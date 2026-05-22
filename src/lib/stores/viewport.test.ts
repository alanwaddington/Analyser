import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// ---------------------------------------------------------------------------
// Mock window.matchMedia before importing the module under test.
// ---------------------------------------------------------------------------

type MQHandler = (e: { matches: boolean }) => void;

interface MockMQL {
	matches: boolean;
	_listeners: MQHandler[];
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
}

// Three mock MQL objects — one per viewport tier.
const mqls: Record<'phone' | 'tablet' | 'desktop', MockMQL> = {
	phone:   { matches: false, _listeners: [], addEventListener: vi.fn(), removeEventListener: vi.fn() },
	tablet:  { matches: false, _listeners: [], addEventListener: vi.fn(), removeEventListener: vi.fn() },
	desktop: { matches: true,  _listeners: [], addEventListener: vi.fn(), removeEventListener: vi.fn() },
};

function wireMql(mql: MockMQL) {
	(mql.addEventListener as ReturnType<typeof vi.fn>).mockImplementation(
		(_event: string, handler: MQHandler) => { mql._listeners.push(handler); }
	);
	(mql.removeEventListener as ReturnType<typeof vi.fn>).mockImplementation(
		(_event: string, handler: MQHandler) => {
			const idx = mql._listeners.indexOf(handler);
			if (idx >= 0) mql._listeners.splice(idx, 1);
		}
	);
}

function setViewport(tier: 'phone' | 'tablet' | 'desktop') {
	mqls.phone.matches   = tier === 'phone';
	mqls.tablet.matches  = tier === 'tablet';
	mqls.desktop.matches = tier === 'desktop';
}

function fireAll(mql: MockMQL) {
	for (const h of [...mql._listeners]) h({ matches: mql.matches });
}

// Wire up all three before any import
for (const mql of Object.values(mqls)) wireMql(mql);

Object.defineProperty(globalThis, 'window', {
	value: {
		matchMedia: vi.fn((query: string): MockMQL => {
			if (query.includes('480'))  return mqls.phone;
			if (query.includes('768'))  return mqls.tablet;
			return mqls.desktop;
		}),
	},
	writable: true,
	configurable: true,
});

// Import after mocks are wired
const { viewport, PHONE_MAX, TABLET_MAX } = await import('./viewport.ts');

// ---------------------------------------------------------------------------

describe('viewport constants', () => {
	it('PHONE_MAX_equals_480', () => {
		expect(PHONE_MAX).toBe(480);
	});

	it('TABLET_MAX_equals_768', () => {
		expect(TABLET_MAX).toBe(768);
	});
});

describe('viewport store', () => {
	let unsub: () => void;

	beforeEach(() => {
		// Reset to desktop state
		for (const mql of Object.values(mqls)) {
			mql._listeners = [];
			wireMql(mql);
		}
		setViewport('desktop');
		// Hold a subscription open so listeners stay registered for the duration of the test
		unsub = viewport.subscribe(() => {});
	});

	afterEach(() => {
		unsub();
		vi.clearAllMocks();
	});

	it('defaults_toDesktop_whenDesktopQueryMatches', () => {
		expect(get(viewport)).toBe('desktop');
	});

	it('returns_phone_whenPhoneQueryMatchesOnInit', () => {
		// Teardown current subscription, set phone state, then re-subscribe
		unsub();
		setViewport('phone');
		unsub = viewport.subscribe(() => {});
		expect(get(viewport)).toBe('phone');
	});

	it('returns_tablet_whenTabletQueryMatchesOnInit', () => {
		unsub();
		setViewport('tablet');
		unsub = viewport.subscribe(() => {});
		expect(get(viewport)).toBe('tablet');
	});

	it('updates_toPhone_whenResizeFiresPhoneQuery', () => {
		expect(get(viewport)).toBe('desktop');
		setViewport('phone');
		fireAll(mqls.desktop);
		fireAll(mqls.phone);
		expect(get(viewport)).toBe('phone');
	});

	it('updates_toTablet_whenResizeFiresTabletQuery', () => {
		expect(get(viewport)).toBe('desktop');
		setViewport('tablet');
		fireAll(mqls.desktop);
		fireAll(mqls.tablet);
		expect(get(viewport)).toBe('tablet');
	});

	it('updates_backToDesktop_whenResizeFromPhone', () => {
		setViewport('phone');
		fireAll(mqls.desktop);
		fireAll(mqls.phone);
		expect(get(viewport)).toBe('phone');

		setViewport('desktop');
		fireAll(mqls.phone);
		fireAll(mqls.desktop);
		expect(get(viewport)).toBe('desktop');
	});

	it('registerListeners_forAllThreeTiers_onSubscribe', () => {
		// Subscription was opened in beforeEach — check listeners were registered
		expect(mqls.phone.addEventListener).toHaveBeenCalled();
		expect(mqls.tablet.addEventListener).toHaveBeenCalled();
		expect(mqls.desktop.addEventListener).toHaveBeenCalled();
	});

	it('removeListeners_forAllThreeTiers_onUnsubscribe', () => {
		unsub();
		expect(mqls.phone.removeEventListener).toHaveBeenCalled();
		expect(mqls.tablet.removeEventListener).toHaveBeenCalled();
		expect(mqls.desktop.removeEventListener).toHaveBeenCalled();
		// Re-subscribe so afterEach unsub() doesn't double-call
		unsub = viewport.subscribe(() => {});
	});
});
