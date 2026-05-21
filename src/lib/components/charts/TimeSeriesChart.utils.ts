import type { Activity, ActivityRecord, ChannelKey } from '$lib/types';

export interface SeriesInput {
	activity: Activity;
	colourIndex: number;
	colour?: string;  // explicit colour override; if set, takes precedence over colourIndex lookup
	label?: string; // optional override for the series name in chart legend
}

export function extractChannel(records: ActivityRecord[], channel: ChannelKey): (number | null)[] {
	return records.map(r => (r[channel] as number | undefined) ?? null);
}

export function buildXValues(records: ActivityRecord[], mode: 'time' | 'distance'): number[] {
	if (mode === 'time') return records.map(r => r.elapsedSeconds);
	return records.map(r => r.distance / 1000);
}

export function isDashed(seriesIndex: number, referenceIndex: number | undefined): boolean {
	if (referenceIndex === undefined) return seriesIndex !== 0;
	return seriesIndex === referenceIndex;
}

export function paceFormat(decimalMinutes: number): string {
	const totalSeconds = Math.round(decimalMinutes * 60);
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
