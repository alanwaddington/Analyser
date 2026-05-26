import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import { buildWorkbook } from './excel.ts';
import type { Activity, ActivityRecord } from '$lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date('2026-01-15T09:00:00Z'),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function makeActivity(id: string, overrides: Partial<Activity> = {}): Activity {
	return {
		id,
		filename: `${id}.fit`,
		sport: 'running',
		startTime: new Date('2026-01-15T09:00:00Z'),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [makeRecord()],
		laps: [],
		devices: [],
		deviceStreams: [],
		...overrides,
	};
}

function parseWorkbook(buf: ArrayBuffer): xlsx.WorkBook {
	return xlsx.read(buf, { type: 'array', cellDates: true });
}

// ── buildWorkbook ─────────────────────────────────────────────────────────────

describe('buildWorkbook', () => {

	it('buildWorkbook_oneActivity_returnsTwoSheets', () => {
		const act = makeActivity('a');
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		// Summary + 1 data sheet
		expect(wb.SheetNames).toHaveLength(2);
	});

	it('buildWorkbook_threeActivities_returnsFourSheets', () => {
		const acts = [makeActivity('a'), makeActivity('b'), makeActivity('c')];
		const buf = buildWorkbook(acts);
		const wb = parseWorkbook(buf);
		// Summary + 3 data sheets
		expect(wb.SheetNames).toHaveLength(4);
	});

	it('buildWorkbook_firstSheetIsSummary', () => {
		const act = makeActivity('a');
		const buf = buildWorkbook(act ? [act] : []);
		const wb = parseWorkbook(buf);
		expect(wb.SheetNames[0]).toBe('Summary');
	});

	it('buildWorkbook_summarySheetHasCorrectColumns', () => {
		const act = makeActivity('a');
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets['Summary'];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		const keys = Object.keys(rows[0]);
		expect(keys).toContain('Filename');
		expect(keys).toContain('Sport');
		expect(keys).toContain('Start Time');
		expect(keys).toContain('Distance (km)');
		expect(keys).toContain('Elapsed Time');
	});

	it('buildWorkbook_summarySheetHasOneRowPerActivity', () => {
		const acts = [makeActivity('a'), makeActivity('b'), makeActivity('c')];
		const buf = buildWorkbook(acts);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets['Summary'];
		const rows = xlsx.utils.sheet_to_json(ws);
		expect(rows).toHaveLength(3);
	});

	it('buildWorkbook_dataSheetNamedAfterFilename', () => {
		const act = makeActivity('morning-run');
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		expect(wb.SheetNames[1]).toBe('morning-run.fit');
	});

	it('buildWorkbook_dataSheetNameTruncatedTo31Chars', () => {
		const act = makeActivity('a', {
			filename: 'this-is-a-very-long-filename-that-exceeds-thirty-one-characters.fit',
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		// Sheet name at index 1 must be <= 31 chars
		expect(wb.SheetNames[1].length).toBeLessThanOrEqual(31);
	});

	it('buildWorkbook_duplicateFilenames_deduplicatedWithSuffix', () => {
		const acts = [
			makeActivity('a', { filename: 'run.fit' }),
			makeActivity('b', { filename: 'run.fit' }),
		];
		const buf = buildWorkbook(acts);
		const wb = parseWorkbook(buf);
		// Both sheet names must exist and be different
		expect(wb.SheetNames[1]).not.toBe(wb.SheetNames[2]);
	});

	it('buildWorkbook_dataSheetHasHeaderRow', () => {
		const act = makeActivity('a', {
			records: [makeRecord({ heartRate: 140 })],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		const keys = Object.keys(rows[0]);
		expect(keys).toContain('Timestamp');
		expect(keys).toContain('Elapsed (s)');
		expect(keys).toContain('Distance (m)');
	});

	it('buildWorkbook_heartRatePresentInRecord_includesHeartRateColumn', () => {
		const act = makeActivity('a', {
			records: [makeRecord({ heartRate: 140 })],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		expect(Object.keys(rows[0])).toContain('Heart Rate (bpm)');
	});

	it('buildWorkbook_channelAllNull_columnOmitted', () => {
		// heartRate is undefined on all records — should NOT appear as column
		const act = makeActivity('a', {
			records: [makeRecord({ heartRate: undefined }), makeRecord({ heartRate: undefined })],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		expect(Object.keys(rows[0])).not.toContain('Heart Rate (bpm)');
	});

	it('buildWorkbook_channelPartiallyPresent_columnIncluded', () => {
		// heartRate defined on first record only — column should appear
		const act = makeActivity('a', {
			records: [
				makeRecord({ heartRate: 140 }),
				makeRecord({ heartRate: undefined }),
			],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		expect(Object.keys(rows[0])).toContain('Heart Rate (bpm)');
	});

	it('buildWorkbook_paceColumn_formattedAsMmss', () => {
		// pace = 5.25 min/km → should export as "5:15"
		const act = makeActivity('a', {
			records: [makeRecord({ pace: 5.25 })],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		expect(rows[0]['Pace (min/km)']).toBe('5:15');
	});

	it('buildWorkbook_paceWholeMinute_formattedAs500', () => {
		const act = makeActivity('a', {
			records: [makeRecord({ pace: 5.0 })],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		expect(rows[0]['Pace (min/km)']).toBe('5:00');
	});

	it('buildWorkbook_paceSingleDigitSeconds_padded', () => {
		// pace = 6 + 5/60 → "6:05"
		const act = makeActivity('a', {
			records: [makeRecord({ pace: 6 + 5 / 60 })],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		expect(rows[0]['Pace (min/km)']).toBe('6:05');
	});

	it('buildWorkbook_nullPace_emptyCell', () => {
		const act = makeActivity('a', {
			records: [
				makeRecord({ pace: 5.0 }),   // ensures column is created
				makeRecord({ pace: undefined }),
			],
		});
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws);
		// Second row pace should be undefined/null/empty string
		expect(rows[1]['Pace (min/km)'] ?? null).toBeNull();
	});

	it('buildWorkbook_dataSheetHasOneRowPerRecord', () => {
		const records = [
			makeRecord({ elapsedSeconds: 0 }),
			makeRecord({ elapsedSeconds: 1 }),
			makeRecord({ elapsedSeconds: 2 }),
		];
		const act = makeActivity('a', { records });
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		const ws = wb.Sheets[wb.SheetNames[1]];
		const rows = xlsx.utils.sheet_to_json(ws);
		expect(rows).toHaveLength(3);
	});

	it('buildWorkbook_emptyActivities_returnsTwoSheets', () => {
		// Edge case: one activity with no records still gets a data sheet
		const act = makeActivity('a', { records: [] });
		const buf = buildWorkbook([act]);
		const wb = parseWorkbook(buf);
		expect(wb.SheetNames).toHaveLength(2);
	});

	it('buildWorkbook_returnsArrayBuffer', () => {
		const act = makeActivity('a');
		const result = buildWorkbook([act]);
		expect(result).toBeInstanceOf(ArrayBuffer);
	});
});
