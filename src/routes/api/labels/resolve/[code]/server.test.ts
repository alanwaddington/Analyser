import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing the route handler.
// The rate limiter now uses Redis incr/expire/ttl; the code lookup uses get.
const mockGet    = vi.fn();
const mockIncr   = vi.fn();
const mockExpire = vi.fn();
const mockTtl    = vi.fn();

vi.mock('$lib/server/redis.ts', () => ({
	getRedis: vi.fn().mockReturnValue({
		get:    mockGet,
		incr:   mockIncr,
		expire: mockExpire,
		ttl:    mockTtl,
	}),
}));

const mod = await import('./+server.ts');
const { GET } = mod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RouteParams = { code: string };

function makeEvent(code: string, ip = '127.0.0.1') {
	return {
		params: { code } as RouteParams,
		request: new Request(`http://localhost/api/labels/resolve/${code}`),
		getClientAddress: () => ip,
	} as Parameters<typeof GET>[0];
}

const VALID_CODE = 'E6Y-NXEMF';
const VALID_UUID = 'efbe6aac-3910-4b87-8c03-eeb9ea6f0276';

/** Set the rate limiter mock to allow the request (count ≤ 10). */
function allowRequest(count = 1): void {
	mockIncr.mockResolvedValueOnce(count);
	if (count === 1) mockExpire.mockResolvedValueOnce(1);
}

// ---------------------------------------------------------------------------
// GET /api/labels/resolve/[code]
// ---------------------------------------------------------------------------

describe('GET /api/labels/resolve/[code]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET_validCode_existingEntry_returns200WithUuid', async () => {
		allowRequest();
		mockGet.mockResolvedValueOnce(VALID_UUID);

		const response = await GET(makeEvent(VALID_CODE));

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual({ uuid: VALID_UUID });
		expect(mockGet).toHaveBeenCalledWith(`code:${VALID_CODE}`);
	});

	it('GET_validCode_missingEntry_returns404', async () => {
		allowRequest();
		mockGet.mockResolvedValueOnce(null);

		const response = await GET(makeEvent(VALID_CODE));

		expect(response.status).toBe(404);
	});

	it('GET_invalidCode_tooShort_returns400', async () => {
		const response = await GET(makeEvent('AB-1'));

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toBeDefined();
	});

	it('GET_invalidCode_noDash_returns400', async () => {
		const response = await GET(makeEvent('ABCDEFGH'));

		expect(response.status).toBe(400);
	});

	it('GET_invalidCode_specialChars_returns400', async () => {
		const response = await GET(makeEvent('AB!-12345'));

		expect(response.status).toBe(400);
	});

	it('GET_invalidCode_emptyString_returns400', async () => {
		const response = await GET(makeEvent(''));

		expect(response.status).toBe(400);
	});

	it('GET_redisError_returns500', async () => {
		allowRequest();
		mockGet.mockRejectedValueOnce(new Error('Redis unreachable'));

		const response = await GET(makeEvent(VALID_CODE));

		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Rate limiting — Redis INCR/EXPIRE/TTL based
// ---------------------------------------------------------------------------

describe('GET /api/labels/resolve/[code] — rate limiting', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGet.mockResolvedValue(VALID_UUID);
	});

	it('GET_firstRequest_incrsRedisKey', async () => {
		mockIncr.mockResolvedValueOnce(1);
		mockExpire.mockResolvedValueOnce(1);

		await GET(makeEvent(VALID_CODE, '10.0.0.1'));

		expect(mockIncr).toHaveBeenCalledWith('ratelimit:resolve:10.0.0.1');
	});

	it('GET_firstRequest_setsExpire', async () => {
		mockIncr.mockResolvedValueOnce(1);
		mockExpire.mockResolvedValueOnce(1);

		await GET(makeEvent(VALID_CODE, '10.0.0.2'));

		expect(mockExpire).toHaveBeenCalledWith('ratelimit:resolve:10.0.0.2', 60);
	});

	it('GET_subsequentRequest_doesNotSetExpire', async () => {
		mockIncr.mockResolvedValueOnce(5); // not the first request

		await GET(makeEvent(VALID_CODE, '10.0.0.3'));

		expect(mockExpire).not.toHaveBeenCalled();
	});

	it('GET_underLimit_returns200', async () => {
		mockIncr.mockResolvedValueOnce(10); // exactly at limit
		mockGet.mockResolvedValueOnce(VALID_UUID);

		const response = await GET(makeEvent(VALID_CODE, '10.0.0.4'));

		expect(response.status).toBe(200);
	});

	it('GET_overLimit_returns429WithRetryAfter', async () => {
		mockIncr.mockResolvedValueOnce(11); // over limit
		mockTtl.mockResolvedValueOnce(45);  // 45 seconds remaining

		const response = await GET(makeEvent(VALID_CODE, '10.0.0.5'));

		expect(response.status).toBe(429);
		const data = await response.json();
		expect(data.error).toMatch(/too many requests/i);
		expect(response.headers.get('Retry-After')).toBe('45');
	});

	it('GET_rateLimitExceeded_retryAfterMatchesTtl', async () => {
		mockIncr.mockResolvedValueOnce(15);
		mockTtl.mockResolvedValueOnce(30);

		const response = await GET(makeEvent(VALID_CODE, '10.0.0.6'));

		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('30');
	});

	it('GET_differentIps_haveIndependentKeys', async () => {
		const ip1 = '10.1.1.1';
		const ip2 = '10.1.1.2';

		mockIncr
			.mockResolvedValueOnce(11) // ip1 over limit
			.mockResolvedValueOnce(1);  // ip2 under limit
		mockTtl.mockResolvedValueOnce(60);
		mockExpire.mockResolvedValueOnce(1);
		mockGet.mockResolvedValueOnce(VALID_UUID);

		const response1 = await GET(makeEvent(VALID_CODE, ip1));
		const response2 = await GET(makeEvent(VALID_CODE, ip2));

		expect(response1.status).toBe(429);
		expect(response2.status).toBe(200);
		expect(mockIncr).toHaveBeenCalledWith(`ratelimit:resolve:${ip1}`);
		expect(mockIncr).toHaveBeenCalledWith(`ratelimit:resolve:${ip2}`);
	});

	it('GET_redisRateLimitError_failsOpen', async () => {
		mockIncr.mockRejectedValueOnce(new Error('Redis unreachable'));
		mockGet.mockResolvedValueOnce(VALID_UUID);

		// Should proceed with the request (fail-open)
		const response = await GET(makeEvent(VALID_CODE, '10.0.0.7'));

		expect(response.status).toBe(200);
	});
});
