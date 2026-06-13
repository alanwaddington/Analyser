import { describe, it, expect } from 'vitest';
import { extractGpsPointsWithMetric, computeMetricRange } from './ActivityMap.utils.ts';
import type { GpsPointWithMetric } from './ActivityMap.utils.ts';
import type { Activity, ActivityRecord } from '$lib/types';

function makeRecord(
	distance: number,
	elapsedSeconds: number,
	lat?: number,
	lon?: number,
	heartRate?: number,
): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds,
		distance,
		heartRate,
		position: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
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
		availableChannels: new Set(),
	};
}

// ---------------------------------------------------------------------------
// extractGpsPointsWithMetric
// ---------------------------------------------------------------------------
describe('extractGpsPointsWithMetric', () => {
	it('extractGpsPointsWithMetric_happyPath_returnsGpsPointsWithValues', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0, 140),
			makeRecord(1000, 60, 51.01, -1.01, 155),
			makeRecord(2000, 120, 51.02, -1.02, 162),
		];
		const activity = makeActivity(records);
		const smoothed = [140, 155, 162];

		const result = extractGpsPointsWithMetric(activity, smoothed);

		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({ lat: 51.0, lon: -1.0, distance: 0, metricValue: 140 });
		expect(result[1]).toEqual({ lat: 51.01, lon: -1.01, distance: 1000, metricValue: 155 });
		expect(result[2]).toEqual({ lat: 51.02, lon: -1.02, distance: 2000, metricValue: 162 });
	});

	it('extractGpsPointsWithMetric_recordsWithoutGps_areSkipped', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0, 140),
			makeRecord(500, 30, undefined, undefined, 148),    // no GPS
			makeRecord(1000, 60, 51.01, -1.01, 155),
		];
		const activity = makeActivity(records);
		const smoothed = [140, 148, 155];

		const result = extractGpsPointsWithMetric(activity, smoothed);

		// Only 2 records have GPS
		expect(result).toHaveLength(2);
		expect(result[0].metricValue).toBe(140);
		expect(result[1].metricValue).toBe(155);
	});

	it('extractGpsPointsWithMetric_nullSmoothedValues_preservedAsNull', () => {
		const records = [
			makeRecord(0, 0, 51.0, -1.0, 140),
			makeRecord(1000, 60, 51.01, -1.01, 155),
		];
		const activity = makeActivity(records);
		const smoothed = [null, 155];

		const result = extractGpsPointsWithMetric(activity, smoothed);

		expect(result).toHaveLength(2);
		expect(result[0].metricValue).toBeNull();
		expect(result[1].metricValue).toBe(155);
	});

	it('extractGpsPointsWithMetric_emptyRecords_returnsEmpty', () => {
		const activity = makeActivity([]);
		const result = extractGpsPointsWithMetric(activity, []);
		expect(result).toHaveLength(0);
	});

	it('extractGpsPointsWithMetric_noGpsRecords_returnsEmpty', () => {
		const records = [
			makeRecord(0, 0),
			makeRecord(1000, 60),
		];
		const activity = makeActivity(records);
		const smoothed = [null, null];

		const result = extractGpsPointsWithMetric(activity, smoothed);
		expect(result).toHaveLength(0);
	});

	it('extractGpsPointsWithMetric_metricAlignedByRecordIndex', () => {
		// Record 0: no GPS, metric 100
		// Record 1: GPS, metric 150
		// Record 2: GPS, metric 200
		const records = [
			makeRecord(0, 0, undefined, undefined, 100),
			makeRecord(1000, 60, 51.0, -1.0, 150),
			makeRecord(2000, 120, 51.01, -1.01, 200),
		];
		const activity = makeActivity(records);
		const smoothed = [100, 150, 200];

		const result = extractGpsPointsWithMetric(activity, smoothed);

		// Index 1 has GPS → metricValue from smoothed[1] = 150
		// Index 2 has GPS → metricValue from smoothed[2] = 200
		expect(result).toHaveLength(2);
		expect(result[0].metricValue).toBe(150);
		expect(result[1].metricValue).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// computeMetricRange
// ---------------------------------------------------------------------------
describe('computeMetricRange', () => {
	it('computeMetricRange_happyPath_returnsMinMax', () => {
		const points: GpsPointWithMetric[][] = [
			[
				{ lat: 51.0, lon: -1.0, distance: 0, metricValue: 140 },
				{ lat: 51.01, lon: -1.01, distance: 1000, metricValue: 165 },
			],
		];

		const result = computeMetricRange(points);

		expect(result).not.toBeNull();
		expect(result!.min).toBe(140);
		expect(result!.max).toBe(165);
	});

	it('computeMetricRange_multipleActivities_computesGlobalRange', () => {
		const points: GpsPointWithMetric[][] = [
			[
				{ lat: 51.0, lon: -1.0, distance: 0, metricValue: 140 },
				{ lat: 51.01, lon: -1.01, distance: 1000, metricValue: 155 },
			],
			[
				{ lat: 52.0, lon: -2.0, distance: 0, metricValue: 130 },
				{ lat: 52.01, lon: -2.01, distance: 1000, metricValue: 180 },
			],
		];

		const result = computeMetricRange(points);

		expect(result).not.toBeNull();
		expect(result!.min).toBe(130);
		expect(result!.max).toBe(180);
	});

	it('computeMetricRange_ignoresNullValues', () => {
		const points: GpsPointWithMetric[][] = [
			[
				{ lat: 51.0, lon: -1.0, distance: 0, metricValue: null },
				{ lat: 51.01, lon: -1.01, distance: 1000, metricValue: 155 },
			],
		];

		const result = computeMetricRange(points);

		expect(result).not.toBeNull();
		expect(result!.min).toBe(155);
		expect(result!.max).toBe(155);
	});

	it('computeMetricRange_allNullValues_returnsNull', () => {
		const points: GpsPointWithMetric[][] = [
			[
				{ lat: 51.0, lon: -1.0, distance: 0, metricValue: null },
				{ lat: 51.01, lon: -1.01, distance: 1000, metricValue: null },
			],
		];

		const result = computeMetricRange(points);
		expect(result).toBeNull();
	});

	it('computeMetricRange_emptyInput_returnsNull', () => {
		const result = computeMetricRange([]);
		expect(result).toBeNull();
	});

	it('computeMetricRange_emptySubArray_returnsNull', () => {
		const result = computeMetricRange([[]]);
		expect(result).toBeNull();
	});

	it('computeMetricRange_singleValue_minEqualsMax', () => {
		const points: GpsPointWithMetric[][] = [
			[{ lat: 51.0, lon: -1.0, distance: 0, metricValue: 150 }],
		];

		const result = computeMetricRange(points);

		expect(result).not.toBeNull();
		expect(result!.min).toBe(150);
		expect(result!.max).toBe(150);
	});
});
