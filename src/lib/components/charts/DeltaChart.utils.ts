import type { Activity } from '$lib/types';
import { computeTimeDelta } from '$lib/compare';

export interface DeltaSeriesInput {
	activity: Activity;
	colourIndex: number;
}

export function getClipDistance(activities: Activity[]): number {
	return Math.min(...activities.map(a => a.totalDistance));
}

export function buildZeroLine(maxDist: number, mode: 'time' | 'distance'): [number, number][] {
	const xMax = mode === 'distance' ? maxDist / 1000 : maxDist;
	return [[0, 0], [xMax, 0]];
}

export function buildDeltaData(
	ref: Activity,
	candidate: Activity,
	maxDist: number,
	mode: 'time' | 'distance',
): [number, number][] {
	const deltas = computeTimeDelta(ref, candidate);
	const filtered = deltas.filter(d => d.distance <= maxDist);
	return filtered.map(d => [
		mode === 'distance' ? d.distance / 1000 : d.distance,
		d.cumulativeDeltaSeconds,
	]);
}
