import { describe, it, expect } from 'vitest';
import { computeRSS } from './rss.ts';

describe('computeRSS', () => {
	it('computeRSS_atExactlyCP_returnsOne', () => {
		// When avg power equals CP, IF=1, RSS = duration / 3600
		// For a 1-hour (3600s) ride at exactly CP: RSS = 1.0
		expect(computeRSS(3600, 250, 250)).toBeCloseTo(1.0, 3);
	});

	it('computeRSS_halfHourAtCP_returnsHalf', () => {
		expect(computeRSS(1800, 250, 250)).toBeCloseTo(0.5, 3);
	});

	it('computeRSS_aboveCp_higherThanLinear', () => {
		// IF > 1 so RSS grows faster than linearly with power
		// 1h at 110% CP: IF=1.1, RSS = (3600 × 275 × 1.21) / (250 × 3600) = 1.21 × 275/250 = 1.331
		const rss = computeRSS(3600, 275, 250);
		expect(rss).toBeGreaterThan(1.0);
		expect(rss).toBeCloseTo(1.331, 2);
	});

	it('computeRSS_belowCp_lowerThanLinear', () => {
		// 1h at 80% CP: IF=0.8, RSS = 0.8 × 0.64 = 0.512
		const rss = computeRSS(3600, 200, 250);
		expect(rss).toBeLessThan(1.0);
		expect(rss).toBeCloseTo(0.512, 3);
	});

	it('computeRSS_zeroDuration_returnsZero', () => {
		expect(computeRSS(0, 250, 250)).toBe(0);
	});

	it('computeRSS_zeroPower_returnsZero', () => {
		expect(computeRSS(3600, 0, 250)).toBe(0);
	});

	it('computeRSS_zeroCp_returnsZero', () => {
		expect(computeRSS(3600, 250, 0)).toBe(0);
	});

	it('computeRSS_negativeCp_returnsZero', () => {
		expect(computeRSS(3600, 250, -1)).toBe(0);
	});

	it('computeRSS_negativeDuration_returnsZero', () => {
		expect(computeRSS(-100, 250, 250)).toBe(0);
	});

	it('computeRSS_negativePower_returnsZero', () => {
		expect(computeRSS(3600, -10, 250)).toBe(0);
	});

	it('computeRSS_proportionalToDuration', () => {
		const rss1h = computeRSS(3600, 220, 250);
		const rss2h = computeRSS(7200, 220, 250);
		expect(rss2h).toBeCloseTo(rss1h * 2, 5);
	});
});
