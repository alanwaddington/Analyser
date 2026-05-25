import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis module before importing the route handler
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('$lib/server/redis.ts', () => ({
	getRedis: vi.fn().mockReturnValue({ get: mockGet, set: mockSet }),
}));

// Import route handlers after mocks are in place
const mod = await import('./+server.ts');
const { GET, PUT } = mod;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RouteParams = { uuid: string };

function makeGetEvent(uuid: string) {
	return {
		params: { uuid } as RouteParams,
		request: new Request(`http://localhost/api/labels/${uuid}`),
	} as Parameters<typeof GET>[0];
}

function makePutEvent(uuid: string, body: unknown) {
	return {
		params: { uuid } as RouteParams,
		request: new Request(`http://localhost/api/labels/${uuid}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}),
	} as Parameters<typeof PUT>[0];
}

const VALID_UUID = 'efbe6aac-3910-4b87-8c03-eeb9ea6f0276';
const VALID_LABELS = { 'ant:9876': 'Polar H10', 'serial:12345': 'Garmin Fenix 7' };
const VALID_SHORT_CODE = 'E6Y-NXEMF';

// ---------------------------------------------------------------------------
// GET /api/labels/[uuid]
// ---------------------------------------------------------------------------

describe('GET /api/labels/[uuid]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('GET_validUuid_existingLabels_returns200WithLabels', async () => {
		mockGet.mockResolvedValueOnce(VALID_LABELS);

		const response = await GET(makeGetEvent(VALID_UUID));

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toEqual({ labels: VALID_LABELS });
		expect(mockGet).toHaveBeenCalledWith(`labels:${VALID_UUID}`);
	});

	it('GET_validUuid_missingLabels_returns404', async () => {
		mockGet.mockResolvedValueOnce(null);

		const response = await GET(makeGetEvent(VALID_UUID));

		expect(response.status).toBe(404);
	});

	it('GET_invalidUuid_nonUuidString_returns400', async () => {
		const response = await GET(makeGetEvent('not-a-uuid'));

		expect(response.status).toBe(400);
		const data = await response.json();
		expect(data.error).toBeDefined();
	});

	it('GET_invalidUuid_emptyString_returns400', async () => {
		const response = await GET(makeGetEvent(''));

		expect(response.status).toBe(400);
	});

	it('GET_redisError_returns500', async () => {
		mockGet.mockRejectedValueOnce(new Error('Redis unreachable'));

		const response = await GET(makeGetEvent(VALID_UUID));

		expect(response.status).toBe(500);
		const data = await response.json();
		expect(data.error).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// PUT /api/labels/[uuid]
// ---------------------------------------------------------------------------

describe('PUT /api/labels/[uuid]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSet.mockResolvedValue('OK');
	});

	it('PUT_validInput_storesLabelsAndReturns200', async () => {
		const response = await PUT(
			makePutEvent(VALID_UUID, { labels: VALID_LABELS, shortCode: VALID_SHORT_CODE }),
		);

		expect(response.status).toBe(200);
		// Stores labels:{uuid} with 90-day TTL
		expect(mockSet).toHaveBeenCalledWith(
			`labels:${VALID_UUID}`,
			VALID_LABELS,
			{ ex: 90 * 24 * 60 * 60 },
		);
		// Stores code:{shortCode} → uuid with 90-day TTL
		expect(mockSet).toHaveBeenCalledWith(
			`code:${VALID_SHORT_CODE}`,
			VALID_UUID,
			{ ex: 90 * 24 * 60 * 60 },
		);
	});

	it('PUT_emptyLabels_stores200', async () => {
		const response = await PUT(
			makePutEvent(VALID_UUID, { labels: {}, shortCode: VALID_SHORT_CODE }),
		);

		expect(response.status).toBe(200);
	});

	it('PUT_invalidUuid_returns400', async () => {
		const response = await PUT(
			makePutEvent('bad-uuid', { labels: VALID_LABELS, shortCode: VALID_SHORT_CODE }),
		);

		expect(response.status).toBe(400);
	});

	it('PUT_missingLabelsField_returns400', async () => {
		const response = await PUT(
			makePutEvent(VALID_UUID, { shortCode: VALID_SHORT_CODE }),
		);

		expect(response.status).toBe(400);
	});

	it('PUT_missingShortCode_returns400', async () => {
		const response = await PUT(
			makePutEvent(VALID_UUID, { labels: VALID_LABELS }),
		);

		expect(response.status).toBe(400);
	});

	it('PUT_labelsIsArray_returns400', async () => {
		const response = await PUT(
			makePutEvent(VALID_UUID, { labels: [['ant:1', 'HRM']], shortCode: VALID_SHORT_CODE }),
		);

		expect(response.status).toBe(400);
	});

	it('PUT_invalidShortCode_returns400', async () => {
		const response = await PUT(
			makePutEvent(VALID_UUID, { labels: VALID_LABELS, shortCode: 'bad' }),
		);

		expect(response.status).toBe(400);
	});

	it('PUT_invalidJsonBody_returns400', async () => {
		const event = {
			params: { uuid: VALID_UUID } as RouteParams,
			request: new Request(`http://localhost/api/labels/${VALID_UUID}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: 'not-json',
			}),
		} as Parameters<typeof PUT>[0];

		const response = await PUT(event);

		expect(response.status).toBe(400);
	});

	it('PUT_redisError_returns500', async () => {
		mockSet.mockRejectedValueOnce(new Error('Redis unreachable'));

		const response = await PUT(
			makePutEvent(VALID_UUID, { labels: VALID_LABELS, shortCode: VALID_SHORT_CODE }),
		);

		expect(response.status).toBe(500);
	});
});
