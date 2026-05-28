import { describe, it, expect } from 'vitest';
import { summarise } from './summary.ts';

describe('summarise', () => {
	it('summarise_normalValues_returnsCorrectStats', () => {
		const result = summarise([100, 200, 300]);
		expect(result?.avg).toBe(200);
		expect(result?.max).toBe(300);
		expect(result?.min).toBe(100);
	});

	it('summarise_withNulls_ignoresNulls', () => {
		const result = summarise([100, null, 300]);
		expect(result?.avg).toBe(200);
		expect((result as unknown as Record<string, unknown>)?.['count']).toBeUndefined(); // count not part of interface
		expect(result?.max).toBe(300);
	});

	it('summarise_allNulls_returnsNull', () => {
		expect(summarise([null, null])).toBeNull();
	});

	it('summarise_emptyArray_returnsNull', () => {
		expect(summarise([])).toBeNull();
	});

	it('summarise_withNaNValues_treatsNaNAsNull', () => {
		// NaN passes the != null check but should not produce NaN results.
		// This can happen when interpolation divides by zero (e.g. duplicate
		// distance records from indoor trainers).
		const result = summarise([100, NaN, 300]);
		expect(result?.avg).toBe(200);
		expect(result?.max).toBe(300);
		expect(result?.min).toBe(100);
	});

	it('summarise_allNaN_returnsNull', () => {
		expect(summarise([NaN, NaN])).toBeNull();
	});
});
