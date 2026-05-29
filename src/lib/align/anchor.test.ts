import { describe, it, expect } from 'vitest';
import { findAnchor, haversineDistance, GPS_PROXIMITY_THRESHOLD_M } from './anchor.ts';
import type { Activity, ActivityRecord } from '$lib/types';

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date('2025-01-01T10:00:00Z'),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function makeActivity(overrides: Partial<Activity> = {}): Activity {
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date('2025-01-01T10:00:00Z'),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [],
		laps: [],
		devices: [],
		deviceStreams: [],
		firstGpsFixIndex: null,
		firstGpsMovementIndex: null,
		timerStartTime: null,
		...overrides,
	};
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
