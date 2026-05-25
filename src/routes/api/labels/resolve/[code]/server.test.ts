import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing the route handler
const mockGet = vi.fn();

vi.mock('$lib/server/redis.ts', () => ({
	getRedis: vi.fn().mockReturnValue({ get: mockGet }),
}));

const mod = await import('./+server.ts');
const { GET } = mod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RouteParams = { code: string };

function makeEvent(code: string) {
	return {
		params: { code } as RouteParams,
		request: new Request(`http://localhost/api/labels/resolve/${code}`),
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
