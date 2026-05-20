import type { Activity } from '$lib/types';

export function buildLapMarkers(
	activity: Activity | undefined,
	xAxisMode: 'time' | 'distance',
): { value: number; label: string }[] {
	if (!activity || activity.records.length === 0) return [];

	if (activity.laps.length > 1) {
		return activity.laps.slice(1).map((lap, i) => ({
			value: xAxisMode === 'distance'
				? lap.startDistance / 1000
				: activity.records[lap.startIndex]?.elapsedSeconds ?? lap.startDistance / 1000,
			label: `Lap ${i + 2}`,
		}));
	}

	// 1 km fallback
	const totalKm = Math.floor(activity.totalDistance / 1000);
	const markers: { value: number; label: string }[] = [];

	for (let km = 1; km <= totalKm; km++) {
		const targetMetres = km * 1000;
		if (xAxisMode === 'distance') {
			markers.push({ value: km, label: `${km} km` });
		} else {
			const record = activity.records.find(r => r.distance >= targetMetres);
			if (record) {
				markers.push({ value: record.elapsedSeconds, label: `${km} km` });
			}
		}
	}

	return markers;
}
