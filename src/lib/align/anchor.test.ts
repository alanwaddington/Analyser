import { describe, it, expect } from 'vitest';
import { findAnchor, haversineDistance, GPS_PROXIMITY_THRESHOLD_M, anchorsAreDistant } from './anchor.ts';
import type { Activity, ActivityRecord } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date('2025-01-01T10:00:00Z'),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
	return makeBaseActivity({
		startTime: new Date('2025-01-01T10:00:00Z'),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		...overrides,
	});
}

// ---- findAnchor: anchor source hierarchy ----

describe('findAnchor — anchor source hierarchy', () => {
	it('findAnchor_noGpsNoTimer_returnsFileStart', () => {
		const r = makeRecord({ elapsedSeconds: 0, distance: 0 });
		const activity = makeActivity({ records: [r] });
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('fileStart');
		expect(anchor.recordIndex).toBe(0);
	});

	it('findAnchor_gpsFixOnly_returnsGpsFix', () => {
		const records = [
			makeRecord({ elapsedSeconds: 0, distance: 0, speed: 0, position: { lat: 51.5, lon: -0.1 } }),
		];
		const activity = makeActivity({ records, firstGpsFixIndex: 0, firstGpsMovementIndex: null });
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('gpsFix');
		expect(anchor.recordIndex).toBe(0);
	});

	it('findAnchor_gpsMovement_returnsGpsMovement', () => {
		const records = [
			makeRecord({ elapsedSeconds: 0, distance: 0, speed: 0, position: { lat: 51.5, lon: -0.1 } }),
			makeRecord({ elapsedSeconds: 5, distance: 10, speed: 7, position: { lat: 51.5001, lon: -0.1001 } }),
		];
		const activity = makeActivity({ records, firstGpsFixIndex: 0, firstGpsMovementIndex: 1 });
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('gpsMovement');
		expect(anchor.recordIndex).toBe(1);
	});

	it('findAnchor_timerEventBeforeGpsMovement_usesTimer', () => {
		const timerTime = new Date('2025-01-01T10:00:03Z');
		const records = [
			makeRecord({ timestamp: new Date('2025-01-01T10:00:00Z'), elapsedSeconds: 0, distance: 0, speed: 0 }),
			makeRecord({ timestamp: new Date('2025-01-01T10:00:03Z'), elapsedSeconds: 3, distance: 0, speed: 0 }),
			makeRecord({ timestamp: new Date('2025-01-01T10:00:07Z'), elapsedSeconds: 7, distance: 10, speed: 5, position: { lat: 51.5, lon: -0.1 } }),
		];
		const activity = makeActivity({
			records,
			firstGpsFixIndex: 2,
			firstGpsMovementIndex: 2,
			timerStartTime: timerTime,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('timer');
		expect(anchor.recordIndex).toBe(1);
	});

	it('findAnchor_timerAndGpsMovement_timerTakesPriority', () => {
		// Even when GPS movement is available, timer wins
		const timerTime = new Date('2025-01-01T10:00:02Z');
		const records = [
			makeRecord({ timestamp: new Date('2025-01-01T10:00:00Z'), elapsedSeconds: 0, distance: 0 }),
			makeRecord({ timestamp: new Date('2025-01-01T10:00:02Z'), elapsedSeconds: 2, distance: 0, speed: 0 }),
			makeRecord({ timestamp: new Date('2025-01-01T10:00:05Z'), elapsedSeconds: 5, distance: 15, speed: 8, position: { lat: 51.5, lon: -0.1 } }),
		];
		const activity = makeActivity({
			records,
			firstGpsFixIndex: 2,
			firstGpsMovementIndex: 2,
			timerStartTime: timerTime,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('timer');
	});

	it('findAnchor_timerMoreThan30sFromAllRecords_fallsBackToGpsMovement', () => {
		// Timer event is an hour before the first record — should be ignored
		const timerTime = new Date('2025-01-01T09:00:00Z'); // 1 hour before records
		const records = [
			makeRecord({ timestamp: new Date('2025-01-01T10:00:00Z'), elapsedSeconds: 0, distance: 0, speed: 5, position: { lat: 51.5, lon: -0.1 } }),
		];
		const activity = makeActivity({
			records,
			firstGpsFixIndex: 0,
			firstGpsMovementIndex: 0,
			timerStartTime: timerTime,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('gpsMovement');
	});

	it('findAnchor_timerWithin30sOfFirstRecord_usesTimer', () => {
		// Timer event is 20s before the first record — within tolerance, should be used
		const firstRecordTime = new Date('2025-01-01T10:00:20Z');
		const timerTime   = new Date('2025-01-01T10:00:00Z'); // 20s before first record
		const records = [
			makeRecord({ timestamp: firstRecordTime, elapsedSeconds: 20, distance: 10, speed: 5, position: { lat: 51.5, lon: -0.1 } }),
		];
		const activity = makeActivity({
			records,
			firstGpsFixIndex: 0,
			firstGpsMovementIndex: 0,
			timerStartTime: timerTime,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('timer');
		expect(anchor.recordIndex).toBe(0);
	});

	it('findAnchor_emptyRecords_returnsFileStartAtIndexZero', () => {
		const activity = makeActivity({ records: [] });
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('fileStart');
		expect(anchor.recordIndex).toBe(0);
		expect(anchor.distanceMetres).toBe(0);
		expect(anchor.elapsedSeconds).toBe(0);
	});
});

// ---- findAnchor: anchor metadata correctness ----

describe('findAnchor — anchor metadata', () => {
	it('findAnchor_gpsMovementAtRecordTwo_distanceAndElapsedFromThatRecord', () => {
		const records = [
			makeRecord({ elapsedSeconds: 0, distance: 0 }),
			makeRecord({ elapsedSeconds: 3, distance: 5 }),
			makeRecord({ elapsedSeconds: 8, distance: 50, speed: 10, position: { lat: 51.5, lon: -0.1 } }),
		];
		const activity = makeActivity({ records, firstGpsFixIndex: 2, firstGpsMovementIndex: 2 });
		const anchor = findAnchor(activity);
		expect(anchor.recordIndex).toBe(2);
		expect(anchor.distanceMetres).toBe(50);
		expect(anchor.elapsedSeconds).toBe(8);
	});

	it('findAnchor_timerMatchesRecord_timestampMatchesTimerTime', () => {
		const timerTime = new Date('2025-01-01T10:00:05Z');
		const records = [
			makeRecord({ timestamp: new Date('2025-01-01T10:00:00Z'), elapsedSeconds: 0, distance: 0 }),
			makeRecord({ timestamp: timerTime, elapsedSeconds: 5, distance: 20 }),
		];
		const activity = makeActivity({ records, timerStartTime: timerTime });
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('timer');
		expect(anchor.timestamp).toEqual(timerTime);
	});
});

// ---- haversineDistance ----

describe('haversineDistance', () => {
	it('haversineDistance_samePoint_returnsZero', () => {
		const d = haversineDistance({ lat: 51.5, lon: -0.1 }, { lat: 51.5, lon: -0.1 });
		expect(d).toBe(0);
	});

	it('haversineDistance_twoPointsCloseBy_returnsApproximateMetres', () => {
		// These two points are ~15.7m apart (verified externally)
		const d = haversineDistance({ lat: 51.5, lon: -0.1 }, { lat: 51.50014, lon: -0.1 });
		expect(d).toBeGreaterThan(14);
		expect(d).toBeLessThan(17);
	});

	it('haversineDistance_londonToParis_approximately343km', () => {
		// London: 51.5074, -0.1278 | Paris: 48.8566, 2.3522 → ~343 km
		const d = haversineDistance({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 });
		expect(d).toBeGreaterThan(340_000);
		expect(d).toBeLessThan(346_000);
	});
});

// ---- anchorsAreDistant ----

describe('anchorsAreDistant', () => {
	function makeGpsActivity(lat: number, lon: number, source: 'gpsMovement' | 'gpsFix' = 'gpsMovement'): Activity {
		const pos = { lat, lon };
		const r = makeRecord({ speed: source === 'gpsMovement' ? 5 : 0, position: pos });
		return makeActivity({
			records: [r],
			firstGpsFixIndex: 0,
			firstGpsMovementIndex: source === 'gpsMovement' ? 0 : null,
			anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(), source },
		});
	}

	it('anchorsAreDistant_fewerThanTwoActivities_returnsFalse', () => {
		expect(anchorsAreDistant([])).toBe(false);
		const a = makeGpsActivity(51.5, -0.1);
		expect(anchorsAreDistant([a])).toBe(false);
	});

	it('anchorsAreDistant_twoActivitiesCloseBy_returnsFalse', () => {
		// Two points ~11m apart (well within 50m threshold)
		const a = makeGpsActivity(51.5, -0.1);
		const b = makeGpsActivity(51.50010, -0.1);
		expect(anchorsAreDistant([a, b])).toBe(false);
	});

	it('anchorsAreDistant_twoActivitiesFarApart_returnsTrue', () => {
		// Two points ~1km apart (well beyond 50m threshold)
		const a = makeGpsActivity(51.5, -0.1);
		const b = makeGpsActivity(51.510, -0.1);
		expect(anchorsAreDistant([a, b])).toBe(true);
	});

	it('anchorsAreDistant_fileStartAnchorsIgnored_returnsFalse', () => {
		// Activities with no GPS (fileStart) should not trigger the warning
		const a = makeActivity({ anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(), source: 'fileStart' } });
		const b = makeActivity({ anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(), source: 'fileStart' } });
		expect(anchorsAreDistant([a, b])).toBe(false);
	});

	it('anchorsAreDistant_onlyOneGpsAnchoredActivity_returnsFalse', () => {
		const gps = makeGpsActivity(51.5, -0.1);
		const noGps = makeActivity({ anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(), source: 'fileStart' } });
		expect(anchorsAreDistant([gps, noGps])).toBe(false);
	});
});

// ---- GPS_PROXIMITY_THRESHOLD_M ----

describe('GPS_PROXIMITY_THRESHOLD_M', () => {
	it('GPS_PROXIMITY_THRESHOLD_M_isPositiveNumber', () => {
		expect(GPS_PROXIMITY_THRESHOLD_M).toBeGreaterThan(0);
	});

	it('GPS_PROXIMITY_THRESHOLD_M_isAtLeast15metres', () => {
		// Must be generous enough to accommodate Parkrun crowd spread
		expect(GPS_PROXIMITY_THRESHOLD_M).toBeGreaterThanOrEqual(15);
	});
});

// ---- findAnchor: indoor hierarchy ----

describe('findAnchor — indoor anchor hierarchy', () => {
	const T0 = new Date('2025-01-01T10:00:00Z');
	const T_TIMER = new Date('2025-01-01T10:00:05Z');
	const T_WORKOUT = new Date('2025-01-01T10:00:10Z');

	function makeIndoorActivity(overrides: Partial<Activity> = {}): Activity {
		return makeActivity({ isIndoor: true, ...overrides });
	}

	it('findAnchor_indoor_timerPresent_usesTimer', () => {
		const r0 = makeRecord({ timestamp: T0, elapsedSeconds: 0, distance: 0 });
		const r1 = makeRecord({ timestamp: T_TIMER, elapsedSeconds: 5, distance: 0 });
		const activity = makeIndoorActivity({
			records: [r0, r1],
			timerStartTime: T_TIMER,
			firstWorkoutStepTime: T_WORKOUT,
			firstIndoorMovementIndex: 1,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('timer');
		expect(anchor.recordIndex).toBe(1);
	});

	it('findAnchor_indoor_noTimer_workoutStepPresent_usesWorkoutStep', () => {
		const r0 = makeRecord({ timestamp: T0, elapsedSeconds: 0, distance: 0 });
		const r1 = makeRecord({ timestamp: T_WORKOUT, elapsedSeconds: 10, distance: 0, power: 100 });
		const activity = makeIndoorActivity({
			records: [r0, r1],
			timerStartTime: null,
			firstWorkoutStepTime: T_WORKOUT,
			firstIndoorMovementIndex: 1,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('workoutStep');
		expect(anchor.recordIndex).toBe(1);
	});

	it('findAnchor_indoor_noTimerNoWorkout_movementPresent_usesIndoorMovement', () => {
		const r0 = makeRecord({ timestamp: T0, elapsedSeconds: 0, distance: 0, power: 0 });
		const r1 = makeRecord({ timestamp: T_WORKOUT, elapsedSeconds: 10, distance: 10, power: 150 });
		const activity = makeIndoorActivity({
			records: [r0, r1],
			timerStartTime: null,
			firstWorkoutStepTime: null,
			firstIndoorMovementIndex: 1,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('indoorMovement');
		expect(anchor.recordIndex).toBe(1);
	});

	it('findAnchor_indoor_noSignals_usesFileStart', () => {
		const r0 = makeRecord({ timestamp: T0, elapsedSeconds: 0, distance: 0 });
		const activity = makeIndoorActivity({
			records: [r0],
			timerStartTime: null,
			firstWorkoutStepTime: null,
			firstIndoorMovementIndex: null,
			startTime: T0,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('fileStart');
	});

	it('findAnchor_indoor_doesNotUseGpsMovement', () => {
		// Even when firstGpsMovementIndex is populated (fake GPS), indoor path ignores it
		const r0 = makeRecord({ timestamp: T0, position: { lat: 51.5, lon: -0.1 } });
		const r1 = makeRecord({ timestamp: T_TIMER, elapsedSeconds: 5, distance: 10, speed: 5, position: { lat: 51.501, lon: -0.1 } });
		const activity = makeIndoorActivity({
			records: [r0, r1],
			firstGpsFixIndex: 0,
			firstGpsMovementIndex: 1,
			timerStartTime: null,
			firstWorkoutStepTime: null,
			firstIndoorMovementIndex: 1,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('indoorMovement');
	});

	it('findAnchor_indoor_timerOutsideTolerance_fallsBackToWorkoutStep', () => {
		const farTimer = new Date(T0.getTime() + 120_000); // 2 min after any record
		const r0 = makeRecord({ timestamp: T0, elapsedSeconds: 0 });
		const activity = makeIndoorActivity({
			records: [r0],
			timerStartTime: farTimer,
			firstWorkoutStepTime: T_WORKOUT,
			firstIndoorMovementIndex: null,
		});
		const anchor = findAnchor(activity);
		// Timer is out of tolerance — should fall to workoutStep
		expect(anchor.source).toBe('workoutStep');
	});

	it('findAnchor_outdoor_indoorFieldsPresent_stillUsesGpsMovement', () => {
		// Outdoor activities should continue using GPS signals even if indoor fields are populated
		const r0 = makeRecord({ timestamp: T0, distance: 0, position: { lat: 51.5, lon: -0.1 } });
		const r1 = makeRecord({ timestamp: T_TIMER, elapsedSeconds: 5, distance: 10, speed: 5, position: { lat: 51.501, lon: -0.1 } });
		const activity = makeActivity({
			isIndoor: false,
			records: [r0, r1],
			firstGpsFixIndex: 0,
			firstGpsMovementIndex: 1,
			firstIndoorMovementIndex: 1,
			timerStartTime: null,
			firstWorkoutStepTime: null,
		});
		const anchor = findAnchor(activity);
		expect(anchor.source).toBe('gpsMovement');
	});
});
