import type { Activity } from '$lib/types';
import type { Segment } from '$lib/components/charts/SegmentChart.utils';
import type { CustomSegment } from '$lib/stores/customSegments';

export function buildSegments(activity: Activity | undefined, customSegments?: CustomSegment[]): Segment[] {
	if (!activity || activity.records.length === 0) return [];

	let autoSegments: Segment[];
	if (activity.laps.length > 1) {
		autoSegments = activity.laps.map((lap, i) => ({
			label: `Lap ${i + 1}`,
			startDist: lap.startDistance,
			endDist: lap.endDistance,
		}));
	} else {
		const totalKm = Math.floor(activity.totalDistance / 1000);
		autoSegments = [];
		for (let km = 1; km <= totalKm; km++) {
			autoSegments.push({ label: `${km} km`, startDist: (km - 1) * 1000, endDist: km * 1000 });
		}
	}

	if (!customSegments || customSegments.length === 0) return autoSegments;

	const customMapped: Segment[] = customSegments.map(cs => ({
		label: cs.name,
		startDist: cs.startDist,
		endDist: cs.endDist,
		custom: true,
		id: cs.id,
	}));

	return [...autoSegments, ...customMapped];
}
