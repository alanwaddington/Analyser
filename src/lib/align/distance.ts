import type { Activity, ActivityRecord } from '../types';
import { lowerBound } from '../utils/binarySearch.ts';

export type ChannelKey = keyof Omit<ActivityRecord, 'timestamp' | 'distance' | 'elapsedSeconds' | 'position'>;

export interface DistanceAligned {
	axis: number[]; // distance in metres, evenly spaced
	channels: Map<ChannelKey, (number | null)[]>;
}

export function interpolateToDistanceAxis(
	activity: Activity,
	stepMetres = 10,
	distanceOffset = 0
): DistanceAligned {
	const records = activity.records;
	if (records.length === 0) return { axis: [], channels: new Map() };

	const rawMaxDist = records.at(-1)!.distance;
	const maxDist = rawMaxDist - distanceOffset;
	if (maxDist <= 0) return { axis: [], channels: new Map() };

	const steps = Math.ceil(maxDist / stepMetres);
	const axis = Array.from({ length: steps + 1 }, (_, i) => i * stepMetres);

	const channelKeys: ChannelKey[] = [
		'speed', 'pace', 'heartRate', 'power', 'formPower', 'powerLeft', 'powerRight',
		'cadence', 'altitude', 'temperature', 'coreTemperature',
		'skinTemperature', 'verticalOscillation', 'groundContactTime', 'strideLength'
	];

	const channels = new Map<ChannelKey, (number | null)[]>();

	for (const key of channelKeys) {
		channels.set(key, axis.map((d) => lerp(records, d + distanceOffset, key)));
	}

	return { axis, channels };
}

function lerp(records: ActivityRecord[], targetDist: number, key: ChannelKey): number | null {
	const lo = Math.min(lowerBound(records, (r) => r.distance, targetDist), records.length - 1);

	if (records[lo].distance === targetDist) return (records[lo][key] as number | undefined) ?? null;
	if (lo === 0) return (records[0][key] as number | undefined) ?? null;

	const a = records[lo - 1];
	const b = records[lo];
	const aVal = a[key] as number | undefined;
	const bVal = b[key] as number | undefined;

	if (aVal == null || bVal == null) return null;

	const span = b.distance - a.distance;
	// Guard: two consecutive records share the same distance (e.g. indoor trainer
	// stopped at end of session). Interpolation would produce Infinity × 0 = NaN.
	if (span === 0) return aVal;
	const t = (targetDist - a.distance) / span;
	return aVal + t * (bVal - aVal);
}

export const LONG_ACTIVITY_THRESHOLD_M = 50_000;
export const STEP_SHORT_M = 10;
export const STEP_LONG_M = 20;

/**
 * Returns the distance-axis interpolation step in metres based on activity length.
 * Long activities (> 50 km) use a 20 m step to halve the interpolated point count;
 * shorter activities use 10 m for finer resolution.
 */
export function distanceStep(totalDistanceMetres: number): number {
	return totalDistanceMetres > LONG_ACTIVITY_THRESHOLD_M ? STEP_LONG_M : STEP_SHORT_M;
}
