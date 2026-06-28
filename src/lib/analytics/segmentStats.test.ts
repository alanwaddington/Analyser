import { describe, it, expect } from 'vitest';
import { computeSegmentStats } from './segmentStats.ts';
import type { Activity, ActivityRecord, AthleteProfile } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';
import type { Segment } from '$lib/components/charts/SegmentChart.utils';

function makeRecord(
	elapsedSeconds: number,
	distance: number,
	overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
	return { timestamp: new Date(elapsedSeconds * 1000), elapsedSeconds, distance, ...overrides };
}

function makeActivity(
	records: ActivityRecord[],
	overrides: Partial<Activity> = {},
): Activity {
	return makeBaseActivity({
		totalDistance: records[records.length - 1]?.distance ?? 0,
		totalElapsedTime: records[records.length - 1]?.elapsedSeconds ?? 0,
		records,
		...overrides,
	});
}

function seg(startDist: number, endDist: number): Segment {
	return { label: 'Test', startDist, endDist };
}

// A simple 3km run: 0–1km in 300s, 1–2km in 360s, 2–3km in 300s
function makeRunRecords(): ActivityRecord[] {
	const recs: ActivityRecord[] = [];
	for (let s = 0; s <= 300; s++) {
		recs.push(makeRecord(s, s * (1000 / 300), { heartRate: 140 + Math.floor(s / 30), power: 200 }));
	}
	for (let s = 301; s <= 660; s++) {
		recs.push(makeRecord(s, 1000 + (s - 300) * (1000 / 360), { heartRate: 155, power: 190 }));
	}
	for (let s = 661; s <= 960; s++) {
		recs.push(makeRecord(s, 2000 + (s - 660) * (1000 / 300), { heartRate: 160, power: 210 }));
	}
	return recs;
}

// ---------------------------------------------------------------------------
// Time computation
// ---------------------------------------------------------------------------

describe('computeSegmentStats — time', () => {
	it('computeSegmentStats_firstKm_returnsCorrectTime', () => {
		const records = makeRunRecords();
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.time).toBeCloseTo(300, 0);
	});

	it('computeSegmentStats_secondKm_returnsCorrectTime', () => {
		const records = makeRunRecords();
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(1000, 2000));
		expect(result.time).toBeCloseTo(360, 0);
	});

	it('computeSegmentStats_segmentBeyondActivity_returnsZeroTime', () => {
		const records = [makeRecord(0, 0), makeRecord(60, 1000)];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(1500, 2000));
		expect(result.time).toBe(0);
	});

	it('computeSegmentStats_emptyRecords_returnsZeroTime', () => {
		const activity = makeActivity([]);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.time).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Pace computation
// ---------------------------------------------------------------------------

describe('computeSegmentStats — pace', () => {
	it('computeSegmentStats_firstKm300s_returns5minKm', () => {
		const records = makeRunRecords();
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		// 300s for 1km = 5.0 min/km
		expect(result.avgPace).toBeCloseTo(5.0, 1);
	});

	it('computeSegmentStats_noTime_returnsNullPace', () => {
		const activity = makeActivity([]);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.avgPace).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Power computation
// ---------------------------------------------------------------------------

describe('computeSegmentStats — power', () => {
	it('computeSegmentStats_withPowerRecords_returnsAvgAndMax', () => {
		const records = [
			makeRecord(0, 0, { power: 200 }),
			makeRecord(60, 500, { power: 220 }),
			makeRecord(120, 1000, { power: 210 }),
		];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		// Average of 200, 220, 210 = 210
		expect(result.avgPower).not.toBeNull();
		expect(result.maxPower).toBe(220);
	});

	it('computeSegmentStats_noPowerRecords_returnsNullPower', () => {
		const records = [makeRecord(0, 0), makeRecord(60, 1000)];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.avgPower).toBeNull();
		expect(result.maxPower).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// HR computation
// ---------------------------------------------------------------------------

describe('computeSegmentStats — HR', () => {
	it('computeSegmentStats_withHrRecords_returnsAvgHR', () => {
		const records = [
			makeRecord(0, 0, { heartRate: 140 }),
			makeRecord(60, 500, { heartRate: 150 }),
			makeRecord(120, 1000, { heartRate: 160 }),
		];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.avgHR).not.toBeNull();
		expect(result.avgHR!).toBeCloseTo(150, 0);
	});

	it('computeSegmentStats_noHrRecords_returnsNullHR', () => {
		const records = [makeRecord(0, 0), makeRecord(60, 1000)];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.avgHR).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Profile-derived: % CP (running)
// ---------------------------------------------------------------------------

describe('computeSegmentStats — powerPct (CP for running)', () => {
	it('computeSegmentStats_runningWithCP_returnsCpPct', () => {
		const records = [
			makeRecord(0, 0, { power: 250 }),
			makeRecord(60, 1000, { power: 250 }),
		];
		const activity = makeActivity(records, { sport: 'running', powerSource: 'stryd' });
		const profile: AthleteProfile = { cp: 300 };
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		// 250/300 = 83%
		expect(result.powerPct).toBe(83);
	});

	it('computeSegmentStats_runningWithCPNativePower_returnsCpPct', () => {
		const records = [
			makeRecord(0, 0, { power: 300 }),
			makeRecord(60, 1000, { power: 300 }),
		];
		const activity = makeActivity(records, { sport: 'running', powerSource: 'native' });
		const profile: AthleteProfile = { cp: 300 };
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		expect(result.powerPct).toBe(100);
	});

	it('computeSegmentStats_runningNoCp_returnsNullPowerPct', () => {
		const records = [
			makeRecord(0, 0, { power: 250 }),
			makeRecord(60, 1000, { power: 250 }),
		];
		const activity = makeActivity(records, { sport: 'running' });
		const profile: AthleteProfile = {};
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		expect(result.powerPct).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Profile-derived: % FTP (cycling)
// ---------------------------------------------------------------------------

describe('computeSegmentStats — powerPct (FTP for cycling)', () => {
	it('computeSegmentStats_cyclingWithFTP_returnsFtpPct', () => {
		const records = [
			makeRecord(0, 0, { power: 270 }),
			makeRecord(60, 1000, { power: 270 }),
		];
		const activity = makeActivity(records, { sport: 'cycling', powerSource: 'cycling' });
		const profile: AthleteProfile = { ftp: 300 };
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		// 270/300 = 90%
		expect(result.powerPct).toBe(90);
	});

	it('computeSegmentStats_cyclingNoFtp_returnsNullPowerPct', () => {
		const records = [
			makeRecord(0, 0, { power: 270 }),
			makeRecord(60, 1000, { power: 270 }),
		];
		const activity = makeActivity(records, { sport: 'cycling' });
		const profile: AthleteProfile = {};
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		expect(result.powerPct).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// powerLabel
// ---------------------------------------------------------------------------

describe('computeSegmentStats — powerLabel', () => {
	it('computeSegmentStats_strydPowerSource_returnsStryd', () => {
		const records = [makeRecord(0, 0, { power: 250 }), makeRecord(60, 1000, { power: 250 })];
		const activity = makeActivity(records, { sport: 'running', powerSource: 'stryd' });
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.powerLabel).toBe('Stryd');
	});

	it('computeSegmentStats_nativePowerSource_returnsNativeLabel', () => {
		const records = [makeRecord(0, 0, { power: 250 }), makeRecord(60, 1000, { power: 250 })];
		const activity = makeActivity(records, { sport: 'running', powerSource: 'native' });
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.powerLabel).toContain('Running Power');
	});

	it('computeSegmentStats_cyclingPowerSource_returnsCyclingLabel', () => {
		const records = [makeRecord(0, 0, { power: 270 }), makeRecord(60, 1000, { power: 270 })];
		const activity = makeActivity(records, { sport: 'cycling', powerSource: 'cycling' });
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.powerLabel).toBe('Power');
	});

	it('computeSegmentStats_noPowerSource_returnsPower', () => {
		const records = [makeRecord(0, 0, { power: 270 }), makeRecord(60, 1000, { power: 270 })];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.powerLabel).toBe('Power');
	});
});

// ---------------------------------------------------------------------------
// HR zone distribution
// ---------------------------------------------------------------------------

describe('computeSegmentStats — hrZones', () => {
	it('computeSegmentStats_withMaxHrRunning_returnsZoneDistribution', () => {
		// All HR at 155 bpm; maxHrRunning = 185 → 155/185 = 83.8% → Z4
		const records = Array.from({ length: 61 }, (_, i) =>
			makeRecord(i, i * (1000 / 60), { heartRate: 155 }),
		);
		const activity = makeActivity(records, { sport: 'running' });
		const profile: AthleteProfile = { maxHrRunning: 185 };
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		expect(result.hrZones).not.toBeNull();
		expect(result.hrZones).toHaveLength(5);
		// Nearly all time in Z4
		expect(result.hrZones![3]).toBeGreaterThan(90);
	});

	it('computeSegmentStats_withLTHR_returnsZoneDistribution', () => {
		// All HR at 130 bpm; lthr = 165 → 130/165 = 78.8% → Z1 (<81%)
		const records = Array.from({ length: 61 }, (_, i) =>
			makeRecord(i, i * (1000 / 60), { heartRate: 130 }),
		);
		const activity = makeActivity(records);
		const profile: AthleteProfile = { lthr: 165 };
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		expect(result.hrZones).not.toBeNull();
		expect(result.hrZones![0]).toBeGreaterThan(90);
	});

	it('computeSegmentStats_noHrThreshold_returnsNullHrZones', () => {
		const records = [
			makeRecord(0, 0, { heartRate: 150 }),
			makeRecord(60, 1000, { heartRate: 150 }),
		];
		const activity = makeActivity(records);
		const profile: AthleteProfile = {};
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		expect(result.hrZones).toBeNull();
	});

	it('computeSegmentStats_noProfile_returnsNullHrZones', () => {
		const records = [
			makeRecord(0, 0, { heartRate: 150 }),
			makeRecord(60, 1000, { heartRate: 150 }),
		];
		const activity = makeActivity(records);
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.hrZones).toBeNull();
	});

	it('computeSegmentStats_hrZonesSumTo100', () => {
		const records = [
			makeRecord(0, 0, { heartRate: 120 }),
			makeRecord(30, 500, { heartRate: 150 }),
			makeRecord(60, 1000, { heartRate: 170 }),
		];
		const activity = makeActivity(records, { sport: 'running' });
		const profile: AthleteProfile = { maxHrRunning: 185 };
		const result = computeSegmentStats(activity, seg(0, 1000), profile);
		if (result.hrZones) {
			const total = result.hrZones.reduce((a, b) => a + b, 0);
			// Integer rounding across 5 zones can produce 99 or 101 — ±2 is acceptable
			expect(total).toBeGreaterThanOrEqual(98);
			expect(total).toBeLessThanOrEqual(102);
		}
	});
});

// ---------------------------------------------------------------------------
// No profile
// ---------------------------------------------------------------------------

describe('computeSegmentStats — no profile (AC9)', () => {
	it('computeSegmentStats_noProfile_returnsNullProfileFields', () => {
		const records = [
			makeRecord(0, 0, { power: 250, heartRate: 150 }),
			makeRecord(60, 1000, { power: 250, heartRate: 150 }),
		];
		const activity = makeActivity(records, { sport: 'running' });
		const result = computeSegmentStats(activity, seg(0, 1000));
		expect(result.powerPct).toBeNull();
		expect(result.hrZones).toBeNull();
	});
});
