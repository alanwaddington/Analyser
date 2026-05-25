import { Redis } from '@upstash/redis';
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } from '$env/dynamic/private';

let _redis: Redis | null = null;

/**
 * Returns the Upstash Redis singleton.
 * Throws if credentials are not configured — callers must handle this.
 */
export function getRedis(): Redis {
	if (_redis !== null) return _redis;
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
		throw new Error('Upstash Redis credentials not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)');
	}
	_redis = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
	return _redis;
}
