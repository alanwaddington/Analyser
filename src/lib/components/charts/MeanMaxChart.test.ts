import { describe, it, expect } from 'vitest';
import { buildMeanMaxData, formatDuration } from './MeanMaxChart.utils.ts';
import type { Record } from '$lib/types';

function makeRecord(overrides: Partial<Record> = {}): Record {
	return {
		timestamp: new Date(),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildMeanMaxData
// ---------------------------------------------------------------------------
describe('buildMeanMaxData', () => {
	it('buildMeanMaxData_withPower_returnsDurationMeanPairs', () => {
		const records = Array.from({ length: 10 }, (_, i) =>
			makeRecord({ power: 200 + i * 10 }),
		);
		const result = buildMeanMaxData(records);
		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toHaveLength(2);
	});

	it('buildMeanMaxData_withPower_firstPairDurationIsOne', () => {
		const records = Array.from({ length: 10 }, () => makeRecord({ power: 250 }));
		const result = buildMeanMaxData(records);
		expect(result[0][0]).toBe(1);
	});

	it('buildMeanMaxData_withPower_meansArePositive', () => {
		const records = Array.from({ length: 10 }, () => makeRecord({ power: 300 }));
		const result = buildMeanMaxData(records);
		expect(result.every(([, mean]) => mean > 0)).toBe(true);
	});

	it('buildMeanMaxData_constantPower_allMeansEqual', () => {
		const records = Array.from({ length: 10 }, () => makeRecord({ power: 200 }));
		const result = buildMeanMaxData(records);
		expect(result.every(([, mean]) => Math.abs(mean - 200) < 0.001)).toBe(true);
	});

	it('buildMeanMaxData_noPower_returnsEmptyArray', () => {
		const records = Array.from({ length: 10 }, () => makeRecord());
		const result = buildMeanMaxData(records);
		expect(result).toEqual([]);
	});

	it('buildMeanMaxData_emptyRecords_returnsEmptyArray', () => {
		const result = buildMeanMaxData([]);
		expect(result).toEqual([]);
	});

	it('buildMeanMaxData_mixedNullAndPower_usesOnlyNonNull', () => {
		const records = [
			makeRecord({ power: 300 }),
			makeRecord(),
			makeRecord({ power: 300 }),
			makeRecord(),
			makeRecord({ power: 300 }),
		];
		const result = buildMeanMaxData(records);
		expect(result.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe('formatDuration', () => {
	it('formatDuration_underSixty_showsSeconds', () => {
		expect(formatDuration(45)).toBe('45s');
	});

	it('formatDuration_one_showsOneSecond', () => {
		expect(formatDuration(1)).toBe('1s');
	});

	it('formatDuration_fiftyNine_showsSeconds', () => {
		expect(formatDuration(59)).toBe('59s');
	});

	it('formatDuration_exactMinute_showsMinutesOnly', () => {
		expect(formatDuration(60)).toBe('1:00');
	});

	it('formatDuration_mixedMinutesSeconds_showsPaddedSeconds', () => {
		expect(formatDuration(90)).toBe('1:30');
	});

	it('formatDuration_singleDigitSeconds_padded', () => {
		expect(formatDuration(65)).toBe('1:05');
	});

	it('formatDuration_largeValue_showsHoursAsMinutes', () => {
		expect(formatDuration(3661)).toBe('61:01');
	});

	it('formatDuration_exactHour_showsHourAsMinutes', () => {
		expect(formatDuration(3600)).toBe('60:00');
	});
});
