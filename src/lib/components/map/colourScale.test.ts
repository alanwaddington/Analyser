import { describe, it, expect } from 'vitest';
import { valueToColour, formatMetricValue } from './colourScale.ts';

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
		// Inverted: min maps to red, max maps to blue (for pace where low = fast = "good" = blue)
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
