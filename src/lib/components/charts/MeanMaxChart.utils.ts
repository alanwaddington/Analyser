import type { Activity, ActivityRecord } from '$lib/types';
import { meanMaxCurve } from '$lib/analytics/meanmax';

export interface MeanMaxSeriesInput {
	activity: Activity;
	colourIndex: number;
}

export function buildMeanMaxData(records: ActivityRecord[]): [number, number][] {
	const values = records.map(r => r.power ?? null);
	const curve = meanMaxCurve(values);
	return curve.map(p => [p.duration, p.mean]);
}

export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	return `${m}:${s.toString().padStart(2, '0')}`;
}
