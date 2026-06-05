import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// ---------------------------------------------------------------------------
// Mutable imports — reset module between tests so module-level counter resets
// ---------------------------------------------------------------------------

let addToast: (message: string, level?: import('./toast.ts').ToastLevel, duration?: number) => void;
let removeToast: (id: number) => void;
let toasts: import('svelte/store').Readable<import('./toast.ts').Toast[]>;

beforeEach(async () => {
	vi.resetModules();
	vi.useFakeTimers();
	const mod = await import('./toast.ts');
	addToast = mod.addToast;
	removeToast = mod.removeToast;
	toasts = mod.toasts;
});

afterEach(() => {
	vi.useRealTimers();
});

describe('addToast', () => {
	it('addToast_singleToast_appearsInStore', () => {
		addToast('Something went wrong');
		expect(get(toasts)).toHaveLength(1);
		expect(get(toasts)[0].message).toBe('Something went wrong');
	});

	it('addToast_defaultLevel_isWarning', () => {
		addToast('Storage full');
		expect(get(toasts)[0].level).toBe('warning');
	});

	it('addToast_explicitInfoLevel_isUsed', () => {
		addToast('Saved', 'info');
		expect(get(toasts)[0].level).toBe('info');
	});

	it('addToast_explicitErrorLevel_isUsed', () => {
		addToast('Failed', 'error');
		expect(get(toasts)[0].level).toBe('error');
	});

	it('addToast_multipleToasts_allAppear', () => {
		addToast('First');
		addToast('Second');
		addToast('Third');
		expect(get(toasts)).toHaveLength(3);
	});

	it('addToast_uniqueIds_incrementing', () => {
		addToast('First');
		addToast('Second');
		const ids = get(toasts).map(t => t.id);
		expect(ids[0]).not.toBe(ids[1]);
		expect(ids[1]).toBeGreaterThan(ids[0]);
	});

	it('addToast_autoDismiss_removedAfterDuration', () => {
		addToast('Auto dismiss', 'warning', 3000);
		expect(get(toasts)).toHaveLength(1);
		vi.advanceTimersByTime(3000);
		expect(get(toasts)).toHaveLength(0);
	});

	it('addToast_autoDismiss_notRemovedBeforeDuration', () => {
		addToast('Not yet', 'warning', 3000);
		vi.advanceTimersByTime(2999);
		expect(get(toasts)).toHaveLength(1);
	});

	it('addToast_defaultDuration_removedAfter5000ms', () => {
		addToast('Default duration');
		vi.advanceTimersByTime(5000);
		expect(get(toasts)).toHaveLength(0);
	});
});

describe('removeToast', () => {
	it('removeToast_byId_removesCorrectToast', () => {
		addToast('First');
		addToast('Second');
		const id = get(toasts)[0].id;
		removeToast(id);
		expect(get(toasts)).toHaveLength(1);
		expect(get(toasts)[0].message).toBe('Second');
	});

	it('removeToast_unknownId_isNoOp', () => {
		addToast('Persists');
		removeToast(9999);
		expect(get(toasts)).toHaveLength(1);
	});

	it('removeToast_onlyToast_storeBecomesEmpty', () => {
		addToast('Sole toast');
		const id = get(toasts)[0].id;
		removeToast(id);
		expect(get(toasts)).toHaveLength(0);
	});
});
