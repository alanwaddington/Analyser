import { describe, it, expect } from 'vitest';
import { paceFormat } from './TimeSeriesChart.utils.ts';

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
