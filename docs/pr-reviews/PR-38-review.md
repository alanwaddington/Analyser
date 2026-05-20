# PR #38 Review — feat: Create SegmentChart.svelte component (#15)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/15-segment-chart → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 25/26 met |

---

## Issues Reviewed

### Issue Hierarchy
- #15 — Step 15: Create SegmentChart.svelte component (Event mode) (standalone)

---

## Changed Files Audit

### `src/lib/compare/delta.ts` (+1 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Export `timeAtDistance` so `SegmentChart.utils.ts` can reuse it |
| Issues | #15 |
| Criteria covered | Enables AC6 (segmentTime uses timeAtDistance) |
| Quality | Minimal change — `function` → `export function`. No logic altered |
| Test coverage | Existing tests in delta.test.ts cover `timeAtDistance` indirectly via `computeTimeDelta`; new tests in SegmentChart.test.ts exercise it through `segmentTime` |

### `src/lib/components/charts/SegmentChart.utils.ts` (+34 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure functions and interfaces for segment time computation and delta calculation |
| Issues | #15 |
| Criteria covered | AC2, AC3, AC4, AC6, AC7, AC8, AC11, AC24 |
| Quality | Clean, focused module. Follows codebase pattern (MeanMaxChart.utils.ts). Imports `timeAtDistance` correctly. Coverage check at line 21 (`segment.endDist > lastDist`) handles partial coverage |
| Test coverage | `SegmentChart.test.ts` — 11 tests covering all exported functions |

### `src/lib/components/charts/SegmentChart.test.ts` (+136 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `segmentTime` and `computeSegmentDeltas` |
| Issues | #15 |
| Criteria covered | AC26 |
| Quality | Well-structured with `makeRecord`/`makeActivity` helpers matching existing test patterns. Tests use `toBeCloseTo` for floating-point safety. Good coverage of edge cases: empty records, no coverage, partial coverage, interpolation |
| Test coverage | N/A — this is the test file |

### `src/lib/components/charts/SegmentChart.svelte` (+256 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | ECharts bar chart component for per-segment time deltas |
| Issues | #15 |
| Criteria covered | AC1, AC5, AC9, AC10, AC12, AC13, AC14, AC15, AC16, AC17, AC18, AC19, AC20, AC21, AC22, AC23, AC25 |
| Quality | Follows established chart component pattern. `$derived` memoization for `seriesDeltas`. Per-value bar colouring. Shadow axisPointer appropriate for bar charts. `esc()` helper for tooltip XSS prevention |
| Test coverage | Type-checked via `npm run check`; component not unit-testable in Vitest node env (expected — matches codebase pattern) |

---

## Acceptance Criteria Verification

### #15 — Step 15: Create SegmentChart.svelte component (Event mode)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Component file at `SegmentChart.svelte` | `src/lib/components/charts/SegmentChart.svelte` exists | N/A | ✅ Met |
| AC2 | `SegmentChart.utils.ts` with exports | `SegmentChart.utils.ts:1-34` — exports `SegmentSeriesInput`, `Segment`, `segmentTime`, `computeSegmentDeltas` | `SegmentChart.test.ts` imports all | ✅ Met |
| AC3 | `SegmentSeriesInput` has `activity` + `colourIndex` | `SegmentChart.utils.ts:4-7` | Type-checked | ✅ Met |
| AC4 | `Segment` has `label`, `startDist`, `endDist` | `SegmentChart.utils.ts:9-13` | `SegmentChart.test.ts:27-29` | ✅ Met |
| AC5 | Accepts `seriesInputs`, `referenceIndex`, `segments` props | `SegmentChart.svelte:9-17` via `$props()` | Type-checked | ✅ Met |
| AC6 | `segmentTime` returns elapsed seconds | `SegmentChart.utils.ts:15-23` — calls `timeAtDistance` for start/end | `segmentTime_happyPath`, `segmentTime_firstSegment`, `segmentTime_interpolatesWithinSegment` | ✅ Met |
| AC7 | `segmentTime` returns 0 for no coverage | `SegmentChart.utils.ts:16,19,21` — three guard clauses | `segmentTime_emptyRecords`, `segmentTime_noCoverage`, `segmentTime_partialCoverage` | ✅ Met |
| AC8 | `computeSegmentDeltas` returns `{ label, delta }[]` | `SegmentChart.utils.ts:25-34` | `computeSegmentDeltas_*` (5 tests) | ✅ Met |
| AC9 | Canvas renderer | `SegmentChart.svelte:129` — `{ renderer: 'canvas' }` | N/A | ✅ Met |
| AC10 | One bar per non-reference activity per segment | `SegmentChart.svelte:50-69` — filters out `referenceIndex`, maps remaining | N/A | ✅ Met |
| AC11 | Delta = refTime - candidateTime, positive = faster | `SegmentChart.utils.ts:31` — `segmentTime(reference, seg) - segmentTime(candidate, seg)` | `computeSegmentDeltas_candidateFaster_positiveDelta` | ✅ Met |
| AC12 | Positive bars use faster colour | `SegmentChart.svelte:41,61` — `fasterColour()` for delta >= 0 | N/A | ✅ Met |
| AC13 | Negative bars use slower colour | `SegmentChart.svelte:42,61` — `slowerColour()` for delta < 0 | N/A | ✅ Met |
| AC14 | Theme-aware with matchMedia | `SegmentChart.svelte:127,131-135` — reads at mount, listens for changes | N/A | ✅ Met |
| AC15 | `{ notMerge: true }` on all setOption | `SegmentChart.svelte:123,134,152` — three call sites, all have `{ notMerge: true }` | N/A | ✅ Met |
| AC16 | `$effect` tracks props and calls setOption | `SegmentChart.svelte:148-153` — tracks `seriesInputs`, `referenceIndex`, `segments` | N/A | ✅ Met |
| AC17 | `onMount` initialises chart/matchMedia/ResizeObserver, no setOption | `SegmentChart.svelte:126-140` — no standalone setOption in onMount body | N/A | ✅ Met |
| AC18 | `onDestroy` cleans up all resources | `SegmentChart.svelte:142-146` — disconnects ResizeObserver, removes listener, disposes chart | N/A | ✅ Met |
| AC19 | Custom legend with SVG swatch and toggle | `SegmentChart.svelte:163-181` — rectangle SVG swatches, `toggleSeries` on click | N/A | ⚠️ Partially Met |
| AC20 | Legend buttons have `aria-pressed`, `aria-label`, `focus-visible` | `SegmentChart.svelte:171-173,239-242` — all three present | N/A | ✅ Met |
| AC21 | Tooltip with signed delta and HTML escaping | `SegmentChart.svelte:99-109` — `esc()` helper, `sign` logic, `.toFixed(1)s` | N/A | ✅ Met |
| AC22 | Category x-axis labels, rotated if > 6 | `SegmentChart.svelte:48,79` — `rotate = segments.length > 6 ? 30 : 0`, `interval: 0` | N/A | ✅ Met |
| AC23 | No group sync | No `groupId` prop, no `echarts.connect()` call | N/A | ✅ Met |
| AC24 | Handles missing coverage (returns 0) | `SegmentChart.utils.ts:16-21` — guard clauses | `segmentTime_noCoverage`, `segmentTime_partialCoverage` | ✅ Met |
| AC25 | `npm run check` passes | PR description states 380 files, 0 errors, 0 warnings | N/A | ✅ Met |
| AC26 | Tests cover segmentTime and computeSegmentDeltas | `SegmentChart.test.ts` — 6 + 5 = 11 tests | All passing | ✅ Met |

**Summary:** 25/26 criteria met. 1 partially met (AC19 — see M1).

---

## Findings

### Major (should fix)

#### M1 — AC19 specifies "SVG line swatch" but implementation uses rectangle swatch

- **Category:** Code Quality / Acceptance Criteria
- **Location:** `SegmentChart.svelte:174-176`
- **Description:** AC19 states "SVG line swatch in `FILE_COLOURS[colourIndex]`" but the implementation uses a `<rect>` SVG element. However, a rectangle swatch is actually the *correct* visual choice for a bar chart — line swatches are for line charts (TimeSeriesChart, DeltaChart, MeanMaxChart). The AC text appears to be a copy-paste from the line chart pattern. The MeanMaxChart also uses rectangle swatches for its legend. The design section explicitly chose rectangle swatches as the right approach.
- **Recommendation:** Update the AC19 text on the issue to say "SVG rectangle swatch" to match the intentional design choice. No code change needed — the implementation is correct for a bar chart.

### Minor (nice to fix)

#### m1 — Y-axis label is "s" instead of descriptive text

- **Category:** Code Quality
- **Location:** `SegmentChart.svelte:88`
- **Description:** The y-axis `name` is `'s'` (seconds abbreviation). The issue's original spec says "Y-axis label: seconds vs reference". While terse labels save space, `'s'` on its own is cryptic without context. Other chart components in the codebase use similarly terse labels (e.g. MeanMaxChart uses `'W'` for watts), so this is consistent with the existing pattern.
- **Recommendation:** Consider changing to `'Δ (s)'` or leaving as-is for consistency. Low priority.

### Suggestions (optional)

#### S1 — Consider `$derived` for `hiddenSeries` toggle rebuild

- **Category:** Performance
- **Location:** `SegmentChart.svelte:116-124`
- **Description:** The `toggleSeries` function manually creates a new `Set`, toggles membership, reassigns, then calls `setOption`. This works correctly. However, since `hiddenSeries` is `$state`, the `$effect` at line 148 will also fire (it tracks `seriesInputs`, not `hiddenSeries`, so it won't double-render). The manual `setOption` call in `toggleSeries` is fine and matches the MeanMaxChart pattern.
- **Recommendation:** No change needed — this is consistent with other chart components.

---

## Positive Observations

- **Consistent patterns**: The component follows the exact same structure as TimeSeriesChart, DeltaChart, and MeanMaxChart — `onMount`/`onDestroy`/`$effect` lifecycle, `$derived` memoization, custom HTML legend, `{ notMerge: true }` convention.
- **Smart reuse**: `timeAtDistance` reused from `delta.ts` rather than reimplemented — O(log n) binary search with interpolation.
- **Thorough guard clauses**: `segmentTime` handles three edge cases (empty records, null interpolation result, end distance beyond last record) before computing the result.
- **`$derived seriesDeltas`**: Memoizes expensive delta computation so toggle/theme changes don't recompute — lesson learned from MeanMaxChart S1 finding in PR #36.
- **Excellent test coverage**: 11 tests covering happy path, edge cases, and boundary conditions for both exported functions.
- **Accessible legend**: `aria-pressed`, `aria-label` with show/hide prefix, `role="group"`, `focus-visible` outline — strong a11y.
- **XSS prevention**: Tooltip uses `esc()` helper for HTML entity escaping.

---

## Action Items

### Immediate Fixes (block merge)

None — no critical or blocking issues found.

### Post-merge improvements

- [ ] M1: Update AC19 text on issue #15 to say "rectangle swatch" instead of "line swatch" to match the design intent
- [ ] m1: Consider more descriptive y-axis label — create issue if desired

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
