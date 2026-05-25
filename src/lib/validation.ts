/**
 * Shared validation constants for sync identity format.
 * Used by both server-side API routes and client-side components.
 */

/** Standard UUID v4 format: 8-4-4-4-12 hex chars. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Short sync code: 3 uppercase alphanumeric chars, dash, 5 uppercase alphanumeric chars. */
export const SHORT_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{5}$/i;
