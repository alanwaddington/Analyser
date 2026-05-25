import { env } from '$env/dynamic/private';
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Returns the Upstash Redis singleton.
 * Credentials are read from $env/dynamic/private at runtime (populated from
 * process.env, which includes .env.local values in the SvelteKit dev server).
 * Throws if credentials are not configured — callers catch and return 500.
 */
export function getRedis(): Redis {
	if (_redis !== null) return _redis;
	const url   = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		throw new Error(
			'Upstash Redis credentials not configured. ' +
			'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your Vercel project settings ' +
			'(or in .env.local for local development).',
		);
	}
	_redis = new Redis({ url, token });
	return _redis;
}
