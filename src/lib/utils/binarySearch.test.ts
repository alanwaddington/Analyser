import { describe, it, expect } from 'vitest';
import { lowerBound } from './binarySearch.ts';

const key = (x: number) => x;

describe('lowerBound', () => {
	it('lowerBound_EmptyArray_ReturnsZero', () => {
		expect(lowerBound([], key, 5)).toBe(0);
	});

	it('lowerBound_TargetBelowMin_ReturnsZero', () => {
		expect(lowerBound([10, 20, 30], key, 5)).toBe(0);
	});

	it('lowerBound_ExactMatchOnFirstElement_ReturnsZero', () => {
		expect(lowerBound([10, 20, 30], key, 10)).toBe(0);
	});

	it('lowerBound_ExactMatchOnLastElement_ReturnsLastIndex', () => {
		expect(lowerBound([10, 20, 30], key, 30)).toBe(2);
	});

	it('lowerBound_ValueBetweenElements_ReturnsUpperIndex', () => {
		expect(lowerBound([10, 20, 30], key, 15)).toBe(1);
	});

	it('lowerBound_TargetAboveMax_ReturnsArrayLength', () => {
		expect(lowerBound([10, 20, 30], key, 40)).toBe(3);
	});

	it('lowerBound_SingleElementExactMatch_ReturnsZero', () => {
		expect(lowerBound([10], key, 10)).toBe(0);
	});

	it('lowerBound_SingleElementBelow_ReturnsZero', () => {
		expect(lowerBound([10], key, 5)).toBe(0);
	});

	it('lowerBound_SingleElementAbove_ReturnsArrayLength', () => {
		expect(lowerBound([10], key, 15)).toBe(1);
	});

	it('lowerBound_DuplicateValuesAtTarget_ReturnsFirstOccurrence', () => {
		expect(lowerBound([10, 20, 20, 20, 30], key, 20)).toBe(1);
	});

	it('lowerBound_WorksWithObjectsViaKeyFn', () => {
		const arr = [{ d: 0 }, { d: 10 }, { d: 20 }];
		expect(lowerBound(arr, (x) => x.d, 10)).toBe(1);
	});
});
