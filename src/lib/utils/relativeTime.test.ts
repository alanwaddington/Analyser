import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const SEC = 1000;
const MIN = 60 * SEC;
const HR = 60 * MIN;
const DAY = 24 * HR;

describe('relativeTime', () => {
	it('relativeTime_under60Seconds_returnsJustNow', () => {
		const now = Date.now();
		expect(relativeTime(now - 30 * SEC, now)).toBe('just now');
	});

	it('relativeTime_exactly60Seconds_returns1MinAgo', () => {
		const now = Date.now();
		expect(relativeTime(now - 60 * SEC, now)).toBe('1 min ago');
	});

	it('relativeTime_5Minutes_returns5MinAgo', () => {
		const now = Date.now();
		expect(relativeTime(now - 5 * MIN, now)).toBe('5 min ago');
	});

	it('relativeTime_59Minutes_returns59MinAgo', () => {
		const now = Date.now();
		expect(relativeTime(now - 59 * MIN, now)).toBe('59 min ago');
	});

	it('relativeTime_exactly1Hour_returns1HrAgo', () => {
		const now = Date.now();
		expect(relativeTime(now - HR, now)).toBe('1 hr ago');
	});

	it('relativeTime_3Hours_returns3HrsAgo', () => {
		const now = Date.now();
		expect(relativeTime(now - 3 * HR, now)).toBe('3 hrs ago');
	});

	it('relativeTime_23Hours_returns23HrsAgo', () => {
		const now = Date.now();
		expect(relativeTime(now - 23 * HR, now)).toBe('23 hrs ago');
	});

	it('relativeTime_between24And48Hours_returnsYesterday', () => {
		const now = Date.now();
		expect(relativeTime(now - 30 * HR, now)).toBe('yesterday');
	});

	it('relativeTime_exactly48Hours_returnsFormattedDate', () => {
		const now = Date.now();
		const ts = now - 48 * HR;
		const result = relativeTime(ts, now);
		expect(result).not.toBe('yesterday');
		expect(result.length).toBeGreaterThan(0);
	});

	it('relativeTime_olderTimestamp_returnsFormattedDate', () => {
		const now = Date.now();
		const result = relativeTime(now - 7 * DAY, now);
		expect(result).not.toBe('just now');
		expect(result).not.toContain('ago');
		expect(result).not.toBe('yesterday');
	});

	it('relativeTime_futureTimestamp_returnsJustNow', () => {
		const now = Date.now();
		expect(relativeTime(now + 5 * SEC, now)).toBe('just now');
	});
});
