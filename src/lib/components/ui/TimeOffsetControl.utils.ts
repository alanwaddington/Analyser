/**
 * Pure utility functions and constants for the TimeOffsetControl component.
 * Extracted for testability — none of these touch stores or UI state.
 */

import type { AnchorSource } from '$lib/types';

/** Short label shown inside the anchor badge pill. */
export const ANCHOR_LABELS: Record<AnchorSource, string> = {
	timer:          'Timer',
	gpsMovement:    'GPS move',
	gpsFix:         'GPS fix',
	fileStart:      'File start',
	workoutStep:    'Workout',
	indoorMovement: 'Indoor',
};

/** Tooltip text shown on hover of the anchor badge. */
export const ANCHOR_TITLES: Record<AnchorSource, string> = {
	timer:          'Aligned by FIT timer start event',
	gpsMovement:    'Aligned by first GPS movement',
	gpsFix:         'Aligned by first GPS fix (stationary)',
	fileStart:      'No GPS — aligned by file start time',
	workoutStep:    'Aligned by first workout step',
	indoorMovement: 'Aligned by first indoor movement (speed/power/cadence)',
};

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
