import type { Activity } from '$lib/types';
import { presentChannels, buildHeaderLabel, formatCellValue, escapeCsvField } from './columns';

/**
 * Build a RFC 4180 CSV string from one or more activities.
 *
 * - Single activity: no `activity` column; headers are Timestamp, Elapsed (s), Distance (m), …channels
 * - Multiple activities: `activity` column (filename) prepended as first column
 * - Channels with all-null values across all records are omitted
 * - Pace formatted as M:SS; timestamps as ISO 8601 strings
 * - Lines separated by CRLF per RFC 4180
 */
export function buildCsv(activities: Activity[]): string {
	if (activities.length === 0) return '';

	const multi = activities.length > 1;

	// Determine present channels across ALL activities' records
	const allRecords = activities.flatMap(a => a.records);
	const channels = presentChannels(allRecords);

	// Header row
	const channelHeaders = channels.map(buildHeaderLabel);
	const fixedHeaders = ['Timestamp', 'Elapsed (s)', 'Distance (m)'];
	const headerCells = multi
		? ['activity', ...fixedHeaders, ...channelHeaders]
		: [...fixedHeaders, ...channelHeaders];
	const rows: string[] = [headerCells.map(escapeCsvField).join(',')];

	// Data rows
	for (const activity of activities) {
		for (const rec of activity.records) {
			const channelValues = channels.map(key => {
				const formatted = formatCellValue(key, rec[key]);
				return escapeCsvField(formatted == null ? '' : String(formatted));
			});
			const timestamp = escapeCsvField(rec.timestamp.toISOString());
			const elapsed = String(rec.elapsedSeconds);
			const distance = String(rec.distance);
			const fixedValues = [timestamp, elapsed, distance];
			const cells = multi
				? [escapeCsvField(activity.filename), ...fixedValues, ...channelValues]
				: [...fixedValues, ...channelValues];
			rows.push(cells.join(','));
		}
	}

	return rows.join('\r\n') + '\r\n';
}
