import type { Activity, ActivityRecord, ChannelKey, Anomaly } from '$lib/types';
import { CHANNEL_META } from '$lib/types';
import { summarise } from '$lib/analytics/summary';
import { formatPace } from '$lib/utils/formatting';
export { formatPace as paceFormat } from '$lib/utils/formatting';

export interface SeriesInput {
	activity: Activity;
	colourIndex: number;
	colour?: string;          // explicit colour override; if set, takes precedence over colourIndex lookup
	label?: string;           // optional override for the series name in chart legend
	timeOffset?: number;      // seconds to add to x-axis values in time mode (cross-file alignment)
	distanceOffset?: number;  // metres to subtract from distance axis (GPS anchor re-zeroing)
}

export function extractChannel(records: ActivityRecord[], channel: ChannelKey): (number | null)[] {
	return records.map(r => (r[channel] as number | undefined) ?? null);
}

export function buildXValues(records: ActivityRecord[], mode: 'time' | 'distance'): number[] {
	if (mode === 'time') return records.map(r => r.elapsedSeconds);
	// Distance mode: interpolateToDistanceAxis handles re-zeroing via distanceOffset;
	// this path is only reached in time mode (kept for time-axis altitude backdrop).
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

export interface SeriesStats {
	label: string;
	colour: string;
	min: string;
	avg: string;
	max: string;
	minRaw: number;
	avgRaw: number;
	maxRaw: number;
	count: number;
	xMin: number;
	xMax: number;
	unit: string;
}

const INTEGER_CHANNELS = new Set<ChannelKey>([
	'heartRate', 'power', 'powerLeft', 'powerRight', 'cadence',
	'altitude', 'groundContactTime', 'strideLength',
]);

export function formatStatValue(value: number, channel: ChannelKey): string {
	if (channel === 'pace') return formatPace(value);
	if (INTEGER_CHANNELS.has(channel)) return value.toFixed(0);
	return value.toFixed(1);
}

export function computeSeriesStats(
	data: [number, number | null][],
	channel: ChannelKey,
	label: string,
	colour: string,
	xRange?: { min: number; max: number },
): SeriesStats | null {
	const points = xRange
		? data.filter(([x]) => x >= xRange.min && x <= xRange.max)
		: data;
	const yValues = points.map(([, y]) => y);
	const s = summarise(yValues);
	if (!s) return null;
	// Pace is inverted: numerically lower = faster. Swap min/max so that
	// "max" means fastest pace and "min" means slowest, matching the
	// inverted y-axis convention used in the pace chart.
	const statMin = channel === 'pace' ? s.max : s.min;
	const statMax = channel === 'pace' ? s.min : s.max;
	return {
		label,
		colour,
		min: formatStatValue(statMin, channel),
		avg: formatStatValue(s.avg, channel),
		max: formatStatValue(statMax, channel),
		minRaw: statMin,
		avgRaw: s.avg,
		maxRaw: statMax,
		count: yValues.filter((v): v is number => v !== null).length,
		xMin: xRange?.min ?? points[0][0],
		xMax: xRange?.max ?? points[points.length - 1][0],
		unit: CHANNEL_META[channel].unit,
	};
}

/**
 * Returns true when cycling power data exceeds 120% of FTP, indicating Z6/Z7 are
 * in use and the chart should display all 7 Coggan zones instead of clipping at Z5.
 */
export function shouldUseFullFtpZones(data: [number, number | null][], ftp: number): boolean {
	const threshold = ftp * 1.20;
	for (const [, y] of data) {
		if (y != null && y > threshold) return true;
	}
	return false;
}

/** Computes the x-axis value for an anomaly marker in the given axis mode. */
export function anomalyXValue(
	anomaly: Anomaly,
	s: SeriesInput,
	axisMode: 'time' | 'distance',
): number {
	const record = s.activity.records[anomaly.recordIndex];
	if (!record) return 0;
	if (axisMode === 'distance') {
		return (record.distance + (s.distanceOffset ?? 0)) / 1000;
	}
	return record.elapsedSeconds + (s.timeOffset ?? 0);
}
