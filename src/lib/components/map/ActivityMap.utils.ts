import type { Activity, ActivityRecord, GpsPoint } from '$lib/types';
import { lowerBound } from '$lib/utils/binarySearch';

// ---------------------------------------------------------------------------
// Tile layer providers
// ---------------------------------------------------------------------------

/** Configuration for a Leaflet base tile layer. */
export interface TileProvider {
	/** Display name shown in the layers control. */
	name: string;
	/** Leaflet URL template (may contain {s}, {z}, {x}, {y}, {r} tokens). */
	url: string;
	/** Attribution HTML string required by the tile provider's terms of use. */
	attribution: string;
	/**
	 * Highest zoom level at which the provider natively serves tiles.
	 * Passed to Leaflet as `maxNativeZoom` (not `maxZoom`) so that the layer
	 * remains selectable at any map zoom — tiles are simply upscaled beyond
	 * this value rather than the layer being disabled in the control.
	 */
	maxNativeZoom: number;
}

/**
 * Ordered list of free (no API key) tile layer providers.
 * The first entry is the default layer shown on map load.
 */
export const TILE_PROVIDERS: TileProvider[] = [
	{
		name: 'Streets',
		url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxNativeZoom: 19,
	},
	{
		name: 'Satellite',
		// Note: ESRI uses {z}/{y}/{x} tile ordering (row before column), which is the
		// opposite of the {z}/{x}/{y} convention used by OSM-based providers. This is
		// correct for this specific endpoint — do not change to {z}/{x}/{y}.
		url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
		attribution: '&copy; Esri, Maxar, Earthstar Geographics',
		maxNativeZoom: 18,
	},
	{
		name: 'Topo',
		url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
		attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxNativeZoom: 17,
	},
	{
		name: 'Cycling',
		url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
		attribution: '&copy; <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxNativeZoom: 20,
	},
	{
		name: 'Dark',
		// Note: {r} is a Leaflet retina token — replaced with '@2x' on HiDPI displays
		// to request higher-resolution tiles. This is intentional and correct.
		url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>',
		maxNativeZoom: 20,
	},
];

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

export function positionFromPoints(
	points: GpsPointWithDistance[],
	targetDist: number,
): GpsPoint | null {
	if (points.length === 0) return null;

	const lo = lowerBound(points, (p) => p.distance, targetDist);
	if (lo >= points.length) return null;
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

export function positionAtDistance(activity: Activity, targetDist: number): GpsPoint | null {
	return positionFromPoints(extractGpsPoints(activity), targetDist);
}

// ---------------------------------------------------------------------------
// Metric-coloured polyline utilities
// ---------------------------------------------------------------------------

/** GPS point with distance and an optional smoothed metric value. */
export interface GpsPointWithMetric extends GpsPointWithDistance {
	metricValue: number | null;
}

/**
 * Pairs GPS points from an activity with pre-computed smoothed metric values.
 * Records without a GPS position are skipped; the smoothedValues array must be
 * aligned to activity.records by index (same length).
 */
export function extractGpsPointsWithMetric(
	activity: Activity,
	smoothedValues: (number | null)[],
): GpsPointWithMetric[] {
	const result: GpsPointWithMetric[] = [];
	for (let i = 0; i < activity.records.length; i++) {
		const record: ActivityRecord = activity.records[i];
		if (record.position === undefined) continue;
		result.push({
			lat: record.position.lat,
			lon: record.position.lon,
			distance: record.distance,
			metricValue: smoothedValues[i] ?? null,
		});
	}
	return result;
}

/**
 * Computes the global min/max range across all activities' metric points,
 * ignoring null values.
 * Returns null if no valid values exist.
 */
export function computeMetricRange(
	allPoints: GpsPointWithMetric[][],
): { min: number; max: number } | null {
	let min = Infinity;
	let max = -Infinity;

	for (const points of allPoints) {
		for (const p of points) {
			if (p.metricValue === null) continue;
			if (p.metricValue < min) min = p.metricValue;
			if (p.metricValue > max) max = p.metricValue;
		}
	}

	if (!isFinite(min) || !isFinite(max)) return null;
	return { min, max };
}

/**
 * Given a target lat/lon and an array of GPS points with distance values,
 * returns the distance (in metres) of the nearest GPS point.
 *
 * Uses squared Euclidean distance on raw lat/lon coordinates — sufficient for
 * finding the nearest point within a local area without the overhead of
 * Haversine.
 *
 * Returns null if the points array is empty.
 */
export function distanceAtPoint(
	points: GpsPointWithDistance[],
	targetLat: number,
	targetLon: number,
): number | null {
	if (points.length === 0) return null;

	let nearestDist = points[0].distance;
	let minSquaredDelta = Infinity;

	for (const p of points) {
		const dLat = p.lat - targetLat;
		const dLon = p.lon - targetLon;
		const squaredDelta = dLat * dLat + dLon * dLon;
		if (squaredDelta < minSquaredDelta) {
			minSquaredDelta = squaredDelta;
			nearestDist = p.distance;
		}
	}

	return nearestDist;
}
