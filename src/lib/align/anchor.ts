import type { Activity, AlignmentAnchor, ActivityRecord } from '$lib/types';

export const GPS_PROXIMITY_THRESHOLD_M = 50;

/** Timer events more than this many milliseconds from any record are ignored. */
const TIMER_TOLERANCE_MS = 30_000;

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two GPS points in metres (Haversine formula). */
export function haversineDistance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const sinDLat = Math.sin(dLat / 2);
	const sinDLon = Math.sin(dLon / 2);
	const haversine =
		sinDLat * sinDLat +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine));
}

/**
 * Select the best alignment anchor for an activity.
 *
 * Hierarchy (highest priority first):
 *   1. FIT timer start event — explicit user intent
 *   2. First GPS movement record — GPS fix with speed > 0
 *   3. First GPS fix — GPS acquired but stationary
 *   4. File start (index 0) — no GPS at all
 */
export function findAnchor(activity: Activity): AlignmentAnchor {
	const { records, timerStartTime, firstGpsMovementIndex, firstGpsFixIndex, startTime } = activity;

	// 1. Timer event: find the record closest to timerStartTime, but only if it is
	//    within TIMER_TOLERANCE_MS. A timer event far outside the record timespan
	//    (e.g. from a different session or a clock mismatch) is silently ignored
	//    and the next signal in the hierarchy is used instead.
	if (timerStartTime != null && records.length > 0) {
		const timerMs = timerStartTime.getTime();
		const idx = findClosestRecordIndex(records, timerMs);
		if (idx !== null && Math.abs(records[idx].timestamp.getTime() - timerMs) <= TIMER_TOLERANCE_MS) {
			return anchorFromRecord(records[idx], idx, 'timer');
		}
	}

	// 2. First GPS movement
	if (firstGpsMovementIndex != null) {
		const r = records[firstGpsMovementIndex];
		return anchorFromRecord(r, firstGpsMovementIndex, 'gpsMovement');
	}

	// 3. First GPS fix (stationary)
	if (firstGpsFixIndex != null) {
		const r = records[firstGpsFixIndex];
		return anchorFromRecord(r, firstGpsFixIndex, 'gpsFix');
	}

	// 4. File start fallback — use activity.startTime as the anchor timestamp
	return {
		recordIndex: 0,
		distanceMetres: records[0]?.distance ?? 0,
		elapsedSeconds: records[0]?.elapsedSeconds ?? 0,
		timestamp: startTime,
		source: 'fileStart',
	};
}

/**
 * Returns true when GPS anchors from two or more loaded activities are more than
 * GPS_PROXIMITY_THRESHOLD_M apart — indicating the files may be from different
 * locations rather than the same course.
 *
 * Only activities whose anchor has a GPS position (source !== 'fileStart') are
 * compared. Returns false if fewer than two GPS-anchored activities are present.
 */
export function anchorsAreDistant(activities: Activity[]): boolean {
	const gpsAnchored = activities.filter(a => {
		const pos = a.records[a.anchor.recordIndex]?.position;
		return pos != null && a.anchor.source !== 'fileStart';
	});
	if (gpsAnchored.length < 2) return false;

	for (let i = 0; i < gpsAnchored.length - 1; i++) {
		for (let j = i + 1; j < gpsAnchored.length; j++) {
			const posA = gpsAnchored[i].records[gpsAnchored[i].anchor.recordIndex].position!;
			const posB = gpsAnchored[j].records[gpsAnchored[j].anchor.recordIndex].position!;
			if (haversineDistance(posA, posB) > GPS_PROXIMITY_THRESHOLD_M) return true;
		}
	}
	return false;
}

function anchorFromRecord(r: ActivityRecord, index: number, source: AlignmentAnchor['source']): AlignmentAnchor {
	return {
		recordIndex: index,
		distanceMetres: r.distance,
		elapsedSeconds: r.elapsedSeconds,
		timestamp: r.timestamp,
		source,
	};
}

/** Returns the index of the record whose timestamp is closest to targetMs, preferring the first match. */
function findClosestRecordIndex(records: ActivityRecord[], targetMs: number): number | null {
	if (records.length === 0) return null;
	let bestIdx = 0;
	let bestDiff = Math.abs(records[0].timestamp.getTime() - targetMs);
	for (let i = 1; i < records.length; i++) {
		const diff = Math.abs(records[i].timestamp.getTime() - targetMs);
		if (diff < bestDiff) {
			bestDiff = diff;
			bestIdx = i;
		}
	}
	return bestIdx;
}
