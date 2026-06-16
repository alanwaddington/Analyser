/**
 * Shared export handler for CSV and XLSX formats.
 *
 * exportActivities(activities, format) lazy-loads the appropriate builder,
 * generates the file, and triggers the browser download.  The caller is
 * responsible for managing any loading-state flag around this call.
 */

import type { Activity } from '$lib/types';
import type { ExportFormat } from './columns';
import { triggerDownload, localDateString } from './download';

/**
 * Generate and download an export file for the given activities.
 *
 * @param activities The loaded activities to export (must be non-empty).
 * @param format     'csv' (default) or 'xlsx'.
 */
export async function exportActivities(
	activities: Activity[],
	format: ExportFormat = 'csv',
): Promise<void> {
	const date = localDateString();
	if (format === 'csv') {
		const { buildCsv } = await import('./csv');
		const csv = buildCsv(activities);
		triggerDownload(
			new Blob([csv], { type: 'text/csv;charset=utf-8' }),
			`analyser-export-${date}.csv`,
			'text/csv',
		);
	} else {
		const { buildWorkbook } = await import('./excel');
		const buf = buildWorkbook(activities);
		triggerDownload(
			buf,
			`analyser-export-${date}.xlsx`,
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		);
	}
}
