import type { Activity, ActivityRecord } from '../types';

export type ChannelKey = keyof Omit<ActivityRecord, 'timestamp' | 'distance' | 'elapsedSeconds' | 'position'>;

export interface DistanceAligned {
	axis: number[]; // distance in metres, evenly spaced
	channels: Map<ChannelKey, (number | null)[]>;
}

export function interpolateToDistanceAxis(
	activity: Activity,
	stepMetres = 10
): DistanceAligned {
	const records = activity.records;
	if (records.length === 0) return { axis: [], channels: new Map() };

	const maxDist = records.at(-1)!.distance;
	const steps = Math.ceil(maxDist / stepMetres);
	const axis = Array.from({ length: steps + 1 }, (_, i) => i * stepMetres);

	const channelKeys: ChannelKey[] = [
		'speed', 'pace', 'heartRate', 'power', 'powerLeft', 'powerRight',
		'cadence', 'altitude', 'temperature', 'coreTemperature',
		'skinTemperature', 'verticalOscillation', 'groundContactTime', 'strideLength'
	];

	const channels = new Map<ChannelKey, (number | null)[]>();

	for (const key of channelKeys) {
		channels.set(key, axis.map((d) => lerp(records, d, key)));
	}

	return { axis, channels };
}

function lerp(records: ActivityRecord[], targetDist: number, key: ChannelKey): number | null {
	let lo = 0;
	let hi = records.length - 1;

	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (records[mid].distance < targetDist) lo = mid + 1;
		else hi = mid;
	}

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
