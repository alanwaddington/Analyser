import type { Activity } from '$lib/types';
import type { Segment } from '$lib/components/charts/SegmentChart.utils';

export function buildSegments(activity: Activity | undefined): Segment[] {
	if (!activity || activity.records.length === 0) return [];
	if (activity.laps.length > 1) {
		return activity.laps.map((lap, i) => ({
			label: `Lap ${i + 1}`,
			startDist: lap.startDistance,
			endDist: lap.endDistance,
		}));
	}
	const totalKm = Math.floor(activity.totalDistance / 1000);
	const segments: Segment[] = [];
	for (let km = 1; km <= totalKm; km++) {
		segments.push({ label: `${km} km`, startDist: (km - 1) * 1000, endDist: km * 1000 });
	}
	return segments;
}
