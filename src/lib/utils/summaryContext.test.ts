import { describe, it, expect } from 'vitest';
import { buildCellContext } from './summaryContext.ts';
import type { AthleteProfile } from '$lib/types';

function profile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
	return overrides;
}

describe('buildCellContext — power channel', () => {
	it('buildCellContext_power_weightSet_returnsWkg', () => {
		const ctx = buildCellContext('power', 200, 'cycling', profile({ weight: 70 }));
		expect(ctx?.wkg).toBe('2.9');
	});

	it('buildCellContext_power_ftpSet_cycling_returnsFtpPct', () => {
		const ctx = buildCellContext('power', 200, 'cycling', profile({ ftp: 250 }));
		expect(ctx?.pctLabel).toBe('80% FTP');
	});

	it('buildCellContext_power_cpSet_running_returnsCpPct', () => {
		const ctx = buildCellContext('power', 200, 'running', profile({ cp: 250 }));
		expect(ctx?.pctLabel).toBe('80% CP');
	});

	it('buildCellContext_power_weightAndFtp_returnsBoth', () => {
		const ctx = buildCellContext('power', 200, 'cycling', profile({ weight: 70, ftp: 250 }));
		expect(ctx?.wkg).toBe('2.9');
		expect(ctx?.pctLabel).toBe('80% FTP');
	});

	it('buildCellContext_power_noThresholds_returnsNull', () => {
		const ctx = buildCellContext('power', 200, 'cycling', profile());
		expect(ctx).toBeNull();
	});

	it('buildCellContext_power_ftpSetButRunning_doesNotUseFtp', () => {
		// FTP is a cycling threshold — should not appear for running activities
		const ctx = buildCellContext('power', 200, 'running', profile({ ftp: 250 }));
		expect(ctx?.pctLabel).toBeUndefined();
	});

	it('buildCellContext_power_cpSetButCycling_doesNotUseCp', () => {
		// CP is a running threshold — should not appear for cycling activities
		const ctx = buildCellContext('power', 200, 'cycling', profile({ cp: 250 }));
		expect(ctx?.pctLabel).toBeUndefined();
	});
});

describe('buildCellContext — heartRate channel', () => {
	it('buildCellContext_heartRate_maxHrRunningSet_sport_running_returnsZone', () => {
		const ctx = buildCellContext('heartRate', 160, 'running', profile({ maxHrRunning: 190 }));
		expect(ctx?.zone).toBeGreaterThan(0);
	});

	it('buildCellContext_heartRate_noMaxHr_returnsNull', () => {
		const ctx = buildCellContext('heartRate', 160, 'running', profile());
		expect(ctx).toBeNull();
	});
});

describe('buildCellContext — other channels', () => {
	it('buildCellContext_cadence_returnsNull', () => {
		const ctx = buildCellContext('cadence', 170, 'running', profile({ weight: 70, ftp: 250 }));
		expect(ctx).toBeNull();
	});

	it('buildCellContext_speed_returnsNull', () => {
		const ctx = buildCellContext('speed', 12, 'cycling', profile({ weight: 70 }));
		expect(ctx).toBeNull();
	});
});
