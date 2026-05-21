import { describe, it, expect } from 'vitest';
import { buildMeanMaxData, formatDuration } from './MeanMaxChart.utils.ts';
import type { MeanMaxSeriesInput } from './MeanMaxChart.utils.ts';
import type { Activity, ActivityRecord } from '$lib/types';

function makeActivity(overrides: Partial<Activity> = {}): Activity {
	return {
		id: 'act-1',
		filename: 'test.fit',
		startTime: new Date('2025-01-01T10:00:00Z'),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [],
		laps: [],
		devices: [],
		deviceStreams: [],
		...overrides,
	};
}

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
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

	it('formatDuration_exactHour_showsHoursMinutesSeconds', () => {
		expect(formatDuration(3600)).toBe('1:00:00');
	});

	it('formatDuration_overOneHour_showsHoursMinutesSeconds', () => {
		expect(formatDuration(3661)).toBe('1:01:01');
	});
});

// ---------------------------------------------------------------------------
// MeanMaxSeriesInput — colour and label overrides
// ---------------------------------------------------------------------------
describe('MeanMaxSeriesInput', () => {
	it('MeanMaxSeriesInput_withColourOverride_acceptsColourField', () => {
		const input: MeanMaxSeriesInput = {
			activity: makeActivity(),
			colourIndex: 0,
			colour: '#ff0000',
		};
		expect(input.colour).toBe('#ff0000');
	});

	it('MeanMaxSeriesInput_withLabelOverride_acceptsLabelField', () => {
		const input: MeanMaxSeriesInput = {
			activity: makeActivity(),
			colourIndex: 0,
			label: 'Assioma Duo',
		};
		expect(input.label).toBe('Assioma Duo');
	});

	it('MeanMaxSeriesInput_withoutOverrides_colourAndLabelAreUndefined', () => {
		const input: MeanMaxSeriesInput = {
			activity: makeActivity(),
			colourIndex: 1,
		};
		expect(input.colour).toBeUndefined();
		expect(input.label).toBeUndefined();
	});

	it('MeanMaxSeriesInput_withBothOverrides_bothFieldsAccessible', () => {
		const input: MeanMaxSeriesInput = {
			activity: makeActivity(),
			colourIndex: 0,
			colour: '#22c55e',
			label: 'Polar H10',
		};
		expect(input.colour).toBe('#22c55e');
		expect(input.label).toBe('Polar H10');
	});
});
