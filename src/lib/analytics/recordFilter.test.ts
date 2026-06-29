import { describe, it, expect } from 'vitest';
import { applyRecordFilter, deriveGradients, filterRecords } from './recordFilter.ts';
import type { ActivityRecord } from '$lib/types';
import type { RecordFilter } from '$lib/stores/filterStore.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function records(values: Partial<ActivityRecord>[]): ActivityRecord[] {
	return values.map((v, i) => makeRecord({ elapsedSeconds: i, distance: i * 100, ...v }));
}

// ---------------------------------------------------------------------------
// applyRecordFilter — empty filter
// ---------------------------------------------------------------------------

describe('applyRecordFilter_emptyFilter', () => {
	it('applyRecordFilter_emptyFilter_returnsAllIndices', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }, { speed: 30 }]);
		const result = applyRecordFilter(recs, {});
		expect(result.size).toBe(3);
		expect(result.has(0)).toBe(true);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(true);
	});

	it('applyRecordFilter_emptyRecords_returnsEmptySet', () => {
		const result = applyRecordFilter([], {});
		expect(result.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — speed channel
// ---------------------------------------------------------------------------

describe('applyRecordFilter_speed', () => {
	it('applyRecordFilter_speedMin_excludesBelowMin', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }, { speed: 30 }]);
		const filter: RecordFilter = { speed: { min: 20 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(false); // 10 < 20
		expect(result.has(1)).toBe(true);  // 20 >= 20
		expect(result.has(2)).toBe(true);  // 30 >= 20
	});

	it('applyRecordFilter_speedMax_excludesAboveMax', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }, { speed: 30 }]);
		const filter: RecordFilter = { speed: { max: 20 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(true);  // 10 <= 20
		expect(result.has(1)).toBe(true);  // 20 <= 20
		expect(result.has(2)).toBe(false); // 30 > 20
	});

	it('applyRecordFilter_speedRange_excludesOutside', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }, { speed: 30 }]);
		const filter: RecordFilter = { speed: { min: 15, max: 25 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(false);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(false);
	});

	it('applyRecordFilter_speedMissing_passesFilterByDefault', () => {
		const recs = records([{ speed: undefined }, { speed: 20 }]);
		const filter: RecordFilter = { speed: { min: 15 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(true);  // missing speed passes
		expect(result.has(1)).toBe(true);  // 20 >= 15
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — power channel
// ---------------------------------------------------------------------------

describe('applyRecordFilter_power', () => {
	it('applyRecordFilter_powerMin_excludesBelowMin', () => {
		const recs = records([{ power: 150 }, { power: 250 }, { power: 350 }]);
		const filter: RecordFilter = { power: { min: 200 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(false);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(true);
	});

	it('applyRecordFilter_powerMax_excludesAboveMax', () => {
		const recs = records([{ power: 150 }, { power: 250 }, { power: 350 }]);
		const filter: RecordFilter = { power: { max: 300 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(true);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(false);
	});

	it('applyRecordFilter_powerMissing_passesFilter', () => {
		const recs = records([{ power: undefined }]);
		const filter: RecordFilter = { power: { min: 200 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — heartRate channel
// ---------------------------------------------------------------------------

describe('applyRecordFilter_heartRate', () => {
	it('applyRecordFilter_heartRateRange_filtersCorrectly', () => {
		const recs = records([{ heartRate: 100 }, { heartRate: 150 }, { heartRate: 180 }]);
		const filter: RecordFilter = { heartRate: { min: 140, max: 160 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(false);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — cadence channel
// ---------------------------------------------------------------------------

describe('applyRecordFilter_cadence', () => {
	it('applyRecordFilter_cadenceMin_excludesBelowMin', () => {
		const recs = records([{ cadence: 70 }, { cadence: 85 }, { cadence: 100 }]);
		const filter: RecordFilter = { cadence: { min: 80 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(false);
		expect(result.has(1)).toBe(true);
		expect(result.has(2)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — gradient channel
// ---------------------------------------------------------------------------

describe('applyRecordFilter_gradient', () => {
	it('applyRecordFilter_gradientMin_excludesFlatAndDownhill', () => {
		// gradients: -5%, 0%, 10%
		const gradients = [-5, 0, 10];
		const recs = records([{}, {}, {}]);
		const filter: RecordFilter = { gradient: { min: 2 } };
		const result = applyRecordFilter(recs, filter, gradients);
		expect(result.has(0)).toBe(false); // -5 < 2
		expect(result.has(1)).toBe(false); // 0 < 2
		expect(result.has(2)).toBe(true);  // 10 >= 2
	});

	it('applyRecordFilter_gradientMax_excludesUphill', () => {
		const gradients = [-10, 0, 5];
		const recs = records([{}, {}, {}]);
		const filter: RecordFilter = { gradient: { max: -2 } };
		const result = applyRecordFilter(recs, filter, gradients);
		expect(result.has(0)).toBe(true);  // -10 <= -2
		expect(result.has(1)).toBe(false); // 0 > -2
		expect(result.has(2)).toBe(false); // 5 > -2
	});

	it('applyRecordFilter_nullGradient_passesFilter', () => {
		const gradients = [null, 5];
		const recs = records([{}, {}]);
		const filter: RecordFilter = { gradient: { min: 3 } };
		const result = applyRecordFilter(recs, filter, gradients);
		expect(result.has(0)).toBe(true);  // null → pass by default
		expect(result.has(1)).toBe(true);  // 5 >= 3
	});

	it('applyRecordFilter_noGradientArray_allRecordsPass', () => {
		const recs = records([{}, {}, {}]);
		const filter: RecordFilter = { gradient: { min: 2 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.size).toBe(3); // no gradient data → all pass
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — combined channels
// ---------------------------------------------------------------------------

describe('applyRecordFilter_combined', () => {
	it('applyRecordFilter_twoChannels_requiresBothToPass', () => {
		const recs = records([
			{ speed: 25, heartRate: 160 }, // speed ok, HR ok
			{ speed: 15, heartRate: 160 }, // speed fail, HR ok
			{ speed: 25, heartRate: 130 }, // speed ok, HR fail
		]);
		const filter: RecordFilter = { speed: { min: 20 }, heartRate: { min: 140 } };
		const result = applyRecordFilter(recs, filter);
		expect(result.has(0)).toBe(true);
		expect(result.has(1)).toBe(false);
		expect(result.has(2)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// applyRecordFilter — inverted mode
// ---------------------------------------------------------------------------

describe('applyRecordFilter_inverted', () => {
	it('applyRecordFilter_inverted_swapsPassingAndFailing', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }, { speed: 30 }]);
		const filter: RecordFilter = { speed: { min: 20 }, inverted: true };
		const result = applyRecordFilter(recs, filter);
		// Without inversion: 0=fail, 1=pass, 2=pass
		// With inversion:    0=pass, 1=fail, 2=fail
		expect(result.has(0)).toBe(true);
		expect(result.has(1)).toBe(false);
		expect(result.has(2)).toBe(false);
	});

	it('applyRecordFilter_invertedEmptyFilter_returnsEmptySet', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }]);
		const filter: RecordFilter = { inverted: true };
		const result = applyRecordFilter(recs, filter);
		// Invert of all → none
		expect(result.size).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// deriveGradients
// ---------------------------------------------------------------------------

describe('deriveGradients', () => {
	it('deriveGradients_emptyRecords_returnsEmptyArray', () => {
		expect(deriveGradients([])).toEqual([]);
	});

	it('deriveGradients_singleRecord_returnsNull', () => {
		const recs = records([{ altitude: 100, distance: 0 }]);
		const grads = deriveGradients(recs);
		expect(grads).toHaveLength(1);
		expect(grads[0]).toBeNull();
	});

	it('deriveGradients_flatTerrain_returnsZero', () => {
		const recs = [
			makeRecord({ altitude: 100, distance: 0 }),
			makeRecord({ altitude: 100, distance: 100 }),
			makeRecord({ altitude: 100, distance: 200 }),
		];
		const grads = deriveGradients(recs);
		expect(grads[0]).toBeCloseTo(0, 5);
		expect(grads[1]).toBeCloseTo(0, 5);
		expect(grads[2]).toBeNull(); // last record has no next
	});

	it('deriveGradients_uphill10pct_returnsPositive', () => {
		const recs = [
			makeRecord({ altitude: 100, distance: 0 }),
			makeRecord({ altitude: 110, distance: 100 }),
		];
		const grads = deriveGradients(recs);
		expect(grads[0]).toBeCloseTo(10, 5); // (110-100)/(100-0)*100 = 10%
		expect(grads[1]).toBeNull();
	});

	it('deriveGradients_downhill5pct_returnsNegative', () => {
		const recs = [
			makeRecord({ altitude: 100, distance: 0 }),
			makeRecord({ altitude: 95, distance: 100 }),
		];
		const grads = deriveGradients(recs);
		expect(grads[0]).toBeCloseTo(-5, 5); // (95-100)/100*100 = -5%
	});

	it('deriveGradients_missingAltitude_returnsNull', () => {
		const recs = [
			makeRecord({ altitude: undefined, distance: 0 }),
			makeRecord({ altitude: undefined, distance: 100 }),
		];
		const grads = deriveGradients(recs);
		expect(grads[0]).toBeNull();
		expect(grads[1]).toBeNull();
	});

	it('deriveGradients_zeroDistanceDelta_returnsNull', () => {
		const recs = [
			makeRecord({ altitude: 100, distance: 50 }),
			makeRecord({ altitude: 110, distance: 50 }), // same distance
		];
		const grads = deriveGradients(recs);
		expect(grads[0]).toBeNull(); // distance delta = 0, can't compute
	});
});

// ---------------------------------------------------------------------------
// filterRecords
// ---------------------------------------------------------------------------

describe('filterRecords', () => {
	it('filterRecords_emptySet_returnsEmpty', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }]);
		expect(filterRecords(recs, new Set())).toEqual([]);
	});

	it('filterRecords_fullSet_returnsAll', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }]);
		const result = filterRecords(recs, new Set([0, 1]));
		expect(result).toHaveLength(2);
	});

	it('filterRecords_partialSet_returnsSubset', () => {
		const recs = records([{ speed: 10 }, { speed: 20 }, { speed: 30 }]);
		const result = filterRecords(recs, new Set([0, 2]));
		expect(result).toHaveLength(2);
		expect(result[0].speed).toBe(10);
		expect(result[1].speed).toBe(30);
	});
});
