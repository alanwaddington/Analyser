import type { Activity, ActivityRecord, ChannelKey } from '$lib/types';

export interface SeriesInput {
	activity: Activity;
	colourIndex: number;
	colour?: string;      // explicit colour override; if set, takes precedence over colourIndex lookup
	label?: string;       // optional override for the series name in chart legend
	timeOffset?: number;  // seconds to add to x-axis values in time mode (cross-file alignment)
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

/**
 * Returns the effective x-axis mode for a chart.
 * When forceDistanceAxis is true, always returns 'distance' regardless of the
 * global xAxisMode store value (used by strip charts that always use distance).
 */
export function effectiveAxisMode(
	storeMode: 'time' | 'distance',
	forceDistanceAxis?: boolean,
): 'time' | 'distance' {
	return forceDistanceAxis ? 'distance' : storeMode;
}

export function paceFormat(decimalMinutes: number): string {
	const totalSeconds = Math.round(decimalMinutes * 60);
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
