import { describe, it, expect } from 'vitest';
import { paceFormat, formatStatValue, computeSeriesStats } from './TimeSeriesChart.utils.ts';

describe('paceFormat', () => {
	it('paceFormat_wholeMinutes_returnsDoubleZeroSeconds', () => {
		expect(paceFormat(5)).toBe('5:00');
	});

	it('paceFormat_halfMinute_returnsThirtySeconds', () => {
		expect(paceFormat(5.5)).toBe('5:30');
	});

	it('paceFormat_quarterMinute_returnsFifteenSeconds', () => {
		expect(paceFormat(5.25)).toBe('5:15');
	});

	it('paceFormat_threeQuarterMinute_returnsFortyFiveSeconds', () => {
		expect(paceFormat(5.75)).toBe('5:45');
	});

	it('paceFormat_secondsRoundUpTo60_rollsOverToNextMinute', () => {
		expect(paceFormat(4.9999)).toBe('5:00');
	});

	it('paceFormat_singleDigitSeconds_padsWith0', () => {
		expect(paceFormat(6 + 5 / 60)).toBe('6:05');
	});
});

describe('formatStatValue', () => {
	it('formatStatValue_paceChannel_returnsMSSFormat', () => {
		expect(formatStatValue(5.5, 'pace')).toBe('5:30');
	});

	it('formatStatValue_heartRateChannel_returnsInteger', () => {
		expect(formatStatValue(152.7, 'heartRate')).toBe('153');
	});

	it('formatStatValue_powerChannel_returnsInteger', () => {
		expect(formatStatValue(245.3, 'power')).toBe('245');
	});

	it('formatStatValue_cadenceChannel_returnsInteger', () => {
		expect(formatStatValue(87.9, 'cadence')).toBe('88');
	});

	it('formatStatValue_speedChannel_returnsOneDecimal', () => {
		expect(formatStatValue(12.345, 'speed')).toBe('12.3');
	});

	it('formatStatValue_temperatureChannel_returnsOneDecimal', () => {
		expect(formatStatValue(36.789, 'temperature')).toBe('36.8');
	});

	it('formatStatValue_altitudeChannel_returnsInteger', () => {
		expect(formatStatValue(123.6, 'altitude')).toBe('124');
	});

	it('formatStatValue_strideLengthChannel_returnsInteger', () => {
		expect(formatStatValue(1234.5, 'strideLength')).toBe('1235');
	});
});

describe('computeSeriesStats', () => {
	const data: [number, number | null][] = [
		[0, 100],
		[1, 200],
		[2, 300],
		[3, 400],
	];

	it('computeSeriesStats_simpleDataset_returnsCorrectAvgAndMax', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316');
		expect(result).not.toBeNull();
		expect(result!.avgRaw).toBe(250);
		expect(result!.maxRaw).toBe(400);
		expect(result!.count).toBe(4);
	});

	it('computeSeriesStats_simpleDataset_returnsCorrectLabel', () => {
		const result = computeSeriesStats(data, 'heartRate', 'My HRM', '#38bdf8');
		expect(result!.label).toBe('My HRM');
		expect(result!.colour).toBe('#38bdf8');
	});

	it('computeSeriesStats_simpleDataset_returnsCorrectUnit', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316');
		expect(result!.unit).toBe('bpm');
	});

	it('computeSeriesStats_simpleDataset_formatsAvgAsInteger', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316');
		expect(result!.avg).toBe('250');
		expect(result!.max).toBe('400');
	});

	it('computeSeriesStats_paceChannel_formatsAvgAsMSS', () => {
		const paceData: [number, number | null][] = [
			[0, 5],
			[1, 6],
		];
		const result = computeSeriesStats(paceData, 'pace', 'Watch', '#f97316');
		expect(result!.avg).toBe('5:30');
		expect(result!.max).toBe('6:00');
	});

	it('computeSeriesStats_withXRange_slicesDataToRange', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316', { min: 1, max: 2 });
		expect(result).not.toBeNull();
		expect(result!.count).toBe(2);
		expect(result!.avgRaw).toBe(250); // (200+300)/2
		expect(result!.maxRaw).toBe(300);
	});

	it('computeSeriesStats_withXRange_storesRangeInResult', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316', { min: 1, max: 2 });
		expect(result!.xMin).toBe(1);
		expect(result!.xMax).toBe(2);
	});

	it('computeSeriesStats_noXRange_storesFullDataRange', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316');
		expect(result!.xMin).toBe(0);
		expect(result!.xMax).toBe(3);
	});

	it('computeSeriesStats_emptyData_returnsNull', () => {
		expect(computeSeriesStats([], 'heartRate', 'HRM', '#f97316')).toBeNull();
	});

	it('computeSeriesStats_allNullValues_returnsNull', () => {
		const nullData: [number, number | null][] = [
			[0, null],
			[1, null],
		];
		expect(computeSeriesStats(nullData, 'heartRate', 'HRM', '#f97316')).toBeNull();
	});

	it('computeSeriesStats_xRangeExcludesAllPoints_returnsNull', () => {
		const result = computeSeriesStats(data, 'heartRate', 'HRM', '#f97316', { min: 10, max: 20 });
		expect(result).toBeNull();
	});

	it('computeSeriesStats_nullsInData_excludesNullsFromStats', () => {
		const mixedData: [number, number | null][] = [
			[0, 100],
			[1, null],
			[2, 300],
		];
		const result = computeSeriesStats(mixedData, 'heartRate', 'HRM', '#f97316');
		expect(result!.count).toBe(2);
		expect(result!.avgRaw).toBe(200);
	});
});
