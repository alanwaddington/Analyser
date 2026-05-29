import { describe, it, expect } from 'vitest';
import { buildLapMarkers } from './lapMarkers.ts';
import type { Activity, Lap, ActivityRecord } from '$lib/types';

function makeRecord(distance: number, elapsedSeconds: number): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds,
		distance,
	};
}

function makeLap(startDistance: number, endDistance: number, elapsedSeconds: number, startIndex: number, endIndex: number): Lap {
	return { startDistance, endDistance, elapsedSeconds, startIndex, endIndex };
}

function makeActivity(records: ActivityRecord[], laps: Lap[]): Activity {
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(),
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
		laps,
		devices: [],
		deviceStreams: [],
		firstGpsFixIndex: null,
		firstGpsMovementIndex: null,
		timerStartTime: null,
		firstIndoorMovementIndex: null,
		firstWorkoutStepTime: null,
		subSport: undefined,
		isIndoor: false,
		anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(0), source: 'fileStart' as const },
	};
}

// ---------------------------------------------------------------------------
// buildLapMarkers — distance mode
// ---------------------------------------------------------------------------
describe('buildLapMarkers — distance mode', () => {
	it('buildLapMarkers_undefinedActivity_returnsEmpty', () => {
		expect(buildLapMarkers(undefined, 'distance')).toEqual([]);
	});

	it('buildLapMarkers_emptyRecords_returnsEmpty', () => {
		const activity = makeActivity([], []);
		expect(buildLapMarkers(activity, 'distance')).toEqual([]);
	});

	it('buildLapMarkers_withMultipleLaps_distanceMode_returnsLapBoundaries', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
			makeRecord(2000, 120),
			makeRecord(3000, 180),
		];
		const laps = [
			makeLap(0, 1000, 60, 0, 1),
			makeLap(1000, 2000, 60, 1, 2),
			makeLap(2000, 3000, 60, 2, 3),
		];
		const activity = makeActivity(records, laps);
		const result = buildLapMarkers(activity, 'distance');
		expect(result).toHaveLength(2); // skip first lap boundary, include rest
		expect(result[0]).toEqual({ value: 1, label: 'Lap 2' });
		expect(result[1]).toEqual({ value: 2, label: 'Lap 3' });
	});

	it('buildLapMarkers_withOneLap_distanceMode_returns1kmFallback', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(500, 30),
			makeRecord(1000, 60),
			makeRecord(2500, 150),
		];
		const laps = [makeLap(0, 2500, 150, 0, 3)];
		const activity = makeActivity(records, laps);
		const result = buildLapMarkers(activity, 'distance');
		expect(result).toHaveLength(2); // 1km and 2km
		expect(result[0]).toEqual({ value: 1, label: '1 km' });
		expect(result[1]).toEqual({ value: 2, label: '2 km' });
	});

	it('buildLapMarkers_withNoLaps_distanceMode_returns1kmFallback', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
			makeRecord(2000, 120),
		];
		const activity = makeActivity(records, []);
		const result = buildLapMarkers(activity, 'distance');
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ value: 1, label: '1 km' });
		expect(result[1]).toEqual({ value: 2, label: '2 km' });
	});

	it('buildLapMarkers_distanceLessThan1km_returnsEmpty', () => {
		const records = [makeRecord(0, 0), makeRecord(500, 30)];
		const activity = makeActivity(records, []);
		expect(buildLapMarkers(activity, 'distance')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildLapMarkers — time mode
// ---------------------------------------------------------------------------
describe('buildLapMarkers — time mode', () => {
	it('buildLapMarkers_undefinedActivity_timeMode_returnsEmpty', () => {
		expect(buildLapMarkers(undefined, 'time')).toEqual([]);
	});

	it('buildLapMarkers_withMultipleLaps_timeMode_returnsLapTimes', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
			makeRecord(2000, 125),
			makeRecord(3000, 190),
		];
		const laps = [
			makeLap(0, 1000, 60, 0, 1),
			makeLap(1000, 2000, 65, 1, 2),
			makeLap(2000, 3000, 65, 2, 3),
		];
		const activity = makeActivity(records, laps);
		const result = buildLapMarkers(activity, 'time');
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ value: 60, label: 'Lap 2' });
		expect(result[1]).toEqual({ value: 125, label: 'Lap 3' });
	});

	it('buildLapMarkers_withOneLap_timeMode_returns1kmTimeFallback', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
			makeRecord(2000, 125),
			makeRecord(2500, 155),
		];
		const laps = [makeLap(0, 2500, 155, 0, 3)];
		const activity = makeActivity(records, laps);
		const result = buildLapMarkers(activity, 'time');
		expect(result).toHaveLength(2); // 1km and 2km boundaries
		expect(result[0].label).toBe('1 km');
		expect(result[0].value).toBe(60); // record at 1000m has elapsedSeconds=60
		expect(result[1].label).toBe('2 km');
		expect(result[1].value).toBe(125);
	});
});
