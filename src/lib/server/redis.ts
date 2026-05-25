import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Returns the Upstash Redis singleton.
 * Credentials are read from process.env at runtime (not at build time), so
 * the server can start without them configured — the error surfaces only when
 * the first sync API request is made.
 * Throws if credentials are not configured — callers catch and return 500.
 */
export function getRedis(): Redis {
	if (_redis !== null) return _redis;
	// process.env is used directly (rather than $env/dynamic/private) so that
	// the build succeeds without the credentials present in the dev environment.
	// In Vercel, these are set as project environment variables.
	const url   = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;
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
