import { describe, it, expect } from 'vitest';
import { computeTimeOffsets, computeAnchoredOffsets, activitiesOverlap } from './timestamp.ts';
import { findAnchor } from './anchor.ts';
import type { Activity, ActivityRecord } from '$lib/types';

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
		firstGpsFixIndex: null,
		firstGpsMovementIndex: null,
		timerStartTime: null,
		firstIndoorMovementIndex: null,
		firstWorkoutStepTime: null,
		subSport: undefined,
		isIndoor: false,
		// No GPS/timer → fileStart anchor; timestamp must be startTime for fallback to work
		anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: startTime, source: 'fileStart' as const },
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

// ---- helpers for computeAnchoredOffsets tests ----

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date('2025-01-01T10:00:00Z'),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function makeActivityWithGps(id: string, records: ActivityRecord[], opts: {
	firstGpsMovementIndex?: number | null;
	firstGpsFixIndex?: number | null;
	timerStartTime?: Date | null;
} = {}): Activity {
	const a: Activity = {
		id,
		filename: `${id}.fit`,
		startTime: records[0]?.timestamp ?? new Date(0),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records,
		laps: [],
		devices: [],
		deviceStreams: [],
		firstGpsFixIndex: opts.firstGpsFixIndex ?? null,
		firstGpsMovementIndex: opts.firstGpsMovementIndex ?? null,
		firstIndoorMovementIndex: null,
		firstWorkoutStepTime: null,
		subSport: undefined,
		isIndoor: false,
		timerStartTime: opts.timerStartTime ?? null,
		anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(0), source: 'fileStart' as const },
	};
	a.anchor = findAnchor(a);
	return a;
}

describe('computeAnchoredOffsets', () => {
	it('computeAnchoredOffsets_emptyArray_returnsEmptyMap', () => {
		const result = computeAnchoredOffsets([]);
		expect(result.size).toBe(0);
	});

	it('computeAnchoredOffsets_singleActivity_returnsZero', () => {
		const r = makeRecord({ timestamp: T0, elapsedSeconds: 0 });
		const a = makeActivityWithGps('a', [r], { firstGpsMovementIndex: 0 });
		const result = computeAnchoredOffsets([a]);
		expect(result.get('a')).toBe(0);
	});

	it('computeAnchoredOffsets_twoFilesGpsMovementAnchors_offsetIsAnchorTimestampDiff', () => {
		// Reference: GPS movement at T0; other: GPS movement at T30
		// Expected offset for other = (T0 - T30) = -30s (other started 30s later in wall time)
		const rA = makeRecord({ timestamp: T0, elapsedSeconds: 5 });
		const rB = makeRecord({ timestamp: T30, elapsedSeconds: 5 });
		const a = makeActivityWithGps('a', [rA], { firstGpsMovementIndex: 0 });
		const b = makeActivityWithGps('b', [rB], { firstGpsMovementIndex: 0 });
		const result = computeAnchoredOffsets([a, b]);
		expect(result.get('a')).toBe(0);
		expect(result.get('b')).toBe(-30);
	});

	it('computeAnchoredOffsets_preRecordingOffset_aligns_toGpsAnchor_notFileStart', () => {
		// File A: started recording at T0, GPS movement at T0 (elapsedSeconds 0)
		// File B: started recording at T0 also (same wall time), GPS movement at T30 (30s into recording)
		// Both athletes are at the same GPS location at T30.
		// File B should have offset = -(30) so charts align at the GPS movement moment.
		const rA0 = makeRecord({ timestamp: T0, elapsedSeconds: 0 });
		const rA_move = makeRecord({ timestamp: T0, elapsedSeconds: 0 });
		const rB0 = makeRecord({ timestamp: T0, elapsedSeconds: 0 });
		const rB_move = makeRecord({ timestamp: T30, elapsedSeconds: 30 });

		const a = makeActivityWithGps('a', [rA0, rA_move], { firstGpsMovementIndex: 0 });
		const b = makeActivityWithGps('b', [rB0, rB_move], { firstGpsMovementIndex: 1 });
		const result = computeAnchoredOffsets([a, b]);
		expect(result.get('a')).toBe(0);
		expect(result.get('b')).toBe(-30);
	});

	it('computeAnchoredOffsets_timerEventPriority_usesTimerNotGpsMovement', () => {
		// File A: timer at T0; File B: timer at T5
		// GPS movement in both at T30 — should be ignored in favour of timer
		const timerA = T0;
		const timerB = T5;
		const rA = [
			makeRecord({ timestamp: T0, elapsedSeconds: 0 }),
			makeRecord({ timestamp: T30, elapsedSeconds: 30, speed: 5, position: { lat: 51.5, lon: -0.1 } }),
		];
		const rB = [
			makeRecord({ timestamp: T5, elapsedSeconds: 0 }),
			makeRecord({ timestamp: T30, elapsedSeconds: 25, speed: 5, position: { lat: 51.5, lon: -0.1 } }),
		];
		const a = makeActivityWithGps('a', rA, { firstGpsMovementIndex: 1, timerStartTime: timerA });
		const b = makeActivityWithGps('b', rB, { firstGpsMovementIndex: 1, timerStartTime: timerB });
		const result = computeAnchoredOffsets([a, b]);
		expect(result.get('a')).toBe(0);
		// Timer B is T5, timer A is T0 → offset for B = (T0 - T5) = -5s
		expect(result.get('b')).toBe(-5);
	});

	it('computeAnchoredOffsets_noGpsNoTimer_fallsBackToStartTime', () => {
		// Activities with no GPS fall back to raw startTime difference (existing behaviour)
		const a = makeActivity('a', T0);
		const b = makeActivity('b', T30);
		const result = computeAnchoredOffsets([a, b]);
		expect(result.get('a')).toBe(0);
		expect(result.get('b')).toBe(-30);
	});

	it('computeAnchoredOffsets_referenceAlwaysZero', () => {
		const rA = makeRecord({ timestamp: T30, elapsedSeconds: 0 });
		const rB = makeRecord({ timestamp: T0, elapsedSeconds: 0 });
		const a = makeActivityWithGps('a', [rA], { firstGpsMovementIndex: 0 });
		const b = makeActivityWithGps('b', [rB], { firstGpsMovementIndex: 0 });
		const result = computeAnchoredOffsets([a, b]);
		expect(result.get('a')).toBe(0);
	});
});
