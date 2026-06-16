import { describe, it, expect } from 'vitest';
import {
	CHANNEL_KEYS,
	presentChannels,
	buildHeaderLabel,
	formatCellValue,
	escapeCsvField,
} from './columns.ts';
import type { ActivityRecord } from '$lib/types';

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date('2026-01-15T09:00:00Z'),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

// ── CHANNEL_KEYS ──────────────────────────────────────────────────────────────

describe('CHANNEL_KEYS', () => {
	it('CHANNEL_KEYS_isArray_containsKnownChannels', () => {
		expect(CHANNEL_KEYS).toContain('heartRate');
		expect(CHANNEL_KEYS).toContain('power');
		expect(CHANNEL_KEYS).toContain('pace');
		expect(CHANNEL_KEYS).toContain('altitude');
	});

	it('CHANNEL_KEYS_doesNotContainPosition', () => {
		expect(CHANNEL_KEYS).not.toContain('position');
	});
});

// ── presentChannels ───────────────────────────────────────────────────────────

describe('presentChannels', () => {
	it('presentChannels_allNull_returnsEmpty', () => {
		const records = [makeRecord(), makeRecord()];
		expect(presentChannels(records)).toEqual([]);
	});

	it('presentChannels_heartRatePresent_includesHeartRate', () => {
		const records = [makeRecord({ heartRate: 140 })];
		expect(presentChannels(records)).toContain('heartRate');
	});

	it('presentChannels_heartRateAllNull_excludesHeartRate', () => {
		const records = [
			makeRecord({ heartRate: undefined }),
			makeRecord({ heartRate: undefined }),
		];
		expect(presentChannels(records)).not.toContain('heartRate');
	});

	it('presentChannels_partiallyPresent_includesChannel', () => {
		const records = [
			makeRecord({ heartRate: 140 }),
			makeRecord({ heartRate: undefined }),
		];
		expect(presentChannels(records)).toContain('heartRate');
	});

	it('presentChannels_multipleChannels_returnsAll', () => {
		const records = [makeRecord({ heartRate: 140, power: 200, pace: 5.0 })];
		const result = presentChannels(records);
		expect(result).toContain('heartRate');
		expect(result).toContain('power');
		expect(result).toContain('pace');
	});

	it('presentChannels_preservesChannelKeyOrder', () => {
		const records = [makeRecord({ pace: 5.0, heartRate: 140 })];
		const result = presentChannels(records);
		expect(result.indexOf('heartRate')).toBeLessThan(result.indexOf('pace'));
	});
});

// ── buildHeaderLabel ─────────────────────────────────────────────────────────

describe('buildHeaderLabel', () => {
	it('buildHeaderLabel_heartRate_returnsLabelWithUnit', () => {
		expect(buildHeaderLabel('heartRate')).toBe('Heart Rate (bpm)');
	});

	it('buildHeaderLabel_power_returnsLabelWithUnit', () => {
		expect(buildHeaderLabel('power')).toBe('Power (W)');
	});

	it('buildHeaderLabel_pace_returnsLabelWithUnit', () => {
		expect(buildHeaderLabel('pace')).toBe('Pace (min/km)');
	});

	it('buildHeaderLabel_altitude_returnsLabelWithUnit', () => {
		expect(buildHeaderLabel('altitude')).toBe('Altitude (m)');
	});

	it('buildHeaderLabel_temperature_returnsLabelWithUnit', () => {
		expect(buildHeaderLabel('temperature')).toBe('Temperature (°C)');
	});
});

// ── formatCellValue ───────────────────────────────────────────────────────────

describe('formatCellValue', () => {
	it('formatCellValue_null_returnsNull', () => {
		expect(formatCellValue('heartRate', null)).toBeNull();
	});

	it('formatCellValue_undefined_returnsNull', () => {
		expect(formatCellValue('heartRate', undefined)).toBeNull();
	});

	it('formatCellValue_heartRateNumber_passesThrough', () => {
		expect(formatCellValue('heartRate', 140)).toBe(140);
	});

	it('formatCellValue_pace_formatsAsMmss', () => {
		expect(formatCellValue('pace', 5.25)).toBe('5:15');
	});

	it('formatCellValue_paceWholeMinute_formatsCorrectly', () => {
		expect(formatCellValue('pace', 5.0)).toBe('5:00');
	});

	it('formatCellValue_paceSingleDigitSeconds_pads', () => {
		expect(formatCellValue('pace', 6 + 5 / 60)).toBe('6:05');
	});

	it('formatCellValue_power_passesThrough', () => {
		expect(formatCellValue('power', 250)).toBe(250);
	});

	it('formatCellValue_dateValue_passesThrough', () => {
		const d = new Date('2026-01-15T09:00:00Z');
		expect(formatCellValue('heartRate', d)).toBe(d);
	});
});

// ── escapeCsvField ────────────────────────────────────────────────────────────

describe('escapeCsvField', () => {
	it('escapeCsvField_plainString_returnsUnchanged', () => {
		expect(escapeCsvField('hello')).toBe('hello');
	});

	it('escapeCsvField_stringWithComma_wrapsInQuotes', () => {
		expect(escapeCsvField('hello,world')).toBe('"hello,world"');
	});

	it('escapeCsvField_stringWithDoubleQuote_escapesAndWraps', () => {
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
	});

	it('escapeCsvField_stringWithNewline_wrapsInQuotes', () => {
		expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
	});

	it('escapeCsvField_stringWithCrLf_wrapsInQuotes', () => {
		expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
	});

	it('escapeCsvField_emptyString_returnsEmpty', () => {
		expect(escapeCsvField('')).toBe('');
	});

	it('escapeCsvField_stringWithBothCommaAndQuote_handlesCorrectly', () => {
		expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
	});
});
