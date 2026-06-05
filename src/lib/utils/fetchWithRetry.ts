export interface RetryOptions {
	maxRetries?: number;
	baseDelayMs?: number;
	jitter?: number;
}

/** Returns true if the error or response status indicates a transient failure worth retrying. */
export function isRetryable(errorOrResponse: Error | Response): boolean {
	if (errorOrResponse instanceof Response) {
		return errorOrResponse.status === 429 || errorOrResponse.status >= 500;
	}
	// Network error (TypeError from fetch)
	return true;
}

/**
 * Computes the backoff delay in ms for a given retry attempt.
 * Uses exponential backoff (baseDelayMs * 2^attempt) with ±jitter fraction.
 * If retryAfterSeconds is provided (from a 429 Retry-After header), it overrides the exponential base.
 */
export function computeDelay(
	attempt: number,
	baseDelayMs: number,
	jitter: number,
	retryAfterSeconds?: number,
): number {
	const base = retryAfterSeconds !== undefined
		? retryAfterSeconds * 1000
		: baseDelayMs * Math.pow(2, attempt);
	const spread = base * jitter;
	return base - spread + Math.random() * spread * 2;
}

/**
 * Fetch with automatic retry for transient errors.
 *
 * - Retries on: network errors (TypeError), 5xx, 429
 * - Does not retry on: 4xx (except 429), 2xx/3xx
 * - 429 with Retry-After header: uses header value as the backoff delay
 * - After all retries exhausted: returns the last Response (HTTP errors) or throws (network errors)
 */
export async function fetchWithRetry(
	input: RequestInfo | URL,
	init?: RequestInit,
	opts?: RetryOptions,
): Promise<Response> {
	const maxRetries = opts?.maxRetries ?? 3;
	const baseDelayMs = opts?.baseDelayMs ?? 1000;
	const jitter = opts?.jitter ?? 0.25;

	let lastError: Error | null = null;
	let lastResponse: Response | null = null;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(input, init);

			if (!isRetryable(response) || attempt === maxRetries) {
				return response;
			}

			lastResponse = response;
			const retryAfterHeader = response.headers.get('Retry-After');
			const retryAfterSeconds = retryAfterHeader !== null ? parseFloat(retryAfterHeader) : undefined;
			const validRetryAfter = retryAfterSeconds !== undefined && !isNaN(retryAfterSeconds)
				? retryAfterSeconds
				: undefined;

			const delay = computeDelay(attempt, baseDelayMs, jitter, validRetryAfter);
			await new Promise<void>((resolve) => setTimeout(resolve, delay));
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));

			if (attempt === maxRetries) {
				throw lastError;
			}

			const delay = computeDelay(attempt, baseDelayMs, jitter);
			await new Promise<void>((resolve) => setTimeout(resolve, delay));
		}
	}

	// Unreachable, but satisfies TypeScript
	if (lastError) throw lastError;
	return lastResponse!;
}
