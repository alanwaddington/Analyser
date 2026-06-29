import type { AthleteProfile } from '$lib/types';

export type HrZone = 1 | 2 | 3 | 4 | 5;
export type CpZone = 1 | 2 | 3 | 4 | 5;

export interface ZoneBand {
	min: number;
	max: number;
	zone: number;
}

// HR zone from % of maxHR (5-zone model)
// Z1 < 60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 ≥ 90%
export function hrZoneFromMaxHR(bpm: number, maxHR: number): HrZone {
	const pct = bpm / maxHR;
	if (pct < 0.60) return 1;
	if (pct < 0.70) return 2;
	if (pct < 0.80) return 3;
	if (pct < 0.90) return 4;
	return 5;
}

// HR zone from % of LTHR (5-zone model)
// Z1 < 81%, Z2 81–89%, Z3 89–93%, Z4 93–100%, Z5 ≥ 100%
export function hrZoneFromLTHR(bpm: number, lthr: number): HrZone {
	const pct = bpm / lthr;
	if (pct < 0.81) return 1;
	if (pct < 0.89) return 2;
	if (pct < 0.93) return 3;
	if (pct < 1.00) return 4;
	return 5;
}

// Sport-aware HR zone: picks the primary sport's maxHR, falls back to the other
// sport's maxHR, then falls back to LTHR. Returns null when no threshold is configured.
export function hrZone(bpm: number, profile: AthleteProfile, sport: string): HrZone | null {
	const primaryMaxHR  = sport === 'cycling' ? profile.maxHrCycling : profile.maxHrRunning;
	const fallbackMaxHR = sport === 'cycling' ? profile.maxHrRunning  : profile.maxHrCycling;
	const maxHR = primaryMaxHR ?? fallbackMaxHR;
	if (maxHR != null) return hrZoneFromMaxHR(bpm, maxHR);
	if (profile.lthr != null) return hrZoneFromLTHR(bpm, profile.lthr);
	return null;
}

// Estimate maxHR from LTHR — LTHR is approximately 92% of maxHR (Friel/Coggan convention).
// Use only when maxHR is not directly available.
export function lthrToEstimatedMaxHR(lthr: number): number {
	return lthr / 0.92;
}

// CP zone — Stryd 5-zone model
// Z1 < 75%, Z2 75–88%, Z3 88–104%, Z4 104–120%, Z5 ≥ 120%
export function cpZone(watts: number, cp: number): CpZone {
	const pct = watts / cp;
	if (pct < 0.75) return 1;
	if (pct < 0.88) return 2;
	if (pct < 1.04) return 3;
	if (pct < 1.20) return 4;
	return 5;
}

// Percentage of FTP — returns rounded integer; returns 0 when ftp ≤ 0
export function ftpPct(watts: number, ftp: number): number {
	if (ftp <= 0) return 0;
	return Math.round((watts / ftp) * 100);
}

// Percentage of CP — returns rounded integer; returns 0 when cp ≤ 0
export function cpPct(watts: number, cp: number): number {
	if (cp <= 0) return 0;
	return Math.round((watts / cp) * 100);
}

// Watts per kilogram — returns 1 decimal place; returns 0 when weightKg ≤ 0
export function wPerKg(watts: number, weightKg: number): number {
	if (weightKg <= 0) return 0;
	return Math.round((watts / weightKg) * 10) / 10;
}

// HR zone boundary array for markArea construction (maxHR-based)
export function hrZoneBoundaries(maxHR: number): ZoneBand[] {
	return [
		{ min: 0,             max: maxHR * 0.60, zone: 1 },
		{ min: maxHR * 0.60,  max: maxHR * 0.70, zone: 2 },
		{ min: maxHR * 0.70,  max: maxHR * 0.80, zone: 3 },
		{ min: maxHR * 0.80,  max: maxHR * 0.90, zone: 4 },
		{ min: maxHR * 0.90,  max: Infinity,      zone: 5 },
	];
}

// CP zone boundary array for markArea construction (Stryd model)
export function cpZoneBoundaries(cp: number): ZoneBand[] {
	return [
		{ min: 0,          max: cp * 0.75, zone: 1 },
		{ min: cp * 0.75,  max: cp * 0.88, zone: 2 },
		{ min: cp * 0.88,  max: cp * 1.04, zone: 3 },
		{ min: cp * 1.04,  max: cp * 1.20, zone: 4 },
		{ min: cp * 1.20,  max: Infinity,  zone: 5 },
	];
}

export type FtpZone = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// FTP zone — Coggan 7-zone cycling power model
// Z1 (Active Recovery) < 55%, Z2 (Endurance) 55–75%, Z3 (Tempo) 75–90%,
// Z4 (Threshold) 90–105%, Z5 (VO2Max) 105–120%, Z6 (Anaerobic) 120–150%, Z7 (Neuromuscular) ≥ 150%
export function ftpZone(watts: number, ftp: number): FtpZone {
	const pct = watts / ftp;
	if (pct < 0.55) return 1;
	if (pct < 0.75) return 2;
	if (pct < 0.90) return 3;
	if (pct < 1.05) return 4;
	if (pct < 1.20) return 5;
	if (pct < 1.50) return 6;
	return 7;
}

// FTP zone boundary array for markArea construction (Coggan 7-zone model)
export function ftpZoneBoundaries(ftp: number): ZoneBand[] {
	return [
		{ min: 0,           max: ftp * 0.55, zone: 1 },
		{ min: ftp * 0.55,  max: ftp * 0.75, zone: 2 },
		{ min: ftp * 0.75,  max: ftp * 0.90, zone: 3 },
		{ min: ftp * 0.90,  max: ftp * 1.05, zone: 4 },
		{ min: ftp * 1.05,  max: ftp * 1.20, zone: 5 },
		{ min: ftp * 1.20,  max: ftp * 1.50, zone: 6 },
		{ min: ftp * 1.50,  max: Infinity,   zone: 7 },
	];
}
