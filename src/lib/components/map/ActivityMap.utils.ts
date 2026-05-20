import type { Activity, GpsPoint } from '$lib/types';

export interface GpsPointWithDistance {
	lat: number;
	lon: number;
	distance: number;
}

export function extractGpsPoints(activity: Activity): GpsPointWithDistance[] {
	return activity.records
		.filter(r => r.position !== undefined)
		.map(r => ({ lat: r.position!.lat, lon: r.position!.lon, distance: r.distance }));
}

export function positionAtDistance(activity: Activity, targetDist: number): GpsPoint | null {
	const points = extractGpsPoints(activity);
	if (points.length === 0) return null;

	let lo = 0;
	let hi = points.length - 1;

	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (points[mid].distance < targetDist) lo = mid + 1;
		else hi = mid;
	}

	if (points[lo].distance < targetDist) return null;
	if (lo === 0) return { lat: points[0].lat, lon: points[0].lon };

	const a = points[lo - 1];
	const b = points[lo];
	if (b.distance === a.distance) return { lat: a.lat, lon: a.lon };

	const t = (targetDist - a.distance) / (b.distance - a.distance);
	return {
		lat: a.lat + t * (b.lat - a.lat),
		lon: a.lon + t * (b.lon - a.lon),
	};
}
