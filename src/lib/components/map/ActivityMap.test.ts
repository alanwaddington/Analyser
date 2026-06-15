import { describe, it, expect } from 'vitest';
import { positionAtDistance, positionFromPoints, extractGpsPoints, distanceAtPoint, TILE_PROVIDERS } from './ActivityMap.utils.ts';
import type { GpsPointWithDistance } from './ActivityMap.utils.ts';
import type { Activity, ActivityRecord } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeRecord(distance: number, elapsedSeconds: number, lat?: number, lon?: number): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds,
		distance,
		position: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
	};
}

function makeActivity(records: ActivityRecord[]): Activity {
	return makeBaseActivity({
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
	});
}

// ---------------------------------------------------------------------------
// positionAtDistance
// ---------------------------------------------------------------------------
describe('positionAtDistance', () => {
	it('positionAtDistance_happyPath_returnsInterpolatedPosition', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0),
			makeRecord(1000, 60, 51.01, -1.01),
			makeRecord(2000, 120, 51.02, -1.02),
		];
		const activity = makeActivity(records);
		const result = positionAtDistance(activity, 500);
		expect(result).not.toBeNull();
		expect(result!.lat).toBeCloseTo(51.005, 4);
		expect(result!.lon).toBeCloseTo(-1.005, 4);
	});

	it('positionAtDistance_exactMatch_returnsExactPosition', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0),
			makeRecord(1000, 60, 51.01, -1.01),
		];
		const activity = makeActivity(records);
		const result = positionAtDistance(activity, 1000);
		expect(result).not.toBeNull();
		expect(result!.lat).toBeCloseTo(51.01, 5);
		expect(result!.lon).toBeCloseTo(-1.01, 5);
	});

	it('positionAtDistance_atStart_returnsFirstPosition', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0),
			makeRecord(1000, 60, 51.01, -1.01),
		];
		const activity = makeActivity(records);
		const result = positionAtDistance(activity, 0);
		expect(result).not.toBeNull();
		expect(result!.lat).toBeCloseTo(51.0, 5);
		expect(result!.lon).toBeCloseTo(-1.0, 5);
	});

	it('positionAtDistance_noGpsData_returnsNull', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
			makeRecord(2000, 120),
		];
		const activity = makeActivity(records);
		expect(positionAtDistance(activity, 500)).toBeNull();
	});

	it('positionAtDistance_distanceBeyondRecords_returnsNull', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0),
			makeRecord(1000, 60, 51.01, -1.01),
		];
		const activity = makeActivity(records);
		expect(positionAtDistance(activity, 5000)).toBeNull();
	});

	it('positionAtDistance_emptyRecords_returnsNull', () => {
		const activity = makeActivity([]);
		expect(positionAtDistance(activity, 500)).toBeNull();
	});

	it('positionAtDistance_partialGpsData_interpolatesFromGpsRecords', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(500, 30, 51.0, -1.0),
			makeRecord(1500, 90, 51.01, -1.01),
			makeRecord(2000, 120),
		];
		const activity = makeActivity(records);
		const result = positionAtDistance(activity, 1000);
		expect(result).not.toBeNull();
		expect(result!.lat).toBeCloseTo(51.005, 4);
		expect(result!.lon).toBeCloseTo(-1.005, 4);
	});

	it('positionAtDistance_interpolationAccuracy_midpointIsAverage', () => {
		const records = [
			makeRecord(0, 0, 10.0, 20.0),
			makeRecord(2000, 120, 12.0, 22.0),
		];
		const activity = makeActivity(records);
		const result = positionAtDistance(activity, 1000);
		expect(result).not.toBeNull();
		expect(result!.lat).toBeCloseTo(11.0, 5);
		expect(result!.lon).toBeCloseTo(21.0, 5);
	});
});

// ---------------------------------------------------------------------------
// positionFromPoints
// ---------------------------------------------------------------------------
describe('positionFromPoints', () => {
	it('positionFromPoints_happyPath_returnsInterpolatedPosition', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
		];
		const result = positionFromPoints(points, 500);
		expect(result).not.toBeNull();
		expect(result!.lat).toBeCloseTo(51.005, 4);
		expect(result!.lon).toBeCloseTo(-1.005, 4);
	});

	it('positionFromPoints_emptyPoints_returnsNull', () => {
		expect(positionFromPoints([], 500)).toBeNull();
	});

	it('positionFromPoints_beyondRange_returnsNull', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
		];
		expect(positionFromPoints(points, 5000)).toBeNull();
	});

	it('positionFromPoints_exactMatch_returnsExactPosition', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
		];
		const result = positionFromPoints(points, 1000);
		expect(result!.lat).toBeCloseTo(51.01, 5);
		expect(result!.lon).toBeCloseTo(-1.01, 5);
	});
});

// ---------------------------------------------------------------------------
// extractGpsPoints
// ---------------------------------------------------------------------------
describe('extractGpsPoints', () => {
	it('extractGpsPoints_allHavePosition_returnsAll', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0),
			makeRecord(1000, 60, 51.01, -1.01),
			makeRecord(2000, 120, 51.02, -1.02),
		];
		const activity = makeActivity(records);
		const result = extractGpsPoints(activity);
		expect(result).toHaveLength(3);
	});

	it('extractGpsPoints_filtersOutNoPosition', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0),
			makeRecord(500, 30),
			makeRecord(1000, 60, 51.01, -1.01),
			makeRecord(1500, 90),
			makeRecord(2000, 120, 51.02, -1.02),
		];
		const activity = makeActivity(records);
		const result = extractGpsPoints(activity);
		expect(result).toHaveLength(3);
	});

	it('extractGpsPoints_emptyRecords_returnsEmpty', () => {
		const activity = makeActivity([]);
		expect(extractGpsPoints(activity)).toEqual([]);
	});

	it('extractGpsPoints_noPositionData_returnsEmpty', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
		];
		const activity = makeActivity(records);
		expect(extractGpsPoints(activity)).toEqual([]);
	});

	it('extractGpsPoints_returnsLatLonDistanceAndRecordIndex', () => {
		const records = [
			makeRecord(0, 0, 51.5, -0.1),
			makeRecord(1000, 60, 51.51, -0.11),
		];
		const activity = makeActivity(records);
		const result = extractGpsPoints(activity);
		expect(result[0]).toEqual({ lat: 51.5, lon: -0.1, distance: 0, recordIndex: 0 });
		expect(result[1]).toEqual({ lat: 51.51, lon: -0.11, distance: 1000, recordIndex: 1 });
	});

	it('extractGpsPoints_filtersOutNoPosition_recordIndexReferencesOriginalArray', () => {
		// Records at index 0 and 2 have GPS; index 1 does not.
		// The recordIndex in each output point must reference the original array index.
		const records = [
			makeRecord(0, 0, 51.0, -1.0),       // index 0 — has GPS
			makeRecord(500, 30),                  // index 1 — no GPS
			makeRecord(1000, 60, 51.01, -1.01),  // index 2 — has GPS
		];
		const activity = makeActivity(records);
		const result = extractGpsPoints(activity);
		expect(result).toHaveLength(2);
		expect(result[0].recordIndex).toBe(0);
		expect(result[1].recordIndex).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// distanceAtPoint
// ---------------------------------------------------------------------------
describe('distanceAtPoint', () => {
	it('distanceAtPoint_emptyPoints_returnsNull', () => {
		expect(distanceAtPoint([], 51.0, -1.0)).toBeNull();
	});

	it('distanceAtPoint_exactMatch_returnsDistance', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
			{ lat: 51.02, lon: -1.02, distance: 2000 },
		];
		const result = distanceAtPoint(points, 51.01, -1.01);
		expect(result).toBeCloseTo(1000, 0);
	});

	it('distanceAtPoint_nearestPoint_returnsClosestDistance', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
			{ lat: 51.02, lon: -1.02, distance: 2000 },
		];
		// Target slightly closer to the middle point
		const result = distanceAtPoint(points, 51.009, -1.009);
		expect(result).toBeCloseTo(1000, 0);
	});

	it('distanceAtPoint_singlePoint_returnsThatDistance', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 500 },
		];
		const result = distanceAtPoint(points, 51.0, -1.0);
		expect(result).toBeCloseTo(500, 0);
	});

	it('distanceAtPoint_pointBeyondTraceEnd_returnsLastPointDistance', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
		];
		// Target well beyond the end of the trace — nearest is the last point
		const result = distanceAtPoint(points, 52.0, -2.0);
		expect(result).toBeCloseTo(1000, 0);
	});

	it('distanceAtPoint_pointBeforeTraceStart_returnsFirstPointDistance', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 100 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
		];
		// Target well before the start — nearest is the first point
		const result = distanceAtPoint(points, 50.0, 0.0);
		expect(result).toBeCloseTo(100, 0);
	});

	it('distanceAtPoint_midpointBetweenTwoPoints_returnsNearer', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.02, lon: -1.02, distance: 2000 },
		];
		// Just past the halfway mark → nearer to second point
		const result = distanceAtPoint(points, 51.011, -1.011);
		expect(result).toBeCloseTo(2000, 0);
	});

	it('distanceAtPoint_firstPointIsNearest_returnsFirstDistance', () => {
		const points: GpsPointWithDistance[] = [
			{ lat: 51.0, lon: -1.0, distance: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000 },
		];
		// Target much closer to first point
		const result = distanceAtPoint(points, 51.001, -1.001);
		expect(result).toBeCloseTo(0, 0);
	});
});

// ---------------------------------------------------------------------------
// TILE_PROVIDERS
// ---------------------------------------------------------------------------
describe('TILE_PROVIDERS', () => {
	it('TILE_PROVIDERS_length_hasFiveEntries', () => {
		expect(TILE_PROVIDERS).toHaveLength(5);
	});

	it('TILE_PROVIDERS_firstEntry_isOpenStreetMapStreets', () => {
		expect(TILE_PROVIDERS[0].name).toBe('Streets');
		expect(TILE_PROVIDERS[0].url).toContain('openstreetmap.org');
	});

	it('TILE_PROVIDERS_allEntries_haveRequiredFields', () => {
		for (const provider of TILE_PROVIDERS) {
			expect(typeof provider.name).toBe('string');
			expect(provider.name.length).toBeGreaterThan(0);
			expect(typeof provider.url).toBe('string');
			expect(provider.url.length).toBeGreaterThan(0);
			expect(typeof provider.attribution).toBe('string');
			expect(provider.attribution.length).toBeGreaterThan(0);
			expect(typeof provider.maxNativeZoom).toBe('number');
			expect(provider.maxNativeZoom).toBeGreaterThan(0);
		}
	});

	it('TILE_PROVIDERS_allUrls_useHttps', () => {
		for (const provider of TILE_PROVIDERS) {
			expect(provider.url).toMatch(/^https:\/\//);
		}
	});

	it('TILE_PROVIDERS_names_areUnique', () => {
		const names = TILE_PROVIDERS.map(p => p.name);
		const unique = new Set(names);
		expect(unique.size).toBe(names.length);
	});

	it('TILE_PROVIDERS_includesSatellite', () => {
		const satellite = TILE_PROVIDERS.find(p => p.name === 'Satellite');
		expect(satellite).toBeDefined();
		expect(satellite!.url).toContain('arcgisonline.com');
	});

	it('TILE_PROVIDERS_includesTopo', () => {
		const topo = TILE_PROVIDERS.find(p => p.name === 'Topo');
		expect(topo).toBeDefined();
		expect(topo!.url).toContain('opentopomap.org');
	});

	it('TILE_PROVIDERS_includesCycling', () => {
		const cycling = TILE_PROVIDERS.find(p => p.name === 'Cycling');
		expect(cycling).toBeDefined();
		expect(cycling!.url).toContain('cyclosm');
	});

	it('TILE_PROVIDERS_includesDark', () => {
		const dark = TILE_PROVIDERS.find(p => p.name === 'Dark');
		expect(dark).toBeDefined();
		expect(dark!.url).toContain('cartocdn.com');
	});
});
