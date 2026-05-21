/**
 * Pure utility functions for the TimeOffsetControl component.
 * Extracted for testability — none of these functions touch stores or UI state.
 */

export const MIN_OFFSET_SECONDS = -3600;
export const MAX_OFFSET_SECONDS =  3600;

/**
 * Clamp a numeric value to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Apply a delta (nudge) to a current offset value, clamping to the allowed range.
 */
export function nudgeOffset(current: number, delta: number): number {
	return clamp(current + delta, MIN_OFFSET_SECONDS, MAX_OFFSET_SECONDS);
}

/**
 * Parse a raw number input and round to the nearest second.
 * Returns null when the input is NaN (e.g. empty text field).
 * Result is clamped to the allowed range.
 */
export function parseOffset(raw: number): number | null {
	if (isNaN(raw)) return null;
	return clamp(Math.round(raw), MIN_OFFSET_SECONDS, MAX_OFFSET_SECONDS);
}
