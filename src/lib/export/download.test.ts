// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerDownload, downloadPng } from './download.ts';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeArrayBuffer(bytes: number[]): ArrayBuffer {
	const buf = new ArrayBuffer(bytes.length);
	const view = new Uint8Array(buf);
	bytes.forEach((b, i) => { view[i] = b; });
	return buf;
}

// ── triggerDownload ───────────────────────────────────────────────────────────

describe('triggerDownload', () => {
	let downloadAttribute = '';

	beforeEach(() => {
		downloadAttribute = '';

		// Stub URL.createObjectURL / revokeObjectURL (not available in jsdom)
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:fake-url-123'),
			revokeObjectURL: vi.fn(),
		});

		// Intercept anchor .click() to capture the download attribute
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'a') {
				const anchor = originalCreateElement('a');
				// Override click so we capture the download attr without navigation
				vi.spyOn(anchor, 'click').mockImplementation(() => {
					downloadAttribute = anchor.download;
				});
				return anchor;
			}
			return originalCreateElement(tag);
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('triggerDownload_validBuffer_createsObjectUrl', () => {
		const buf = makeArrayBuffer([1, 2, 3]);
		triggerDownload(buf, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		expect(URL.createObjectURL).toHaveBeenCalledOnce();
	});

	it('triggerDownload_validBuffer_setsCorrectFilename', () => {
		const buf = makeArrayBuffer([1, 2, 3]);
		triggerDownload(buf, 'my-file.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		expect(downloadAttribute).toBe('my-file.xlsx');
	});

	it('triggerDownload_validBuffer_revokesUrlAfterClick', () => {
		const buf = makeArrayBuffer([1, 2, 3]);
		triggerDownload(buf, 'test.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url-123');
	});

	it('triggerDownload_blobInput_createsObjectUrl', () => {
		const blob = new Blob(['hello'], { type: 'text/plain' });
		triggerDownload(blob, 'test.txt', 'text/plain');
		expect(URL.createObjectURL).toHaveBeenCalledOnce();
	});
});

// ── downloadPng ───────────────────────────────────────────────────────────────

describe('downloadPng', () => {
	beforeEach(() => {
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:fake-png-url'),
			revokeObjectURL: vi.fn(),
		});

		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			if (tag === 'a') {
				const anchor = originalCreateElement('a');
				vi.spyOn(anchor, 'click').mockImplementation(() => { /* no-op */ });
				return anchor;
			}
			return originalCreateElement(tag);
		});

		// atob is available in jsdom — no stub needed
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('downloadPng_validDataUrl_createsObjectUrl', () => {
		// Minimal valid PNG base64 (1×1 pixel, transparent)
		const dataUrl =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
		downloadPng(dataUrl, 'chart.png');
		expect(URL.createObjectURL).toHaveBeenCalledOnce();
	});

	it('downloadPng_validDataUrl_doesNotThrow', () => {
		const dataUrl =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
		expect(() => downloadPng(dataUrl, 'chart.png')).not.toThrow();
	});
});
