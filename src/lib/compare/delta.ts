import type { Activity, TimeDelta } from '../types';

// Compute cumulative time delta between a candidate activity and a reference,
// aligned on a shared distance axis. Positive = candidate is ahead.
export function computeTimeDelta(reference: Activity, candidate: Activity, stepMetres = 10): TimeDelta[] {
	const maxDist = Math.min(reference.totalDistance, candidate.totalDistance);
	const steps = Math.floor(maxDist / stepMetres);
	const result: TimeDelta[] = [];

	for (let i = 1; i <= steps; i++) {
		const dist = i * stepMetres;
		const refTime = timeAtDistance(reference, dist);
		const candTime = timeAtDistance(candidate, dist);
		if (refTime == null || candTime == null) continue;
		result.push({ distance: dist, cumulativeDeltaSeconds: refTime - candTime });
	}

	return result;
}

function timeAtDistance(activity: Activity, targetDist: number): number | null {
	const records = activity.records;
	let lo = 0;
	let hi = records.length - 1;

	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (records[mid].distance < targetDist) lo = mid + 1;
		else hi = mid;
	}

	if (lo === 0) return records[0].elapsedSeconds;

	const a = records[lo - 1];
	const b = records[lo];
	if (b.distance === a.distance) return a.elapsedSeconds;
	const t = (targetDist - a.distance) / (b.distance - a.distance);
	return a.elapsedSeconds + t * (b.elapsedSeconds - a.elapsedSeconds);
}
