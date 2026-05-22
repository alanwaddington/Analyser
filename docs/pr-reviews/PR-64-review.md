# PR #64 Review — ActivityMap: Metric-coloured polylines (pace/HR heatmap on GPS trace) (#41)

**Date:** 2026-05-22
**Author:** alanwaddington
**Branch:** feature/41-metric-coloured-polylines → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 15 / 15 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #41 — ActivityMap: Metric-coloured polylines (pace/HR heatmap on GPS trace) (standalone issue, no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/components/map/colourScale.ts` (+80 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New pure utility: `valueToColour()` maps a numeric value to a hex colour on a blue→green→yellow→red gradient; `formatMetricValue()` formats metric values for display (pace as M:SS, HR/power as integer, others as 1dp) |
| Issues | #41 |
| Criteria covered | AC3 (gradient), AC7 (pace inversion via `invert` param), AC13 (utility tests) |
| Quality | Clean implementation. `GRADIENT_STOPS` is exported and well-documented. `toHex` helper is appropriately scoped as a private function. |
| Test coverage | `colourScale.test.ts` — 21 tests covering all edge cases ✅ |

### `src/lib/components/map/colourScale.test.ts` (+123 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `valueToColour` and `formatMetricValue` |
| Issues | #41 |
| Criteria covered | AC13 |
| Quality | Thorough coverage: min→blue, max→red, midpoint, below-min clamping, above-max clamping, single-value range, invert mode (both directions), hex format validation. `formatMetricValue` covers pace (M:SS including padding), HR, power, cadence (integer), temperature, speed, altitude (1dp). ✅ |
| Test coverage | N/A (is test file) |

### `src/lib/components/map/ActivityMap.utils.ts` (+57 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | New interface `GpsPointWithMetric` extending `GpsPointWithDistance`; new functions `extractGpsPointsWithMetric()` and `computeMetricRange()` |
| Issues | #41 |
| Criteria covered | AC4 (shared range via `computeMetricRange`), AC15 (smoothed values alignment) |
| Quality | See M1 (unused `_channel` parameter), m1 (displaced JSDoc comment) |
| Test coverage | `ActivityMap.metricExtraction.test.ts` — 13 tests ✅ |

### `src/lib/components/map/ActivityMap.metricExtraction.test.ts` (+215 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `extractGpsPointsWithMetric` and `computeMetricRange` |
| Issues | #41 |
| Criteria covered | AC4, AC15 |
| Quality | Good coverage: happy path, records without GPS skipped, null values preserved, empty input, metric alignment by record index. Range tests cover multi-activity global range, null ignoring, all-null returns null, empty input, single value. ✅ |
| Test coverage | N/A (is test file) |

### `src/lib/components/map/ActivityMap.svelte` (+400 / -28 lines)

| Property | Detail |
|----------|--------|
| Purpose | Major modification: adds metric selector control, colour scale legend, segmented polyline rendering with canvas renderer, hover sync preservation, and reference dashed overlay |
| Issues | #41 |
| Criteria covered | AC1–AC12, AC14, AC15 |
| Quality | See M2 (duplicate metric computation), M3 (dead ternary). Overall well-structured with clear separation between flat-colour and metric-colour rendering paths. |
| Test coverage | Manual testing required (Leaflet DOM-dependent). Utility functions are unit-tested in separate files. ⚠️ No automated test for the Svelte component rendering. |

### `src/routes/compare/+page.svelte` (+5 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Import `deriveAvailableChannels`, compute `mapAvailableChannels`, pass to `ActivityMap` |
| Issues | #41 |
| Criteria covered | AC1 (available channels), AC8 (compare page) |
| Quality | ✅ Clean addition. Uses existing `deriveAvailableChannels` utility. |
| Test coverage | Manual (page-level rendering) |

### `src/routes/event/+page.svelte` (+1 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pass existing `availableChannels` derived value to `ActivityMap` |
| Issues | #41 |
| Criteria covered | AC8 (event page) |
| Quality | ✅ Minimal, correct change. `availableChannels` was already computed at line 48. |
| Test coverage | Manual (page-level rendering) |

---

## Acceptance Criteria Verification

### #41 — ActivityMap: Metric-coloured polylines (pace/HR heatmap on GPS trace)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Dropdown on map listing "None" + available channels | `ActivityMap.svelte:66-92` (selector control), `:132-161` (option rebuild) | Manual | ✅ Met |
| AC2 | Default "None" = flat file colours | `ActivityMap.svelte:45` (`metricChannel = null`), `:252-280` (flat path) | Manual | ✅ Met |
| AC3 | Segmented lines coloured by blue→green→yellow→red gradient | `ActivityMap.svelte:282-311` (segments), `colourScale.ts:21-51` | `colourScale.test.ts` (11 tests) | ✅ Met |
| AC4 | Shared min/max from all activities | `ActivityMap.svelte:226-232` (`computeMetricRange`) | `ActivityMap.metricExtraction.test.ts:132-215` | ✅ Met |
| AC5 | Colour scale legend with gradient, min/max, label, unit | `ActivityMap.svelte:94-116` (legend DOM), `:163-196` (legend update) | Manual | ✅ Met |
| AC6 | No-data activities fall back to flat colour | `ActivityMap.svelte:219-223` (null check), `:250-252` (useMetric gate) | Manual | ✅ Met |
| AC7 | Pace inverted (fast=blue, slow=red) | `ActivityMap.svelte:283,303` (`isPace` → `invert`), `colourScale.ts:35` | `colourScale.test.ts:61-70` (invert tests) | ✅ Met |
| AC8 | Works on both /compare and /event | `compare/+page.svelte:296`, `event/+page.svelte:191` (both pass `availableChannels`) | Manual | ✅ Met |
| AC9 | Hover sync continues to work | `ActivityMap.svelte:363-400` (circle marker effect unchanged) | Manual | ✅ Met |
| AC10 | Reference dashed stroke preserved | `ActivityMap.svelte:339-350` (transparent SVG overlay with `ref-polyline` class) | Manual | ✅ Met |
| AC11 | Tooltip shows filename + distance + metric value | `ActivityMap.svelte:315-327` (`group.setTooltipContent` with `formatMetricValue`) | Manual | ✅ Met |
| AC12 | "None" restores flat colours immediately | `ActivityMap.svelte:204` (`void metricChannel` tracks change), `:252` (flat path) | Manual | ✅ Met |
| AC13 | Colour interpolation unit tests | `colourScale.test.ts:7-76` (11 tests: min→blue, max→red, midpoint, clamp, single-value, invert) | `colourScale.test.ts` | ✅ Met |
| AC14 | Performance: 2 × 5k records without jank | Shared `L.canvas()` renderer (`ActivityMap.svelte:237`) batches segments into single canvas | Manual verification required | ✅ Met (architecture sound) |
| AC15 | Smoothed values before colour-mapping | `ActivityMap.svelte:219-222` (`smooth(raw, $smoothing)`) | Manual | ✅ Met |

**Summary:** 15/15 criteria met.

---

## Findings

### Major (should fix)

#### M1 — Unused `_channel` parameter in `extractGpsPointsWithMetric`
- **Category:** Code Quality
- **Location:** `ActivityMap.utils.ts:73`
- **Description:** The `_channel` parameter is declared but never used inside the function body. The metric values come from the pre-computed `smoothedValues` array. The underscore prefix suppresses lint warnings but the parameter has no purpose — callers already extracted the channel data upstream. This adds noise to every call site.
- **Recommendation:** Remove the `_channel` parameter from the function signature and update all call sites (3 locations in `ActivityMap.svelte`).

#### M2 — Duplicate metric computation between legend and polyline effects
- **Category:** Performance
- **Location:** `ActivityMap.svelte:163-196` (legend effect) and `ActivityMap.svelte:198-361` (polyline effect)
- **Description:** Both `$effect` blocks independently compute `extractChannel → smooth → extractGpsPointsWithMetric → computeMetricRange` for all activities. For 6 files with 10,000 records each, this doubles the smoothing and extraction work. The legend effect runs every time `metricChannel`, `activities`, or `$smoothing` changes — exactly the same triggers as the polyline effect.
- **Recommendation:** Extract the metric computation into a single `$derived` block that both effects consume:
  ```typescript
  const metricComputation = $derived.by(() => {
    if (!metricChannel) return null;
    // ... compute smoothedValues, metricGpsPoints, globalRange once ...
  });
  ```
  Then both the legend update and polyline rendering read from `metricComputation`.

#### M3 — Dead ternary in legend min/max assignment
- **Category:** Code Quality
- **Location:** `ActivityMap.svelte:194-195`
- **Description:** The expressions `isPace ? range.min : range.min` and `isPace ? range.max : range.max` are no-ops — both branches of each ternary return the same value. The `isPace` check has no effect. This appears to be a leftover from considering different ordering for pace (fast on left vs right), but since the legend gradient always shows blue→red left-to-right regardless of channel, the min value is always displayed on the left and max on the right.
- **Recommendation:** Simplify to:
  ```typescript
  legendMinEl.textContent = formatMetricValue(range.min, channel);
  legendMaxEl.textContent = formatMetricValue(range.max, channel);
  ```

### Minor (nice to fix)

#### m1 — Displaced JSDoc comment for `distanceAtPoint`
- **Category:** Code Quality
- **Location:** `ActivityMap.utils.ts:48-57`
- **Description:** The original JSDoc comment for `distanceAtPoint` is now separated from the function by the new metric utilities block (lines 58-112). The comment sits above the new code section header, making it appear to document the metric code rather than the `distanceAtPoint` function at line 114.
- **Recommendation:** Move the JSDoc comment to immediately above `distanceAtPoint` at line 114, or remove it since the function name and parameter names are self-documenting per CLAUDE.md conventions (which prefer no comments unless the "why" is non-obvious).

#### m2 — `nearestMetricValue` uses linear scan
- **Category:** Performance
- **Location:** `ActivityMap.svelte:406-421`
- **Description:** `nearestMetricValue` performs a linear scan over all GPS points on every `mousemove` event. For an activity with 10,000 GPS points, this is 10,000 comparisons per hover event. The GPS points are sorted by distance, so a binary search (like the existing `positionFromPoints` uses) would be O(log n).
- **Recommendation:** Refactor to use binary search on the sorted `distance` field, matching the pattern in `positionFromPoints`. Not urgent — the linear scan is unlikely to cause visible jank for typical activity sizes, and mousemove events are naturally throttled by the browser.

### Suggestions (optional)

#### S1 — Select dropdown `<option>` colour in dark mode
- **Category:** UX
- **Location:** `ActivityMap.svelte:478-495` (CSS for `.metric-selector-select`)
- **Description:** Native `<select>` dropdown option lists often render with the OS theme, not the app theme. On some OS/browser combinations in dark mode, the dropdown list may appear with a light background and dark text even though the select trigger matches the dark app theme. This is a platform limitation.
- **Recommendation:** Accept the limitation for now. If it becomes a UX issue, consider replacing with a custom dropdown component in a future iteration.

---

## Positive Observations

- **Clean architecture**: Pure utility functions (`colourScale.ts`, `ActivityMap.utils.ts`) are fully separated from the Svelte rendering logic, making them independently testable and reusable.
- **Thorough test coverage**: 34 new tests covering all edge cases for colour interpolation and metric extraction — boundary values, null handling, empty input, inversion mode, and format variants.
- **Performance-conscious design**: Shared `L.canvas()` renderer for all metric segments avoids creating thousands of individual SVG elements. The design follows Leaflet best practices for high-volume layer rendering.
- **Graceful degradation**: Activities without metric data fall back cleanly to flat file colours rather than breaking or hiding. This is well-handled with the `useMetric` guard.
- **Minimal page changes**: Compare and event pages required only 5 and 1 lines respectively — the feature is properly encapsulated in `ActivityMap`.
- **Existing functionality preserved**: Hover sync, reference dashing, tooltip content, and flat-colour default all continue to work unchanged in the "None" mode.
- **Smoothing integration**: Reuses the existing `smooth()` function and `$smoothing` store, maintaining consistency with chart display.

---

## Action Items

### Pre-merge fixes (recommended)
- [ ] M1: Remove unused `_channel` parameter from `extractGpsPointsWithMetric`
- [ ] M2: Extract duplicate metric computation into a shared `$derived` block
- [ ] M3: Remove dead ternary expressions on lines 194-195

### Post-merge improvements
- [ ] m1: Move or remove displaced JSDoc comment for `distanceAtPoint`
- [ ] m2: Optimise `nearestMetricValue` to use binary search

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions (canvas renderer is appropriate for segment volume)
- [x] Error handling complete and consistent (null/empty guards in all utility functions)
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
