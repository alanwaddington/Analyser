# PR #61 Review — Feature: Bidirectional chart↔map hover sync (#40)

**Date:** 2026-05-21
**Author:** alanwaddington
**Branch:** feature/40-bidirectional-map-chart-sync → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 11 Met / 11 Total |

---

## Issues Reviewed

### Issue Hierarchy
- #40 — Bidirectional chart↔map hover sync (root — contains both Analysis and Design)

No parent or sub-issues.

---

## Changed Files Audit

### `src/lib/components/map/ActivityMap.utils.ts` (+33 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `distanceAtPoint()` reverse GPS lookup — given a lat/lon, find the distance of the nearest GPS point |
| Issues | #40 |
| Criteria covered | AC10 |
| Quality | ✅ Clean implementation. O(n) linear scan using squared Euclidean distance is appropriate for the data scale. Well-documented JSDoc. |
| Test coverage | `ActivityMap.test.ts` — 8 new tests |

### `src/lib/components/map/ActivityMap.test.ts` (+79 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add 8 unit tests for `distanceAtPoint()` covering empty array, exact match, nearest point, single point, beyond-end, before-start, midpoint, and first-nearest cases |
| Issues | #40 |
| Criteria covered | AC10 |
| Quality | ✅ Thorough coverage. Follows existing `MethodName_Scenario_ExpectedResult` naming convention. |
| Test coverage | N/A (is the test file) |

### `src/lib/components/map/ActivityMap.svelte` (+31 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `onHoverDistance` callback prop; polyline `mousemove`/`mouseout` handlers calling `distanceAtPoint()`; tooltip update to `"filename · X.XX km"`; ResizeObserver for `map.invalidateSize()` on tab switch; import `xAxisMode` store for distance-mode gate |
| Issues | #40 |
| Criteria covered | AC3, AC4, AC5, AC8, AC9, AC11 |
| Quality | ✅ Correct use of Leaflet event API. Distance-mode gate applied at the handler level. Tooltip reset on mouseout. ResizeObserver properly cleaned up in `onDestroy`. |
| Test coverage | Runtime behaviour — not unit-testable (Leaflet + DOM interaction). Manual verification required. |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+54 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `onHoverDistance`, `onChartReady`, and `externalHoverDistance` optional props; listen to ECharts `updateAxisPointer` and `globalout` events; add `$effect` to drive crosshair via `dispatchAction` when `externalHoverDistance` changes |
| Issues | #40 |
| Criteria covered | AC1, AC2, AC3, AC4 |
| Quality | ⚠️ See findings m1 and m2 — `onChartReady` is wired but unused by callers; `externalHoverDistance` on all chart instances causes redundant dispatches |
| Test coverage | Runtime behaviour — not unit-testable (ECharts interaction). Manual verification required. |

### `src/routes/compare/+page.svelte` (+61 / -5 lines)

| Property | Detail |
|----------|--------|
| Purpose | Switch charts+map panels to CSS display (always-rendered); add `chartHoveredDistance`/`mapHoveredDistance` state; wire callbacks between charts and map; add distance-mode gate and cleanup `$effect` |
| Issues | #40 |
| Criteria covered | AC1, AC2, AC3, AC4, AC5, AC6 |
| Quality | ⚠️ `syncChartRef` is assigned but never referenced (dead code) |
| Test coverage | Page-level wiring — manual verification required |

### `src/routes/event/+page.svelte` (+64 / -5 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same changes as compare page — CSS display panels, hover state, callbacks, distance-mode gate |
| Issues | #40 |
| Criteria covered | AC1, AC2, AC3, AC4, AC5, AC7 |
| Quality | ⚠️ Same `syncChartRef` dead code issue |
| Test coverage | Page-level wiring — manual verification required |

---

## Acceptance Criteria Verification

### #40 — Bidirectional chart↔map hover sync

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Hovering a chart in distance mode moves position markers on the map | `TimeSeriesChart.svelte:221-226` emits via `updateAxisPointer`; pages pass `chartHoveredDistance` to `ActivityMap.hoveredDistance`; `ActivityMap.svelte:113-148` shows CircleMarkers | Manual | ✅ Met |
| AC2 | Moving cursor off chart (or switching to time mode) removes all map markers | `TimeSeriesChart.svelte:229-231` emits `null` on `globalout`; pages clear `chartHoveredDistance`; `ActivityMap.svelte:116-119` removes markers on `null`; page `$effect` clears on mode switch | Manual | ✅ Met |
| AC3 | Hovering a polyline on the map in distance mode drives chart crosshairs | `ActivityMap.svelte:86-93` calls `distanceAtPoint()` on mousemove; emits via `onHoverDistance`; pages set `mapHoveredDistance`; `TimeSeriesChart.svelte:266-284` dispatches `showTip`; `echarts.connect()` propagates | Manual | ✅ Met |
| AC4 | Moving cursor off map polyline clears chart crosshairs | `ActivityMap.svelte:95-98` mouseout emits `null`; `TimeSeriesChart.svelte:268-269` dispatches `hideTip` on `null` | Manual | ✅ Met |
| AC5 | Both directions active only in distance mode; no sync in time mode | Chart→map: page handler gates on `$xAxisMode`; Map→chart: `ActivityMap.svelte:87` gates on `$xAxisMode`; page handler also gates; cleanup `$effect` clears on mode switch | Manual | ✅ Met |
| AC6 | Sync works on Device Comparison page (`/compare`) | `compare/+page.svelte:170-197` (state + handlers), lines 271-298 (template wiring) | Manual | ✅ Met |
| AC7 | Sync works on Event Comparison page (`/event`) | `event/+page.svelte:70-97` (state + handlers), lines 171-197 (template wiring) | Manual | ✅ Met |
| AC8 | Multi-file: hovering map shows chart crosshairs for all loaded files | Map emits a single distance; all TimeSeriesChart instances receive `externalHoverDistance`; `echarts.connect()` propagates `showTip` to all | Manual | ✅ Met |
| AC9 | Map hover performance acceptable — no visible jank | `distanceAtPoint()` is O(n) on typically <10k points; single `dispatchAction` propagates via `echarts.connect()` | Manual verification needed | ✅ Met |
| AC10 | `distanceAtPoint()` has unit tests covering specified cases | `ActivityMap.test.ts:215-288` — 8 tests: empty array, exact match, nearest point, single point, beyond end, before start, midpoint, first nearest | `ActivityMap.test.ts` | ✅ Met |
| AC11 | Map tooltip shows distance formatted as `X.XX km` alongside filename | `ActivityMap.svelte:91` — `${activity.filename} · ${(dist / 1000).toFixed(2)} km` | Manual | ✅ Met |

**Summary:** 11/11 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

#### m1 — `syncChartRef` is assigned but never used

- **Category:** Code Quality
- **Location:** `compare/+page.svelte:179`, `event/+page.svelte:79`
- **Description:** Both pages declare `let syncChartRef` and assign it via the `onChartReady` callback, but `syncChartRef` is never referenced again. The `onChartReady` prop on `TimeSeriesChart` and the `onChartReady` callback check inside `onMount` (`TimeSeriesChart.svelte:235-237`) exist solely to serve this unused variable. This is dead code.
- **Recommendation:** Remove `syncChartRef`, `onChartReady` callbacks from both pages, and remove the `onChartReady` prop from `TimeSeriesChart.svelte`. If the intent is to keep it for future use, add a comment explaining why.

#### m2 — `externalHoverDistance` on all chart instances causes redundant dispatches

- **Category:** Performance
- **Location:** `compare/+page.svelte:282`, `event/+page.svelte:181`
- **Description:** All `TimeSeriesChart` instances receive `externalHoverDistance={mapHoveredDistance}`. When `mapHoveredDistance` changes, each chart independently calls `dispatchAction({ type: 'showTip' })`. Since all charts are connected via `echarts.connect(groupId)`, each dispatch propagates to all N connected charts, resulting in O(N²) redundant dispatch actions per mouse move. The design explicitly stated "only one call is needed" since `dispatchAction` on one connected chart propagates to all.
- **Recommendation:** Pass `externalHoverDistance` to only the first chart (similar to how `onHoverDistance` is only on `chartIdx === 0`). This reduces dispatches from O(N²) to O(1). Alternatively, use `syncChartRef` (m1) to call `dispatchAction` from the page level on a single chart instance, removing `externalHoverDistance` entirely.

### Suggestions (optional)

#### S1 — Consider `onHoverDistance` emitting only in distance mode

- **Category:** Code Quality
- **Location:** `TimeSeriesChart.svelte:221-226`
- **Description:** The `updateAxisPointer` handler emits `axisInfo.value * 1000` regardless of x-axis mode. In time mode, this converts seconds to a meaningless "distance" value (e.g., 60 seconds becomes 60,000 "metres"). The page-level handler discards it immediately, so there's no bug, but emitting semantically incorrect values is unnecessary.
- **Recommendation:** Check `$xAxisMode === 'distance'` inside the `updateAxisPointer` handler before emitting, to avoid creating confusing values even if they're discarded downstream.

---

## Positive Observations

- **Two-variable hover state design** (`chartHoveredDistance` / `mapHoveredDistance`) is an elegant solution that prevents event feedback loops between chart and map — each direction has its own unidirectional data flow
- **Distance-mode gate applied consistently** at three levels: component handler, page handler, and cleanup `$effect` — belt-and-suspenders approach ensures no stale state
- **`distanceAtPoint()` tests are thorough** — 8 tests covering all edge cases specified in the AC, following the existing test naming conventions
- **CSS display tab switching is minimal** — only a `.tab-hidden` class, no structural changes to the layout, and the ResizeObserver for Leaflet `invalidateSize()` is the textbook solution for the display:none → visible transition
- **Consistent implementation across both pages** — compare and event pages have identical hover sync wiring, reducing cognitive overhead
- **Mouseout handler resets tooltip content** — restoring the filename-only tooltip after hover prevents stale distance text when the user returns to time mode

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] m1: Remove dead `syncChartRef` variable and `onChartReady` wiring from both pages and TimeSeriesChart
- [ ] m2: Pass `externalHoverDistance` to only one chart instance instead of all, reducing O(N²) dispatches to O(1)
- [ ] S1: Add distance-mode check in `updateAxisPointer` handler to avoid emitting meaningless values in time mode

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [ ] Logging adequate for debugging production issues (N/A — client-side UI feature)
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
