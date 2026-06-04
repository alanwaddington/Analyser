import { describe, it, expect } from 'vitest';
import { formatPace } from './formatting.ts';

describe('formatPace', () => {
	it('formatPace_zero_returnsZeroColonZero', () => {
		expect(formatPace(0)).toBe('0:00');
	});

	it('formatPace_wholeMinutes_returnsDoubleZeroSeconds', () => {
		expect(formatPace(5)).toBe('5:00');
	});

	it('formatPace_halfMinute_returnsThirtySeconds', () => {
		expect(formatPace(5.5)).toBe('5:30');
	});

	it('formatPace_rolloverEdgeCase_bumpsMinute', () => {
		expect(formatPace(4.9999)).toBe('5:00');
	});

	it('formatPace_singleDigitSeconds_padsWith0', () => {
		expect(formatPace(6 + 5 / 60)).toBe('6:05');
	});

	it('formatPace_doubleDigitMinutes_formatsCorrectly', () => {
		expect(formatPace(10.25)).toBe('10:15');
	});

	it('formatPace_quarterMinute_returnsFifteenSeconds', () => {
		expect(formatPace(5.25)).toBe('5:15');
	});

	it('formatPace_threeQuarterMinute_returnsFortyFiveSeconds', () => {
		expect(formatPace(5.75)).toBe('5:45');
	});
});
