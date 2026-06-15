import type { Activity } from '$lib/types';
import { computeTimeDelta } from '$lib/compare';
import { distanceStep } from '$lib/align/distance';

export interface DeltaSeriesInput {
	activity: Activity;
	colourIndex: number;
	distanceOffset?: number;
}

export function getClipDistance(activities: Activity[], distanceOffsets?: Map<string, number>): number {
	return Math.min(...activities.map(a => {
		const offset = distanceOffsets?.get(a.id) ?? 0;
		return a.totalDistance - offset;
	}));
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
	refDistanceOffset = 0,
	candDistanceOffset = 0,
): [number, number][] {
	const deltas = computeTimeDelta(ref, candidate, distanceStep(maxDist), refDistanceOffset, candDistanceOffset);
	const filtered = deltas.filter(d => d.distance <= maxDist);
	return filtered.map(d => [
		mode === 'distance' ? d.distance / 1000 : d.distance,
		d.cumulativeDeltaSeconds,
	]);
}
