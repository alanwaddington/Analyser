import { describe, it, expect } from 'vitest';
import { segmentTime, computeSegmentDeltas } from './SegmentChart.utils.ts';
import type { Activity, ActivityRecord } from '$lib/types';
import type { Segment } from './SegmentChart.utils.ts';

function makeRecord(distance: number, elapsedSeconds: number): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds,
		distance,
	};
}

function makeActivity(records: ActivityRecord[]): Activity {
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(),
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
		laps: [],
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

const seg1km: Segment = { label: '0–1km', startDist: 0, endDist: 1000 };
const seg2km: Segment = { label: '1–2km', startDist: 1000, endDist: 2000 };
const seg3km: Segment = { label: '2–3km', startDist: 2000, endDist: 3000 };

// ---------------------------------------------------------------------------
// segmentTime
// ---------------------------------------------------------------------------
describe('segmentTime', () => {
	it('segmentTime_happyPath_returnsElapsedSeconds', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 300),
			makeRecord(2000, 620),
			makeRecord(3000, 960),
		];
		const activity = makeActivity(records);
		expect(segmentTime(activity, seg2km)).toBeCloseTo(320, 1);
	});

	it('segmentTime_firstSegment_returnsElapsedFromStart', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 300),
			makeRecord(2000, 620),
		];
		const activity = makeActivity(records);
		expect(segmentTime(activity, seg1km)).toBeCloseTo(300, 1);
	});

	it('segmentTime_emptyRecords_returnsZero', () => {
		const activity = makeActivity([]);
		expect(segmentTime(activity, seg1km)).toBe(0);
	});

	it('segmentTime_noCoverage_returnsZero', () => {
		const records = [makeRecord(0, 0), makeRecord(500, 150)];
		const activity = makeActivity(records);
		expect(segmentTime(activity, seg2km)).toBe(0);
	});

	it('segmentTime_partialCoverage_returnsZeroWhenEndNotCovered', () => {
		const records = [makeRecord(0, 0), makeRecord(1500, 450)];
		const activity = makeActivity(records);
		expect(segmentTime(activity, seg2km)).toBe(0);
	});

	it('segmentTime_interpolatesWithinSegment', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(2000, 600),
		];
		const activity = makeActivity(records);
		const result = segmentTime(activity, seg1km);
		expect(result).toBeCloseTo(300, 1);
	});
});

// ---------------------------------------------------------------------------
// computeSegmentDeltas
// ---------------------------------------------------------------------------
describe('computeSegmentDeltas', () => {
	it('computeSegmentDeltas_candidateFaster_positiveDelta', () => {
		const refRecords = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120)];
		const candRecords = [makeRecord(0, 0), makeRecord(1000, 55), makeRecord(2000, 110)];
		const ref = makeActivity(refRecords);
		const candidate = makeActivity(candRecords);
		const result = computeSegmentDeltas(ref, candidate, [seg1km]);
		expect(result[0].delta).toBeCloseTo(5, 1);
	});

	it('computeSegmentDeltas_candidateSlower_negativeDelta', () => {
		const refRecords = [makeRecord(0, 0), makeRecord(1000, 55), makeRecord(2000, 110)];
		const candRecords = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120)];
		const ref = makeActivity(refRecords);
		const candidate = makeActivity(candRecords);
		const result = computeSegmentDeltas(ref, candidate, [seg1km]);
		expect(result[0].delta).toBeCloseTo(-5, 1);
	});

	it('computeSegmentDeltas_equalTimes_zeroDelta', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 60), makeRecord(2000, 120)];
		const ref = makeActivity(records);
		const candidate = makeActivity(records);
		const result = computeSegmentDeltas(ref, candidate, [seg1km]);
		expect(result[0].delta).toBeCloseTo(0, 3);
	});

	it('computeSegmentDeltas_multipleSegments_returnsArrayWithLabels', () => {
		const refRecords = [
			makeRecord(0, 0), makeRecord(1000, 300), makeRecord(2000, 620), makeRecord(3000, 960),
		];
		const candRecords = [
			makeRecord(0, 0), makeRecord(1000, 290), makeRecord(2000, 610), makeRecord(3000, 970),
		];
		const ref = makeActivity(refRecords);
		const candidate = makeActivity(candRecords);
		const result = computeSegmentDeltas(ref, candidate, [seg1km, seg2km, seg3km]);
		expect(result).toHaveLength(3);
		expect(result[0].label).toBe('0–1km');
		expect(result[1].label).toBe('1–2km');
		expect(result[2].label).toBe('2–3km');
	});

	it('computeSegmentDeltas_emptySegments_returnsEmptyArray', () => {
		const records = [makeRecord(0, 0), makeRecord(1000, 300)];
		const ref = makeActivity(records);
		const candidate = makeActivity(records);
		expect(computeSegmentDeltas(ref, candidate, [])).toEqual([]);
	});
});
