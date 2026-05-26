import { describe, it, expect } from 'vitest';
import { extractChannel, buildXValues, isDashed, effectiveAxisMode } from './TimeSeriesChart.utils.ts';
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
