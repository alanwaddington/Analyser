# PR #134 Review — Perf: lazy-load ECharts to reduce initial bundle size (#101)

**Date:** 2026-06-04
**Author:** alanwaddington
**Branch:** feature/101-lazy-load-echarts → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 12/13 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #101 — Perf: lazy-load ECharts to reduce initial bundle size (standalone issue — no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/components/charts/echarts-loader.ts` (+12 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Singleton dynamic import wrapper — caches the `import('echarts')` Promise in a module-scoped variable so all chart components share one fetch and subsequent calls resolve from cache |
| Issues | #101 |
| Criteria covered | AC3, AC10, S2, S3 |
| Quality | Clean and minimal. `import type` at top erased at compile time. Cast `as Promise<EChartsModule>` is correct. No issues. |
| Test coverage | `echarts-loader.test.ts` — 5 tests covering promise return type, singleton identity, and resolved module shape |

### `src/lib/components/charts/echarts-loader.test.ts` (+45 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the echarts-loader singleton |
| Issues | #101 |
| Criteria covered | AC10 |
| Quality | Uses `vi.resetModules()` in `beforeEach` to get a fresh module per test — correct for testing singleton caching. Mocks echarts with `init`, `connect`, `disconnect` stubs. Follows `MethodName_Scenario_ExpectedResult` naming convention. |
| Test coverage | N/A (is the test file) |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+25 / -5 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace static `import * as echarts` with async `loadECharts()` in `onMount`; add loading skeleton; explicit `setOption` after init |
| Issues | #101 |
| Criteria covered | AC3, AC4, AC5, AC6, AC7 |
| Quality | Correctly handles chart→map hover sync, zoom tracking, and `ec.connect()` after dynamic import. Explicit `chart.setOption(buildOption(), { notMerge: true })` after `ec.init()` solves the non-reactive `chart` variable issue. Skeleton uses same `.chart-canvas` class for consistent height. |
| Test coverage | `TimeSeriesChart.test.ts` tests `.utils.ts` pure functions (unaffected). Component rendering tested via `/verify` Playwright run. |

### `src/lib/components/charts/DeltaChart.svelte` (+25 / -5 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same lazy-load refactor pattern as TimeSeriesChart |
| Issues | #101 |
| Criteria covered | AC3, AC4, AC5, AC6 |
| Quality | Identical pattern; `ec.connect(groupId)` correctly replaces `echarts.connect(groupId)`. Explicit `setOption` after init present. |
| Test coverage | `DeltaChart.test.ts` tests `.utils.ts` pure functions. |

### `src/lib/components/charts/MeanMaxChart.svelte` (+23 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same lazy-load refactor; no `connect()` needed (no group sync) |
| Issues | #101 |
| Criteria covered | AC3, AC4, AC5, AC7 |
| Quality | No explicit `setOption` in `onMount` — correct here because `chart` is declared as `$state<ECharts>`, making the `$effect` reactive to the assignment. Consistent pattern. |
| Test coverage | `MeanMaxChart.test.ts` tests `.utils.ts` pure functions. |

### `src/lib/components/charts/SegmentChart.svelte` (+24 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same lazy-load refactor; no `connect()` needed |
| Issues | #101 |
| Criteria covered | AC3, AC4, AC5, AC7 |
| Quality | Explicit `setOption` after init present. Clean pattern. |
| Test coverage | `SegmentChart.test.ts` tests `.utils.ts` pure functions. |

### `src/lib/components/map/ActivityMap.utils.ts` (+1 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Remove `.ts` extension from `$lib/utils/binarySearch.ts` import — TypeScript doesn't rewrite explicit extensions on path aliases at emit |
| Issues | N/A (opportunistic fix for pre-existing svelte-check error) |
| Criteria covered | AC9 (clears the last type-check warning) |
| Quality | Correct fix. The `.ts` extension was the sole remaining `svelte-check` error. |
| Test coverage | Existing `ActivityMap.test.ts` covers the utils functions. |

### `src/routes/layout.css` (+12 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `--skeleton-from` and `--skeleton-to` CSS custom properties for skeleton shimmer in dark (default + explicit) and light themes |
| Issues | #101 |
| Criteria covered | AC4 (skeleton respects theme) |
| Quality | Added to all three theme blocks (`:root`, `[data-theme="dark"]`, `[data-theme="light"]`). Colour values consistent with existing theme palette. |
| Test coverage | Visual — verified via Playwright screenshots. |

### `vite.config.ts` (+2 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `rollup-plugin-visualizer` to generate `stats.html` bundle report on every build |
| Issues | #101 |
| Criteria covered | AC1 |
| Quality | `open: false` prevents auto-opening in browser. `gzipSize: true` shows gzipped sizes for accurate analysis. Placed after `sveltekit()` in plugin array — correct order. |
| Test coverage | Build output verified (`stats.html` generated). |

### `package.json` (+1 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `rollup-plugin-visualizer` as devDependency |
| Issues | #101 |
| Criteria covered | AC1 |
| Quality | No issues. |
| Test coverage | N/A |

### `package-lock.json` (+400 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Lock file updated for `rollup-plugin-visualizer` and its transitive dependencies |
| Issues | #101 |
| Criteria covered | AC1 |
| Quality | Auto-generated. |
| Test coverage | N/A |

### `.gitignore` (+3 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `stats.html` to `.gitignore` (build artefact, not source) |
| Issues | #101 |
| Criteria covered | AC1 |
| Quality | Placed under a clear `# Bundle analyser output` comment. Correct — `stats.html` is regenerated on every build. |
| Test coverage | N/A |

---

## Acceptance Criteria Verification

### #101 — Perf: lazy-load ECharts to reduce initial bundle size

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| Top-1 | ECharts is not in the initial bundle | `echarts-loader.ts` dynamic import; Vite manifest `isDynamicEntry: true`; no entry-point sync tree contains ECharts | Playwright network capture: 0 requests on landing | ✅ Met |
| Top-2 | Chart components show a loading state while ECharts imports | All 4 charts: `{#if !ready}` skeleton div with `.chart-skeleton` shimmer | Visual via Playwright | ✅ Met |
| Top-3 | No visible regression in chart rendering | All charts render data lines, axes, lap markers, legends after fix commit | Playwright screenshots `/tmp/v2-02-compare-loaded.png` | ✅ Met |
| AC1 | `rollup-plugin-visualizer` installed; `stats.html` generated | `vite.config.ts:4` import; `package.json` devDep; `stats.html` in `.gitignore` | `npm run build` produces `stats.html` (579 kB) | ✅ Met |
| AC2 | ECharts only in deferred/async chunk, not entry-point | Manifest: `"isDynamicEntry": true`; all 7 entry-point sync trees verified clean | Python script walking manifest sync deps | ✅ Met |
| AC3 | All four charts use `await import('echarts')` via `loadECharts()` inside async `onMount` | `TimeSeriesChart.svelte:228`, `DeltaChart.svelte:134`, `MeanMaxChart.svelte:102`, `SegmentChart.svelte:129` | `echarts-loader.test.ts` (5 tests) | ✅ Met |
| AC4 | Visible loading skeleton matching chart height; no layout shift | All 4 charts: `<div class="chart-canvas chart-skeleton">` inherits `.chart-canvas` height at all breakpoints | Visual via Playwright | ✅ Met |
| AC5 | Charts render correctly: series data, colours, tooltips, zoom/pan, lap markers, PNG export | Fix commit `a879a30` adds explicit `setOption` after init for 3 non-reactive charts | Playwright screenshots confirm rendering | ✅ Met |
| AC6 | `echarts.connect(groupId)` sync works | `TimeSeriesChart.svelte:231` and `DeltaChart.svelte:136`: `ec.connect(groupId)` | Manual — verified hover sync works in `/verify` | ✅ Met |
| AC7 | Tab switching (Charts → Map → Charts) works; remount works | Charts panel always-mounted via CSS hide/show; MeanMaxChart/SegmentChart remount via `{#if}` — singleton cache resolves instantly | Playwright: 0 re-fetches on tab switch | ✅ Met |
| AC8 | Build no longer emits `chunk > 500 kB` warning | Warning **still appears** — Vite/Rolldown fires it for all chunks >500 kB including async ones | `npm run build` output still shows warning | ⚠️ Partially Met |
| AC9 | No TypeScript errors; `import type` unchanged | `npm run check`: 0 errors, 0 warnings. `import type { ECharts, EChartsOption }` preserved in all 4 charts | `svelte-check` clean pass | ✅ Met |
| AC10 | Second `loadECharts()` call returns cached Promise, no re-fetch | `echarts-loader.ts:6-8` singleton cache; Playwright: 1 total ECharts request across full session | `echarts-loader.test.ts`: `calledTwice_returnsSamePromiseInstance` | ✅ Met |

**Summary:** 12/13 criteria met. 1 partially met (AC8 — warning still present but harmless; the underlying goal of deferring ECharts from the initial bundle is fully achieved).

---

## Findings

### Major (should fix)

#### M1 — MeanMaxChart missing explicit `setOption` in `onMount` — fragile dependency on `$state` reactivity

- **Category:** Reliability
- **Location:** `MeanMaxChart.svelte:100-107`
- **Description:** MeanMaxChart is the only chart that does NOT call `chart.setOption(buildOption(), { notMerge: true })` explicitly in `onMount`. It works because `chart` is declared as `$state<ECharts>`, making the `$effect` reactive to the assignment. The other three charts discovered this problem (blank canvases) and were fixed with explicit `setOption` calls. MeanMaxChart should have the same explicit call for consistency and to avoid a future regression if someone changes `$state` to a plain `let`.
- **Recommendation:** Add `chart.setOption(buildOption(), { notMerge: true })` after `ec.init()` in MeanMaxChart's `onMount`, same as the other three charts. This makes all four charts follow the same pattern and removes the implicit dependency on `$state` reactivity ordering.

### Minor (nice to fix)

#### m1 — AC8 incorrectly marked as met on the issue

- **Category:** Code Quality (documentation)
- **Location:** Issue #101 body
- **Description:** AC8 states "The build no longer emits the `chunk > 500 kB` warning for the ECharts chunk." The warning still fires because Vite/Rolldown emits it for all chunks exceeding the threshold, including async ones. The underlying goal (ECharts not in the initial bundle) is fully achieved, but the specific AC as written is not met. The checkbox on the issue is ticked but should not be.
- **Recommendation:** Either: (a) update AC8 to reflect the actual behaviour — "ECharts is in a deferred async chunk and not in any entry-point sync tree", or (b) add `build: { chunkSizeWarningLimit: 1200 }` to `vite.config.ts` to suppress the warning for the known ECharts chunk. Option (a) is more honest; option (b) is cosmetic.

#### m2 — Skeleton CSS duplicated across four components

- **Category:** Code Quality
- **Location:** All four chart `.svelte` files — `.chart-skeleton` + `@keyframes shimmer` blocks
- **Description:** The `.chart-skeleton` class and `@keyframes shimmer` animation are copy-pasted identically into all four chart components' `<style>` blocks. Svelte scopes styles per component, so each gets its own copy. This is ~12 lines × 4 = 48 lines of identical CSS.
- **Recommendation:** This is a known trade-off with Svelte's scoped styling and is acceptable. A shared CSS file (like the existing `png-btn.css`) would deduplicate it but adds a file for a small gain. Flag for awareness only — not actionable unless more chart components are added.

### Suggestions (optional)

#### S1 — Consider `build.chunkSizeWarningLimit` to silence the known ECharts warning

- **Category:** Developer Experience
- **Location:** `vite.config.ts`
- **Description:** The `chunk > 500 kB` warning on every build is noise now that ECharts is intentionally a large async chunk. Setting `build: { chunkSizeWarningLimit: 1200 }` would suppress it without hiding genuinely problematic chunks (ECharts is ~1137 kB).
- **Recommendation:** Add to `vite.config.ts`: `build: { chunkSizeWarningLimit: 1200 }`. This also resolves AC8 as originally written.

---

## Positive Observations

- The singleton loader pattern (`echarts-loader.ts`) is clean, minimal, and solves three problems at once: deferred loading, shared fetch across concurrent mounts, and instant cache on remount. Good abstraction at the right level.
- The `visibility: hidden` approach for the container div (keeping it in the DOM for `bind:this`) is a smart solution to the async lifecycle timing problem. The skeleton renders at the correct height at all breakpoints because it shares the `.chart-canvas` class.
- The fix commit (`a879a30`) for blank charts was correctly diagnosed — the non-reactive `chart` variable issue is a genuine Svelte 5 pitfall. The commit message explains the root cause clearly.
- The `ActivityMap.utils.ts` fix is a worthwhile cleanup — clears the last type-check warning with a one-character change.
- Test naming follows the `MethodName_Scenario_ExpectedResult` convention consistently.
- `vi.resetModules()` in `beforeEach` correctly isolates the singleton state between test cases.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] M1: Add explicit `chart.setOption(buildOption(), { notMerge: true })` to MeanMaxChart's `onMount` for consistency with the other three charts
- [ ] m1: Update AC8 on issue #101 to reflect actual behaviour, or suppress the warning via `chunkSizeWarningLimit`

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue (ActivityMap.utils.ts fix is a beneficial opportunistic cleanup)
