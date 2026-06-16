import { describe, it, expect } from 'vitest';
import {
	hrZoneFromMaxHR,
	hrZoneFromLTHR,
	hrZone,
	lthrToEstimatedMaxHR,
	cpZone,
	ftpPct,
	cpPct,
	wPerKg,
	hrZoneBoundaries,
	cpZoneBoundaries,
} from './zones.ts';
import type { AthleteProfile } from '$lib/types';

// ---------------------------------------------------------------------------
// hrZoneFromMaxHR — 5-zone % of maxHR model
// ---------------------------------------------------------------------------

describe('hrZoneFromMaxHR', () => {
	it('hrZoneFromMaxHR_below60pct_returnsZone1', () => {
		expect(hrZoneFromMaxHR(110, 190)).toBe(1); // 57.9%
	});

	it('hrZoneFromMaxHR_exactly60pct_returnsZone2', () => {
		expect(hrZoneFromMaxHR(114, 190)).toBe(2); // 60%
	});

	it('hrZoneFromMaxHR_70pctBoundary_returnsZone3', () => {
		expect(hrZoneFromMaxHR(133, 190)).toBe(3); // 70%
	});

	it('hrZoneFromMaxHR_80pctBoundary_returnsZone4', () => {
		expect(hrZoneFromMaxHR(152, 190)).toBe(4); // 80%
	});

	it('hrZoneFromMaxHR_90pctAndAbove_returnsZone5', () => {
		expect(hrZoneFromMaxHR(171, 190)).toBe(5); // 90%
		expect(hrZoneFromMaxHR(190, 190)).toBe(5); // 100%
	});

	it('hrZoneFromMaxHR_zeroBpm_returnsZone1', () => {
		expect(hrZoneFromMaxHR(0, 190)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// hrZoneFromLTHR — 5-zone % of LTHR model
// ---------------------------------------------------------------------------

describe('hrZoneFromLTHR', () => {
	it('hrZoneFromLTHR_below81pct_returnsZone1', () => {
		expect(hrZoneFromLTHR(130, 165)).toBe(1); // 78.8%
	});

	it('hrZoneFromLTHR_81pctBoundary_returnsZone2', () => {
		expect(hrZoneFromLTHR(134, 165)).toBe(2); // 81.2%
	});

	it('hrZoneFromLTHR_89pctBoundary_returnsZone3', () => {
		expect(hrZoneFromLTHR(147, 165)).toBe(3); // 89.1%
	});

	it('hrZoneFromLTHR_93pctBoundary_returnsZone4', () => {
		expect(hrZoneFromLTHR(154, 165)).toBe(4); // 93.3%
	});

	it('hrZoneFromLTHR_atLTHR_returnsZone5', () => {
		expect(hrZoneFromLTHR(165, 165)).toBe(5); // 100%
	});

	it('hrZoneFromLTHR_above100pct_returnsZone5', () => {
		expect(hrZoneFromLTHR(180, 165)).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// hrZone — sport-aware dispatch with fallback
// ---------------------------------------------------------------------------

describe('hrZone', () => {
	it('hrZone_cyclingUsesMaxHrCycling', () => {
		const profile: AthleteProfile = { maxHrCycling: 190, maxHrRunning: 200 };
		// 171 bpm = 90% of 190 → Z5; but only 85.5% of 200 → Z4
		// cycling should use 190 → Z5
		expect(hrZone(171, profile, 'cycling')).toBe(5);
	});

	it('hrZone_runningUsesMaxHrRunning', () => {
		const profile: AthleteProfile = { maxHrCycling: 190, maxHrRunning: 200 };
		// 171 bpm = 85.5% of 200 → Z4
		expect(hrZone(171, profile, 'running')).toBe(4);
	});

	it('hrZone_cyclingFallsBackToLTHR_whenMaxHrCyclingAbsent', () => {
		const profile: AthleteProfile = { lthr: 165 };
		// 154 bpm = 93.3% of 165 → Z4
		expect(hrZone(154, profile, 'cycling')).toBe(4);
	});

	it('hrZone_runningFallsBackToLTHR_whenMaxHrRunningAbsent', () => {
		const profile: AthleteProfile = { lthr: 165 };
		expect(hrZone(134, profile, 'running')).toBe(2);
	});

	it('hrZone_cyclingFallsBackToRunningMaxHR_whenCyclingMaxHRAbsent', () => {
		const profile: AthleteProfile = { maxHrRunning: 190 }; // no maxHrCycling
		// 171 bpm = 90% of 190 → Z5
		expect(hrZone(171, profile, 'cycling')).toBe(5);
	});

	it('hrZone_runningFallsBackToCyclingMaxHR_whenRunningMaxHRAbsent', () => {
		const profile: AthleteProfile = { maxHrCycling: 190 }; // no maxHrRunning
		// 152 bpm = 80% of 190 → Z4
		expect(hrZone(152, profile, 'running')).toBe(4);
	});

	it('hrZone_noThreshold_returnsNull', () => {
		const profile: AthleteProfile = { ftp: 250, cp: 280 };
		expect(hrZone(160, profile, 'cycling')).toBeNull();
	});

	it('hrZone_emptyProfile_returnsNull', () => {
		expect(hrZone(160, {}, 'running')).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// lthrToEstimatedMaxHR
// ---------------------------------------------------------------------------

describe('lthrToEstimatedMaxHR', () => {
	it('lthrToEstimatedMaxHR_165lthr_returnsApprox179', () => {
		// 165 / 0.92 ≈ 179.35
		expect(lthrToEstimatedMaxHR(165)).toBeCloseTo(179.35, 1);
	});

	it('lthrToEstimatedMaxHR_resultIsGreaterThanLTHR', () => {
		expect(lthrToEstimatedMaxHR(160)).toBeGreaterThan(160);
	});
});

// ---------------------------------------------------------------------------
// cpZone — Stryd 5-zone CP model
// ---------------------------------------------------------------------------

describe('cpZone', () => {
	it('cpZone_below75pct_returnsZone1', () => {
		expect(cpZone(220, 300)).toBe(1); // 73.3%
	});

	it('cpZone_75pctBoundary_returnsZone2', () => {
		expect(cpZone(225, 300)).toBe(2); // 75%
	});

	it('cpZone_88pctBoundary_returnsZone3', () => {
		expect(cpZone(264, 300)).toBe(3); // 88%
	});

	it('cpZone_104pctBoundary_returnsZone4', () => {
		expect(cpZone(312, 300)).toBe(4); // 104%
	});

	it('cpZone_120pctAndAbove_returnsZone5', () => {
		expect(cpZone(360, 300)).toBe(5); // 120%
		expect(cpZone(400, 300)).toBe(5);
	});

	it('cpZone_zeroWatts_returnsZone1', () => {
		expect(cpZone(0, 300)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// ftpPct
// ---------------------------------------------------------------------------

describe('ftpPct', () => {
	it('ftpPct_exactlyAtFTP_returns100', () => {
		expect(ftpPct(250, 250)).toBe(100);
	});

	it('ftpPct_aboveFTP_returnsOver100', () => {
		expect(ftpPct(280, 250)).toBe(112);
	});

	it('ftpPct_belowFTP_returnsUnder100', () => {
		expect(ftpPct(200, 250)).toBe(80);
	});

	it('ftpPct_zeroFtp_returnsZero', () => {
		expect(ftpPct(250, 0)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// cpPct
// ---------------------------------------------------------------------------

describe('cpPct', () => {
	it('cpPct_exactlyAtCP_returns100', () => {
		expect(cpPct(300, 300)).toBe(100);
	});

	it('cpPct_aboveCP_returnsOver100', () => {
		expect(cpPct(336, 300)).toBe(112);
	});

	it('cpPct_zeroCp_returnsZero', () => {
		expect(cpPct(300, 0)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// wPerKg
// ---------------------------------------------------------------------------

describe('wPerKg', () => {
	it('wPerKg_250w_70kg_returns3point6', () => {
		expect(wPerKg(250, 70)).toBe(3.6);
	});

	it('wPerKg_300w_70kg_returns4point3', () => {
		expect(wPerKg(300, 70)).toBe(4.3);
	});

	it('wPerKg_zeroWatts_returnsZero', () => {
		expect(wPerKg(0, 70)).toBe(0);
	});

	it('wPerKg_zeroWeight_returnsZero', () => {
		expect(wPerKg(250, 0)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// hrZoneBoundaries
// ---------------------------------------------------------------------------

describe('hrZoneBoundaries', () => {
	it('hrZoneBoundaries_190maxHR_returns5Zones', () => {
		const bands = hrZoneBoundaries(190);
		expect(bands).toHaveLength(5);
	});

	it('hrZoneBoundaries_zonesAreContiguous', () => {
		const bands = hrZoneBoundaries(190);
		for (let i = 1; i < bands.length; i++) {
			expect(bands[i].min).toBe(bands[i - 1].max);
		}
	});

	it('hrZoneBoundaries_firstZoneStartsAtZero', () => {
		const bands = hrZoneBoundaries(190);
		expect(bands[0].min).toBe(0);
	});

	it('hrZoneBoundaries_lastZoneEndsAtInfinity', () => {
		const bands = hrZoneBoundaries(190);
		expect(bands[4].max).toBe(Infinity);
	});

	it('hrZoneBoundaries_zoneNumbersAscend', () => {
		const bands = hrZoneBoundaries(190);
		bands.forEach((b, i) => expect(b.zone).toBe(i + 1));
	});
});

// ---------------------------------------------------------------------------
// cpZoneBoundaries
// ---------------------------------------------------------------------------

describe('cpZoneBoundaries', () => {
	it('cpZoneBoundaries_300cp_returns5Zones', () => {
		const bands = cpZoneBoundaries(300);
		expect(bands).toHaveLength(5);
	});

	it('cpZoneBoundaries_zonesAreContiguous', () => {
		const bands = cpZoneBoundaries(300);
		for (let i = 1; i < bands.length; i++) {
			expect(bands[i].min).toBe(bands[i - 1].max);
		}
	});

	it('cpZoneBoundaries_firstZoneStartsAtZero', () => {
		const bands = cpZoneBoundaries(300);
		expect(bands[0].min).toBe(0);
	});

	it('cpZoneBoundaries_lastZoneEndsAtInfinity', () => {
		const bands = cpZoneBoundaries(300);
		expect(bands[4].max).toBe(Infinity);
	});
});
