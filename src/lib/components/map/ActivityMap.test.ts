import { describe, it, expect } from 'vitest';
import { positionAtDistance, extractGpsPoints } from './ActivityMap.utils.ts';
import type { Activity, Record } from '$lib/types';

function makeRecord(distance: number, elapsedSeconds: number, lat?: number, lon?: number): Record {
	return {
		timestamp: new Date(),
		elapsedSeconds,
		distance,
		position: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
	};
}

function makeActivity(records: Record[]): Activity {
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(),
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
		laps: [],
		devices: [],
	};
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

	it('extractGpsPoints_returnsLatLonAndDistance', () => {
		const records = [
			makeRecord(0, 0, 51.5, -0.1),
			makeRecord(1000, 60, 51.51, -0.11),
		];
		const activity = makeActivity(records);
		const result = extractGpsPoints(activity);
		expect(result[0]).toEqual({ lat: 51.5, lon: -0.1, distance: 0 });
		expect(result[1]).toEqual({ lat: 51.51, lon: -0.11, distance: 1000 });
	});
});
