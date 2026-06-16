import { describe, it, expect } from 'vitest';
import { buildCsv } from './csv.ts';
import type { Activity, ActivityRecord } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date('2026-01-15T09:00:00Z'),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function makeActivity(id: string, overrides: Partial<Activity> = {}): Activity {
	return makeBaseActivity({
		id,
		filename: `${id}.fit`,
		sport: 'running',
		startTime: new Date('2026-01-15T09:00:00Z'),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [makeRecord()],
		...overrides,
	});
}

/** Parse one RFC 4180 row into fields, handling quoted fields with embedded commas and quotes. */
function parseCsvRow(row: string): string[] {
	const fields: string[] = [];
	let i = 0;
	while (i < row.length) {
		if (row[i] === '"') {
			let field = '';
			i++;
			while (i < row.length) {
				if (row[i] === '"' && row[i + 1] === '"') { field += '"'; i += 2; }
				else if (row[i] === '"') { i++; break; }
				else { field += row[i++]; }
			}
			fields.push(field);
			if (row[i] === ',') i++;
		} else {
			const end = row.indexOf(',', i);
			if (end === -1) { fields.push(row.slice(i)); break; }
			fields.push(row.slice(i, end));
			i = end + 1;
		}
	}
	return fields;
}

/** Parse the CSV string into rows of field arrays (RFC 4180 compliant). */
function parseCsv(csv: string): string[][] {
	return csv.split('\r\n').filter(line => line.length > 0).map(parseCsvRow);
}

/** Parse a CSV string into an array of objects keyed by the header row (RFC 4180 compliant). */
function parseCsvAsObjects(csv: string): Record<string, string>[] {
	const rows = csv.split('\r\n').filter(l => l.length > 0);
	if (rows.length === 0) return [];
	const headers = parseCsvRow(rows[0]);
	return rows.slice(1).map(row => {
		const cells = parseCsvRow(row);
		const obj: Record<string, string> = {};
		headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
		return obj;
	});
}

// ── buildCsv — return type ────────────────────────────────────────────────────

describe('buildCsv', () => {
	it('buildCsv_returnsString', () => {
		const act = makeActivity('a');
		expect(typeof buildCsv([act])).toBe('string');
	});

	// ── single activity ───────────────────────────────────────────────────────

	it('buildCsv_singleActivity_firstRowIsHeader', () => {
		const act = makeActivity('a', { records: [makeRecord({ heartRate: 140 })] });
		const rows = parseCsv(buildCsv([act]));
		expect(rows[0]).toContain('Timestamp');
		expect(rows[0]).toContain('Elapsed (s)');
		expect(rows[0]).toContain('Distance (m)');
	});

	it('buildCsv_singleActivity_noActivityColumn', () => {
		const act = makeActivity('a', { records: [makeRecord({ heartRate: 140 })] });
		const rows = parseCsv(buildCsv([act]));
		expect(rows[0]).not.toContain('activity');
	});

	it('buildCsv_singleActivity_correctRowCount', () => {
		const records = [
			makeRecord({ elapsedSeconds: 0 }),
			makeRecord({ elapsedSeconds: 1 }),
			makeRecord({ elapsedSeconds: 2 }),
		];
		const act = makeActivity('a', { records });
		const rows = parseCsv(buildCsv([act]));
		// 1 header + 3 data rows
		expect(rows).toHaveLength(4);
	});

	it('buildCsv_singleActivity_oneRecord_twoRows', () => {
		const act = makeActivity('a');
		const rows = parseCsv(buildCsv([act]));
		expect(rows).toHaveLength(2);
	});

	it('buildCsv_emptyRecords_onlyHeaderRow', () => {
		const act = makeActivity('a', { records: [] });
		const rows = parseCsv(buildCsv([act]));
		expect(rows).toHaveLength(1);
	});

	// ── multi-activity ────────────────────────────────────────────────────────

	it('buildCsv_multiActivity_hasActivityColumn', () => {
		const acts = [makeActivity('a'), makeActivity('b')];
		const rows = parseCsv(buildCsv(acts));
		expect(rows[0][0]).toBe('activity');
	});

	it('buildCsv_multiActivity_activityColumnHasFilename', () => {
		const acts = [
			makeActivity('a', { filename: 'run-a.fit' }),
			makeActivity('b', { filename: 'run-b.fit' }),
		];
		const objs = parseCsvAsObjects(buildCsv(acts));
		const filenames = objs.map(r => r['activity']);
		expect(filenames).toContain('run-a.fit');
		expect(filenames).toContain('run-b.fit');
	});

	it('buildCsv_multiActivity_correctTotalRowCount', () => {
		const act1 = makeActivity('a', {
			records: [makeRecord(), makeRecord()],
		});
		const act2 = makeActivity('b', {
			records: [makeRecord(), makeRecord(), makeRecord()],
		});
		const rows = parseCsv(buildCsv([act1, act2]));
		// 1 header + 5 data rows
		expect(rows).toHaveLength(6);
	});

	// ── channel handling ──────────────────────────────────────────────────────

	it('buildCsv_heartRatePresent_includesHeartRateColumn', () => {
		const act = makeActivity('a', { records: [makeRecord({ heartRate: 140 })] });
		const rows = parseCsv(buildCsv([act]));
		expect(rows[0]).toContain('Heart Rate (bpm)');
	});

	it('buildCsv_heartRateAllNull_omitsColumn', () => {
		const act = makeActivity('a', {
			records: [makeRecord({ heartRate: undefined }), makeRecord({ heartRate: undefined })],
		});
		const rows = parseCsv(buildCsv([act]));
		expect(rows[0]).not.toContain('Heart Rate (bpm)');
	});

	it('buildCsv_channelPresentInOneActivity_includesColumn', () => {
		// heart rate only in act1 — should still appear in merged CSV
		const act1 = makeActivity('a', { records: [makeRecord({ heartRate: 140 })] });
		const act2 = makeActivity('b', { records: [makeRecord({ heartRate: undefined })] });
		const rows = parseCsv(buildCsv([act1, act2]));
		expect(rows[0]).toContain('Heart Rate (bpm)');
	});

	it('buildCsv_channelPartiallyPresent_includesColumn', () => {
		const act = makeActivity('a', {
			records: [makeRecord({ heartRate: 140 }), makeRecord({ heartRate: undefined })],
		});
		const rows = parseCsv(buildCsv([act]));
		expect(rows[0]).toContain('Heart Rate (bpm)');
	});

	// ── pace formatting ───────────────────────────────────────────────────────

	it('buildCsv_pace_formattedAsMmss', () => {
		const act = makeActivity('a', { records: [makeRecord({ pace: 5.25 })] });
		const objs = parseCsvAsObjects(buildCsv([act]));
		expect(objs[0]['Pace (min/km)']).toBe('5:15');
	});

	it('buildCsv_paceWholeMinute_formattedAs500', () => {
		const act = makeActivity('a', { records: [makeRecord({ pace: 5.0 })] });
		const objs = parseCsvAsObjects(buildCsv([act]));
		expect(objs[0]['Pace (min/km)']).toBe('5:00');
	});

	it('buildCsv_paceSingleDigitSeconds_padded', () => {
		const act = makeActivity('a', { records: [makeRecord({ pace: 6 + 5 / 60 })] });
		const objs = parseCsvAsObjects(buildCsv([act]));
		expect(objs[0]['Pace (min/km)']).toBe('6:05');
	});

	// ── RFC 4180 escaping ─────────────────────────────────────────────────────

	it('buildCsv_filenameWithComma_escapedCorrectly', () => {
		const act = makeActivity('a', { filename: 'run,fast.fit' });
		const csv = buildCsv([act, makeActivity('b')]);
		// The quoted field should appear in the output
		expect(csv).toContain('"run,fast.fit"');
	});

	// ── timestamp format ──────────────────────────────────────────────────────

	it('buildCsv_timestampColumn_isIsoString', () => {
		const ts = new Date('2026-01-15T09:00:00Z');
		const act = makeActivity('a', { records: [makeRecord({ timestamp: ts })] });
		const objs = parseCsvAsObjects(buildCsv([act]));
		expect(objs[0]['Timestamp']).toBe(ts.toISOString());
	});

	// ── null values ───────────────────────────────────────────────────────────

	it('buildCsv_nullChannelValue_producesEmptyCell', () => {
		const act = makeActivity('a', {
			records: [
				makeRecord({ heartRate: 140 }),
				makeRecord({ heartRate: undefined }),
			],
		});
		const objs = parseCsvAsObjects(buildCsv([act]));
		expect(objs[1]['Heart Rate (bpm)']).toBe('');
	});

	// ── line endings ──────────────────────────────────────────────────────────

	it('buildCsv_usesRfc4180LineEndings', () => {
		const act = makeActivity('a');
		const csv = buildCsv([act]);
		expect(csv).toContain('\r\n');
	});

	it('buildCsv_endsWithCrlf', () => {
		const act = makeActivity('a');
		const csv = buildCsv([act]);
		expect(csv.endsWith('\r\n')).toBe(true);
	});
});
