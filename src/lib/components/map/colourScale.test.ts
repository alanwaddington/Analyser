import { describe, it, expect } from 'vitest';
import {
	valueToColour,
	formatMetricValue,
	ZONE_BASE_RGB,
	zoneToColour,
	zoneChartColour,
	getZoneBoundaries,
	valueToZone,
	formatZoneBoundary,
	powerSourceLabel,
} from './colourScale.ts';
import type { AthleteProfile } from '$lib/types';

// ---------------------------------------------------------------------------
// valueToColour
// ---------------------------------------------------------------------------
describe('valueToColour', () => {
	it('valueToColour_atMin_returnsBlue', () => {
		const colour = valueToColour(0, 0, 100);
		// Blue stop: rgb(0, 100, 255) → #0064ff
		expect(colour.toLowerCase()).toBe('#0064ff');
	});

	it('valueToColour_atMax_returnsRed', () => {
		const colour = valueToColour(100, 0, 100);
		// Red stop: rgb(255, 50, 0) → #ff3200
		expect(colour.toLowerCase()).toBe('#ff3200');
	});

	it('valueToColour_atMidpoint_returnsGreenOrYellow', () => {
		const colour = valueToColour(50, 0, 100);
		// Midpoint is between green and yellow; should not be blue or red
		expect(colour.toLowerCase()).not.toBe('#0064ff');
		expect(colour.toLowerCase()).not.toBe('#ff3200');
		// Hex colour format
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('valueToColour_atOneThird_returnsGreen', () => {
		const colour = valueToColour(1, 0, 3);
		// t=0.333 → between blue and green → should have strong green component
		// At t=1/3: interpolating from blue(0,100,255) → green(0,200,100)
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
		// Green channel should be higher than blue channel in the result
		const r = parseInt(colour.slice(1, 3), 16);
		const g = parseInt(colour.slice(3, 5), 16);
		expect(g).toBeGreaterThan(r);
	});

	it('valueToColour_belowMin_clampsToBlue', () => {
		const clampedColour = valueToColour(-10, 0, 100);
		expect(clampedColour.toLowerCase()).toBe('#0064ff');
	});

	it('valueToColour_aboveMax_clampsToRed', () => {
		const clampedColour = valueToColour(200, 0, 100);
		expect(clampedColour.toLowerCase()).toBe('#ff3200');
	});

	it('valueToColour_singleValueRange_returnsMidGradientColour', () => {
		// min === max — should not throw, returns a consistent colour
		const colour = valueToColour(50, 50, 50);
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('valueToColour_invertedFalse_minIsBlue', () => {
		const colour = valueToColour(0, 0, 100, false);
		expect(colour.toLowerCase()).toBe('#0064ff');
	});

	it('valueToColour_invertedTrue_minIsRed', () => {
		// invert=true reverses the gradient: min → red, max → blue
		const colour = valueToColour(0, 0, 100, true);
		expect(colour.toLowerCase()).toBe('#ff3200');
	});

	it('valueToColour_invertedTrue_maxIsBlue', () => {
		const colour = valueToColour(100, 0, 100, true);
		expect(colour.toLowerCase()).toBe('#0064ff');
	});

	it('valueToColour_returnsValidHexFormat', () => {
		const colour = valueToColour(42, 0, 100);
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('valueToColour_paceContract_fastPaceIsBlue', () => {
		// Pace uses no inversion (invert=false / default).
		// Low min/km = fast → blue; high min/km = slow → red.
		// Verify the contract so a mistaken invert=true is caught by tests.
		const fastColour = valueToColour(4.0, 4.0, 8.0);   // min = fastest
		const slowColour = valueToColour(8.0, 4.0, 8.0);   // max = slowest
		expect(fastColour.toLowerCase()).toBe('#0064ff');   // blue
		expect(slowColour.toLowerCase()).toBe('#ff3200');   // red
	});
});

// ---------------------------------------------------------------------------
// formatMetricValue
// ---------------------------------------------------------------------------
describe('formatMetricValue', () => {
	it('formatMetricValue_pace_returnsMMSS', () => {
		// 6.5 min/km = 6 minutes and 30 seconds = "6:30"
		expect(formatMetricValue(6.5, 'pace')).toBe('6:30');
	});

	it('formatMetricValue_pace_wholeMinute_returnsMMSS', () => {
		expect(formatMetricValue(5, 'pace')).toBe('5:00');
	});

	it('formatMetricValue_pace_paddedSeconds', () => {
		// 5.083... min/km = 5 min 5 sec = "5:05"
		expect(formatMetricValue(5 + 5 / 60, 'pace')).toBe('5:05');
	});

	it('formatMetricValue_heartRate_returnsInteger', () => {
		expect(formatMetricValue(150.7, 'heartRate')).toBe('151');
	});

	it('formatMetricValue_power_returnsInteger', () => {
		expect(formatMetricValue(245.3, 'power')).toBe('245');
	});

	it('formatMetricValue_cadence_returnsInteger', () => {
		expect(formatMetricValue(90.6, 'cadence')).toBe('91');
	});

	it('formatMetricValue_temperature_returnsOneDecimal', () => {
		expect(formatMetricValue(23.46, 'temperature')).toBe('23.5');
	});

	it('formatMetricValue_coreTemperature_returnsOneDecimal', () => {
		expect(formatMetricValue(38.12, 'coreTemperature')).toBe('38.1');
	});

	it('formatMetricValue_speed_returnsOneDecimal', () => {
		expect(formatMetricValue(12.345, 'speed')).toBe('12.3');
	});

	it('formatMetricValue_altitude_returnsOneDecimal', () => {
		expect(formatMetricValue(254.7, 'altitude')).toBe('254.7');
	});
});

// ---------------------------------------------------------------------------
// ZONE_BASE_RGB
// ---------------------------------------------------------------------------
describe('ZONE_BASE_RGB', () => {
	it('ZONE_BASE_RGB_hasSevenEntries', () => {
		expect(ZONE_BASE_RGB).toHaveLength(7);
	});

	it('ZONE_BASE_RGB_eachEntryIsRgbTuple', () => {
		for (const [r, g, b] of ZONE_BASE_RGB) {
			expect(r).toBeGreaterThanOrEqual(0);
			expect(r).toBeLessThanOrEqual(255);
			expect(g).toBeGreaterThanOrEqual(0);
			expect(g).toBeLessThanOrEqual(255);
			expect(b).toBeGreaterThanOrEqual(0);
			expect(b).toBeLessThanOrEqual(255);
		}
	});
});

// ---------------------------------------------------------------------------
// zoneToColour
// ---------------------------------------------------------------------------
describe('zoneToColour', () => {
	it('zoneToColour_zone1_returnsOpaqueHex', () => {
		const colour = zoneToColour(1);
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('zoneToColour_zone5_returnsOpaqueHex', () => {
		const colour = zoneToColour(5);
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('zoneToColour_zone7_returnsOpaqueHex', () => {
		const colour = zoneToColour(7);
		expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
	});

	it('zoneToColour_differentZones_produceDifferentColours', () => {
		const c1 = zoneToColour(1);
		const c5 = zoneToColour(5);
		expect(c1).not.toBe(c5);
	});

	it('zoneToColour_zone1_matchesZoneBaseRgb', () => {
		const [r, g, b] = ZONE_BASE_RGB[0];
		const expected = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
		expect(zoneToColour(1)).toBe(expected);
	});

	it('zoneToColour_outOfRange_clampsToValidZone', () => {
		expect(zoneToColour(0)).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(zoneToColour(8)).toMatch(/^#[0-9a-fA-F]{6}$/);
	});
});

// ---------------------------------------------------------------------------
// zoneChartColour
// ---------------------------------------------------------------------------
describe('zoneChartColour', () => {
	it('zoneChartColour_zone1Dark_matchesExistingDarkAlpha', () => {
		const colour = zoneChartColour(1, true);
		expect(colour).toBe('rgba(148,163,184,0.12)');
	});

	it('zoneChartColour_zone1Light_matchesExistingLightAlpha', () => {
		const colour = zoneChartColour(1, false);
		expect(colour).toBe('rgba(148,163,184,0.2)');
	});

	it('zoneChartColour_zone5Dark_matchesExistingDarkAlpha', () => {
		const colour = zoneChartColour(5, true);
		expect(colour).toBe('rgba(248,113,113,0.22)');
	});

	it('zoneChartColour_zone7Dark_matchesExistingDarkAlpha', () => {
		const colour = zoneChartColour(7, true);
		expect(colour).toBe('rgba(244,114,182,0.22)');
	});

	it('zoneChartColour_returnsRgbaFormat', () => {
		expect(zoneChartColour(3, true)).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
	});
});

// ---------------------------------------------------------------------------
// getZoneBoundaries
// ---------------------------------------------------------------------------
describe('getZoneBoundaries', () => {
	it('getZoneBoundaries_heartRate_runningWithMaxHR_returns5Bands', () => {
		const profile: AthleteProfile = { maxHrRunning: 180 };
		const bands = getZoneBoundaries('heartRate', 'running', profile);
		expect(bands).not.toBeNull();
		expect(bands).toHaveLength(5);
	});

	it('getZoneBoundaries_heartRate_cyclingWithMaxHrCycling_returns5Bands', () => {
		const profile: AthleteProfile = { maxHrCycling: 175 };
		const bands = getZoneBoundaries('heartRate', 'cycling', profile);
		expect(bands).not.toBeNull();
		expect(bands).toHaveLength(5);
	});

	it('getZoneBoundaries_heartRate_cyclingFallsBackToRunningMaxHR', () => {
		const profile: AthleteProfile = { maxHrRunning: 180 };
		const bands = getZoneBoundaries('heartRate', 'cycling', profile);
		expect(bands).not.toBeNull();
	});

	it('getZoneBoundaries_heartRate_lthrFallback_returns5Bands', () => {
		const profile: AthleteProfile = { lthr: 155 };
		const bands = getZoneBoundaries('heartRate', 'running', profile);
		expect(bands).not.toBeNull();
		expect(bands).toHaveLength(5);
	});

	it('getZoneBoundaries_heartRate_noProfile_returnsNull', () => {
		const bands = getZoneBoundaries('heartRate', 'running', {});
		expect(bands).toBeNull();
	});

	it('getZoneBoundaries_power_runningWithCP_returns5Bands', () => {
		const profile: AthleteProfile = { cp: 300 };
		const bands = getZoneBoundaries('power', 'running', profile);
		expect(bands).not.toBeNull();
		expect(bands).toHaveLength(5);
	});

	it('getZoneBoundaries_power_cyclingWithFTP_returns7Bands', () => {
		const profile: AthleteProfile = { ftp: 250 };
		const bands = getZoneBoundaries('power', 'cycling', profile);
		expect(bands).not.toBeNull();
		expect(bands).toHaveLength(7);
	});

	it('getZoneBoundaries_power_runningNoCP_returnsNull', () => {
		const profile: AthleteProfile = { ftp: 250 };
		const bands = getZoneBoundaries('power', 'running', profile);
		expect(bands).toBeNull();
	});

	it('getZoneBoundaries_power_cyclingNoFTP_returnsNull', () => {
		const profile: AthleteProfile = { cp: 300 };
		const bands = getZoneBoundaries('power', 'cycling', profile);
		expect(bands).toBeNull();
	});

	it('getZoneBoundaries_cadence_returnsNull', () => {
		const profile: AthleteProfile = { maxHrRunning: 180, cp: 300, ftp: 250 };
		expect(getZoneBoundaries('cadence', 'running', profile)).toBeNull();
	});

	it('getZoneBoundaries_speed_returnsNull', () => {
		expect(getZoneBoundaries('speed', 'running', {})).toBeNull();
	});

	it('getZoneBoundaries_heartRate_runningMaxHRPreferredOverLTHR', () => {
		const profile: AthleteProfile = { maxHrRunning: 180, lthr: 155 };
		const bandsWithMaxHR = getZoneBoundaries('heartRate', 'running', profile);
		const bandsLTHROnly: AthleteProfile = { lthr: 155 };
		const bandsWithLTHR = getZoneBoundaries('heartRate', 'running', bandsLTHROnly);
		// maxHR=180 gives different boundaries than lthr=155 derived maxHR (155/0.92≈168.5)
		expect(bandsWithMaxHR![0].max).not.toBe(bandsWithLTHR![0].max);
	});
});

// ---------------------------------------------------------------------------
// valueToZone
// ---------------------------------------------------------------------------
describe('valueToZone', () => {
	it('valueToZone_heartRate_inZ1_returns1', () => {
		// maxHR=180: Z1 < 108 bpm
		const profile: AthleteProfile = { maxHrRunning: 180 };
		expect(valueToZone(100, 'heartRate', 'running', profile)).toBe(1);
	});

	it('valueToZone_heartRate_inZ5_returns5', () => {
		// maxHR=180: Z5 >= 162 bpm
		const profile: AthleteProfile = { maxHrRunning: 180 };
		expect(valueToZone(170, 'heartRate', 'running', profile)).toBe(5);
	});

	it('valueToZone_heartRate_atZ2Boundary_returnsZ2', () => {
		// maxHR=180: Z2 starts at 108 bpm (60% of 180)
		const profile: AthleteProfile = { maxHrRunning: 180 };
		expect(valueToZone(108, 'heartRate', 'running', profile)).toBe(2);
	});

	it('valueToZone_power_runningCP_inZ3_returns3', () => {
		// CP=300: Z3 = 88-104% = 264-312W
		const profile: AthleteProfile = { cp: 300 };
		expect(valueToZone(300, 'power', 'running', profile)).toBe(3);
	});

	it('valueToZone_power_cyclingFTP_inZ4_returns4', () => {
		// FTP=250: Z4 = 90-105% = 225-262.5W
		const profile: AthleteProfile = { ftp: 250 };
		expect(valueToZone(250, 'power', 'cycling', profile)).toBe(4);
	});

	it('valueToZone_noProfile_returnsNull', () => {
		expect(valueToZone(150, 'heartRate', 'running', {})).toBeNull();
	});

	it('valueToZone_unsupportedChannel_returnsNull', () => {
		const profile: AthleteProfile = { maxHrRunning: 180 };
		expect(valueToZone(90, 'cadence', 'running', profile)).toBeNull();
	});

	it('valueToZone_aboveAllBands_returnsHighestZone', () => {
		// maxHR=180: Z5 >= 162; value=250 (above max)
		const profile: AthleteProfile = { maxHrRunning: 180 };
		expect(valueToZone(250, 'heartRate', 'running', profile)).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// formatZoneBoundary
// ---------------------------------------------------------------------------
describe('formatZoneBoundary', () => {
	it('formatZoneBoundary_hrZ1_showsLessThan', () => {
		// Z1 has min=0, format as "Z1: <108 bpm"
		const band = { min: 0, max: 108, zone: 1 as const };
		expect(formatZoneBoundary(band, 'heartRate')).toBe('Z1: <108 bpm');
	});

	it('formatZoneBoundary_hrMiddleBand_showsRange', () => {
		const band = { min: 108, max: 126, zone: 2 as const };
		expect(formatZoneBoundary(band, 'heartRate')).toBe('Z2: 108–126 bpm');
	});

	it('formatZoneBoundary_hrZ5_showsGreaterThan', () => {
		// Z5 has max=Infinity, format as "Z5: >162 bpm"
		const band = { min: 162, max: Infinity, zone: 5 as const };
		expect(formatZoneBoundary(band, 'heartRate')).toBe('Z5: >162 bpm');
	});

	it('formatZoneBoundary_powerZ1_usesWattsUnit', () => {
		const band = { min: 0, max: 225, zone: 1 as const };
		expect(formatZoneBoundary(band, 'power')).toBe('Z1: <225 W');
	});

	it('formatZoneBoundary_powerZ5_greaterThan', () => {
		const band = { min: 360, max: Infinity, zone: 5 as const };
		expect(formatZoneBoundary(band, 'power')).toBe('Z5: >360 W');
	});
});

// ---------------------------------------------------------------------------
// powerSourceLabel
// ---------------------------------------------------------------------------
describe('powerSourceLabel', () => {
	it('powerSourceLabel_stryd_returnsStrydPower', () => {
		expect(powerSourceLabel('stryd', undefined)).toBe('Stryd Power');
	});

	it('powerSourceLabel_nativeWithGarmin_returnsGarminRunningPower', () => {
		expect(powerSourceLabel('native', 'garmin')).toBe('Garmin Running Power');
	});

	it('powerSourceLabel_nativeWithUnknownMfr_returnsRunningPower', () => {
		expect(powerSourceLabel('native', undefined)).toBe('Running Power');
	});

	it('powerSourceLabel_cycling_returnsPower', () => {
		expect(powerSourceLabel('cycling', undefined)).toBe('Power');
	});

	it('powerSourceLabel_undefined_returnsPower', () => {
		expect(powerSourceLabel(undefined, undefined)).toBe('Power');
	});

	it('powerSourceLabel_nativeWithSuunto_returnsSuuntoRunningPower', () => {
		expect(powerSourceLabel('native', 'suunto')).toBe('Suunto Running Power');
	});
});
