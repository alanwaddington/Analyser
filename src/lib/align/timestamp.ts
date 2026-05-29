import type { Activity } from '$lib/types';
import { findAnchor } from './anchor';

/** Activities are considered from different sessions when they start more than this apart. */
const OVERLAP_THRESHOLD_SECONDS = 3600; // 1 hour

/**
 * Compute per-file time offsets (in seconds) relative to the first activity.
 *
 * The first activity is the reference (offset = 0). Every other activity gets
 * offset = (activity.startTime − reference.startTime) / 1000.
 *
 * Returns a Map<activityId, offsetSeconds>.
 */
export function computeTimeOffsets(activities: Activity[]): Map<string, number> {
	const offsets = new Map<string, number>();
	if (activities.length === 0) return offsets;

	const referenceTime = activities[0].startTime.getTime();
	for (const activity of activities) {
		const offset = (activity.startTime.getTime() - referenceTime) / 1000;
		offsets.set(activity.id, offset);
	}
	return offsets;
}

/**
 * Compute per-file time offsets (in seconds) relative to the first activity's
 * alignment anchor. Uses the anchor hierarchy: timer event → GPS movement →
 * GPS fix → file start. Falls back to raw startTime when no GPS is available.
 *
 * Returns a Map<activityId, offsetSeconds>.
 */
export function computeAnchoredOffsets(activities: Activity[]): Map<string, number> {
	const offsets = new Map<string, number>();
	if (activities.length === 0) return offsets;

	const referenceAnchor = findAnchor(activities[0]);
	const referenceMs = referenceAnchor.timestamp.getTime();

	for (const activity of activities) {
		const anchor = findAnchor(activity);
		const offsetSeconds = (referenceMs - anchor.timestamp.getTime()) / 1000;
		offsets.set(activity.id, offsetSeconds);
	}
	return offsets;
}

/**
 * Returns true when all activities appear to be from the same session —
 * i.e. no two start times are more than OVERLAP_THRESHOLD_SECONDS apart.
 * Returns true for empty or single-activity arrays.
 */
export function activitiesOverlap(activities: Activity[]): boolean {
	if (activities.length <= 1) return true;

	const times = activities.map(a => a.startTime.getTime());
	const earliest = Math.min(...times);
	const latest = Math.max(...times);
	return (latest - earliest) / 1000 < OVERLAP_THRESHOLD_SECONDS;
}
