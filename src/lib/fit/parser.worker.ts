import FitParser from 'fit-file-parser';
import type { ParseWorkerInput, ParseWorkerMessage, ToastMessage } from '../types';
import { normalise } from './parser';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

function post(msg: ParseWorkerMessage): void {
	workerSelf.postMessage(msg);
}

workerSelf.onmessage = (e: MessageEvent<ParseWorkerInput>) => {
	const { buffer, filename, labels } = e.data;
	const toasts: ToastMessage[] = [];

	try {
		post({ type: 'progress', stage: 'parsing' });

		const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parser.parse(buffer, (error: any, data: any) => {
			if (error) {
				post({ type: 'error', message: String(error), toasts });
				return;
			}
			try {
				const { activity, toasts: newToasts } = normalise(data, filename, labels, (stage) => {
					post({ type: 'progress', stage });
				});
				toasts.push(...newToasts);
				post({ type: 'complete', activity, toasts });
			} catch (err) {
				post({ type: 'error', message: err instanceof Error ? err.message : String(err), toasts });
			}
		});
	} catch (err) {
		post({ type: 'error', message: err instanceof Error ? err.message : String(err), toasts });
	}
};
