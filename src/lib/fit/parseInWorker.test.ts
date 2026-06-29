import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseInWorker, ParseCancelledError } from './parseInWorker';
import type { ParseWorkerMessage, Activity } from '../types';

class MockWorker {
	onmessage: ((e: MessageEvent<ParseWorkerMessage>) => void) | null = null;
	onerror: ((e: ErrorEvent) => void) | null = null;
	terminate = vi.fn();
	postMessage = vi.fn();

	simulateMessage(data: ParseWorkerMessage) {
		this.onmessage?.({ data } as MessageEvent<ParseWorkerMessage>);
	}

	simulateError(message: string) {
		this.onerror?.({ message } as ErrorEvent);
	}
}

let mockWorkerInstance: MockWorker;

beforeEach(() => {
	mockWorkerInstance = new MockWorker();
	// vi.fn requires a 'function' (not arrow) so it is usable as a constructor via `new`
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	vi.stubGlobal('Worker', vi.fn(function (_url: unknown, _opts: unknown) { return mockWorkerInstance; }));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const fakeActivity: Activity = {
	id: '1', filename: 'test.fit', sport: 'running', isIndoor: false,
	startTime: new Date(), totalDistance: 1000, totalElapsedTime: 300,
	records: [], laps: [], devices: [], deviceStreams: [],
	firstGpsFixIndex: null, firstGpsMovementIndex: null, firstIndoorMovementIndex: null,
	firstWorkoutStepTime: null, timerStartTime: null,
	anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(), source: 'fileStart' },
	availableChannels: new Set(), anomalies: [],
};

describe('parseInWorker', () => {
	it('parseInWorker_progressMessages_callsOnProgressWithStages', async () => {
		const stages: string[] = [];
		const buffer = new ArrayBuffer(100);
		const { promise } = parseInWorker(buffer, 'test.fit', {}, (stage) => stages.push(stage));

		mockWorkerInstance.simulateMessage({ type: 'progress', stage: 'parsing' });
		mockWorkerInstance.simulateMessage({ type: 'progress', stage: 'normalising' });
		mockWorkerInstance.simulateMessage({ type: 'progress', stage: 'detecting_anomalies' });
		mockWorkerInstance.simulateMessage({ type: 'complete', activity: fakeActivity, toasts: [] });

		await promise;

		expect(stages).toEqual(['parsing', 'normalising', 'detecting_anomalies']);
	});

	it('parseInWorker_completeMessage_resolvesWithActivityAndToasts', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise } = parseInWorker(buffer, 'test.fit', {});
		const toasts = [{ message: 'warning msg', level: 'warning' as const }];

		mockWorkerInstance.simulateMessage({ type: 'complete', activity: fakeActivity, toasts });

		const result = await promise;
		expect(result.activity.filename).toBe('test.fit');
		expect(result.toasts).toHaveLength(1);
		expect(result.toasts[0].message).toBe('warning msg');
	});

	it('parseInWorker_errorMessage_rejectsPromise', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise } = parseInWorker(buffer, 'test.fit', {});

		mockWorkerInstance.simulateMessage({ type: 'error', message: 'parse failed', toasts: [] });

		await expect(promise).rejects.toThrow('parse failed');
	});

	it('parseInWorker_workerError_rejectsPromise', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise } = parseInWorker(buffer, 'test.fit', {});

		mockWorkerInstance.simulateError('worker crashed');

		await expect(promise).rejects.toThrow('worker crashed');
	});

	it('parseInWorker_completeMessage_terminatesWorker', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise } = parseInWorker(buffer, 'test.fit', {});

		mockWorkerInstance.simulateMessage({ type: 'complete', activity: fakeActivity, toasts: [] });
		await promise;

		expect(mockWorkerInstance.terminate).toHaveBeenCalledOnce();
	});

	it('parseInWorker_errorMessage_terminatesWorker', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise } = parseInWorker(buffer, 'test.fit', {});

		mockWorkerInstance.simulateMessage({ type: 'error', message: 'fail', toasts: [] });

		await expect(promise).rejects.toThrow();
		expect(mockWorkerInstance.terminate).toHaveBeenCalledOnce();
	});

	it('parseInWorker_bufferTransferred_postMessageCalledWithTransferable', () => {
		const buffer = new ArrayBuffer(100);
		parseInWorker(buffer, 'test.fit', {});

		const [, transferables] = mockWorkerInstance.postMessage.mock.calls[0];
		expect(transferables).toContain(buffer);
	});

	it('parseInWorker_cancel_terminatesWorkerAndRejectsWithCancelledError', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise, cancel } = parseInWorker(buffer, 'test.fit', {});

		cancel();

		await expect(promise).rejects.toBeInstanceOf(ParseCancelledError);
		expect(mockWorkerInstance.terminate).toHaveBeenCalledOnce();
	});

	it('parseInWorker_cancelTwice_terminatesWorkerOnlyOnce', () => {
		const buffer = new ArrayBuffer(100);
		const { promise, cancel } = parseInWorker(buffer, 'test.fit', {});

		cancel();
		cancel();

		promise.catch(() => {});
		expect(mockWorkerInstance.terminate).toHaveBeenCalledOnce();
	});

	it('parseInWorker_cancelDoesNotAddActivity_afterCancel', async () => {
		const buffer = new ArrayBuffer(100);
		const { promise, cancel } = parseInWorker(buffer, 'test.fit', {});
		cancel();
		const error = await promise.catch(e => e);
		expect(error).toBeInstanceOf(ParseCancelledError);
	});
});
