import { describe, it, expect } from 'vitest';
import { detectAnomalies, groupAnomaliesByChannel } from './anomalies.ts';
import type { ActivityRecord } from '$lib/types';

function makeRecord(
	elapsedSeconds: number,
	distance: number,
	overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
	return {
		timestamp: new Date(elapsedSeconds * 1000),
		elapsedSeconds,
		distance,
		...overrides,
	};
}

// Build a flat array of records with a stable HR baseline, then inject a spike
function hrRecordsWithSpike(baseline: number, spikeValue: number, spikeAt: number): ActivityRecord[] {
	return Array.from({ length: 60 }, (_, i) =>
		makeRecord(i, i * 10, { heartRate: i === spikeAt ? spikeValue : baseline })
	);
}

// Build records with a power baseline, then inject a spike
function powerRecordsWithSpike(baseline: number, spikeValue: number, spikeAt: number): ActivityRecord[] {
	return Array.from({ length: 60 }, (_, i) =>
		makeRecord(i, i * 10, { power: i === spikeAt ? spikeValue : baseline })
	);
}

// Build records with a dropout: cadence = 0 for a window mid-activity
function cadenceRecordsWithDropout(dropoutStart: number, dropoutEnd: number): ActivityRecord[] {
	return Array.from({ length: 120 }, (_, i) =>
		makeRecord(i, i * 10, {
			cadence: (i >= dropoutStart && i <= dropoutEnd) ? 0 : 85,
		})
	);
}

// --------------------------------------------------------------------------
// HR spike detection — statistical
// --------------------------------------------------------------------------

describe('detectAnomalies — HR spike (statistical)', () => {
	it('detectAnomalies_hrSpike_flaggedAsSpike', () => {
		// Baseline 150 bpm, spike of 220 for 1 s — clearly > mean + 4σ
		const records = hrRecordsWithSpike(150, 220, 30);
		const anomalies = detectAnomalies(records);
		const hrAnomalies = anomalies.filter(a => a.channel === 'heartRate' && a.type === 'spike');
		expect(hrAnomalies.length).toBeGreaterThan(0);
		expect(hrAnomalies[0].detectionStrategy).toBe('statistical');
		expect(hrAnomalies[0].value).toBe(220);
		expect(hrAnomalies[0].recordIndex).toBe(30);
	});

	it('detectAnomalies_hrNormalVariation_notFlagged', () => {
		// All records at 150 bpm — no anomalies
		const records = Array.from({ length: 60 }, (_, i) =>
			makeRecord(i, i * 10, { heartRate: 150 })
		);
		const anomalies = detectAnomalies(records);
		const hrAnomalies = anomalies.filter(a => a.channel === 'heartRate' && a.type === 'spike');
		expect(hrAnomalies.length).toBe(0);
	});

	it('detectAnomalies_hrSpikeLastingOver3s_notFlagged', () => {
		// 5-second elevation — not a glitch, ignore
		const records = Array.from({ length: 60 }, (_, i) =>
			makeRecord(i, i * 10, { heartRate: i >= 28 && i <= 32 ? 220 : 150 })
		);
		const anomalies = detectAnomalies(records);
		const hrAnomalies = anomalies.filter(a => a.channel === 'heartRate' && a.type === 'spike');
		expect(hrAnomalies.length).toBe(0);
	});
});

// --------------------------------------------------------------------------
// HR spike detection — threshold-relative (maxHR)
// --------------------------------------------------------------------------

describe('detectAnomalies — HR spike (threshold-relative)', () => {
	it('detectAnomalies_hrWithMaxHR_usesThresholdRelative', () => {
		const records = hrRecordsWithSpike(150, 200, 30);
		// maxHR = 185; 200 > 185 + 10 = 195 → spike
		const anomalies = detectAnomalies(records, { athleteProfile: { maxHR: 185 } });
		const hrAnomalies = anomalies.filter(a => a.channel === 'heartRate' && a.type === 'spike');
		expect(hrAnomalies.length).toBeGreaterThan(0);
		expect(hrAnomalies[0].detectionStrategy).toBe('threshold-relative');
	});

	it('detectAnomalies_hrBelowMaxHRThreshold_notFlagged', () => {
		const records = hrRecordsWithSpike(150, 192, 30);
		// maxHR = 185; 192 < 185 + 10 = 195 → not a spike
		const anomalies = detectAnomalies(records, { athleteProfile: { maxHR: 185 } });
		const hrAnomalies = anomalies.filter(a => a.channel === 'heartRate' && a.type === 'spike');
		expect(hrAnomalies.length).toBe(0);
	});
});

// --------------------------------------------------------------------------
// Power spike detection — statistical
// --------------------------------------------------------------------------

describe('detectAnomalies — power spike (statistical)', () => {
	it('detectAnomalies_powerSpike_flaggedAsSpike', () => {
		// Baseline 250 W, spike of 2000 W for 1 s
		const records = powerRecordsWithSpike(250, 2000, 30);
		const anomalies = detectAnomalies(records);
		const powerAnomalies = anomalies.filter(a => a.channel === 'power' && a.type === 'spike');
		expect(powerAnomalies.length).toBeGreaterThan(0);
		expect(powerAnomalies[0].detectionStrategy).toBe('statistical');
	});

	it('detectAnomalies_powerZeroGlitch_flaggedAsSpike', () => {
		// Baseline 250 W, one record at 9999 W (common glitch value)
		const records = powerRecordsWithSpike(250, 9999, 30);
		const anomalies = detectAnomalies(records);
		const powerAnomalies = anomalies.filter(a => a.channel === 'power' && a.type === 'spike');
		expect(powerAnomalies.length).toBeGreaterThan(0);
	});
});

// --------------------------------------------------------------------------
// Power spike detection — threshold-relative (CP)
// --------------------------------------------------------------------------

describe('detectAnomalies — power spike (threshold-relative)', () => {
	it('detectAnomalies_strydPowerWithCP_usesThresholdRelative', () => {
		// CP = 300 W; 150% = 450 W threshold; spike at 500 W for 1 s
		const records = powerRecordsWithSpike(280, 500, 30);
		const anomalies = detectAnomalies(records, {
			powerSource: 'stryd',
			athleteProfile: { cp: 300 },
		});
		const powerAnomalies = anomalies.filter(a => a.channel === 'power' && a.type === 'spike');
		expect(powerAnomalies.length).toBeGreaterThan(0);
		expect(powerAnomalies[0].detectionStrategy).toBe('threshold-relative');
	});

	it('detectAnomalies_nativePowerIgnoresCPOption_usesStatistical', () => {
		// power source is 'native', so even with CP set it uses statistical
		const records = powerRecordsWithSpike(280, 500, 30);
		const anomalies = detectAnomalies(records, {
			powerSource: 'native',
			athleteProfile: { cp: 300 },
		});
		// May or may not flag depending on σ — just check strategy if flagged
		const powerAnomalies = anomalies.filter(a => a.channel === 'power' && a.type === 'spike');
		powerAnomalies.forEach(a => expect(a.detectionStrategy).toBe('statistical'));
	});
});

// --------------------------------------------------------------------------
// Cadence dropout detection
// --------------------------------------------------------------------------

describe('detectAnomalies — cadence dropout', () => {
	it('detectAnomalies_cadenceDropoutMidActivity_flaggedAsDropout', () => {
		// Dropout from second 40 to second 60 (20 s > 10 s threshold) — mid-activity
		const records = cadenceRecordsWithDropout(40, 60);
		const anomalies = detectAnomalies(records);
		const dropouts = anomalies.filter(a => a.channel === 'cadence' && a.type === 'dropout');
		expect(dropouts.length).toBeGreaterThan(0);
	});

	it('detectAnomalies_cadenceDropoutShort_notFlagged', () => {
		// Dropout for only 5 s — below 10 s threshold
		const records = cadenceRecordsWithDropout(40, 44);
		const anomalies = detectAnomalies(records);
		const dropouts = anomalies.filter(a => a.channel === 'cadence' && a.type === 'dropout');
		expect(dropouts.length).toBe(0);
	});

	it('detectAnomalies_cadenceDropoutInWarmup_notFlagged', () => {
		// Dropout entirely within first 30 s — warmup period, ignored
		const records = cadenceRecordsWithDropout(5, 20);
		const anomalies = detectAnomalies(records);
		const dropouts = anomalies.filter(a => a.channel === 'cadence' && a.type === 'dropout');
		expect(dropouts.length).toBe(0);
	});
});

// --------------------------------------------------------------------------
// GPS drift detection
// --------------------------------------------------------------------------

describe('detectAnomalies — GPS drift', () => {
	it('detectAnomalies_gpsDrift_flaggedAsGpsDrift', () => {
		// Record at 51.0, -1.0 then suddenly at 51.1, -1.0 (11.1 km away) in 1 s
		// while speed = 15 km/h. Implied speed ≈ 40,000 km/h >> 3× 15 km/h
		const records = [
			makeRecord(0, 0, { position: { lat: 51.0, lon: -1.0 }, speed: 15 }),
			makeRecord(1, 15, { position: { lat: 51.1, lon: -1.0 }, speed: 15 }),
			makeRecord(2, 30, { position: { lat: 51.1, lon: -1.001 }, speed: 15 }),
		];
		const anomalies = detectAnomalies(records);
		const drifts = anomalies.filter(a => a.type === 'gps-drift');
		expect(drifts.length).toBeGreaterThan(0);
		expect(drifts[0].detectionStrategy).toBe('statistical');
	});

	it('detectAnomalies_normalGpsMovement_notFlagged', () => {
		// Steady 15 km/h movement — no drift
		const records = Array.from({ length: 10 }, (_, i) =>
			makeRecord(i, i * 4.17, {
				position: { lat: 51.0 + i * 0.00004, lon: -1.0 },
				speed: 15,
			})
		);
		const anomalies = detectAnomalies(records);
		const drifts = anomalies.filter(a => a.type === 'gps-drift');
		expect(drifts.length).toBe(0);
	});
});

// --------------------------------------------------------------------------
// Clean file — no anomalies
// --------------------------------------------------------------------------

describe('detectAnomalies — clean file', () => {
	it('detectAnomalies_cleanRecords_returnsEmptyArray', () => {
		const records = Array.from({ length: 60 }, (_, i) =>
			makeRecord(i, i * 10, {
				heartRate: 150,
				power: 250,
				cadence: 85,
			})
		);
		expect(detectAnomalies(records)).toEqual([]);
	});

	it('detectAnomalies_emptyRecords_returnsEmptyArray', () => {
		expect(detectAnomalies([])).toEqual([]);
	});
});

// --------------------------------------------------------------------------
// Sorted output
// --------------------------------------------------------------------------

describe('detectAnomalies — output ordering', () => {
	it('detectAnomalies_multipleAnomalies_sortedByRecordIndex', () => {
		// HR spike at 30, power spike at 10
		const records = Array.from({ length: 60 }, (_, i) =>
			makeRecord(i, i * 10, {
				heartRate: i === 30 ? 220 : 150,
				power: i === 10 ? 9999 : 250,
			})
		);
		const anomalies = detectAnomalies(records);
		for (let i = 1; i < anomalies.length; i++) {
			expect(anomalies[i].recordIndex).toBeGreaterThanOrEqual(anomalies[i - 1].recordIndex);
		}
	});
});

// --------------------------------------------------------------------------
// groupAnomaliesByChannel
// --------------------------------------------------------------------------

describe('groupAnomaliesByChannel', () => {
	it('groupAnomaliesByChannel_mixedChannels_groupsCorrectly', () => {
		const records = Array.from({ length: 60 }, (_, i) =>
			makeRecord(i, i * 10, {
				heartRate: i === 30 ? 220 : 150,
				power: i === 10 ? 9999 : 250,
			})
		);
		const anomalies = detectAnomalies(records);
		const byChannel = groupAnomaliesByChannel(anomalies);
		expect(byChannel.has('heartRate')).toBe(true);
		expect(byChannel.has('power')).toBe(true);
		byChannel.get('heartRate')!.forEach(a => expect(a.channel).toBe('heartRate'));
		byChannel.get('power')!.forEach(a => expect(a.channel).toBe('power'));
	});

	it('groupAnomaliesByChannel_emptyInput_returnsEmptyMap', () => {
		expect(groupAnomaliesByChannel([])).toEqual(new Map());
	});
});
