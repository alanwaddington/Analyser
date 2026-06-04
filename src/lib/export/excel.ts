/**
 * Excel workbook builder for exporting Analyser activity data.
 *
 * buildWorkbook(activities) returns an ArrayBuffer containing an .xlsx workbook
 * with a Summary sheet (one row per activity) followed by one data sheet per
 * activity (one row per ActivityRecord).
 *
 * Key formatting rules:
 * - Sheet names truncated to 31 chars (Excel limit), de-duplicated with suffix.
 * - Columns for channels with all-null values are omitted.
 * - Pace values are formatted as MM:SS strings (e.g. "5:15") — not decimal.
 * - Timestamps are JavaScript Date objects for proper Excel date handling.
 */

import * as xlsx from 'xlsx';
import type { Activity, ActivityRecord, ChannelKey } from '$lib/types';
import { CHANNEL_META } from '$lib/types';
import { formatPace } from '$lib/utils/formatting';

// Ordered list of all channel keys; used to build consistent column ordering.
const CHANNEL_KEYS: ChannelKey[] = [
	'heartRate',
	'power',
	'powerLeft',
	'powerRight',
	'cadence',
	'speed',
	'pace',
	'altitude',
	'temperature',
	'coreTemperature',
	'skinTemperature',
	'verticalOscillation',
	'groundContactTime',
	'strideLength',
];

/**
 * Determine which ChannelKeys have at least one non-null value across
 * all records of an activity.
 */
function presentChannels(records: ActivityRecord[]): ChannelKey[] {
	return CHANNEL_KEYS.filter(key =>
		records.some(r => r[key] != null),
	);
}

/** Truncate a string to maxLen chars. */
function truncate(s: string, maxLen: number): string {
	return s.length <= maxLen ? s : s.slice(0, maxLen);
}

/**
 * Produce a list of de-duplicated, Excel-safe (≤31 char) sheet names from
 * the activity filenames.  Names are built to be unique within the returned array.
 */
function makeSheetNames(activities: Activity[]): string[] {
	const seen = new Map<string, number>();
	return activities.map(act => {
		const base = truncate(act.filename, 31);
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		if (count === 0) return base;
		// Need suffix — truncate base further to fit "(N)" suffix
		const suffix = ` (${count + 1})`;
		return truncate(act.filename, 31 - suffix.length) + suffix;
	});
}

/** Build the Summary worksheet — one row per activity. */
function buildSummarySheet(activities: Activity[]): xlsx.WorkSheet {
	const header = ['Filename', 'Sport', 'Start Time', 'Distance (km)', 'Elapsed Time'];
	const rows = activities.map(act => {
		const distKm = (act.totalDistance / 1000).toFixed(2);
		const totalSecs = act.totalElapsedTime;
		const h = Math.floor(totalSecs / 3600);
		const m = Math.floor((totalSecs % 3600) / 60);
		const s = Math.round(totalSecs % 60);
		const elapsed = h > 0
			? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
			: `${m}:${String(s).padStart(2, '0')}`;
		return [act.filename, act.sport ?? '', act.startTime, distKm, elapsed];
	});

	const ws = xlsx.utils.aoa_to_sheet([header, ...rows]);

	// Format the Start Time column (column index 2, "C") as datetime
	const range = xlsx.utils.decode_range(ws['!ref'] ?? 'A1');
	for (let r = 1; r <= range.e.r; r++) {
		const cellAddr = xlsx.utils.encode_cell({ r, c: 2 });
		const cell = ws[cellAddr];
		if (cell && cell.t === 'd') {
			cell.z = 'yyyy-mm-dd hh:mm:ss';
		}
	}

	return ws;
}

/** Build a data worksheet for a single activity. */
function buildActivitySheet(activity: Activity): xlsx.WorkSheet {
	const channels = presentChannels(activity.records);

	// Header row
	const channelHeaders = channels.map(
		key => `${CHANNEL_META[key].label} (${CHANNEL_META[key].unit})`,
	);
	const header = ['Timestamp', 'Elapsed (s)', 'Distance (m)', ...channelHeaders];

	// Data rows
	const rows = activity.records.map(rec => {
		const channelValues = channels.map(key => {
			const val = rec[key];
			if (val == null) return null;
			if (key === 'pace') return formatPace(val as number);
			return val;
		});
		return [rec.timestamp, rec.elapsedSeconds, rec.distance, ...channelValues];
	});

	const ws = xlsx.utils.aoa_to_sheet([header, ...rows]);

	// Format Timestamp column (column A) as datetime
	const range = xlsx.utils.decode_range(ws['!ref'] ?? 'A1');
	for (let r = 1; r <= range.e.r; r++) {
		const cellAddr = xlsx.utils.encode_cell({ r, c: 0 });
		const cell = ws[cellAddr];
		if (cell && cell.t === 'd') {
			cell.z = 'yyyy-mm-dd hh:mm:ss';
		}
	}

	return ws;
}

/**
 * Build an Excel workbook from one or more activities.
 *
 * @returns ArrayBuffer containing the .xlsx file contents.
 */
export function buildWorkbook(activities: Activity[]): ArrayBuffer {
	const wb = xlsx.utils.book_new();

	// Sheet 0: Summary
	xlsx.utils.book_append_sheet(wb, buildSummarySheet(activities), 'Summary');

	// Sheets 1–N: one per activity
	const sheetNames = makeSheetNames(activities);
	activities.forEach((act, i) => {
		xlsx.utils.book_append_sheet(wb, buildActivitySheet(act), sheetNames[i]);
	});

	// Write to ArrayBuffer
	const raw = xlsx.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });
	return raw as ArrayBuffer;
}
