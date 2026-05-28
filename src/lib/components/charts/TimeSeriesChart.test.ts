import { describe, it, expect } from 'vitest';
import { extractChannel, buildXValues, isDashed, effectiveAxisMode, computeSeriesStats, formatStatValue } from './TimeSeriesChart.utils.ts';
import type { ActivityRecord } from '$lib/types';

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// extractChannel
// ---------------------------------------------------------------------------
describe('extractChannel', () => {
	it('extractChannel_presentValues_returnsNumbers', () => {
		const records = [
			makeRecord({ heartRate: 120 }),
			makeRecord({ heartRate: 130 }),
			makeRecord({ heartRate: 140 }),
		];
		expect(extractChannel(records, 'heartRate')).toEqual([120, 130, 140]);
	});

	it('extractChannel_missingValues_returnsNull', () => {
		const records = [
			makeRecord({ heartRate: 120 }),
			makeRecord({}),
			makeRecord({ heartRate: 140 }),
		];
		expect(extractChannel(records, 'heartRate')).toEqual([120, null, 140]);
	});

	it('extractChannel_allMissing_returnsAllNull', () => {
		const records = [makeRecord(), makeRecord(), makeRecord()];
		expect(extractChannel(records, 'power')).toEqual([null, null, null]);
	});

	it('extractChannel_emptyRecords_returnsEmptyArray', () => {
		expect(extractChannel([], 'heartRate')).toEqual([]);
	});

	it('extractChannel_powerChannel_extractsCorrectField', () => {
		const records = [makeRecord({ power: 250 }), makeRecord({ power: 300 })];
		expect(extractChannel(records, 'power')).toEqual([250, 300]);
	});

	it('extractChannel_cadenceChannel_extractsCorrectField', () => {
		const records = [makeRecord({ cadence: 90 }), makeRecord({ cadence: 95 })];
		expect(extractChannel(records, 'cadence')).toEqual([90, 95]);
	});
});

// ---------------------------------------------------------------------------
// buildXValues
// ---------------------------------------------------------------------------
describe('buildXValues', () => {
	it('buildXValues_timeMode_returnsElapsedSeconds', () => {
		const records = [
			makeRecord({ elapsedSeconds: 0 }),
			makeRecord({ elapsedSeconds: 1 }),
			makeRecord({ elapsedSeconds: 2 }),
		];
		expect(buildXValues(records, 'time')).toEqual([0, 1, 2]);
	});

	it('buildXValues_distanceMode_returnsDistanceInKm', () => {
		const records = [
			makeRecord({ distance: 0 }),
			makeRecord({ distance: 500 }),
			makeRecord({ distance: 1000 }),
		];
		expect(buildXValues(records, 'distance')).toEqual([0, 0.5, 1]);
	});

	it('buildXValues_emptyRecords_returnsEmptyArray', () => {
		expect(buildXValues([], 'time')).toEqual([]);
		expect(buildXValues([], 'distance')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// isDashed
// ---------------------------------------------------------------------------
describe('isDashed', () => {
	// Device mode: referenceIndex === undefined
	it('isDashed_deviceMode_firstSeriesSolid', () => {
		expect(isDashed(0, undefined)).toBe(false);
	});

	it('isDashed_deviceMode_secondSeriesDashed', () => {
		expect(isDashed(1, undefined)).toBe(true);
	});

	it('isDashed_deviceMode_thirdSeriesDashed', () => {
		expect(isDashed(2, undefined)).toBe(true);
	});

	// Event mode: referenceIndex is set
	it('isDashed_eventMode_referenceIndexDashed', () => {
		expect(isDashed(0, 0)).toBe(true);
	});

	it('isDashed_eventMode_nonReferenceIndexSolid', () => {
		expect(isDashed(1, 0)).toBe(false);
	});

	it('isDashed_eventMode_secondReferenceIndexDashed', () => {
		expect(isDashed(1, 1)).toBe(true);
	});

	it('isDashed_eventMode_firstSeriesSolidWhenRefIsSecond', () => {
		expect(isDashed(0, 1)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// effectiveAxisMode
// ---------------------------------------------------------------------------
describe('effectiveAxisMode', () => {
	it('effectiveAxisMode_forceTrue_alwaysReturnsDistance', () => {
		expect(effectiveAxisMode('time', true)).toBe('distance');
	});

	it('effectiveAxisMode_forceTrue_distanceModeStillReturnsDistance', () => {
		expect(effectiveAxisMode('distance', true)).toBe('distance');
	});

	it('effectiveAxisMode_forceFalse_returnsStoreModeTime', () => {
		expect(effectiveAxisMode('time', false)).toBe('time');
	});

	it('effectiveAxisMode_forceFalse_returnsStoreModeDistance', () => {
		expect(effectiveAxisMode('distance', false)).toBe('distance');
	});

	it('effectiveAxisMode_forceUndefined_returnsStoreModeTime', () => {
		expect(effectiveAxisMode('time', undefined)).toBe('time');
	});

	it('effectiveAxisMode_forceUndefined_returnsStoreModeDistance', () => {
		expect(effectiveAxisMode('distance', undefined)).toBe('distance');
	});
});

// ---------------------------------------------------------------------------
// formatStatValue
// ---------------------------------------------------------------------------
describe('formatStatValue', () => {
	it('formatStatValue_paceChannel_returnsMSSFormat', () => {
		expect(formatStatValue(5.5, 'pace')).toBe('5:30');
	});

	it('formatStatValue_paceChannel_roundsToNearestSecond', () => {
		expect(formatStatValue(4.25, 'pace')).toBe('4:15');
	});

	it('formatStatValue_heartRateChannel_returnsWholeNumber', () => {
		expect(formatStatValue(142.7, 'heartRate')).toBe('143');
	});

	it('formatStatValue_powerChannel_returnsWholeNumber', () => {
		expect(formatStatValue(250.9, 'power')).toBe('251');
	});

	it('formatStatValue_speedChannel_returnsOneDecimal', () => {
		expect(formatStatValue(12.34, 'speed')).toBe('12.3');
	});

	it('formatStatValue_temperatureChannel_returnsOneDecimal', () => {
		expect(formatStatValue(36.678, 'temperature')).toBe('36.7');
	});
});

// ---------------------------------------------------------------------------
// computeSeriesStats
// ---------------------------------------------------------------------------
describe('computeSeriesStats', () => {
	const heartRateData: [number, number | null][] = [
		[0, 120], [1, 130], [2, 140], [3, 150], [4, 160],
	];
	const paceData: [number, number | null][] = [
		[0, 4.0], [1, 4.5], [2, 5.0], [3, 5.5], [4, 6.0],
	];
	const speedData: [number, number | null][] = [
		[0, 10.1], [1, 12.3], [2, 15.7],
	];

	it('computeSeriesStats_heartRate_returnsFormattedMin', () => {
		const result = computeSeriesStats(heartRateData, 'heartRate', 'HR', '#ff0000');
		expect(result).not.toBeNull();
		expect(result!.min).toBe('120');
	});

	it('computeSeriesStats_heartRate_returnsCorrectMinRaw', () => {
		const result = computeSeriesStats(heartRateData, 'heartRate', 'HR', '#ff0000');
		expect(result!.minRaw).toBe(120);
	});

	it('computeSeriesStats_pace_minIsSlowestPace', () => {
		// paceData: [4.0, 4.5, 5.0, 5.5, 6.0] — 6.0 is slowest (highest numeric = min effort)
		const result = computeSeriesStats(paceData, 'pace', 'Pace', '#0000ff');
		expect(result).not.toBeNull();
		expect(result!.min).toBe('6:00');
		expect(result!.minRaw).toBe(6.0);
	});

	it('computeSeriesStats_pace_maxIsFastestPace', () => {
		// paceData: [4.0, 4.5, 5.0, 5.5, 6.0] — 4.0 is fastest (lowest numeric = max effort)
		const result = computeSeriesStats(paceData, 'pace', 'Pace', '#0000ff');
		expect(result).not.toBeNull();
		expect(result!.max).toBe('4:00');
		expect(result!.maxRaw).toBe(4.0);
	});

	it('computeSeriesStats_pace_avgIsUnchanged', () => {
		const result = computeSeriesStats(paceData, 'pace', 'Pace', '#0000ff');
		expect(result).not.toBeNull();
		expect(result!.avg).toBe('5:00');
	});

	it('computeSeriesStats_speed_returnsFormattedMinOneDecimal', () => {
		const result = computeSeriesStats(speedData, 'speed', 'Speed', '#00ff00');
		expect(result).not.toBeNull();
		expect(result!.min).toBe('10.1');
	});

	it('computeSeriesStats_withXRange_filtersBeforeComputingMin', () => {
		// Only points with x in [1, 3] — values 130, 140, 150 → min 130
		const result = computeSeriesStats(heartRateData, 'heartRate', 'HR', '#ff0000', { min: 1, max: 3 });
		expect(result).not.toBeNull();
		expect(result!.min).toBe('130');
		expect(result!.minRaw).toBe(130);
	});

	it('computeSeriesStats_allNull_returnsNull', () => {
		const nullData: [number, number | null][] = [[0, null], [1, null], [2, null]];
		const result = computeSeriesStats(nullData, 'heartRate', 'HR', '#ff0000');
		expect(result).toBeNull();
	});

	it('computeSeriesStats_withNullValues_ignoresNullsForMin', () => {
		const mixedData: [number, number | null][] = [[0, null], [1, 100], [2, 150], [3, null]];
		const result = computeSeriesStats(mixedData, 'heartRate', 'HR', '#ff0000');
		expect(result).not.toBeNull();
		expect(result!.min).toBe('100');
	});

	it('computeSeriesStats_heartRate_returnsAvgAndMax', () => {
		const result = computeSeriesStats(heartRateData, 'heartRate', 'HR', '#ff0000');
		expect(result!.avg).toBe('140');
		expect(result!.max).toBe('160');
	});
});
