import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getRedis } from '$lib/server/redis';
import { UUID_REGEX, SHORT_CODE_REGEX } from '$lib/validation';
import type { CustomSegment } from '$lib/stores/customSegments';

const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function isLabelsBody(body: unknown): body is {
	labels: Record<string, string>;
	shortCode: string;
	segments?: Record<string, CustomSegment[]>;
} {
	if (typeof body !== 'object' || body === null) return false;
	const b = body as Record<string, unknown>;
	if (typeof b.shortCode !== 'string' || !SHORT_CODE_REGEX.test(b.shortCode)) return false;
	if (typeof b.labels !== 'object' || b.labels === null || Array.isArray(b.labels)) return false;
	if (!Object.values(b.labels as object).every((v) => typeof v === 'string')) return false;
	// segments is optional — skip validation if absent
	if (b.segments !== undefined) {
		if (typeof b.segments !== 'object' || b.segments === null || Array.isArray(b.segments)) return false;
	}
	return true;
}

/**
 * GET /api/labels/[uuid]
 * Returns the stored label map (and optional segments) for this sync identity, or 404 if not found.
 */
export const GET: RequestHandler = async ({ params }) => {
	const { uuid } = params;

	if (!uuid || !UUID_REGEX.test(uuid)) {
		return json({ error: 'Invalid UUID format' }, { status: 400 });
	}

	try {
		const redis = getRedis();
		const [labels, segments] = await Promise.all([
			redis.get<Record<string, string>>(`labels:${uuid}`),
			redis.get<Record<string, CustomSegment[]>>(`segments:${uuid}`),
		]);
		if (labels === null) {
			return json({ error: 'Not found' }, { status: 404 });
		}
		const response: { labels: Record<string, string>; segments?: Record<string, CustomSegment[]> } = { labels };
		if (segments !== null) {
			response.segments = segments;
		}
		return json(response);
	} catch (err) {
		console.error('GET /api/labels/[uuid] error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

/**
 * PUT /api/labels/[uuid]
 * Stores/overwrites the label map for this sync identity with a 90-day rolling TTL.
 * Also stores custom segments if provided, and refreshes the TTL on the code index.
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	const { uuid } = params;

	if (!uuid || !UUID_REGEX.test(uuid)) {
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

	const { labels, shortCode, segments } = body;

	try {
		const redis = getRedis();
		const writes: Promise<unknown>[] = [
			// Store label map with rolling TTL
			redis.set(`labels:${uuid}`, labels, { ex: TTL_SECONDS }),
			// Refresh code index TTL alongside the labels entry
			redis.set(`code:${shortCode}`, uuid, { ex: TTL_SECONDS }),
		];
		if (segments !== undefined) {
			writes.push(redis.set(`segments:${uuid}`, segments, { ex: TTL_SECONDS }));
		}
		await Promise.all(writes);
		return json({ ok: true });
	} catch (err) {
		console.error('PUT /api/labels/[uuid] error:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
