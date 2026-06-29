import FitParser from 'fit-file-parser';
import type { ParseWorkerInput, ParseWorkerMessage, ToastMessage } from '../types';
import { normalise } from './parser';

self.onmessage = (e: MessageEvent<ParseWorkerInput>) => {
	const { buffer, filename, labels } = e.data;
	const toasts: ToastMessage[] = [];

	try {
		(self as DedicatedWorkerGlobalScope).postMessage({ type: 'progress', stage: 'parsing' } satisfies ParseWorkerMessage);

		const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parser.parse(buffer, (error: any, data: any) => {
			if (error) {
				(self as DedicatedWorkerGlobalScope).postMessage({ type: 'error', message: String(error), toasts } satisfies ParseWorkerMessage);
				return;
			}
			try {
				const { activity, toasts: newToasts } = normalise(data, filename, labels, (stage) => {
					(self as DedicatedWorkerGlobalScope).postMessage({ type: 'progress', stage } satisfies ParseWorkerMessage);
				});
				toasts.push(...newToasts);
				(self as DedicatedWorkerGlobalScope).postMessage({ type: 'complete', activity, toasts } satisfies ParseWorkerMessage);
			} catch (err) {
				(self as DedicatedWorkerGlobalScope).postMessage({
					type: 'error',
					message: err instanceof Error ? err.message : String(err),
					toasts,
				} satisfies ParseWorkerMessage);
			}
		});
	} catch (err) {
		(self as DedicatedWorkerGlobalScope).postMessage({
			type: 'error',
			message: err instanceof Error ? err.message : String(err),
			toasts,
		} satisfies ParseWorkerMessage);
	}
};
