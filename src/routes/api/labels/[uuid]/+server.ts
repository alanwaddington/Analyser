import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getRedis } from '$lib/server/redis.ts';
import { UUID_REGEX, SHORT_CODE_REGEX } from '$lib/validation.ts';

const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function isLabelsBody(body: unknown): body is { labels: Record<string, string>; shortCode: string } {
	if (typeof body !== 'object' || body === null) return false;
	const b = body as Record<string, unknown>;
	if (typeof b.shortCode !== 'string' || !SHORT_CODE_REGEX.test(b.shortCode)) return false;
	if (typeof b.labels !== 'object' || b.labels === null || Array.isArray(b.labels)) return false;
	return Object.values(b.labels as object).every((v) => typeof v === 'string');
}

/**
 * GET /api/labels/[uuid]
 * Returns the stored label map for this sync identity, or 404 if not found.
 */
export const GET: RequestHandler = async ({ params }) => {
	const { uuid } = params;

	if (!UUID_REGEX.test(uuid)) {
		return json({ error: 'Invalid UUID format' }, { status: 400 });
	}

	try {
		const redis = getRedis();
		const labels = await redis.get<Record<string, string>>(`labels:${uuid}`);
		if (labels === null) {
			return json({ error: 'Not found' }, { status: 404 });
		}
		return json({ labels });
	} catch (err) {
		console.error('GET /api/labels/[uuid] error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * PUT /api/labels/[uuid]
 * Stores/overwrites the label map for this sync identity with a 90-day rolling TTL.
 * Also refreshes the TTL on the code:{shortCode} → uuid mapping.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	const { uuid } = params;

	if (!UUID_REGEX.test(uuid)) {
		return json({ error: 'Invalid UUID format' }, { status: 400 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!isLabelsBody(body)) {
		return json(
			{ error: 'Body must contain a labels object (string → string) and a shortCode string (XXX-XXXXX)' },
			{ status: 400 },
		);
	}

	const { labels, shortCode } = body;

	try {
		const redis = getRedis();
		// Store label map with rolling TTL
		await redis.set(`labels:${uuid}`, labels, { ex: TTL_SECONDS });
		// Refresh code index TTL alongside the labels entry
		await redis.set(`code:${shortCode}`, uuid, { ex: TTL_SECONDS });
		return json({ ok: true });
	} catch (err) {
		console.error('PUT /api/labels/[uuid] error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
