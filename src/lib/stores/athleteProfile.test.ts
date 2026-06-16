import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock localStorage before importing the module — same pattern as theme.test.ts
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string): string | null => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const { athleteProfile, setProfileField, initAthleteProfile } = await import('./athleteProfile.ts');

const STORAGE_KEY = 'analyser-athlete-profile';

describe('athleteProfile store', () => {
	beforeEach(() => {
		localStorageMock.clear();
		localStorageMock.getItem.mockClear();
		localStorageMock.setItem.mockClear();
		athleteProfile.set({});
	});

	// ---------------------------------------------------------------------------
	// Initial state
	// ---------------------------------------------------------------------------

	it('athleteProfile_defaultState_isEmpty', () => {
		expect(get(athleteProfile)).toEqual({});
	});

	// ---------------------------------------------------------------------------
	// setProfileField — setting values
	// ---------------------------------------------------------------------------

	it('setProfileField_ftp_updatesStoreAndPersists', () => {
		setProfileField('ftp', 250);
		expect(get(athleteProfile).ftp).toBe(250);
		const saved = localStorageMock.getItem(STORAGE_KEY);
		expect(JSON.parse(saved!).ftp).toBe(250);
	});

	it('setProfileField_weight_updatesStoreAndPersists', () => {
		setProfileField('weight', 70);
		expect(get(athleteProfile).weight).toBe(70);
		const saved = localStorageMock.getItem(STORAGE_KEY);
		expect(JSON.parse(saved!).weight).toBe(70);
	});

	it('setProfileField_multipleFields_allPersisted', () => {
		setProfileField('ftp', 250);
		setProfileField('cp', 300);
		setProfileField('weight', 70);
		const stored = get(athleteProfile);
		expect(stored.ftp).toBe(250);
		expect(stored.cp).toBe(300);
		expect(stored.weight).toBe(70);
	});

	// ---------------------------------------------------------------------------
	// setProfileField — clearing values
	// ---------------------------------------------------------------------------

	it('setProfileField_undefined_removesFieldFromStore', () => {
		setProfileField('ftp', 250);
		setProfileField('ftp', undefined);
		expect(get(athleteProfile).ftp).toBeUndefined();
	});

	it('setProfileField_undefined_removesFieldFromLocalStorage', () => {
		setProfileField('ftp', 250);
		setProfileField('ftp', undefined);
		const saved = localStorageMock.getItem(STORAGE_KEY);
		expect(JSON.parse(saved!)).not.toHaveProperty('ftp');
	});

	it('setProfileField_nan_treatedAsUndefined', () => {
		setProfileField('ftp', NaN);
		expect(get(athleteProfile).ftp).toBeUndefined();
	});

	// ---------------------------------------------------------------------------
	// initAthleteProfile — loading from localStorage
	// ---------------------------------------------------------------------------

	it('initAthleteProfile_withStoredData_loadsIntoStore', () => {
		localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ ftp: 280, weight: 68 }));
		initAthleteProfile();
		const stored = get(athleteProfile);
		expect(stored.ftp).toBe(280);
		expect(stored.weight).toBe(68);
	});

	it('initAthleteProfile_emptyStorage_storeRemainsEmpty', () => {
		initAthleteProfile();
		expect(get(athleteProfile)).toEqual({});
	});

	it('initAthleteProfile_malformedJson_storeRemainsEmpty', () => {
		localStorageMock.getItem.mockReturnValueOnce('not-valid-json');
		initAthleteProfile();
		expect(get(athleteProfile)).toEqual({});
	});

	it('initAthleteProfile_survivesPageReload', () => {
		setProfileField('maxHrCycling', 185);
		setProfileField('lthr', 165);
		// Simulate page reload: reset store then reinitialise from localStorage
		athleteProfile.set({});
		initAthleteProfile();
		const stored = get(athleteProfile);
		expect(stored.maxHrCycling).toBe(185);
		expect(stored.lthr).toBe(165);
	});
});

// ---------------------------------------------------------------------------
// SSR safety — window / localStorage undefined
// ---------------------------------------------------------------------------

describe('initAthleteProfile — SSR safety', () => {
	it('initAthleteProfile_ssrEnvironment_isNoOp', async () => {
		// Temporarily shadow localStorage to simulate SSR
		const original = globalThis.localStorage;
		Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true });
		// Should not throw
		expect(() => initAthleteProfile()).not.toThrow();
		Object.defineProperty(globalThis, 'localStorage', { value: original, writable: true });
	});
});
