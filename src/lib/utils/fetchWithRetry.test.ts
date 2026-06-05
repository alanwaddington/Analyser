import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { fetchWithRetry, isRetryable, computeDelay } from './fetchWithRetry.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true });
	mockFetch.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

function ok200(): Response {
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
}

function response(status: number, headers: Record<string, string> = {}): Response {
	return new Response('{}', { status, headers });
}

function networkError(): TypeError {
	return new TypeError('Failed to fetch');
}

/** Advance all pending timers and flush microtasks, repeatedly, to let retries complete. */
async function flushRetries(times = 4): Promise<void> {
	for (let i = 0; i < times; i++) {
		await vi.runAllTimersAsync();
	}
}

// ---------------------------------------------------------------------------
// isRetryable
// ---------------------------------------------------------------------------

describe('isRetryable', () => {
	it('isRetryable_networkError_returnsTrue', () => {
		expect(isRetryable(networkError())).toBe(true);
	});

	it('isRetryable_500Response_returnsTrue', () => {
		expect(isRetryable(response(500))).toBe(true);
	});

	it('isRetryable_503Response_returnsTrue', () => {
		expect(isRetryable(response(503))).toBe(true);
	});

	it('isRetryable_429Response_returnsTrue', () => {
		expect(isRetryable(response(429))).toBe(true);
	});

	it('isRetryable_400Response_returnsFalse', () => {
		expect(isRetryable(response(400))).toBe(false);
	});

	it('isRetryable_404Response_returnsFalse', () => {
		expect(isRetryable(response(404))).toBe(false);
	});

	it('isRetryable_200Response_returnsFalse', () => {
		expect(isRetryable(response(200))).toBe(false);
	});

	it('isRetryable_201Response_returnsFalse', () => {
		expect(isRetryable(response(201))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// computeDelay
// ---------------------------------------------------------------------------

describe('computeDelay', () => {
	it('computeDelay_attempt0_returnsBaseWithJitter', () => {
		// base=1000, jitter=0.25 → delay ∈ [750, 1250]
		const delay = computeDelay(0, 1000, 0.25);
		expect(delay).toBeGreaterThanOrEqual(750);
		expect(delay).toBeLessThanOrEqual(1250);
	});

	it('computeDelay_attempt1_returnsDoubledWithJitter', () => {
		// base=1000 * 2^1 = 2000, jitter=0.25 → delay ∈ [1500, 2500]
		const delay = computeDelay(1, 1000, 0.25);
		expect(delay).toBeGreaterThanOrEqual(1500);
		expect(delay).toBeLessThanOrEqual(2500);
	});

	it('computeDelay_attempt2_returnsQuadrupledWithJitter', () => {
		// base=1000 * 2^2 = 4000, jitter=0.25 → delay ∈ [3000, 5000]
		const delay = computeDelay(2, 1000, 0.25);
		expect(delay).toBeGreaterThanOrEqual(3000);
		expect(delay).toBeLessThanOrEqual(5000);
	});

	it('computeDelay_withRetryAfter_overridesExponential', () => {
		// retryAfterSeconds=30 → delay ∈ [22500, 37500] (30000 ± 25%)
		const delay = computeDelay(0, 1000, 0.25, 30);
		expect(delay).toBeGreaterThanOrEqual(22500);
		expect(delay).toBeLessThanOrEqual(37500);
	});

	it('computeDelay_zeroJitter_returnsExactBase', () => {
		expect(computeDelay(0, 1000, 0)).toBe(1000);
		expect(computeDelay(1, 1000, 0)).toBe(2000);
		expect(computeDelay(2, 1000, 0)).toBe(4000);
	});
});

// ---------------------------------------------------------------------------
// fetchWithRetry — success on first attempt
// ---------------------------------------------------------------------------

describe('fetchWithRetry — immediate success', () => {
	it('fetchWithRetry_200Response_returnsImmediately', async () => {
		mockFetch.mockResolvedValueOnce(ok200());

		const result = await fetchWithRetry('/api/test');

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('fetchWithRetry_passesInputAndInitToFetch', async () => {
		mockFetch.mockResolvedValueOnce(ok200());
		const init: RequestInit = { method: 'PUT', body: '{}' };

		await fetchWithRetry('/api/test', init);

		expect(mockFetch).toHaveBeenCalledWith('/api/test', init);
	});
});

// ---------------------------------------------------------------------------
// fetchWithRetry — retry on transient errors
// ---------------------------------------------------------------------------

describe('fetchWithRetry — retry on transient errors', () => {
	it('fetchWithRetry_networkErrorThenSuccess_retriesAndReturns200', async () => {
		mockFetch
			.mockRejectedValueOnce(networkError())
			.mockResolvedValueOnce(ok200());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });
		await flushRetries();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('fetchWithRetry_500ThenSuccess_retriesAndReturns200', async () => {
		mockFetch
			.mockResolvedValueOnce(response(500))
			.mockResolvedValueOnce(ok200());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });
		await flushRetries();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('fetchWithRetry_429ThenSuccess_retriesAndReturns200', async () => {
		mockFetch
			.mockResolvedValueOnce(response(429))
			.mockResolvedValueOnce(ok200());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });
		await flushRetries();
		const result = await promise;

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('fetchWithRetry_429WithRetryAfterHeader_usesHeaderDelay', async () => {
		mockFetch
			.mockResolvedValueOnce(response(429, { 'Retry-After': '30' }))
			.mockResolvedValueOnce(ok200());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });

		// Advance by 29.5 seconds — should not have retried yet
		await vi.advanceTimersByTimeAsync(29_500);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Advance past 30 seconds — retry fires
		await vi.advanceTimersByTimeAsync(1000);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('fetchWithRetry_429WithoutRetryAfter_usesExponentialDelay', async () => {
		mockFetch
			.mockResolvedValueOnce(response(429))
			.mockResolvedValueOnce(ok200());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 1000, jitter: 0 });

		// Advance by 999ms — should not have retried yet
		await vi.advanceTimersByTimeAsync(999);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Advance past 1000ms — retry fires
		await vi.advanceTimersByTimeAsync(10);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});

// ---------------------------------------------------------------------------
// fetchWithRetry — no retry on non-transient errors
// ---------------------------------------------------------------------------

describe('fetchWithRetry — no retry on non-transient errors', () => {
	it('fetchWithRetry_400Response_doesNotRetry', async () => {
		mockFetch.mockResolvedValueOnce(response(400));

		const result = await fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });

		expect(result.status).toBe(400);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('fetchWithRetry_404Response_doesNotRetry', async () => {
		mockFetch.mockResolvedValueOnce(response(404));

		const result = await fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });

		expect(result.status).toBe(404);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('fetchWithRetry_401Response_doesNotRetry', async () => {
		mockFetch.mockResolvedValueOnce(response(401));

		const result = await fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });

		expect(result.status).toBe(401);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// fetchWithRetry — all retries exhausted
// ---------------------------------------------------------------------------

describe('fetchWithRetry — retries exhausted', () => {
	it('fetchWithRetry_allRetriesExhausted_httpError_returnsLastResponse', async () => {
		mockFetch.mockResolvedValue(response(500));

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });
		await flushRetries(10);
		const result = await promise;

		expect(result.status).toBe(500);
		// 1 initial + 3 retries = 4 calls
		expect(mockFetch).toHaveBeenCalledTimes(4);
	});

	it('fetchWithRetry_allRetriesExhausted_networkError_throws', async () => {
		mockFetch.mockRejectedValue(networkError());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });
		// Attach rejection handler before flushing timers to avoid unhandled rejection
		const assertion = expect(promise).rejects.toThrow('Failed to fetch');
		await flushRetries(10);
		await assertion;

		expect(mockFetch).toHaveBeenCalledTimes(4);
	});

	it('fetchWithRetry_maxRetries0_doesNotRetry', async () => {
		mockFetch.mockResolvedValue(response(500));

		const result = await fetchWithRetry('/api/test', undefined, { maxRetries: 0, baseDelayMs: 100, jitter: 0 });

		expect(result.status).toBe(500);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('fetchWithRetry_threeSuccessiveFailuresThenSuccess_uses4Calls', async () => {
		mockFetch
			.mockResolvedValueOnce(response(503))
			.mockResolvedValueOnce(response(503))
			.mockResolvedValueOnce(response(503))
			.mockResolvedValueOnce(ok200());

		const promise = fetchWithRetry('/api/test', undefined, { maxRetries: 3, baseDelayMs: 100, jitter: 0 });
		await flushRetries(10);
		const result = await promise;

		expect(result.status).toBe(200);
		expect(mockFetch).toHaveBeenCalledTimes(4);
	});
});
