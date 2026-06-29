import FitParser from 'fit-file-parser';
import type { Activity } from '../types';
import { normalise } from './parser';
import { getAllLabels } from '../stores/deviceLabels';
import { addToast } from '../stores/toast';

/**
 * Main-thread bridge: parse a FIT file on the main thread (blocking).
 * For non-blocking parsing with progress, use parseInWorker() instead.
 * Preserved for backward compatibility (AC-10).
 */
export function parseFitFile(buffer: ArrayBuffer, filename: string): Promise<Activity> {
	return new Promise((resolve, reject) => {
		const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parser.parse(buffer, (error: any, data: any) => {
			if (error) return reject(new Error(String(error)));
			try {
				const labels = getAllLabels();
				const { activity, toasts } = normalise(data, filename, labels);
				toasts.forEach(t => addToast(t.message, t.level));
				resolve(activity);
			} catch (e) {
				reject(e);
			}
		});
	});
}
