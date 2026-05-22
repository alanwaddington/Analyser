import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// Mock localStorage before importing the module
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock window.matchMedia
let mockDarkOS = false;
const mediaQueryListeners: Array<(e: { matches: boolean }) => void> = [];

Object.defineProperty(globalThis, 'window', {
	value: {
		matchMedia: vi.fn((query: string) => ({
			matches: query.includes('dark') ? mockDarkOS : !mockDarkOS,
			addEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
				mediaQueryListeners.push(handler);
			}),
			removeEventListener: vi.fn((_event: string, handler: (e: { matches: boolean }) => void) => {
				const idx = mediaQueryListeners.indexOf(handler);
				if (idx >= 0) mediaQueryListeners.splice(idx, 1);
			}),
		})),
	},
	writable: true,
});

// Import after mocks are set up
const { themePreference, isDark, setTheme, initTheme } = await import('./theme.ts');

const STORAGE_KEY = 'analyser-theme';

describe('themePreference store', () => {
	beforeEach(() => {
		localStorageMock.clear();
		localStorageMock.getItem.mockClear();
		localStorageMock.setItem.mockClear();
		mockDarkOS = false;
		mediaQueryListeners.length = 0;
		// Reset to default
		setTheme('system');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('defaultsToSystem_whenNoLocalStorageValue', () => {
		localStorageMock.getItem.mockReturnValueOnce(null);
		initTheme();
		expect(get(themePreference)).toBe('system');
	});

	it('initTheme_restoresDarkPreference_fromLocalStorage', () => {
		localStorageMock.getItem.mockReturnValueOnce('dark');
		initTheme();
		expect(get(themePreference)).toBe('dark');
	});

	it('initTheme_restoresLightPreference_fromLocalStorage', () => {
		localStorageMock.getItem.mockReturnValueOnce('light');
		initTheme();
		expect(get(themePreference)).toBe('light');
	});

	it('initTheme_restoresSystemPreference_fromLocalStorage', () => {
		localStorageMock.getItem.mockReturnValueOnce('system');
		initTheme();
		expect(get(themePreference)).toBe('system');
	});

	it('initTheme_ignoresUnknownStoredValue_defaultsToSystem', () => {
		localStorageMock.getItem.mockReturnValueOnce('invalid-value');
		initTheme();
		expect(get(themePreference)).toBe('system');
	});
});

describe('setTheme', () => {
	beforeEach(() => {
		localStorageMock.clear();
		localStorageMock.setItem.mockClear();
		setTheme('system');
	});

	it('setTheme_dark_updatesStore', () => {
		setTheme('dark');
		expect(get(themePreference)).toBe('dark');
	});

	it('setTheme_light_updatesStore', () => {
		setTheme('light');
		expect(get(themePreference)).toBe('light');
	});

	it('setTheme_system_updatesStore', () => {
		setTheme('dark');
		setTheme('system');
		expect(get(themePreference)).toBe('system');
	});

	it('setTheme_dark_persistsToLocalStorage', () => {
		setTheme('dark');
		expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'dark');
	});

	it('setTheme_light_persistsToLocalStorage', () => {
		setTheme('light');
		expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'light');
	});

	it('setTheme_system_persistsToLocalStorage', () => {
		setTheme('system');
		expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'system');
	});
});

describe('isDark store', () => {
	beforeEach(() => {
		mockDarkOS = false;
		mediaQueryListeners.length = 0;
		setTheme('system');
	});

	it('isDark_dark_returnsTrue', () => {
		setTheme('dark');
		expect(get(isDark)).toBe(true);
	});

	it('isDark_light_returnsFalse', () => {
		setTheme('light');
		expect(get(isDark)).toBe(false);
	});

	it('isDark_system_whenOSDark_returnsTrue', () => {
		mockDarkOS = true;
		setTheme('system');
		// Re-read: isDark should reflect OS
		expect(get(isDark)).toBe(true);
	});

	it('isDark_system_whenOSLight_returnsFalse', () => {
		mockDarkOS = false;
		setTheme('system');
		expect(get(isDark)).toBe(false);
	});
});
