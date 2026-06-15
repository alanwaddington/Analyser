# PR #146 Review — perf: GPS downsampling and ECharts LTTB sampling (#109)

**Date:** 2026-06-15
**Author:** alanwaddington
**Branch:** feature/109-rendering-performance-downsampling → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 18/20 unique criteria met |

---

## Issues Reviewed

### Issue Hierarchy
- #109 — Perf: large activity rendering causes jank — add downsampling for charts and map (root)

No sub-issues or parent issues detected.

---

## Changed Files Audit

### `src/lib/components/map/ActivityMap.utils.ts` (+28 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `recordIndex` to `GpsPointWithDistance`, rewrite `extractGpsPoints()` as for-loop, add `metricValuesForGpsPoints()` |
| Issues | #109 Task 1 |
| Criteria covered | `recordIndex` field, correct index mapping, metric value lookup by recordIndex |
| Quality | ✅ Clean, follows existing patterns. Comment on `recordIndex` is brief and helpful |
| Test coverage | `ActivityMap.test.ts:extractGpsPoints_*`, `ActivityMap.metricExtraction.test.ts:metricValuesForGpsPoints_*` |

### `src/lib/analytics/downsample.ts` (+105 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New module: `downsampleGps()` with RDP + uniform-decimate fallback, `GPS_MAX_POINTS=500` |
| Issues | #109 Task 2 |
| Criteria covered | GPS downsampling function exists, pure, max 500 points, preserves recordIndex |
| Quality | ⚠️ See M1 finding (recursive RDP stack depth risk). Otherwise clean |
| Test coverage | `downsample.test.ts`: 11 tests covering empty, identity, straight line, corner, large, recordIndex |

### `src/lib/components/map/ActivityMap.svelte` (+5 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire `downsampleGps` into `gpsCache`, replace `extractGpsPointsWithMetric` with `metricValuesForGpsPoints` |
| Issues | #109 Task 3 |
| Criteria covered | Map uses ≤500 GPS points, metric colouring uses downsampled points |
| Quality | ✅ Minimal diff, correct reactive dependencies |
| Test coverage | Runtime-verified via Playwright during `/verify 146` |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+11 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `sampling: 'lttb'` to all line series, add `DOWNSAMPLE_THRESHOLD` warn, use `distanceStep()` in `buildData()` |
| Issues | #109 Task 4 |
| Criteria covered | LTTB sampling on line series, console.warn above 2000 points, adaptive distance step |
| Quality | ⚠️ See M2 finding (`buildAltitudeData` still hardcodes step 10) |
| Test coverage | Existing `TimeSeriesChart.test.ts` continues to pass |

### `src/lib/components/charts/DeltaChart.svelte` (+1 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `sampling: 'lttb'` to candidate line series |
| Issues | #109 Task 4 |
| Criteria covered | LTTB sampling on DeltaChart line series |
| Quality | ✅ Minimal, correct placement |
| Test coverage | Existing `DeltaChart.test.ts` continues to pass |

### `src/lib/components/charts/DeltaChart.utils.ts` (+2 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace hardcoded `10` with `distanceStep(maxDist)` in `buildDeltaData` |
| Issues | #109 Task 4 |
| Criteria covered | Adaptive distance step in delta computation |
| Quality | ✅ Correct — `maxDist` is in metres (from `getClipDistance`) |
| Test coverage | Existing `DeltaChart.test.ts` continues to pass |

### `src/lib/align/distance.ts` (+13 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `distanceStep()`, `LONG_ACTIVITY_THRESHOLD_M`, `STEP_SHORT_M`, `STEP_LONG_M` |
| Issues | #109 Task 4 |
| Criteria covered | Adaptive distance step function, threshold at 50 km |
| Quality | ✅ Pure function, well-named constants |
| Test coverage | `distance.test.ts:distanceStep_*` (5 tests) |

### `src/lib/align/distance.test.ts` (+26 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add 5 tests for `distanceStep`, update import |
| Issues | #109 |
| Quality | ✅ Covers short, exact threshold, long, very long, zero |
| Test coverage | N/A (is test file) |

### `src/lib/analytics/downsample.test.ts` (+132 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New test file for `downsampleGps` with 11 test cases |
| Issues | #109 |
| Quality | ✅ Thorough: empty, single, identity, straight line, corner, large input, recordIndex, cap |
| Test coverage | N/A (is test file) |

### `src/lib/components/map/ActivityMap.test.ts` (+18 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Update `extractGpsPoints` tests to expect `recordIndex`, add new `recordIndex` mapping test |
| Issues | #109 |
| Quality | ✅ Correct fixture updates |
| Test coverage | N/A (is test file) |

### `src/lib/components/map/ActivityMap.metricExtraction.test.ts` (+63 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `metricValuesForGpsPoints` tests, update `extractGpsPointsWithMetric` fixtures for `recordIndex` |
| Issues | #109 |
| Quality | ✅ 5 new tests covering empty, recordIndex lookup, null, preservation, multiple points |
| Test coverage | N/A (is test file) |

---

## Acceptance Criteria Verification

### #109 — Perf: large activity rendering causes jank — add downsampling for charts and map

The issue contains duplicate criteria in the Analysis and Design sections. Deduplicated to 20 unique criteria:

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `GpsPointWithDistance` has `recordIndex: number` field (required, not optional) | `ActivityMap.utils.ts:72` | `ActivityMap.test.ts:196-204` | ✅ Met |
| 2 | `extractGpsPoints` returns points where `recordIndex` matches original array position | `ActivityMap.utils.ts:75-83` | `ActivityMap.test.ts:207-220` | ✅ Met |
| 3 | Records without `position` are excluded; `recordIndex` skips correctly | `ActivityMap.utils.ts:79` | `ActivityMap.test.ts:207-220` | ✅ Met |
| 4 | `metricValuesForGpsPoints` returns `GpsPointWithMetric[]` using `smoothedValues[point.recordIndex]` | `ActivityMap.utils.ts:148-159` | `ActivityMap.metricExtraction.test.ts:metricValuesForGpsPoints_*` | ✅ Met |
| 5 | Existing `extractGpsPoints` and `positionFromPoints` tests still pass | Test suite | 737/737 pass | ✅ Met |
| 6 | `metricValuesForGpsPoints_emptyInput_returnsEmpty` test passes | — | `ActivityMap.metricExtraction.test.ts:126` | ✅ Met |
| 7 | `metricValuesForGpsPoints_nullSmoothedValue_returnsNullMetric` test passes | — | `ActivityMap.metricExtraction.test.ts:133` | ✅ Met |
| 8 | `metricValuesForGpsPoints_usesRecordIndex_notFilteredIndex` test passes | — | `ActivityMap.metricExtraction.test.ts:127` | ✅ Met |
| 9 | `downsampleGps` function exists, is pure, covered by unit tests | `downsample.ts:94-105` | `downsample.test.ts` (11 tests) | ✅ Met |
| 10 | Map polyline uses at most 500 GPS points | `ActivityMap.svelte:41` (`GPS_MAX_POINTS`) | `downsample.test.ts:91-101,120-131` | ✅ Met |
| 11 | Each downsampled point includes `recordIndex: number` | `downsample.ts` preserves original points; `GpsPointWithDistance` type enforces field | `downsample.test.ts:103-118` | ✅ Met |
| 12 | `activity.records` is not modified by downsampling | Code inspection: only `extractGpsPoints` creates new objects; records array untouched | Structural | ✅ Met |
| 13 | Downsampling does not activate for ≤ 500 GPS points (map) or ≤ 2,000 (charts) | `downsample.ts:99` returns input reference; `DOWNSAMPLE_THRESHOLD` warn only | `downsample.test.ts:39-53` | ✅ Met |
| 14 | `TimeSeriesChart` series include `sampling: 'lttb'` | `TimeSeriesChart.svelte:180,200` | Runtime verified (LTTB warns observed in Playwright) | ✅ Met |
| 15 | `DeltaChart` series include `sampling: 'lttb'` | `DeltaChart.svelte:55` | Code inspection | ✅ Met |
| 16 | `distanceStep` returns 10 for ≤50km, 20 for >50km | `distance.ts:71-73` | `distance.test.ts:193-216` (5 tests) | ✅ Met |
| 17 | `console.warn` fires when `seriesData.length > 2000` | `TimeSeriesChart.svelte:192-194` | Runtime verified: 6 LTTB warns for 65km activity | ✅ Met |
| 18 | All existing `distance.test.ts`, `TimeSeriesChart` and `DeltaChart` tests pass | Test suite | 737/737 pass | ✅ Met |
| 19 | `extractGpsPointsWithMetric()` no longer called from production `.svelte` code | `ActivityMap.svelte` only imports `metricValuesForGpsPoints`; line 79 is a comment | Code inspection | ✅ Met |
| 20 | `buildAltitudeData` uses `distanceStep()` (Design Task 4 specifies all distance callers) | `TimeSeriesChart.svelte:73` — **still hardcodes `10`** | — | ⚠️ Partially Met |

**Summary:** 19/20 criteria met, 1 partially met.

---

## Findings

### Major (should fix)

#### M1 — Recursive RDP may stack overflow on very large GPS traces

- **Category:** Reliability
- **Location:** `src/lib/analytics/downsample.ts:33-60`
- **Description:** `rdpRecurse` is purely recursive. In the pathological case (GPS data already sorted so every split picks the adjacent index), recursion depth equals the array length. With a 3-hour ride at 1 Hz (10,800 GPS points), this approaches the V8 stack limit (~15K frames). Browser environments may have even lower limits. Normal GPS data won't hit this because RDP splits near the middle, giving O(log n) depth — but degenerate data (e.g. a perfectly straight road) could trigger it.
- **Recommendation:** Convert to an iterative stack-based implementation, or add a depth guard that falls back to uniform decimate when recursion exceeds a safe limit. This is a low-probability edge case but easy to fix preventively.

#### M2 — `buildAltitudeData` still hardcodes distance step to 10m

- **Category:** Performance
- **Location:** `src/lib/components/charts/TimeSeriesChart.svelte:73`
- **Description:** The Design (Task 4) specifies that all callers of `interpolateToDistanceAxis` should use `distanceStep()`. `buildData()` at line 85 was updated correctly, but `buildAltitudeData()` at line 73 still passes a hardcoded `10`. For a 65km ride, this means the altitude backdrop computes 6,500 points while the main series computes 3,250 — a 2x discrepancy and wasted computation.
- **Recommendation:** Change line 73 from `interpolateToDistanceAxis(activity, 10, distanceOffset)` to `interpolateToDistanceAxis(activity, distanceStep(activity.totalDistance), distanceOffset)`.

### Minor (nice to fix)

#### m1 — Stale comment references `extractGpsPointsWithMetric`

- **Category:** Code Quality
- **Location:** `src/lib/components/map/ActivityMap.svelte:79`
- **Description:** Comment says "avoiding duplicate smooth() + extractGpsPointsWithMetric() work" but the code now calls `metricValuesForGpsPoints()`. The comment should be updated.
- **Recommendation:** Update the comment to reference `metricValuesForGpsPoints` instead.

### Suggestions (optional)

#### S1 — `downsample.ts` imports type from a component path

- **Category:** Code Quality
- **Location:** `src/lib/analytics/downsample.ts:1`
- **Description:** `downsample.ts` (an analytics module) imports `GpsPointWithDistance` from `$lib/components/map/ActivityMap.utils`. This creates a dependency from an analytics module to a component module, inverting the usual dependency direction. The type is purely a data shape and could live in `$lib/types.ts`.
- **Recommendation:** Consider extracting `GpsPointWithDistance` and `GpsPointWithMetric` to `$lib/types.ts` in a follow-up.

---

## Positive Observations

- **TDD discipline visible in commit history:** Each commit adds tests before production code; 16 new tests across 3 test files.
- **Zero-overhead design for short activities:** `downsampleGps` returns the input array *by reference* when `points.length <= maxPoints`, avoiding any allocation. The `DOWNSAMPLE_THRESHOLD` warn is informational only — `sampling: 'lttb'` is always set (ECharts no-ops when data fits).
- **Clean #117 interface contract:** `recordIndex` is required on every `GpsPointWithDistance` and survives downsampling. Issue #117 can consume it with no refactor.
- **Minimal surface area:** 5 production files changed (4 modified, 1 new), clean separation of concerns between downsample logic and component wiring.
- **737/737 tests passing** with no modifications to existing test logic — only fixture updates for the new required `recordIndex` field.

---

## Action Items

### Immediate Fixes (should fix before merge)
- [ ] M2: Update `buildAltitudeData` at `TimeSeriesChart.svelte:73` to use `distanceStep(activity.totalDistance)` instead of hardcoded `10`

### Post-merge improvements
- [ ] M1: Convert recursive RDP to iterative stack-based — create issue via `/analyse`
- [ ] m1: Update stale comment at `ActivityMap.svelte:79`
- [ ] S1: Extract `GpsPointWithDistance`/`GpsPointWithMetric` to `$lib/types.ts`

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions (net improvement)
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues (LTTB console.warn)
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
