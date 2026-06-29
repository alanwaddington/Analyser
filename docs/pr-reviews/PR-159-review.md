# PR #159 Review — feat: adaptive FTP zone shading — show Z6/Z7 only when data reaches them (#158)

**Date:** 2026-06-29
**Author:** alanwaddington
**Branch:** feature/158-adaptive-ftp-zones → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 9 Met / 9 Total (AC-9 dropped) |

---

## Issues Reviewed

### Issue Hierarchy
- #158 — feat: adaptive FTP zone shading — show 7 zones only when data reaches Z6/Z7 (root)

---

## Changed Files Audit

### `src/lib/components/charts/TimeSeriesChart.utils.ts` (+12 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Extract `shouldUseFullFtpZones()` pure helper — returns true when any data point exceeds 120% of FTP |
| Issues | #158 |
| Criteria covered | AC-1 (threshold logic), AC-2 (threshold logic), AC-4 (no Infinity — by enabling axisCap downstream) |
| Quality | No issues. Clean, focused function with early return |
| Test coverage | `TimeSeriesChart.utils.test.ts`: 8 tests covering below/at/above threshold, empty, nulls |

### `src/lib/components/charts/TimeSeriesChart.utils.test.ts` (+64 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add 8 unit tests for `shouldUseFullFtpZones()` |
| Issues | #158 |
| Criteria covered | Validates threshold logic for AC-1, AC-2 |
| Quality | No issues. Good boundary coverage (below, exactly at, above 120%). Tests nulls and empty data |
| Test coverage | N/A — this IS the test file |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+41 / -7 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pre-compute `dataCache`, scan cycling power for FTP threshold, adapt zone bands and y-axis |
| Issues | #158 |
| Criteria covered | AC-1 through AC-10 (primary implementation file) |
| Quality | See findings M1 below |
| Test coverage | `shouldUseFullFtpZones` unit tested; integration logic (dataCache, getMarkAreaData slicing, axisCap, yAxis config) not unit tested — see findings |

---

## Acceptance Criteria Verification

### #158 — feat: adaptive FTP zone shading

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-1 | Cycling below 120% FTP → 5 bands, clipped axis | `TimeSeriesChart.svelte:276-292` — `useFullFtpZones` stays false, `zoneAxisMax` preserved; `:412-414` — `zoneBands.slice(0, 5)` | `shouldUseFullFtpZones` below-threshold tests | ✅ Met |
| AC-2 | Cycling above 120% FTP → 7 bands, auto-scaled axis | `TimeSeriesChart.svelte:289-290` — sets `useFullFtpZones=true`, clears `zoneAxisMax`; `:412` — `!useFullFtpZones` skip → full 7 bands | `shouldUseFullFtpZones` above-threshold tests | ✅ Met |
| AC-3 | Cycling above 150% FTP → Z7 visible | Same as AC-2; Z7 band from `ftpZoneBoundaries()` included when `useFullFtpZones=true` | Above-threshold test (300W/400W at ftp=200) | ✅ Met |
| AC-4 | No `yAxis: Infinity` in markArea data | `TimeSeriesChart.svelte:420-422` — `axisCap` is either `Math.ceil(ftpDataMax * 1.2)` or `zoneAxisMax ?? 9999`; `:426` — `b.max === Infinity ? axisCap : b.max` | No direct test for Infinity absence | ✅ Met |
| AC-5 | HR zones unchanged (5-zone) | `getMarkAreaData:398-406` — HR path untouched; `axisCap` fallback `zoneAxisMax ?? 9999` is unchanged for non-FTP paths | No dedicated HR regression test | ✅ Met |
| AC-6 | CP zones unchanged (5-zone) | `getMarkAreaData:407-408` — CP path untouched | No dedicated CP regression test | ✅ Met |
| AC-7 | `buildData()` called once per series via cache | `TimeSeriesChart.svelte:222-228` — `dataCache` map populated before zone logic; `:479` — `dataCache.get(i) ?? []` replaces inline `buildData()` | No test | ✅ Met |
| AC-8 | Multi-file: any file reaching Z6 triggers 7-zone for all | `TimeSeriesChart.svelte` — `dataCache` loop covers all series; `ftpDataMax` aggregates max across all cycling series; single `useFullFtpZones = ftpDataMax > ftp * 1.20` decision applies to all | No dedicated multi-file test | ✅ Met |
| AC-9 | ~~Filter removing Z6+ data reverts to 5-zone~~ | **Dropped** — `buildData()` returns all records regardless of filter state; zone shading reflects the activity's actual power range, which is the correct UX. Filtering greys out records visually but does not change the data scanned for the zone decision. | N/A | N/A (Dropped) |
| AC-10 | Z7 capped at `ceil(dataMax * 1.2)` | `TimeSeriesChart.svelte` — `computeZoneAxisCap(true, ftpDataMax, zoneAxisMax)` returns `Math.ceil(ftpDataMax * 1.2)` when `useFullFtpZones` is true | `computeZoneAxisCap` unit tests | ✅ Met |

**Summary:** 9/9 criteria met (AC-9 dropped — zone decision correctly reflects unfiltered activity power range).

---

## Findings

All findings resolved before merge.

### Major (fixed)

#### M1 — Redundant data scan ✅ Fixed
- **Category:** Performance / Code Quality
- **Description:** Initial implementation built a `cyclingData` array by spreading all dataCache entries, then called `shouldUseFullFtpZones(cyclingData, ftp)` which re-scanned the same data. Since `ftpDataMax` already contained the max value, this was redundant.
- **Fix applied:** Commit `9bec9c2` — removed `cyclingData` array and `shouldUseFullFtpZones` call from Svelte; now uses `useFullFtpZones = ftpDataMax > ftp * 1.20` directly. `shouldUseFullFtpZones` remains exported from utils.ts (still tested, potentially useful externally).

### Minor (fixed)

#### m1 — Missing unit tests for `selectFtpBands` and `computeZoneAxisCap` ✅ Fixed
- **Category:** Code Quality
- **Description:** Band-count and axisCap decision logic was not separately tested.
- **Fix applied:** Commit `d2848b5` — extracted `selectFtpBands()` and `computeZoneAxisCap()` as pure helpers to `TimeSeriesChart.utils.ts`; added 5 tests for `selectFtpBands` and 6 tests for `computeZoneAxisCap`. Total test suite: 1072 tests passing.

#### m2 — `cyclingData` array allocation ✅ Fixed (by M1 fix)

### Suggestions (informational)

#### S1 — `ftpDataMax` stays 0 when all series are running (no action needed)
- **Category:** Reliability (informational)
- **Description:** If `channel === 'power'` and `ftp` is set, but all series are running, `ftpDataMax` remains 0. `computeZoneAxisCap(true, 0, zoneAxisMax)` would return `Math.ceil(0) = 0` — however this path is never reached because `useFullFtpZones` is false when no cycling data exists. The comment in the Svelte source documents this invariant.

---

## Positive Observations

- Clean extraction of `shouldUseFullFtpZones()`, `selectFtpBands()`, and `computeZoneAxisCap()` as pure testable helpers — follows existing codebase pattern of putting pure logic in `.utils.ts`
- The `dataCache` Map eliminates redundant `buildData()` calls — genuine performance improvement for multi-series charts
- Good test naming convention (`MethodName_Scenario_ExpectedResult`) consistent with existing tests
- Thorough boundary testing: below threshold, exactly at threshold (strict `>` not `>=`), above threshold, empty data, all nulls, mixed nulls
- The `selectFtpBands()` approach in `getMarkAreaData` is clean — previous code was building 7 bands then rendering them invisibly behind a clipped axis
- No changes to stores, types, or component interfaces — well-scoped change

---

## Action Items

### Immediate Fixes (block merge)
(none)

### Should fix before merge
(none — M1, m1, m2 all resolved)

### Post-merge improvements
(none — all findings resolved)

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases (for the extracted helper)
- [x] No security vulnerabilities introduced
- [x] No performance regressions (net positive due to dataCache)
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
