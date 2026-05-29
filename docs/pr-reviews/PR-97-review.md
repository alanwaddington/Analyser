# PR #97 Review — Fix: Lap markers collapse to wrong position when FIT file uses per-lap start_distance (#94)

**Date:** 2026-05-29
**Author:** alanwaddington
**Branch:** feature/94-fix-lap-start-distance → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 8/8 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #94 — Lap markers collapse to wrong position when FIT file uses per-lap start_distance (standalone — no parent/child issues)

---

## Changed Files Audit

### `src/lib/fit/parser.ts` (+9 / -5 lines)

| Property | Detail |
|----------|--------|
| Purpose | Fix `buildLaps()` to derive `startDistance` from the running cursor position (`prevEndDist`) instead of the FIT lap's `start_distance` field; change `<` to `<=` in cursor-advance loop; use `Math.max` to prevent backward `endIndex` |
| Issues | #94 |
| Criteria covered | AC1–AC5, AC7 (core fix logic) |
| Quality | ✅ No issues — minimal, focused change |
| Test coverage | `parser.test.ts`: 8 new tests in `buildLaps` describe block |

### `src/lib/fit/parser.test.ts` (+110 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `buildLaps` import and 8 unit tests covering the bug scenario, regression, edge cases, and boundary conditions |
| Issues | #94 |
| Criteria covered | AC4, AC5, AC7, AC8 |
| Quality | ✅ Good test structure — helper factories (`makeRecord`, `makeRecords`), clear naming convention, covers happy path and edges |
| Test coverage | N/A — this is the test file |

---

## Acceptance Criteria Verification

### #94 — Lap markers collapse to wrong position when FIT file uses per-lap start_distance

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Loading Drumpellier file: 5 lap markers at ~1–5 km in distance mode | `parser.ts:405-424` — `prevEndDist` tracking fixes cumulative calculation | Runtime verified via Playwright screenshots | ✅ Met |
| AC2 | Same file in time mode: markers at correct elapsed seconds | `parser.ts:412` — `<=` ensures correct endIndex; `lapMarkers.ts:13` reads `elapsedSeconds` from correct `startIndex` | Runtime verified via Playwright | ✅ Met |
| AC3 | File with cumulative start_distance (Ayr_Parkrun_3): no regression | `parser.ts:410` — `prevEndDist` naturally tracks cumulative distance from records, producing identical results for correct files | `buildLaps_cumulativeStartDistance_producesCorrectSpans` | ✅ Met |
| AC4 | `buildLaps()` returns laps with monotonically increasing `startDistance` | `parser.ts:410` — `startDist = prevEndDist` guarantees monotonic increase since cursor only advances forward | `buildLaps_allZeroStartDistance_producesMonotonicallyIncreasingStartDistances` | ✅ Met |
| AC5 | `buildLaps()` returns laps where `startIndex ≤ endIndex` for non-zero `total_distance` | `parser.ts:413` — `Math.max(startIndex, cursor - 1)` prevents backward `endIndex` | `buildLaps_allZeroStartDistance_eachLapHasNonZeroSpan` | ✅ Met |
| AC6 | Single-lap file: fallback to 1 km markers still works | `parser.ts:405-424` — single lap produces valid span covering full activity; km-marker fallback is handled by `lapMarkers.ts` which is unchanged | `buildLaps_singleLap_coversFullActivity` | ✅ Met |
| AC7 | Empty laps array: returns empty array (no crash) | `parser.ts:408` — `fitLaps.map()` on empty array returns `[]` | `buildLaps_emptyFitLaps_returnsEmptyArray` | ✅ Met |
| AC8 | All existing tests pass; new tests cover zero-start_distance case | 588 tests passing (80 in parser.test.ts) | Full suite verified | ✅ Met |

**Summary:** 8/8 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

#### m1 — Zero-distance lap produces one-record span with non-zero distance
- **Category:** Reliability (edge case)
- **Location:** `parser.ts:412-413`
- **Description:** When a FIT lap has `total_distance: 0` in the middle of an activity, `targetDist == prevEndDist`, so the `<=` loop doesn't advance the cursor. `Math.max(startIndex, cursor - 1)` then sets `endIndex = startIndex`, giving the zero-distance lap a one-record span. That record's actual distance (e.g. 1010 m) becomes `endDistance`, causing `prevEndDist` to shift slightly. The next lap then starts from `cursor` which is the same record — meaning record `startIndex` appears in two consecutive laps.

  This is strictly an improvement over the old code (which produced `endIndex < startIndex` — an invalid backward span). Zero-distance laps are extremely rare in real FIT files (typically only from manual lap-button double-taps) and the current behavior doesn't crash or produce visibly wrong results.
- **Recommendation:** No action needed for this PR. If zero-distance laps become a real concern, a future fix could skip the `Math.max` guard and instead explicitly handle `total_distance === 0` laps as zero-length entries (same index for start/end, same distance for start/end).

### Suggestions

#### S1 — Test could assert exact startDistance values for zero-start_distance case
- **Category:** Test coverage
- **Description:** The `buildLaps_allZeroStartDistance_producesMonotonicallyIncreasingStartDistances` test asserts monotonic increase but doesn't check that `laps[1].startDistance ≈ 1000`, `laps[2].startDistance ≈ 2000`, etc. Adding `toBeCloseTo` assertions would confirm the actual km positions, not just the ordering.
- **Recommendation:** Optional — the current assertions are sufficient for the bug fix; the cumulative test already covers exact values.

---

## Positive Observations

- **Minimal, surgical fix** — only 14 lines of production code changed, all within a single function. Zero changes needed in downstream consumers (`lapMarkers.ts`, `segments.ts`) because the `Lap` interface contract is preserved.
- **`prevEndDist` design** — elegant solution that works for both broken (all-zero) and correct (cumulative) `start_distance` formats without needing to detect which format is in use.
- **`Math.max` guard** — prevents the `endIndex < startIndex` invalid span that existed in the old code when the cursor didn't advance (e.g. zero-distance laps or the original bug scenario).
- **Comprehensive test coverage** — 8 tests cover the core bug reproduction, regression guard, empty inputs, single-lap, boundary contiguity, and field preservation. The test helper factories (`makeRecords`) are clean and reusable.
- **Runtime verification** — Playwright screenshots confirm the fix at the rendered surface for both the broken file and a regression file, in both distance and time modes.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements
- [ ] m1: Zero-distance lap edge case — consider handling if real-world files surface this pattern

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
