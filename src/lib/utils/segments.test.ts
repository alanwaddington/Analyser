import { describe, it, expect } from 'vitest';
import { buildSegments } from './segments.ts';
import type { Activity, Lap, ActivityRecord } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeRecord(distance: number, elapsedSeconds: number): ActivityRecord {
	return { timestamp: new Date(), elapsedSeconds, distance };
}

function makeLap(startDistance: number, endDistance: number, startIndex: number, endIndex: number): Lap {
	return { startDistance, endDistance, elapsedSeconds: 0, startIndex, endIndex };
}

function makeActivity(records: ActivityRecord[], laps: Lap[]): Activity {
	return makeBaseActivity({
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
		laps,
	});
}

describe('buildSegments', () => {
	it('buildSegments_undefinedActivity_returnsEmpty', () => {
		expect(buildSegments(undefined)).toEqual([]);
	});

	it('buildSegments_emptyRecords_returnsEmpty', () => {
		expect(buildSegments(makeActivity([], []))).toEqual([]);
	});

	it('buildSegments_sub1km_returnsEmpty', () => {
		const activity = makeActivity([makeRecord(0, 0), makeRecord(500, 30)], []);
		expect(buildSegments(activity)).toEqual([]);
	});

	it('buildSegments_withMultipleLaps_returnsOneLapPerSegment', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 125), makeRecord(3000, 190)];
		const laps = [
			makeLap(0, 1000, 0, 1),
			makeLap(1000, 2000, 1, 2),
			makeLap(2000, 3000, 2, 3),
		];
		const result = buildSegments(makeActivity(records, laps));
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({ label: 'Lap 1', startDist: 0, endDist: 1000 });
		expect(result[1]).toEqual({ label: 'Lap 2', startDist: 1000, endDist: 2000 });
		expect(result[2]).toEqual({ label: 'Lap 3', startDist: 2000, endDist: 3000 });
	});

	it('buildSegments_withOneLap_returns1kmFallback', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2500, 150)];
		const laps = [makeLap(0, 2500, 0, 2)];
		const result = buildSegments(makeActivity(records, laps));
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ label: '1 km', startDist: 0, endDist: 1000 });
		expect(result[1]).toEqual({ label: '2 km', startDist: 1000, endDist: 2000 });
	});

	it('buildSegments_withNoLaps_returns1kmFallback', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120)];
		const result = buildSegments(makeActivity(records, []));
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ label: '1 km', startDist: 0, endDist: 1000 });
		expect(result[1]).toEqual({ label: '2 km', startDist: 1000, endDist: 2000 });
	});

	it('buildSegments_exactly1km_returns1kmFallback', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60)];
		const result = buildSegments(makeActivity(records, []));
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ label: '1 km', startDist: 0, endDist: 1000 });
	});
});
