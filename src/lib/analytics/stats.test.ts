import { describe, it, expect } from 'vitest';
import { mean, stdDev } from './stats.ts';

describe('mean', () => {
	it('mean_normalValues_returnsArithmeticMean', () => {
		expect(mean([1, 2, 3])).toBe(2);
	});

	it('mean_withNulls_ignoresNulls', () => {
		expect(mean([1, null, 3])).toBe(2);
	});

	it('mean_emptyArray_returnsNull', () => {
		expect(mean([])).toBeNull();
	});

	it('mean_allNulls_returnsNull', () => {
		expect(mean([null, null])).toBeNull();
	});

	it('mean_singleValue_returnsThatValue', () => {
		expect(mean([42])).toBe(42);
	});

	it('mean_withNaN_treatsNaNAsNull', () => {
		expect(mean([2, NaN, 4])).toBe(3);
	});
});

describe('stdDev', () => {
	it('stdDev_knownValues_returnsPopulationStdDev', () => {
		// Population std dev of [2,4,4,4,5,5,7,9] = 2
		const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
		expect(result).toBeCloseTo(2, 5);
	});

	it('stdDev_withNulls_ignoresNulls', () => {
		// Same as [2,4,4,4,5,5,7,9] with a null injected
		const result = stdDev([2, 4, null, 4, 4, 5, 5, 7, 9]);
		expect(result).toBeCloseTo(2, 5);
	});

	it('stdDev_emptyArray_returnsNull', () => {
		expect(stdDev([])).toBeNull();
	});

	it('stdDev_singleValue_returnsNull', () => {
		expect(stdDev([5])).toBeNull();
	});

	it('stdDev_allNulls_returnsNull', () => {
		expect(stdDev([null, null])).toBeNull();
	});

	it('stdDev_identicalValues_returnsZero', () => {
		expect(stdDev([5, 5, 5, 5])).toBe(0);
	});

	it('stdDev_withNaN_treatsNaNAsNull', () => {
		const result = stdDev([2, NaN, 4, 4, 4, 5, 5, 7, 9]);
		expect(result).toBeCloseTo(2, 5);
	});
});
