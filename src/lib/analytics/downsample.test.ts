import { describe, it, expect } from 'vitest';
import { downsampleGps, GPS_MAX_POINTS } from './downsample.ts';
import type { GpsPointWithDistance } from '$lib/components/map/ActivityMap.utils';

function makePoint(lat: number, lon: number, distance: number, recordIndex: number): GpsPointWithDistance {
	return { lat, lon, distance, recordIndex };
}

// Generate N collinear points between (0,0) and (1,0) — a straight horizontal line.
// RDP should reduce to exactly 2 points (start and end).
function makeStraightLine(n: number): GpsPointWithDistance[] {
	return Array.from({ length: n }, (_, i) => ({
		lat: 0,
		lon: i / (n - 1),
		distance: i * 100,
		recordIndex: i,
	}));
}

describe("GPS_MAX_POINTS", () => {
	it("GPS_MAX_POINTS_value_is500", () => {
		expect(GPS_MAX_POINTS).toBe(500);
	});
});

describe("downsampleGps", () => {
	it("downsampleGps_emptyInput_returnsEmpty", () => {
		const result = downsampleGps([], 500);
		expect(result).toHaveLength(0);
	});

	it("downsampleGps_singlePoint_returnsSinglePoint", () => {
		const pts = [makePoint(51.0, -1.0, 0, 0)];
		const result = downsampleGps(pts, 500);
		expect(result).toHaveLength(1);
		expect(result[0].recordIndex).toBe(0);
	});

	it("downsampleGps_fewerThanMaxPoints_returnsInputUnchanged", () => {
		const pts = [
			makePoint(51.0, -1.0, 0, 0),
			makePoint(51.01, -1.01, 1000, 1),
			makePoint(51.02, -1.02, 2000, 2),
		];
		const result = downsampleGps(pts, 500);
		expect(result).toBe(pts); // identical reference — no copy
	});

	it("downsampleGps_exactlyMaxPoints_returnsInputUnchanged", () => {
		const pts = Array.from({ length: 500 }, (_, i) => makePoint(i * 0.001, 0, i * 10, i));
		const result = downsampleGps(pts, 500);
		expect(result).toBe(pts);
	});

	it("downsampleGps_straightLine_removesIntermediatePoints", () => {
		// 1000 collinear points, capped at 50 → RDP should reduce to 2 (start + end)
		const pts = makeStraightLine(1000);
		const result = downsampleGps(pts, 50);
		// All intermediate points are collinear — RDP reduces to start + end
		expect(result.length).toBeLessThanOrEqual(3);
		expect(result[0].recordIndex).toBe(0);
		expect(result[result.length - 1].recordIndex).toBe(999);
	});

	it("downsampleGps_alwaysPreservesFirstAndLastPoint", () => {
		// 1000 straight-line points — even after aggressive simplification
		const pts = makeStraightLine(1000);
		const result = downsampleGps(pts, 500);
		expect(result[0].recordIndex).toBe(0);
		expect(result[result.length - 1].recordIndex).toBe(999);
	});

	it("downsampleGps_rightAngleCorner_preservesCorner", () => {
		// L-shaped route: go east, then turn north at a right angle
		// The corner point must be preserved by RDP
		const pts: GpsPointWithDistance[] = [
			{ lat: 0.0, lon: 0.0, distance: 0, recordIndex: 0 },
			{ lat: 0.0, lon: 0.5, distance: 50000, recordIndex: 1 },
			{ lat: 0.0, lon: 1.0, distance: 100000, recordIndex: 2 }, // corner
			{ lat: 0.5, lon: 1.0, distance: 150000, recordIndex: 3 },
			{ lat: 1.0, lon: 1.0, distance: 200000, recordIndex: 4 },
		];
		const result = downsampleGps(pts, 500);
		// All 5 points should survive — the corner at index 2 has large perp distance
		const recordIndices = result.map(p => p.recordIndex);
		expect(recordIndices).toContain(0); // first
		expect(recordIndices).toContain(2); // corner
		expect(recordIndices).toContain(4); // last
	});

	it("downsampleGps_largeInput_returnsAtMostMaxPoints", () => {
		// 2000 random-ish points — result must be capped
		const pts = Array.from({ length: 2000 }, (_, i) => ({
			lat: Math.sin(i * 0.01) * 0.1 + 51.0,
			lon: Math.cos(i * 0.01) * 0.1 + -1.0,
			distance: i * 10,
			recordIndex: i,
		}));
		const result = downsampleGps(pts, 100);
		expect(result.length).toBeLessThanOrEqual(100);
	});

	it("downsampleGps_preservesRecordIndex", () => {
		// Every output point must have the same recordIndex as the corresponding input point
		const pts = Array.from({ length: 200 }, (_, i) => ({
			lat: Math.sin(i * 0.05) * 0.01 + 51.0,
			lon: i * 0.001 - 1.0,
			distance: i * 10,
			recordIndex: i * 3, // non-sequential to prove it's preserved, not recomputed
		}));
		const result = downsampleGps(pts, 500);
		for (const p of result) {
			// Find the original point with the same lat/lon
			const original = pts.find(o => o.lat === p.lat && o.lon === p.lon);
			expect(original).toBeDefined();
			expect(p.recordIndex).toBe(original!.recordIndex);
		}
	});

	it("downsampleGps_verySmallMaxPoints_capsResult", () => {
		const pts = Array.from({ length: 1000 }, (_, i) => ({
			lat: Math.sin(i * 0.01) * 0.1,
			lon: i * 0.001,
			distance: i * 10,
			recordIndex: i,
		}));
		const result = downsampleGps(pts, 10);
		expect(result.length).toBeLessThanOrEqual(10);
		expect(result[0].recordIndex).toBe(0);
		expect(result[result.length - 1].recordIndex).toBe(999);
	});
});
