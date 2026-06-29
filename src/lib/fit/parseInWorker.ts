import type { Activity, ParseStage, ToastMessage, ParseWorkerMessage, ParseWorkerInput } from '../types';

export interface ParseJob {
	promise: Promise<{ activity: Activity; toasts: ToastMessage[] }>;
	cancel: () => void;
}

export class ParseCancelledError extends Error {
	constructor() {
		super('Parse cancelled');
		this.name = 'ParseCancelledError';
	}
}

/**
 * Parse a FIT file in a Web Worker (non-blocking).
 * Spawns one Worker per file; the Worker is terminated on completion, error, or cancel.
 * The buffer is transferred (not copied) to the Worker — do not use it after this call.
 */
export function parseInWorker(
	buffer: ArrayBuffer,
	filename: string,
	labels: Record<string, string>,
	onProgress?: (stage: ParseStage) => void,
): ParseJob {
	const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' });
	let cancelled = false;
	let resolveJob!: (result: { activity: Activity; toasts: ToastMessage[] }) => void;
	let rejectJob!: (err: Error) => void;

	const promise = new Promise<{ activity: Activity; toasts: ToastMessage[] }>((resolve, reject) => {
		resolveJob = resolve;
		rejectJob = reject;
	});

	worker.onmessage = (e: MessageEvent<ParseWorkerMessage>) => {
		const msg = e.data;
		if (msg.type === 'progress') {
			onProgress?.(msg.stage);
		} else if (msg.type === 'complete') {
			worker.terminate();
			resolveJob({ activity: msg.activity, toasts: msg.toasts });
		} else if (msg.type === 'error') {
			worker.terminate();
			rejectJob(new Error(msg.message));
		}
	};

	worker.onerror = (e: ErrorEvent) => {
		worker.terminate();
		rejectJob(new Error(e.message));
	};

	const input: ParseWorkerInput = { buffer, filename, labels };
	worker.postMessage(input, [buffer]);

	const cancel = () => {
		if (!cancelled) {
			cancelled = true;
			worker.terminate();
			rejectJob(new ParseCancelledError());
		}
	};

	return { promise, cancel };
}
