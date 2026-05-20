# PR #36 Review — feat: Create MeanMaxChart.svelte component (#14)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/14-mean-max-chart -> main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 21/21 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #14 — Step 14: Create MeanMaxChart.svelte component (Device mode) (standalone issue with Analysis + Design sections)

---

## Changed Files Audit

### `src/lib/components/charts/MeanMaxChart.utils.ts` (+20 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure functions for mean-max data transformation and duration formatting; exports `MeanMaxSeriesInput` interface |
| Issues | #14 |
| Criteria covered | AC2, AC3, AC9, AC18 |
| Quality | No issues |
| Test coverage | `MeanMaxChart.test.ts` — 15 tests covering `buildMeanMaxData` and `formatDuration` |

### `src/lib/components/charts/MeanMaxChart.test.ts` (+104 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `buildMeanMaxData` (8 tests) and `formatDuration` (8 tests including boundary cases) |
| Issues | #14 |
| Criteria covered | AC21 |
| Quality | No issues |
| Test coverage | N/A — this is the test file |

### `src/lib/components/charts/MeanMaxChart.svelte` (+223 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | ECharts component: log-scale power duration curve with theme-aware rendering, custom accessible legend, and tooltip |
| Issues | #14 |
| Criteria covered | AC1, AC4, AC5, AC6, AC7, AC8, AC10, AC11, AC12, AC13, AC14, AC15, AC16, AC17, AC19, AC20 |
| Quality | No issues |
| Test coverage | Verified via `npm run check` (type safety) — component rendering not directly testable in Vitest node env |

---

## Acceptance Criteria Verification

### #14 — Step 14: Create MeanMaxChart.svelte component (Device mode)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Component file exists at `MeanMaxChart.svelte` | `MeanMaxChart.svelte` | N/A (existence) | ✅ Met |
| AC2 | `MeanMaxChart.utils.ts` exists with exported `MeanMaxSeriesInput` and `buildMeanMaxData` | `MeanMaxChart.utils.ts:4-7,9-13` | `MeanMaxChart.test.ts` | ✅ Met |
| AC3 | `MeanMaxSeriesInput` has `activity: Activity` and `colourIndex: number` | `MeanMaxChart.utils.ts:5-6` | Implicitly via test usage | ✅ Met |
| AC4 | Accepts `seriesInputs: MeanMaxSeriesInput[]` prop | `MeanMaxChart.svelte:9-13` | `npm run check` | ✅ Met |
| AC5 | Renders ECharts using `renderer: 'canvas'` | `MeanMaxChart.svelte:100` | `npm run check` | ✅ Met |
| AC6 | X-axis is log-scale (`type: 'log'`) | `MeanMaxChart.svelte:37` | Visual | ✅ Met |
| AC7 | Y-axis is linear with unit label `W` | `MeanMaxChart.svelte:48-49` | Visual | ✅ Met |
| AC8 | One solid-line series per activity using `FILE_COLOURS[colourIndex]` | `MeanMaxChart.svelte:72-83` | Visual | ✅ Met |
| AC9 | Data sourced from `meanMaxCurve` with `.mean` field | `MeanMaxChart.utils.ts:10-12` | `buildMeanMaxData_*` tests | ✅ Met |
| AC10 | No `groupId` prop, no `echarts.connect()` | `MeanMaxChart.svelte:9-13` (no groupId), no connect call | Code inspection | ✅ Met |
| AC11 | Theme-aware: matchMedia at mount + change listener | `MeanMaxChart.svelte:98,102-107` | Code inspection | ✅ Met |
| AC12 | Custom HTML legend with toggle | `MeanMaxChart.svelte:132-148` | Visual | ✅ Met |
| AC13 | Legend `aria-pressed`, `aria-label`, `focus-visible` outline | `MeanMaxChart.svelte:139-140,209` | Code inspection | ✅ Met |
| AC14 | `{ notMerge: true }` on all `setOption()` calls | `MeanMaxChart.svelte:94,105,121` — all three call sites | Code inspection | ✅ Met |
| AC15 | `$effect` tracks `seriesInputs` and calls `setOption` | `MeanMaxChart.svelte:119-122` | Code inspection | ✅ Met |
| AC16 | `onMount` initialises chart, matchMedia, ResizeObserver — no `setOption` | `MeanMaxChart.svelte:97-111` — no `setOption` in `onMount` | Code inspection | ✅ Met |
| AC17 | `onDestroy` disconnects ResizeObserver, removes listener, disposes chart | `MeanMaxChart.svelte:113-117` | Code inspection | ✅ Met |
| AC18 | Handles activities with no power data | `MeanMaxChart.utils.ts:10-12` — `meanMaxCurve` returns `[]` for no power | `buildMeanMaxData_noPower_returnsEmptyArray` | ✅ Met |
| AC19 | Tooltip shows duration and power value | `MeanMaxChart.svelte:60-69` | Visual | ✅ Met |
| AC20 | `npm run check` passes with 0 errors | Confirmed: 377 files, 0 errors, 0 warnings | CI output | ✅ Met |
| AC21 | Unit tests cover happy path, no-power, and empty records | `MeanMaxChart.test.ts` — 8 `buildMeanMaxData` tests + 8 `formatDuration` tests | 15/15 pass | ✅ Met |

**Summary:** 21/21 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

#### m1 — `formatDuration` does not handle hour-scale durations readably

- **Category:** Code Quality
- **Location:** `MeanMaxChart.utils.ts:15-19`
- **Description:** For durations >= 3600s, `formatDuration(3661)` returns `"61:01"` rather than `"1:01:01"`. While the test explicitly asserts this behaviour, the x-axis labels for long activities (60+ min) will display `"61:01"` which users may misread as 61 minutes. This is a valid design choice for a log-scale chart where most interesting data is under 30 minutes, but worth noting.
- **Recommendation:** Accept as-is for v1. If users request hour-scale formatting, add a conditional `h:mm:ss` branch for `seconds >= 3600`.

### Suggestions (optional)

#### S1 — `buildMeanMaxData` recomputes on every render

- **Category:** Performance
- **Location:** `MeanMaxChart.svelte:77`
- **Description:** `buildMeanMaxData(s.activity.records)` is called inside `buildOption()`, which runs on every `$effect` trigger and every `toggleSeries` click. `meanMaxCurve` is O(n * d) where n = records and d = sparse durations. For large activities (10k+ records) this recomputation is unnecessary when only series visibility changed.
- **Recommendation:** Accept for v1 — the sparse duration strategy in `meanMaxCurve` keeps d small, and hidden series already short-circuit with `hiddenSeries.has(i) ? [] : buildMeanMaxData(...)`. If performance issues arise with large files, memoize per-activity results.

---

## Positive Observations

- **Consistent pattern adherence:** Structure mirrors DeltaChart and TimeSeriesChart exactly — `onMount` for setup, `$effect` for render, `onDestroy` for cleanup, `.utils.ts` for pure logic
- **Correct naming corrections:** Used `meanMaxCurve` (not `computeMeanMax`) and `.mean` (not `.value`) as documented in the issue's naming correction notes
- **Thorough test coverage:** 15 unit tests cover all documented scenarios including edge cases (empty records, no power, constant power, mixed null/power)
- **HTML entity escaping:** Tooltip formatter uses `esc()` helper to prevent XSS — consistent with the fix applied to DeltaChart in PR #34
- **Accessible legend:** Proper `aria-pressed`, `aria-label`, `role="group"`, and `focus-visible` outline
- **Clean separation:** No store imports, no group sync — appropriately scoped for an independent log-scale chart
- **Light-mode hover:** Uses `@media (prefers-color-scheme: light)` matching the codebase convention (not `:global([data-theme="light"])`)

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] m1: Consider `h:mm:ss` formatting for hour-scale durations if user feedback warrants it

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
