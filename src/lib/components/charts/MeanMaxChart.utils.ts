import type { Activity, Record } from '$lib/types';
import { meanMaxCurve } from '$lib/analytics/meanmax';

export interface MeanMaxSeriesInput {
	activity: Activity;
	colourIndex: number;
}

export function buildMeanMaxData(records: Record[]): [number, number][] {
	const values = records.map(r => r.power ?? null);
	const curve = meanMaxCurve(values);
	return curve.map(p => [p.duration, p.mean]);
}

export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}
