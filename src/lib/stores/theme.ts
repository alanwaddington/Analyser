import { writable, readable, get } from 'svelte/store';

export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'analyser-theme';
const VALID_PREFS = new Set<ThemePreference>(['dark', 'light', 'system']);

function isValidPref(value: string | null): value is ThemePreference {
	return value !== null && VALID_PREFS.has(value as ThemePreference);
}

/** The user's raw theme preference — 'dark', 'light', or 'system' (follow OS). */
export const themePreference = writable<ThemePreference>('system');

/**
 * Resolves whether the effective theme is dark.
 * - 'dark'   → always true
 * - 'light'  → always false
 * - 'system' → follows window.matchMedia('(prefers-color-scheme: dark)')
 */
export const isDark = readable<boolean>(false, (set) => {
	let mq: MediaQueryList | null = null;
	let mqHandler: ((e: MediaQueryListEvent) => void) | null = null;

	const unsubscribe = themePreference.subscribe((pref) => {
		// Remove any previous OS listener when switching away from 'system'
		if (mq && mqHandler) {
			mq.removeEventListener('change', mqHandler);
			mq = null;
			mqHandler = null;
		}

		if (pref === 'dark') {
			set(true);
		} else if (pref === 'light') {
			set(false);
		} else {
			// 'system' — delegate to OS preference
			if (typeof window !== 'undefined') {
				mq = window.matchMedia('(prefers-color-scheme: dark)');
				set(mq.matches);
				mqHandler = (e: MediaQueryListEvent) => set(e.matches);
				mq.addEventListener('change', mqHandler);
			} else {
				// SSR fallback: default to dark
				set(true);
			}
		}
	});

	return () => {
		unsubscribe();
		if (mq && mqHandler) {
			mq.removeEventListener('change', mqHandler);
		}
	};
});

/**
 * Updates the theme preference, persists it to localStorage.
 */
export function setTheme(pref: ThemePreference): void {
	themePreference.set(pref);
	if (typeof window !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, pref);
	}
}

/**
 * Reads the stored preference from localStorage and initialises the store.
 * Call once from +layout.svelte on mount. Safe to call in SSR (no-op).
 */
export function initTheme(): void {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (isValidPref(stored)) {
		themePreference.set(stored);
	}
	// If not valid/absent, store remains at default 'system'
}

/**
 * Returns the resolved effective theme ('dark' or 'light') for a given preference.
 * Used by +layout.svelte to compute the value to write to data-theme.
 */
export function resolveTheme(pref: ThemePreference): 'dark' | 'light' {
	if (pref === 'dark') return 'dark';
	if (pref === 'light') return 'light';
	if (typeof window !== 'undefined') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return 'dark'; // SSR fallback
}
