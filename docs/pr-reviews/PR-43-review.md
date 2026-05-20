# PR #43 Review — feat: Create ActivityMap.svelte component (#16)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/16-activity-map → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 23/23 met |

---

## Issues Reviewed

### Issue Hierarchy
- #16 — Step 16: Create ActivityMap.svelte component (Leaflet) (standalone)

---

## Changed Files Audit

### `src/lib/components/map/ActivityMap.utils.ts` (+40 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure functions for GPS point extraction and position interpolation at a given distance |
| Issues | #16 |
| Criteria covered | AC5, AC6, AC18, AC19, AC21 |
| Quality | Clean, follows binary search + lerp pattern from `delta.ts` and `align/distance.ts`. `extractGpsPoints` filters on `position !== undefined` then maps to `{ lat, lon, distance }`. `positionAtDistance` does binary search on GPS-bearing records only, with null returns for no coverage/beyond range. |
| Test coverage | `ActivityMap.test.ts` — 13 tests covering both functions |

### `src/lib/components/map/ActivityMap.test.ts` (+171 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `positionAtDistance` and `extractGpsPoints` |
| Issues | #16 |
| Criteria covered | AC22 |
| Quality | Well-structured with `makeRecord` and `makeActivity` helpers matching codebase conventions. Tests cover: happy path, exact match, start position, no GPS, beyond records, empty records, partial GPS, interpolation accuracy, filtering, empty returns, lat/lon/distance tuple verification. |
| Test coverage | N/A — this is the test file |

### `src/lib/components/map/ActivityMap.svelte` (+141 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Leaflet map component with polylines, reference dashing, crosshair markers, tooltips |
| Issues | #16 |
| Criteria covered | AC1, AC2, AC3, AC4, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC14, AC15, AC16, AC17, AC20, AC23 |
| Quality | Follows the established lifecycle pattern. Separate `$effect`s for polylines vs markers (performance-aware). Marker reuse via `setLatLng()`. Proper cleanup in `onDestroy`. `interactive: false` on markers prevents hover interference. |
| Test coverage | Type-checked via `npm run check`; component not unit-testable in Vitest node env (Leaflet requires DOM — expected, matches codebase pattern) |

---

## Acceptance Criteria Verification

### #16 — Step 16: Create ActivityMap.svelte component (Leaflet)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Component file at `ActivityMap.svelte` | `src/lib/components/map/ActivityMap.svelte` exists | N/A | ✅ Met |
| AC2 | Dynamic Leaflet import in `onMount` | `ActivityMap.svelte:24-25` — `await import('leaflet')` and CSS import inside `onMount` | N/A | ✅ Met |
| AC3 | OSM tile layer with attribution | `ActivityMap.svelte:29-32` — correct URL template and attribution string | N/A | ✅ Met |
| AC4 | Polyline per activity, coloured by FILE_COLOURS | `ActivityMap.svelte:47-48` — `FILE_COLOURS[i % FILE_COLOURS.length]` | N/A | ✅ Met |
| AC5 | GPS points extracted, no-position filtered | `ActivityMap.utils.ts:10-13` — `filter(r => r.position !== undefined)` | `extractGpsPoints_filtersOutNoPosition` | ✅ Met |
| AC6 | Zero GPS activities produce no polyline | `ActivityMap.svelte:49` — `if (gpsPoints.length === 0) continue` | `extractGpsPoints_emptyRecords_returnsEmpty` | ✅ Met |
| AC7 | Auto-fit bounds on draw and activity change | `ActivityMap.svelte:64-68` — `fitBounds` with padding, or fallback setView | N/A | ✅ Met |
| AC8 | Reference polyline uses SVG renderer + `ref-polyline` class | `ActivityMap.svelte:54-55` — conditional `L.svg()` renderer and `className` | N/A | ✅ Met |
| AC9 | `:global(.ref-polyline) { stroke-dasharray: 8 6; }` | `ActivityMap.svelte:131` — `:global(.ref-polyline path) { stroke-dasharray: 8 6; }` (targets inner `<path>`) | N/A | ✅ Met |
| AC10 | Non-reference polylines render solid | `ActivityMap.svelte:54-55` — `renderer: undefined`, no className when not ref | N/A | ✅ Met |
| AC11 | All solid when `referenceIndex` undefined | `ActivityMap.svelte:53` — `isRef` is false when `referenceIndex` is undefined | N/A | ✅ Met |
| AC12 | `$effect` redraws on activities/referenceIndex change | `ActivityMap.svelte:38-70` — `void activities; void referenceIndex;` tracked | N/A | ✅ Met |
| AC13 | `onDestroy` calls `map.remove()` | `ActivityMap.svelte:35` — `map?.remove()` | N/A | ✅ Met |
| AC14 | `hoveredDistance: number | null` prop accepted | `ActivityMap.svelte:10,14` — declared in `$props()` | N/A | ✅ Met |
| AC15 | CircleMarker at interpolated position when hoveredDistance non-null | `ActivityMap.svelte:79-99` — creates `L.circleMarker` with `positionAtDistance` result | N/A | ✅ Met |
| AC16 | Markers use file colour, radius 5–6px | `ActivityMap.svelte:88-93` — `radius: 5`, `fillColor: colour` | N/A | ✅ Met |
| AC17 | Markers removed when hoveredDistance null | `ActivityMap.svelte:75-78` — removes all markers, resets array | N/A | ✅ Met |
| AC18 | Binary search + linear interpolation in utils | `ActivityMap.utils.ts:19-37` — binary search on GPS records, linear lat/lon lerp | `positionAtDistance_happyPath`, `positionAtDistance_interpolationAccuracy` | ✅ Met |
| AC19 | No GPS coverage → no marker (no error) | `ActivityMap.utils.ts:19-20` — returns null for empty points; `ActivityMap.svelte:82-85` — skips null | `positionAtDistance_noGpsData_returnsNull` | ✅ Met |
| AC20 | Previous polylines removed before redraw | `ActivityMap.svelte:42-43` — `for (const p of polylines) p.remove()` | N/A | ✅ Met |
| AC21 | Exports `positionAtDistance` and `extractGpsPoints` | `ActivityMap.utils.ts:10,16` — both exported | Type-checked via imports | ✅ Met |
| AC22 | Tests cover positionAtDistance: happy path, no GPS, beyond, accuracy | `ActivityMap.test.ts` — 8 tests for `positionAtDistance`, 5 for `extractGpsPoints` | All 13 passing | ✅ Met |
| AC23 | `npm run check` passes 0 errors 0 warnings | 385 files, 0 errors, 0 warnings | N/A | ✅ Met |

**Summary:** 23/23 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

#### S1 — Consider caching `extractGpsPoints` with `$derived` for marker `$effect`

- **Category:** Performance
- **Location:** `ActivityMap.svelte:80`
- **Description:** The marker `$effect` calls `positionAtDistance(activities[i], hoveredDistance)` on every hover event. `positionAtDistance` internally calls `extractGpsPoints` which allocates a new filtered array each time. For activities with thousands of records, this runs on every mouse move. Caching `extractGpsPoints` per activity with `$derived` (like `seriesDeltas` in SegmentChart) would avoid repeated allocations.
- **Recommendation:** Optional optimisation. The binary search is O(log n) per call so the total cost is still low. Only worth doing if profiling shows jank with large GPS datasets. No code change needed for merge.

---

## Positive Observations

- **Separate `$effect`s for polylines vs markers**: Polylines redraw only on activity/reference changes (rare); markers update on hover (frequent). This avoids expensive full map redraws on every mouse move — thoughtful performance design.
- **Marker reuse with `setLatLng()`**: Avoids remove/recreate cycle which would cause visual flicker. Clean pattern.
- **Smart `positionAtDistance`**: Works on GPS-bearing records only (filters first, then binary searches) — correctly handles mixed GPS/non-GPS records in a single activity.
- **Consistent patterns**: Same binary search + lerp pattern as `timeAtDistance` in `delta.ts`. Same lifecycle pattern (`onMount`/`onDestroy`/`$effect`) as all chart components.
- **Accessibility**: `role="img"` and `aria-label="GPS route map"` on the map container.
- **Comprehensive test coverage**: 13 tests covering happy path, edge cases (empty, no GPS, partial GPS, beyond range), exact match, and interpolation accuracy.
- **CSS transition for smooth animation**: Elegant use of SVG `cx`/`cy` transitions — no JS animation library needed.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] S1: Consider `$derived` cache for `extractGpsPoints` per activity if profiling shows hover jank with large datasets

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
