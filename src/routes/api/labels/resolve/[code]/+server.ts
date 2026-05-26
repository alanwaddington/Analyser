import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getRedis } from '$lib/server/redis';
import { SHORT_CODE_REGEX } from '$lib/validation';

// ---------------------------------------------------------------------------
// In-memory rate limiter
// Note: in-process state is not shared across serverless function instances.
// This provides per-instance protection — sufficient to deter casual enumeration
// attempts, but not a substitute for infrastructure-level rate limiting at scale.
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS  = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQ    = 10;     // max requests per IP per window

const _rateMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const entry = _rateMap.get(ip);
	if (!entry || now > entry.resetAt) {
		_rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}
	if (entry.count >= RATE_LIMIT_MAX_REQ) return true;
	entry.count++;
	return false;
}

/**
 * GET /api/labels/resolve/[code]
 * Resolves a short sync code to its full UUID, or 404 if the code is unknown or expired.
 * Rate-limited to 10 requests per minute per IP to deter code enumeration.
 */
export const GET: RequestHandler = async ({ params, getClientAddress }) => {
	const { code } = params;

	if (isRateLimited(getClientAddress())) {
		return json(
			{ error: 'Too many requests — please wait before trying again' },
			{
				status: 429,
				headers: { 'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) },
			},
		);
	}

	if (!code || !SHORT_CODE_REGEX.test(code)) {
		return json({ error: 'Invalid sync code format — expected XXX-XXXXX (8 alphanumeric chars with dash)' }, { status: 400 });
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
