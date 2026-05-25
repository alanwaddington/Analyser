import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing the route handler
const mockGet = vi.fn();

vi.mock('$lib/server/redis.ts', () => ({
	getRedis: vi.fn().mockReturnValue({ get: mockGet }),
}));

// Import route handler after mocks are in place.
// vi.resetModules() is used per test group that needs fresh rate-limiter state.
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

// ---------------------------------------------------------------------------
// GET /api/labels/resolve/[code]
// ---------------------------------------------------------------------------

describe('GET /api/labels/resolve/[code]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET_validCode_existingEntry_returns200WithUuid', async () => {
		mockGet.mockResolvedValueOnce(VALID_UUID);

		const response = await GET(makeEvent(VALID_CODE));

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual({ uuid: VALID_UUID });
		expect(mockGet).toHaveBeenCalledWith(`code:${VALID_CODE}`);
	});

	it('GET_validCode_missingEntry_returns404', async () => {
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
		mockGet.mockRejectedValueOnce(new Error('Redis unreachable'));

		const response = await GET(makeEvent(VALID_CODE));

		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// Rate limiting — uses a distinct IP so existing test slots don't interfere
// ---------------------------------------------------------------------------

describe('GET /api/labels/resolve/[code] — rate limiting', () => {
	const RATE_IP = '10.0.0.99';

	beforeEach(() => {
		vi.clearAllMocks();
		mockGet.mockResolvedValue(VALID_UUID);
	});

	it('GET_rateLimitExceeded_returns429WithRetryAfter', async () => {
		// Exhaust the 10-request window
		for (let i = 0; i < 10; i++) {
			const response = await GET(makeEvent(VALID_CODE, RATE_IP));
			expect(response.status).toBe(200);
		}

		// 11th request should be rate-limited
		const response = await GET(makeEvent(VALID_CODE, RATE_IP));

		expect(response.status).toBe(429);
		const data = await response.json();
		expect(data.error).toMatch(/too many requests/i);
		expect(response.headers.get('Retry-After')).not.toBeNull();
	});

	it('GET_differentIps_haveIndependentLimits', async () => {
		const ip1 = '10.1.1.1';
		const ip2 = '10.1.1.2';

		// Exhaust limit for ip1
		for (let i = 0; i < 10; i++) {
			await GET(makeEvent(VALID_CODE, ip1));
		}

		// ip2 should still be under its own limit
		const response = await GET(makeEvent(VALID_CODE, ip2));
		expect(response.status).toBe(200);
	});
});
