import type { Activity, Record, ChannelKey } from '$lib/types';

export interface SeriesInput {
	activity: Activity;
	colourIndex: number;
}

export function extractChannel(records: Record[], channel: ChannelKey): (number | null)[] {
	return records.map(r => (r[channel] as number | undefined) ?? null);
}

export function buildXValues(records: Record[], mode: 'time' | 'distance'): number[] {
	if (mode === 'time') return records.map(r => r.elapsedSeconds);
	return records.map(r => r.distance / 1000);
}

export function isDashed(seriesIndex: number, referenceIndex: number | undefined): boolean {
	if (referenceIndex === undefined) return seriesIndex !== 0;
	return seriesIndex === referenceIndex;
}
