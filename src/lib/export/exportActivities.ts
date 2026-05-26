/**
 * Shared Excel export handler.
 *
 * exportActivities(activities) lazy-loads SheetJS, builds the workbook, and
 * triggers the browser download.  The caller is responsible for managing any
 * loading-state flag around this call.
 */

import type { Activity } from '$lib/types';
import { triggerDownload } from './download';

/**
 * Generate and download an Excel workbook for the given activities.
 *
 * @param activities The loaded activities to export (must be non-empty).
 */
export async function exportActivities(activities: Activity[]): Promise<void> {
	const { buildWorkbook } = await import('./excel');
	const buf = buildWorkbook(activities);
	const date = new Date().toISOString().slice(0, 10);
	triggerDownload(
		buf,
		`analyser-export-${date}.xlsx`,
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	);
}
