import { describe, it, expect } from 'vitest';
import { computeTimeOffsets, activitiesOverlap } from './timestamp.ts';
import type { Activity } from '$lib/types';

function makeActivity(id: string, startTime: Date): Activity {
	return {
		id,
		filename: `${id}.fit`,
		startTime,
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [],
		laps: [],
		devices: [],
		deviceStreams: [],
	};
}

const T0 = new Date('2025-01-01T10:00:00Z');
const T5 = new Date('2025-01-01T10:00:05Z');  // +5 s
const T30 = new Date('2025-01-01T10:00:30Z'); // +30 s
const NEXT_DAY = new Date('2025-01-02T10:00:00Z'); // +86400 s

describe('computeTimeOffsets', () => {
	it('computeTimeOffsets_emptyArray_returnsEmptyMap', () => {
		const result = computeTimeOffsets([]);
		expect(result.size).toBe(0);
	});

	it('computeTimeOffsets_singleActivity_returnsZeroOffset', () => {
		const a = makeActivity('a', T0);
		const result = computeTimeOffsets([a]);
		expect(result.get('a')).toBe(0);
	});

	it('computeTimeOffsets_firstActivityIsReference_alwaysZero', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T5);
		const result = computeTimeOffsets([a, b]);
		expect(result.get('a')).toBe(0);
	});

	it('computeTimeOffsets_twoActivities_computesOffsetInSeconds', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T5);
		const result = computeTimeOffsets([a, b]);
		expect(result.get('b')).toBe(5);
	});

	it('computeTimeOffsets_secondActivityStartsEarlier_offsetIsNegative', () => {
		const a = makeActivity('a', T5);
		const b = makeActivity('b', T0);
		const result = computeTimeOffsets([a, b]);
		expect(result.get('b')).toBe(-5);
	});

	it('computeTimeOffsets_threeActivities_allRelativeToFirst', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T5);
		const c = makeActivity('c', T30);
		const result = computeTimeOffsets([a, b, c]);
		expect(result.get('a')).toBe(0);
		expect(result.get('b')).toBe(5);
		expect(result.get('c')).toBe(30);
	});

	it('computeTimeOffsets_identicalStartTimes_allZero', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T0);
		const result = computeTimeOffsets([a, b]);
		expect(result.get('a')).toBe(0);
		expect(result.get('b')).toBe(0);
	});

	it('computeTimeOffsets_returnsEntryForEveryActivity', () => {
		const activities = [
			makeActivity('a', T0),
			makeActivity('b', T5),
			makeActivity('c', T30),
		];
		const result = computeTimeOffsets(activities);
		expect(result.size).toBe(3);
		expect(result.has('a')).toBe(true);
		expect(result.has('b')).toBe(true);
		expect(result.has('c')).toBe(true);
	});
});

describe('activitiesOverlap', () => {
	it('activitiesOverlap_emptyArray_returnsTrue', () => {
		expect(activitiesOverlap([])).toBe(true);
	});

	it('activitiesOverlap_singleActivity_returnsTrue', () => {
		expect(activitiesOverlap([makeActivity('a', T0)])).toBe(true);
	});

	it('activitiesOverlap_filesWithinOneHour_returnsTrue', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T30);
		expect(activitiesOverlap([a, b])).toBe(true);
	});

	it('activitiesOverlap_filesOnDifferentDays_returnsFalse', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', NEXT_DAY);
		expect(activitiesOverlap([a, b])).toBe(false);
	});

	it('activitiesOverlap_exactly3600sApart_returnsFalse', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', new Date(T0.getTime() + 3600 * 1000));
		expect(activitiesOverlap([a, b])).toBe(false);
	});

	it('activitiesOverlap_just59MinutesApart_returnsTrue', () => {
		const a = makeActivity('a', T0);
		const b = makeActivity('b', new Date(T0.getTime() + 3599 * 1000));
		expect(activitiesOverlap([a, b])).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// differentSessions gate predicate
// The compare-page gate is: !activitiesOverlap(activities)
// These tests document the expected gate behaviour for each scenario
// (AC1, AC2, AC3 from issue #70).
// ---------------------------------------------------------------------------
describe('differentSessions gate predicate', () => {
	it('gate_emptyArray_shouldNotGate', () => {
		// AC1 edge: 0 files — compare should be accessible
		expect(!activitiesOverlap([])).toBe(false);
	});

	it('gate_singleFile_shouldNotGate', () => {
		// AC1: single file — compare must always be accessible
		expect(!activitiesOverlap([makeActivity('a', T0)])).toBe(false);
	});

	it('gate_twoFilesWithinOneHour_shouldNotGate', () => {
		// AC2: same-session multi-file — compare must be accessible
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T30);
		expect(!activitiesOverlap([a, b])).toBe(false);
	});

	it('gate_twoFilesOnDifferentDays_shouldGate', () => {
		// AC3: different-day files — compare must be gated
		const a = makeActivity('a', T0);
		const b = makeActivity('b', NEXT_DAY);
		expect(!activitiesOverlap([a, b])).toBe(true);
	});

	it('gate_threeFilesAllSameSession_shouldNotGate', () => {
		// AC2: three overlapping files — compare must be accessible
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T5);
		const c = makeActivity('c', T30);
		expect(!activitiesOverlap([a, b, c])).toBe(false);
	});

	it('gate_threeFilesOneOutlier_shouldGate', () => {
		// AC3: three files where one is from a different day
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T30);
		const c = makeActivity('c', NEXT_DAY);
		expect(!activitiesOverlap([a, b, c])).toBe(true);
	});
});
