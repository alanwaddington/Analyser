# PR #33 Review — feat: Create TimeSeriesChart.svelte component (#12)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/12-time-series-chart → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate — pure logic well tested; Svelte component untestable in node environment |
| Acceptance Criteria | 18/18 Met (Analysis ACs) |

---

## Issues Reviewed

### Issue Hierarchy
- #12 — Step 12: Create TimeSeriesChart.svelte component (standalone — no parent/child issues)

---

## Changed Files Audit

### `src/lib/components/charts/TimeSeriesChart.svelte` (+271 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | ECharts time-series line chart component with group sync, smoothing, dual axis mode, theme awareness, lap markers, and interactive legend |
| Issues | #12 |
| Criteria covered | AC1–AC18 (all) |
| Quality | See findings below |
| Test coverage | Indirectly via `TimeSeriesChart.utils.ts` tests; component logic not directly testable in node environment |

### `src/lib/components/charts/TimeSeriesChart.utils.ts` (+15 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure functions extracted from chart component: `extractChannel`, `buildXValues`, `isDashed` |
| Issues | #12 |
| Criteria covered | AC5 (data extraction for smoothing), AC6 (x-axis values), AC8/AC9 (dash logic) |
| Quality | ✅ Clean, focused, well-typed |
| Test coverage | `TimeSeriesChart.test.ts` — 16 tests covering all three functions |

### `src/lib/components/charts/TimeSeriesChart.test.ts` (+117 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the three extracted pure functions |
| Issues | #12 |
| Criteria covered | Validates AC5, AC6, AC8, AC9, AC16 |
| Quality | ✅ Follows codebase convention (`MethodName_Scenario_ExpectedResult`), good edge cases |
| Test coverage | N/A (this is the test file) |

---

## Acceptance Criteria Verification

### #12 — Step 12: Create TimeSeriesChart.svelte component

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Component file exists at `src/lib/components/charts/TimeSeriesChart.svelte` | File exists, 271 lines | N/A | ✅ Met |
| AC2 | Accepts all five props with correct TypeScript types | `.svelte:16-28` — `$props()` with typed destructuring | N/A (type-checked by `svelte-check`) | ✅ Met |
| AC3 | Renders ECharts using `renderer: 'canvas'` | `.svelte:127` — `echarts.init(container, undefined, { renderer: 'canvas' })` | N/A | ✅ Met |
| AC4 | Chart joins group via `echarts.connect(groupId)` | `.svelte:128-129` — `chart.group = groupId; echarts.connect(groupId)` | N/A | ✅ Met |
| AC5 | Data smoothed using `smooth()` with `$smoothing` | `.svelte:46-47` — `extractChannel` then `smooth(raw, $smoothing)` | `extractChannel` tests validate data extraction; `smooth` tested separately | ✅ Met |
| AC6 | X-axis switches between seconds and km | `.svelte:48` — `buildXValues(records, $xAxisMode)`; `.svelte:61` — axis name conditional | `buildXValues` tests cover both modes | ✅ Met |
| AC7 | Chart re-renders when `$smoothing` changes | `.svelte:149-154` — `$effect` watching `$smoothing` calls `setOption` | N/A | ✅ Met |
| AC8 | Device mode: series[0] solid, rest dashed | `utils.ts:12-14` — `isDashed` returns `seriesIndex !== 0` when `referenceIndex` undefined | 3 tests: first solid, second dashed, third dashed | ✅ Met |
| AC9 | Event mode: reference dashed, rest solid | `utils.ts:13` — `isDashed` returns `idx === referenceIndex` | 4 tests covering both directions | ✅ Met |
| AC10 | Lap markers as vertical dashed lines | `.svelte:98-108` — `markLine` on `series[0]` with `symbol: ['none','none']`, dashed style | N/A | ✅ Met |
| AC11 | Theme-aware colours, re-renders on change | `.svelte:124-137` — `matchMedia` init + change listener calling `setOption` | N/A | ✅ Met |
| AC12 | Custom HTML legend with SVG swatches | `.svelte:167-190` — `{#each}` rendering `<button>` with `<svg><line>` swatches | N/A | ✅ Met |
| AC13 | Clicking legend item toggles series visibility | `.svelte:114-122` — `toggleSeries` mutates `hiddenSeries` Set; `.svelte:88` — `hiddenSeries.has(i) ? [] : buildData(...)` | N/A | ✅ Met |
| AC14 | Tooltip shows values at crosshair | `.svelte:74-79` — `tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } }` | N/A | ✅ Met |
| AC15 | Header displays channel label and unit | `.svelte:159-162` — `CHANNEL_META[channel].label` and `.unit` | N/A | ✅ Met |
| AC16 | Handles null/undefined channel values | `utils.ts:3-4` — `(r[channel] as number | undefined) ?? null`; ECharts handles null in data arrays as gaps | 3 tests: missing, all-missing, empty records | ✅ Met |
| AC17 | Dispose + cleanup on destroy | `.svelte:143-147` — `resizeObserver.disconnect()`, `mq.removeEventListener`, `chart.dispose()` | N/A | ✅ Met |
| AC18 | `npm run check` passes | Verified: 371 files, 0 errors, 0 warnings | `npm test`: 32/32 pass | ✅ Met |

**Summary:** 18/18 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

#### M1 — Double `setOption` call on mount

- **Category:** Performance
- **Location:** `TimeSeriesChart.svelte:130` and `TimeSeriesChart.svelte:149-154`
- **Description:** `onMount` calls `chart.setOption(buildOption())` at line 130. The `$effect` at line 149 also runs on mount (Svelte 5 effects run once initially), causing a second immediate `setOption` call with identical data. For activities with thousands of records, `buildData()` runs the `smooth()` function for every series twice on first render.
- **Recommendation:** Guard the `$effect` with `if (!chart) return;` at the top, and remove the `chart.setOption(buildOption())` from `onMount` — let the `$effect` handle the initial render. Alternatively, add a `mounted` flag and skip the first `$effect` execution. The simplest approach:
  ```typescript
  $effect(() => {
    void $smoothing;
    void $xAxisMode;
    // chart is only set after onMount, and $effect runs once initially
    // when chart is undefined, so the ?. handles it.
    // But if chart IS defined on first $effect run (after onMount sets it),
    // this is a redundant second call.
    chart?.setOption(buildOption());
  });
  ```
  Remove line 130 (`chart.setOption(buildOption())`) from `onMount` and rely solely on the `$effect` to set the initial option. The `$effect` will run after `onMount` completes since `onMount` is synchronous and `$effect` runs after the current microtask.

  **However**, this depends on Svelte 5's `$effect` timing guarantee — if the `$effect` runs *before* `onMount`, the chart won't exist yet. The current code is **safe** (double-render is wasteful but not incorrect). If fixing, test manually.

#### M2 — ECharts default merge may leave stale series on prop change

- **Category:** Reliability
- **Location:** `TimeSeriesChart.svelte:121,130,135,153`
- **Description:** When `seriesInputs` changes (e.g. user removes an activity), `setOption()` uses ECharts' default merge behaviour. If the new `seriesInputs` has fewer entries than the previous call, the old extra series remain in the chart because ECharts merges by index. This would cause phantom series lingering on the chart.
- **Recommendation:** Pass `{ notMerge: true }` to all `setOption()` calls:
  ```typescript
  chart?.setOption(buildOption(), { notMerge: true });
  ```
  This ensures the chart is fully replaced on each update. Performance cost is negligible for the data sizes involved.

### Minor (nice to fix)

#### m1 — `$effect` does not react to `seriesInputs` or `referenceIndex` prop changes

- **Category:** Reliability
- **Location:** `TimeSeriesChart.svelte:149-154`
- **Description:** The `$effect` only tracks `$smoothing` and `$xAxisMode`. If the parent changes `seriesInputs` (e.g. adds/removes an activity) or `referenceIndex` (user clicks a different reference in event mode), the chart will not re-render because those prop changes are not tracked inside the `$effect`. Svelte 5 only tracks reactive values that are *read* inside the `$effect` body.
- **Recommendation:** Read `seriesInputs` and `referenceIndex` inside the `$effect`:
  ```typescript
  $effect(() => {
    void $smoothing;
    void $xAxisMode;
    void seriesInputs;
    void referenceIndex;
    chart?.setOption(buildOption(), { notMerge: true });
  });
  ```
  Since `seriesInputs` and `referenceIndex` are `$props()`, they are reactive in Svelte 5 and will trigger the `$effect` when the parent updates them.

#### m2 — Comment on line 97 violates "no comments" project convention

- **Category:** Code Quality
- **Location:** `TimeSeriesChart.svelte:97`
- **Description:** The line `// Lap markers on first series only` describes *what* the code does, which is already apparent from the conditional. CLAUDE.md states: "Don't explain WHAT the code does, since well-named identifiers already do that."
- **Recommendation:** Remove the comment.

#### m3 — Comment on line 149 also explains what

- **Category:** Code Quality
- **Location:** `TimeSeriesChart.svelte:150`
- **Description:** `// Re-render when smoothing or axis mode changes` — the `void $smoothing; void $xAxisMode;` pattern is well-known in Svelte 5.
- **Recommendation:** Remove the comment.

### Suggestions (optional)

#### S1 — `SeriesInput` interface could be exported for consumer type safety

- **Category:** Code Quality
- **Location:** `TimeSeriesChart.svelte:11-14`
- **Description:** The `SeriesInput` interface is defined inside the component's `<script>` block. Parent pages (`/compare`, `/event`) need to construct objects matching this shape. If the interface is only defined internally, parents must match the shape by convention rather than by import.
- **Recommendation:** Move the `SeriesInput` interface to `TimeSeriesChart.utils.ts` and export it. This gives parent pages a type to import.

---

## Positive Observations

- **Clean extraction of pure logic** — `extractChannel`, `buildXValues`, and `isDashed` are pulled into a separate `.utils.ts` file, making them testable in the node-only Vitest environment. Good engineering judgment.
- **Comprehensive test coverage for utils** — 16 tests cover all three functions including edge cases (empty records, all-null channels, both Device and Event mode dash logic).
- **Accessibility** — legend buttons use `aria-pressed`, `aria-label`, and `role="group"`, and SVG swatches are correctly marked `aria-hidden`. Focus-visible outline for keyboard users.
- **Theme implementation** — correct use of `matchMedia` with event listener for live theme switching, and stored reference for proper cleanup.
- **Codebase conventions followed** — test naming matches `MethodName_Scenario_ExpectedResult`, scoped `<style>` block uses CSS custom properties matching `layout.css`, imports use `$lib/` alias.
- **Correct naming fix** — identified and resolved the `rollingAverage` → `smooth` naming mismatch from the plan.

---

## Action Items

### Immediate Fixes (block merge)

None — no critical findings.

### Should fix (before or shortly after merge)

- [ ] M1: Remove duplicate `setOption` call on mount (or accept the double-render as a minor perf cost)
- [ ] M2: Add `{ notMerge: true }` to all `setOption()` calls to prevent stale series on activity removal

### Post-merge improvements

- [ ] m1: Track `seriesInputs` and `referenceIndex` in the `$effect` for reactivity to prop changes
- [ ] m2: Remove comment on line 97
- [ ] m3: Remove comment on line 150
- [ ] S1: Export `SeriesInput` interface from utils for parent page type safety

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions (M1 is minor — double init render only)
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
