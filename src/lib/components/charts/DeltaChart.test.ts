import { describe, it, expect } from 'vitest';
import { getClipDistance, buildZeroLine, buildDeltaData } from './DeltaChart.utils.ts';
import type { Activity, ActivityRecord } from '$lib/types';

function makeRecord(distance: number, elapsedSeconds: number): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds,
		distance,
	};
}

function makeActivity(totalDistance: number, records: ActivityRecord[]): Activity {
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(),
		totalDistance,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
		laps: [],
		devices: [],
		deviceStreams: [],
	};
}

// ---------------------------------------------------------------------------
// getClipDistance
// ---------------------------------------------------------------------------
describe('getClipDistance', () => {
	it('getClipDistance_sameLength_returnsThatLength', () => {
		const a = makeActivity(5000, []);
		const b = makeActivity(5000, []);
		expect(getClipDistance([a, b])).toBe(5000);
	});

	it('getClipDistance_differentLengths_returnsShortest', () => {
		const a = makeActivity(5000, []);
		const b = makeActivity(3000, []);
		expect(getClipDistance([a, b])).toBe(3000);
	});

	it('getClipDistance_threeActivities_returnsShortest', () => {
		const a = makeActivity(5000, []);
		const b = makeActivity(3000, []);
		const c = makeActivity(4000, []);
		expect(getClipDistance([a, b, c])).toBe(3000);
	});

	it('getClipDistance_singleActivity_returnsTotalDistance', () => {
		const a = makeActivity(2500, []);
		expect(getClipDistance([a])).toBe(2500);
	});
});

// ---------------------------------------------------------------------------
// buildZeroLine
// ---------------------------------------------------------------------------
describe('buildZeroLine', () => {
	it('buildZeroLine_distanceMode_returnsKmRange', () => {
		const result = buildZeroLine(5000, 'distance');
		expect(result).toEqual([[0, 0], [5, 0]]);
	});

	it('buildZeroLine_timeMode_returnsMetresRange', () => {
		const result = buildZeroLine(5000, 'time');
		expect(result).toEqual([[0, 0], [5000, 0]]);
	});

	it('buildZeroLine_distanceMode_fractionalKm', () => {
		const result = buildZeroLine(2500, 'distance');
		expect(result).toEqual([[0, 0], [2.5, 0]]);
	});

	it('buildZeroLine_alwaysStartsAtOrigin', () => {
		const result = buildZeroLine(1000, 'distance');
		expect(result[0]).toEqual([0, 0]);
	});
});

// ---------------------------------------------------------------------------
// buildDeltaData
// ---------------------------------------------------------------------------
describe('buildDeltaData', () => {
	function makeEvenActivity(totalDistance: number, secondsPerMetre: number): Activity {
		const records: ActivityRecord[] = [];
		for (let d = 0; d <= totalDistance; d += 10) {
			records.push(makeRecord(d, d * secondsPerMetre));
		}
		return makeActivity(totalDistance, records);
	}

	it('buildDeltaData_sameSpeed_returnsAllZeroDeltas', () => {
		const ref = makeEvenActivity(1000, 0.2);
		const cand = makeEvenActivity(1000, 0.2);
		const result = buildDeltaData(ref, cand, 1000, 'distance');
		expect(result.every(([, delta]) => Math.abs(delta) < 0.001)).toBe(true);
	});

	it('buildDeltaData_candidateFaster_returnsPositiveDeltas', () => {
		const ref = makeEvenActivity(1000, 0.2);
		const cand = makeEvenActivity(1000, 0.15);
		const result = buildDeltaData(ref, cand, 1000, 'distance');
		expect(result.length).toBeGreaterThan(0);
		expect(result.every(([, delta]) => delta > 0)).toBe(true);
	});

	it('buildDeltaData_candidateSlower_returnsNegativeDeltas', () => {
		const ref = makeEvenActivity(1000, 0.15);
		const cand = makeEvenActivity(1000, 0.2);
		const result = buildDeltaData(ref, cand, 1000, 'distance');
		expect(result.length).toBeGreaterThan(0);
		expect(result.every(([, delta]) => delta < 0)).toBe(true);
	});

	it('buildDeltaData_distanceMode_xAxisInKm', () => {
		const ref = makeEvenActivity(1000, 0.2);
		const cand = makeEvenActivity(1000, 0.2);
		const result = buildDeltaData(ref, cand, 1000, 'distance');
		expect(result.every(([x]) => x <= 1)).toBe(true);
	});

	it('buildDeltaData_timeMode_xAxisInMetres', () => {
		const ref = makeEvenActivity(1000, 0.2);
		const cand = makeEvenActivity(1000, 0.2);
		const result = buildDeltaData(ref, cand, 1000, 'time');
		expect(result.every(([x]) => x <= 1000)).toBe(true);
	});

	it('buildDeltaData_clipsToMaxDist_excludesBeyondBoundary', () => {
		const ref = makeEvenActivity(2000, 0.2);
		const cand = makeEvenActivity(2000, 0.2);
		const result = buildDeltaData(ref, cand, 1000, 'distance');
		expect(result.every(([x]) => x <= 1)).toBe(true);
	});

	it('buildDeltaData_emptyRecords_returnsEmptyArray', () => {
		const ref = makeActivity(0, [makeRecord(0, 0)]);
		const cand = makeActivity(0, [makeRecord(0, 0)]);
		const result = buildDeltaData(ref, cand, 0, 'distance');
		expect(result).toEqual([]);
	});
});
