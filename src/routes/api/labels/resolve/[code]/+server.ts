import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getRedis } from '$lib/server/redis.ts';

/** Short sync code: 3 uppercase alphanumeric chars, dash, 5 uppercase alphanumeric chars. */
const SHORT_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{5}$/i;

/**
 * GET /api/labels/resolve/[code]
 * Resolves a short sync code to its full UUID, or 404 if the code is unknown or expired.
 */
export const GET: RequestHandler = async ({ params }) => {
	const { code } = params;

	if (!SHORT_CODE_REGEX.test(code)) {
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
