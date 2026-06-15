import { describe, it, expect } from 'vitest';
import { extractGpsPointsWithMetric, computeMetricRange, metricValuesForGpsPoints } from './ActivityMap.utils.ts';
import type { GpsPointWithMetric } from '$lib/types';
import type { Activity, ActivityRecord } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

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
	return makeBaseActivity({
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
	});
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
		expect(result[0]).toEqual({ lat: 51.0, lon: -1.0, distance: 0, recordIndex: 0, metricValue: 140 });
		expect(result[1]).toEqual({ lat: 51.01, lon: -1.01, distance: 1000, recordIndex: 1, metricValue: 155 });
		expect(result[2]).toEqual({ lat: 51.02, lon: -1.02, distance: 2000, recordIndex: 2, metricValue: 162 });
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

// ---------------------------------------------------------------------------
// metricValuesForGpsPoints
// ---------------------------------------------------------------------------
describe('metricValuesForGpsPoints', () => {
	it('metricValuesForGpsPoints_emptyInput_returnsEmpty', () => {
		const result = metricValuesForGpsPoints([], []);
		expect(result).toHaveLength(0);
	});

	it('metricValuesForGpsPoints_usesRecordIndex_notFilteredIndex', () => {
		// GPS point with recordIndex=2 should pick up smoothedValues[2], not smoothedValues[0]
		const gpsPoints = [
			{ lat: 51.0, lon: -1.0, distance: 0, recordIndex: 2 },
		];
		const smoothed = [100, 150, 200]; // smoothedValues[2] = 200
		const result = metricValuesForGpsPoints(gpsPoints, smoothed);
		expect(result).toHaveLength(1);
		expect(result[0].metricValue).toBe(200);
	});

	it('metricValuesForGpsPoints_nullSmoothedValue_returnsNullMetric', () => {
		const gpsPoints = [
			{ lat: 51.0, lon: -1.0, distance: 0, recordIndex: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000, recordIndex: 1 },
		];
		const smoothed = [null, 155];
		const result = metricValuesForGpsPoints(gpsPoints, smoothed);
		expect(result).toHaveLength(2);
		expect(result[0].metricValue).toBeNull();
		expect(result[1].metricValue).toBe(155);
	});

	it('metricValuesForGpsPoints_preservesLatLonDistance', () => {
		const gpsPoints = [
			{ lat: 51.5, lon: -0.1, distance: 500, recordIndex: 3 },
		];
		const smoothed = [0, 0, 0, 140];
		const result = metricValuesForGpsPoints(gpsPoints, smoothed);
		expect(result[0].lat).toBe(51.5);
		expect(result[0].lon).toBe(-0.1);
		expect(result[0].distance).toBe(500);
		expect(result[0].metricValue).toBe(140);
	});

	it('metricValuesForGpsPoints_multiplePoints_mapsEachByRecordIndex', () => {
		const gpsPoints = [
			{ lat: 51.0, lon: -1.0, distance: 0, recordIndex: 0 },
			{ lat: 51.01, lon: -1.01, distance: 1000, recordIndex: 3 },
			{ lat: 51.02, lon: -1.02, distance: 2000, recordIndex: 6 },
		];
		const smoothed = [10, 20, 30, 40, 50, 60, 70]; // indexes 0=10, 3=40, 6=70
		const result = metricValuesForGpsPoints(gpsPoints, smoothed);
		expect(result).toHaveLength(3);
		expect(result[0].metricValue).toBe(10);
		expect(result[1].metricValue).toBe(40);
		expect(result[2].metricValue).toBe(70);
	});
});
