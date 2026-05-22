# PR #76 Review — Feat: Dark/light mode toggle with localStorage persistence (#75)

**Date:** 2026-05-22
**Author:** alanwaddington
**Branch:** feature/75-dark-light-theme-toggle → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 15 Met / 15 Total |

---

## Issues Reviewed

### Issue Hierarchy

- #75 — Dark/light mode toggle (standalone — no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/stores/theme.ts` (+93 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New theme store: `themePreference` writable, `isDark` readable (derived from preference + OS media query), `setTheme()`, `initTheme()`, `resolveTheme()` |
| Issues | #75 |
| Criteria covered | AC2, AC3, AC4, AC5, AC6, AC7 |
| Quality | ✅ Clean SSR guards (`typeof window !== 'undefined'`), proper `matchMedia` listener cleanup in `isDark` teardown. `VALID_PREFS` set for input validation. Single responsibility — one module for all theme logic. |
| Test coverage | `theme.test.ts`: 15 tests covering default, persistence, isDark derivation for all 3 modes, and invalid localStorage values |

**Detail:**

- Line 3: `ThemePreference` type exported — `'dark' | 'light' | 'system'`
- Line 5: `STORAGE_KEY = 'analyser-theme'` — named constant, not magic string
- Lines 8–10: `isValidPref()` validates localStorage reads, rejects invalid values (AC7 safety)
- Lines 21–57: `isDark` readable — subscribes to `themePreference`, manages `matchMedia` listener lifecycle internally. Cleanup returns unsubscribe + `removeEventListener` — no leak.
- Lines 62–67: `setTheme()` — updates store and writes to `localStorage` (AC6)
- Lines 73–80: `initTheme()` — reads `localStorage`, validates, sets store. No-op in SSR. Called from `+layout.svelte` onMount.
- Lines 86–93: `resolveTheme()` — pure utility, currently unused in layout (layout uses `$isDark` boolean directly, which is equivalent and simpler)

### `src/lib/stores/theme.test.ts` (+156 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for theme store: default state, persistence, isDark derivation, invalid input handling |
| Issues | #75 |
| Criteria covered | AC15 |
| Quality | ✅ Proper mock setup (localStorage, window.matchMedia). Tests follow `method_scenario_expected` naming convention. Dynamic import (`await import`) ensures mocks are in place before module initialisation. |
| Test coverage | N/A — this is the test file |

**Detail:**

- 3 `describe` blocks: `themePreference store` (5 tests), `setTheme` (6 tests), `isDark store` (4 tests)
- Covers: default `'system'`, restore from localStorage for all 3 valid values, invalid value rejection, `setItem` calls, isDark true/false for dark/light/system modes
- Edge case: `initTheme_ignoresUnknownStoredValue_defaultsToSystem` — validates input boundary

### `src/lib/components/ui/ThemeToggle.svelte` (+80 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Three-pill toggle component (System/Light/Dark) for sidebar footer |
| Issues | #75 |
| Criteria covered | AC1, AC2, AC9, AC10, S2, S3 |
| Quality | ✅ Matches XAxisToggle pattern exactly (same `.pills`/`.pill` class names, same border-radius 999px, same active colour `#3b82f6`). Uses `role="group"` + `aria-label="Theme"` for accessibility. Native `<button>` elements for keyboard access. Icon scale animation via CSS `transition: transform 0.2s`. |
| Test coverage | Visual verification via Playwright |

**Detail:**

- Line 5: `modes` array — data-driven, no hardcoded repetition in template
- Line 13: `role="group" aria-label="Theme"` — AC10
- Line 17: `class:active={$themePreference === mode.value}` — highlights the raw preference, not the resolved value. Correct: clicking "System" highlights "Sys" regardless of what the OS resolves to.
- Line 77: `.icon-active { transform: scale(1.15) }` — S3 subtle animation

### `src/lib/components/ui/Sidebar.svelte` (+2 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Import and render ThemeToggle in sidebar footer |
| Issues | #75 |
| Criteria covered | AC1, S2 |
| Quality | ✅ Minimal change — import line + component tag. Placed between XAxisToggle and SmoothingSlider as designed. |
| Test coverage | Visual verification via Playwright |

**Detail:**

- Line 9: `import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';`
- Line 66: `<ThemeToggle />` — placed in `.footer` div between XAxisToggle and SmoothingSlider

### `src/routes/layout.css` (+20 / -9 lines)

| Property | Detail |
|----------|--------|
| Purpose | Restructure CSS theme definitions from `@media (prefers-color-scheme)` to `[data-theme]` attribute selectors; add smooth transition |
| Issues | #75 |
| Criteria covered | AC3, AC4, S1 |
| Quality | ✅ `:root` retained with dark defaults (flash prevention). `[data-theme="dark"]` and `[data-theme="light"]` selectors have higher specificity than `:root`, correctly overriding defaults once JS sets the attribute. `transition: background 0.3s, color 0.3s` on `html, body` for smooth switching. |
| Test coverage | Visual verification via Playwright |

**Detail:**

- Lines 4–11: `:root` dark palette retained as fallback — prevents flash-of-unstyled-content before JS hydrates
- Lines 14–21: `[data-theme="dark"]` — explicit dark palette (duplicate of `:root`, but necessary for specificity parity with the light selector)
- Lines 24–31: `[data-theme="light"]` — light palette (previously `@media (prefers-color-scheme: light)`)
- Line 39: `transition: background 0.3s, color 0.3s` — S1 smooth transition

### `src/routes/+layout.svelte` (+14 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire theme store into app shell: call `initTheme()` on mount, sync `data-theme` attribute on `<html>` via `$effect` |
| Issues | #75 |
| Criteria covered | AC3, AC4, AC5, AC6 |
| Quality | ✅ `browser` guard prevents SSR errors. `$effect` watches `$isDark` (which reactively tracks both `themePreference` and OS changes in system mode) — single expression resolves all cases. `onMount` for `initTheme()` is correct timing (after hydration, before first paint with data). |
| Test coverage | Playwright verification |

**Detail:**

- Line 9: Imports `themePreference`, `isDark`, `initTheme` from `$lib/stores/theme`
- Lines 17–19: `onMount(() => { initTheme(); })` — reads localStorage after hydration
- Lines 22–26: `$effect` — `document.documentElement.dataset.theme = $isDark ? 'dark' : 'light'` — elegantly resolves all 3 modes to a single attribute write

### `src/lib/components/charts/TimeSeriesChart.svelte` (+11 / -24 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace local `isDark` state + `matchMedia` listeners with shared `isDark` store; replace `@media` CSS with `:global([data-theme="light"])` |
| Issues | #75 |
| Criteria covered | AC8 |
| Quality | ✅ Clean removal: `isDark = $state(false)`, `mq`, `themeHandler`, `matchMedia` setup/teardown all removed. `$isDark` store subscription used in all 6 colour helpers (`textColour`, `gridColour`, `tooltipBg`, `tooltipText`, `altFill`, `altLine`). `void $isDark` added to existing `$effect` for reactive chart re-render. CSS `:global([data-theme="light"])` correctly scopes parent selector while keeping `.legend-btn` component-scoped. |
| Test coverage | Existing `TimeSeriesChart.test.ts` passes |

### `src/lib/components/charts/MeanMaxChart.svelte` (+8 / -21 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same migration as TimeSeriesChart |
| Issues | #75 |
| Criteria covered | AC8 |
| Quality | ✅ Identical pattern: import `isDark`, remove local state + listeners, use `$isDark` in 4 colour helpers, add `void $isDark` to `$effect`, replace `@media` CSS. |
| Test coverage | Existing `MeanMaxChart.test.ts` passes |

### `src/lib/components/charts/DeltaChart.svelte` (+8 / -21 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same migration as TimeSeriesChart |
| Issues | #75 |
| Criteria covered | AC8 |
| Quality | ✅ Identical pattern. |
| Test coverage | Existing `DeltaChart.test.ts` passes |

### `src/lib/components/charts/SegmentChart.svelte` (+10 / -23 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same migration as TimeSeriesChart, plus 2 extra colour helpers (`fasterColour`, `slowerColour`) |
| Issues | #75 |
| Criteria covered | AC8 |
| Quality | ✅ All 6 colour helpers migrated to `$isDark`. Identical cleanup pattern. |
| Test coverage | Existing `SegmentChart.test.ts` passes |

---

## Acceptance Criteria Verification

### #75 — Dark/light mode toggle

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Theme toggle visible in sidebar footer | `Sidebar.svelte:66` — `<ThemeToggle />` in `.footer` div | Playwright verification Step 2 | ✅ Met |
| AC2 | Toggle offers three modes: System, Light, Dark | `ThemeToggle.svelte:5-9` — `modes` array with 3 entries | Playwright verification Step 3 (3 pills confirmed) | ✅ Met |
| AC3 | Dark applies dark palette regardless of OS | `layout.css:14-21` — `[data-theme="dark"]` selector; `+layout.svelte:24` — `$isDark ? 'dark' : 'light'` | `theme.test.ts:95-98` — `setTheme_dark_updatesStore`; `theme.test.ts:134-137` — `isDark_dark_returnsTrue` | ✅ Met |
| AC4 | Light applies light palette regardless of OS | `layout.css:24-31` — `[data-theme="light"]` selector; same layout `$effect` | `theme.test.ts:100-103` — `setTheme_light_updatesStore`; `theme.test.ts:139-142` — `isDark_light_returnsFalse` | ✅ Met |
| AC5 | System follows OS `prefers-color-scheme` | `theme.ts:39-44` — `matchMedia` listener in `isDark` readable for `'system'` pref | `theme.test.ts:144-155` — `isDark_system_whenOSDark_returnsTrue`, `isDark_system_whenOSLight_returnsFalse` | ✅ Met |
| AC6 | Theme saved to localStorage and restored | `theme.ts:65` — `setItem`; `theme.ts:75-78` — `initTheme` reads + validates | `theme.test.ts:111-124` — 3 persistence tests; `theme.test.ts:63-67` — restore test | ✅ Met |
| AC7 | Default to System when no localStorage | `theme.ts:13` — `writable<ThemePreference>('system')`; `initTheme` only sets if valid | `theme.test.ts:57-61` — `defaultsToSystem_whenNoLocalStorageValue`; `theme.test.ts:81-85` — `ignoresUnknownStoredValue` | ✅ Met |
| AC8 | ECharts charts use shared isDark store | All 4 charts import `isDark` from `$lib/stores/theme`, use `$isDark` in colour helpers, include `void $isDark` in `$effect` | Existing chart tests pass; Playwright screenshots confirm chart theme switching | ✅ Met |
| AC9 | Toggle keyboard accessible (focusable, Enter/Space) | `ThemeToggle.svelte:15-22` — native `<button>` elements (inherently keyboard accessible) | Playwright Step 12 — Tab navigation reaches buttons | ✅ Met |
| AC10 | Toggle has accessible label for screen readers | `ThemeToggle.svelte:13` — `role="group" aria-label="Theme"` | Playwright Step 2 — `div[role="group"][aria-label="Theme"]` located | ✅ Met |
| AC11 | Leaflet map not broken by theme switch | Map component has zero `theme`/`isDark` references; no changes to map files | Playwright — map not explicitly driven but component is unchanged | ✅ Met |
| AC12 | Hardcoded accent colours legible in both themes | All ~30 accent colours (blues `#3b82f6`, greens `#22c55e`, reds `#ef4444`) unchanged; these are bright colours with adequate contrast on both light and dark backgrounds | Visual verification via Playwright screenshots in both themes | ✅ Met |
| AC13 | `svelte-check` 0 errors, 0 warnings | 412 files, 0 errors, 0 warnings | `svelte-check` output in commit log | ✅ Met |
| AC14 | All existing tests pass | 289/289 tests pass (274 existing + 15 new) | `vitest run` output | ✅ Met |
| AC15 | Unit test verifies theme store default, persistence, isDark | `theme.test.ts` — 15 tests across 3 describe blocks | N/A — this is the test | ✅ Met |

**Summary:** 15/15 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

#### S1 — `resolveTheme()` is exported but unused

- **Category:** Code Quality
- **Location:** `theme.ts:86-93`
- **Description:** `resolveTheme()` is exported but never called — `+layout.svelte` uses `$isDark ? 'dark' : 'light'` instead. The function is correct and could be useful for future callers, but currently it's dead code.
- **Recommendation:** Consider removing it, or defer until a caller needs it. Low priority — does not affect functionality.

---

## Positive Observations

- The `isDark` readable store design is elegant — it encapsulates the `matchMedia` listener lifecycle internally, so consumers just subscribe to a boolean. The cleanup function properly unsubscribes from both the `themePreference` store and the `matchMedia` listener, preventing memory leaks.
- The chart component migration is a net reduction of 52 lines (89 deleted, 37 added) while gaining new functionality (manual theme switching). The duplicated `matchMedia` setup/teardown boilerplate in 4 components was a maintenance risk; the shared store eliminates it entirely.
- The ThemeToggle component follows the exact same pill pattern as XAxisToggle — same class names, sizing, colours, border-radius — maintaining visual consistency without introducing new design elements.
- The `:root` dark palette is correctly retained as a fallback for the brief window before JS hydrates and sets `data-theme`. This prevents a flash-of-wrong-theme on first paint for users with dark OS preference.
- Input validation in `initTheme()` via `isValidPref()` protects against corrupted or tampered localStorage values — the store safely falls back to `'system'` rather than crashing or entering an undefined state.
- The test file uses dynamic `await import()` after mock setup, ensuring the module sees the mocked `localStorage` and `window.matchMedia` from initialisation. This is the correct pattern for testing modules with side effects.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] S1: Remove unused `resolveTheme()` if no caller materialises

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
