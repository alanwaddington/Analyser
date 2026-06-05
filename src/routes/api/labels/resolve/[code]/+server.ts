import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getRedis } from '$lib/server/redis';
import { SHORT_CODE_REGEX } from '$lib/validation';

const RATE_LIMIT_WINDOW_S = 60;
const RATE_LIMIT_MAX_REQ  = 10;

async function isRateLimited(ip: string): Promise<{ limited: boolean; retryAfter: number }> {
	try {
		const redis = getRedis();
		const key = `ratelimit:resolve:${ip}`;
		const count = await redis.incr(key);
		if (count === 1) {
			// First request in this window — set the expiry
			await redis.expire(key, RATE_LIMIT_WINDOW_S);
		}
		if (count > RATE_LIMIT_MAX_REQ) {
			const ttl = await redis.ttl(key);
			return { limited: true, retryAfter: Math.max(ttl, 1) };
		}
		return { limited: false, retryAfter: 0 };
	} catch {
		// Fail-open: if Redis is unavailable, allow the request through
		return { limited: false, retryAfter: 0 };
	}
}

/**
 * GET /api/labels/resolve/[code]
 * Resolves a short sync code to its full UUID, or 404 if the code is unknown or expired.
 * Rate-limited to 10 requests per minute per IP (enforced globally via Redis).
 */
export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const { code } = params;

	if (!code || !SHORT_CODE_REGEX.test(code)) {
		return json({ error: 'Invalid sync code format — expected XXX-XXXXX (8 alphanumeric chars with dash)' }, { status: 400 });
	}

	const { limited, retryAfter } = await isRateLimited(getClientAddress());
	if (limited) {
		return json(
			{ error: 'Too many requests — please wait before trying again' },
			{
				status: 429,
				headers: { 'Retry-After': String(retryAfter) },
			},
		);
	}

	try {
		const redis = getRedis();
		const uuid = await redis.get<string>(`code:${code}`);
		if (uuid === null) {
			return json({ error: 'Sync code not found or expired' }, { status: 404 });
		}
		return json({ uuid });
	} catch (err) {
		console.error('GET /api/labels/resolve/[code] error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
