import { describe, it, expect } from 'vitest';
import { buildSegments } from './segments.ts';
import type { Activity, Lap, ActivityRecord } from '$lib/types';
import type { CustomSegment } from '$lib/stores/customSegments';
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

describe('buildSegments — custom segment merging', () => {
	it('buildSegments_withCustomSegments_appendsAfterAutoLaps', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120), makeRecord(3000, 180)];
		const laps = [makeLap(0, 1000, 0, 1), makeLap(1000, 2000, 1, 2), makeLap(2000, 3000, 2, 3)];
		const custom: CustomSegment[] = [
			{ id: 'x', name: 'The Hill', startDist: 500, endDist: 1500 },
		];
		const result = buildSegments(makeActivity(records, laps), custom);
		// 3 auto-laps + 1 custom = 4 total
		expect(result).toHaveLength(4);
		// Auto-laps come first
		expect(result[0].label).toBe('Lap 1');
		expect(result[2].label).toBe('Lap 3');
		// Custom segment is last
		expect(result[3].label).toBe('The Hill');
		expect(result[3].startDist).toBe(500);
		expect(result[3].endDist).toBe(1500);
		expect(result[3].custom).toBe(true);
		expect(result[3].id).toBe('x');
	});

	it('buildSegments_customSegments_haveCustomFlag', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60)];
		const custom: CustomSegment[] = [
			{ id: 'a', name: 'Test', startDist: 0, endDist: 1000 },
		];
		const result = buildSegments(makeActivity(records, []), custom);
		expect(result[result.length - 1].custom).toBe(true);
	});

	it('buildSegments_autoLapSegments_doNotHaveCustomFlag', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120)];
		const laps = [makeLap(0, 1000, 0, 1), makeLap(1000, 2000, 1, 2)];
		const result = buildSegments(makeActivity(records, laps), []);
		result.forEach(s => expect(s.custom).toBeUndefined());
	});

	it('buildSegments_emptyCustomArray_behaviourUnchanged', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120)];
		const laps = [makeLap(0, 1000, 0, 1), makeLap(1000, 2000, 1, 2)];
		const withCustom = buildSegments(makeActivity(records, laps), []);
		const without = buildSegments(makeActivity(records, laps));
		expect(withCustom).toHaveLength(without.length);
		withCustom.forEach((s, i) => {
			expect(s.label).toBe(without[i].label);
			expect(s.startDist).toBe(without[i].startDist);
			expect(s.endDist).toBe(without[i].endDist);
		});
	});

	it('buildSegments_multipleCustomSegments_allAppended', () => {
		const records = [makeRecord(0, 0), makeRecord(5000, 1500)];
		const custom: CustomSegment[] = [
			{ id: 'a', name: 'Hill', startDist: 1000, endDist: 2000 },
			{ id: 'b', name: 'Descent', startDist: 3000, endDist: 4000 },
		];
		const result = buildSegments(makeActivity(records, []), custom);
		// 5 km splits (1km x5) + 2 custom = 7
		expect(result).toHaveLength(7);
		expect(result[5].label).toBe('Hill');
		expect(result[6].label).toBe('Descent');
	});

	it('buildSegments_customSegments_preserveId', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60)];
		const custom: CustomSegment[] = [
			{ id: 'my-id-123', name: 'Test', startDist: 0, endDist: 1000 },
		];
		const result = buildSegments(makeActivity(records, []), custom);
		expect(result[result.length - 1].id).toBe('my-id-123');
	});
});
