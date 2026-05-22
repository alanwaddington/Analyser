import { readable } from 'svelte/store';

/**
 * Maximum width (inclusive) considered a phone viewport.
 *
 * CSS counterpart: `--bp-phone` custom property in `src/routes/layout.css`.
 * If you change this value, also update `--bp-phone` and all
 * `@media (max-width: 480px)` rules that reference `--bp-phone`.
 */
export const PHONE_MAX = 480;

/**
 * Maximum width (inclusive) considered a tablet viewport.
 *
 * CSS counterpart: `--bp-tablet` custom property in `src/routes/layout.css`.
 * If you change this value, also update `--bp-tablet` and all
 * `@media (max-width: 768px)` rules that reference `--bp-tablet`.
 */
export const TABLET_MAX = 768;

export type ViewportTier = 'phone' | 'tablet' | 'desktop';

/**
 * Reactive viewport tier based on `window.matchMedia`.
 *
 * - `'phone'`   — viewport width ≤ 480px
 * - `'tablet'`  — viewport width 481–768px
 * - `'desktop'` — viewport width > 768px (default / SSR fallback)
 *
 * Follows the same readable-store pattern as `isDark` in theme.ts:
 * registers `matchMedia` listeners on first subscriber and removes them
 * when the last subscriber unsubscribes — no memory leaks.
 */
export const viewport = readable<ViewportTier>('desktop', (set) => {
	if (typeof window === 'undefined') {
		// SSR: default to desktop, no listeners needed
		return () => {};
	}

	const mqPhone   = window.matchMedia(`(max-width: ${PHONE_MAX}px)`);
	const mqTablet  = window.matchMedia(`(min-width: ${PHONE_MAX + 1}px) and (max-width: ${TABLET_MAX}px)`);
	const mqDesktop = window.matchMedia(`(min-width: ${TABLET_MAX + 1}px)`);

	function resolve() {
		if (mqPhone.matches)   set('phone');
		else if (mqTablet.matches) set('tablet');
		else                   set('desktop');
	}

	// Initialise immediately
	resolve();

	const phoneHandler   = () => resolve();
	const tabletHandler  = () => resolve();
	const desktopHandler = () => resolve();

	mqPhone.addEventListener('change', phoneHandler);
	mqTablet.addEventListener('change', tabletHandler);
	mqDesktop.addEventListener('change', desktopHandler);

	return () => {
		mqPhone.removeEventListener('change', phoneHandler);
		mqTablet.removeEventListener('change', tabletHandler);
		mqDesktop.removeEventListener('change', desktopHandler);
	};
});
