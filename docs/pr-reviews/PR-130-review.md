# PR #130 Review — Perf: extract shared lowerBound binary search utility (#99)

**Date:** 2026-06-03
**Author:** alanwaddington
**Branch:** feature/99-extract-lower-bound-utility → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 15/15 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #99 — Perf: extract shared binary search utility used in 4+ modules (root — contains Analysis and Design)

---

## Changed Files Audit

### `src/lib/utils/binarySearch.ts` (+16 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New generic `lowerBound<T>()` utility implementing the standard lower-bound binary search algorithm |
| Issues | #99 |
| Criteria covered | AC-1 (single utility exported), AC-2 (returns index of first element ≥ target or arr.length) |
| Quality | ✅ Clean, minimal, well-documented with JSDoc. Standard algorithm using `hi = arr.length` (not `arr.length - 1`) for correct beyond-range behaviour. Uses `>> 1` for midpoint (matches existing codebase convention from the replaced code). |
| Test coverage | `binarySearch.test.ts` — 11 tests covering all contract cases |

### `src/lib/utils/binarySearch.test.ts` (+51 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Comprehensive unit tests for `lowerBound` |
| Issues | #99 |
| Criteria covered | AC-3 (full test coverage: empty array, below min, exact match first/last, between elements, above max, single element, duplicates, objects via key function) |
| Quality | ✅ Tests follow existing project conventions (vitest, describe/it/expect). Names use `MethodName_Scenario_ExpectedResult` pattern. Each test is a single assertion. |
| Test coverage | N/A (this is the test file) |

### `src/lib/align/distance.ts` (+2 / -8 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace inline binary search loop in `lerp()` with `lowerBound()` call |
| Issues | #99 |
| Criteria covered | AC-4 (lerp uses lowerBound), AC-5 (Math.min clamp present) |
| Quality | ✅ Mechanical replacement. `Math.min(lowerBound(...), records.length - 1)` correctly preserves the old behaviour where `hi = length - 1` would land on the last index for beyond-range targets. All post-search logic (exact match check, lo === 0 guard, null-channel handling, zero-span guard) is unchanged. |
| Test coverage | `distance.test.ts` — 10 existing tests pass (trailing duplicates, NaN guard, normal interpolation, distanceOffset re-zeroing, computeTimeDelta integration) |

### `src/lib/compare/delta.ts` (+2 / -8 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace inline binary search loop in `timeAtDistance()` with `lowerBound()` call |
| Issues | #99 |
| Criteria covered | AC-6 (timeAtDistance uses lowerBound), AC-7 (Math.min clamp present) |
| Quality | ✅ Identical pattern to `lerp()` replacement. Post-search logic (lo === 0 guard, duplicate distance guard, interpolation) is unchanged. |
| Test coverage | No dedicated `delta.test.ts`, but `distance.test.ts` includes `computeTimeDelta` integration tests (lines 149–189) that exercise `timeAtDistance` indirectly. 611 full-suite tests pass. |

### `src/lib/components/map/ActivityMap.utils.ts` (+3 / -10 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace inline binary search loop in `positionFromPoints()` with `lowerBound()` call. Replace old beyond-range check with index bounds check. |
| Issues | #99 |
| Criteria covered | AC-8 (positionFromPoints uses lowerBound), AC-9 (beyond-range via `lo >= points.length`) |
| Quality | ✅ Cleaner than the original — the old `if (points[lo].distance < targetDist) return null` is replaced by the more direct `if (lo >= points.length) return null`. Semantically equivalent given lowerBound's contract. No `Math.min` clamp needed here because `positionFromPoints` explicitly handles beyond-range by returning null. Post-search logic (lo === 0 guard, duplicate distance guard, interpolation) is unchanged. |
| Test coverage | `ActivityMap.test.ts` — 34 existing tests pass including: happy path interpolation, exact match, at-start, beyond-range returns null, empty records, partial GPS data |

---

## Acceptance Criteria Verification

### #99 — Perf: extract shared binary search utility used in 4+ modules

#### Original Issue Acceptance Criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | Single `binarySearch.ts` utility with full test coverage | `binarySearch.ts` (16 lines), `binarySearch.test.ts` (11 tests) | `binarySearch.test.ts` | ✅ Met |
| 2 | All four call sites replaced | 3 call sites across 3 files replaced (the issue over-counted: "delta.ts" and "timeAtDistance() in delta.ts" are the same site) | Existing tests pass at all 3 sites | ✅ Met |
| 3 | No behavioural change (existing tests still pass) | All 611 tests pass | Full test suite | ✅ Met |

#### Analysis Section Acceptance Criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 4 | `binarySearch.ts` exports `lowerBound<T>(arr, key, target): number` | `binarySearch.ts:5` — correctly typed generic | `binarySearch.test.ts:47` (objects via key fn) | ✅ Met |
| 5 | Returns index of first element where `key(element) >= target` | `binarySearch.ts:5-16` — standard lower-bound algorithm | `binarySearch.test.ts` — 11 tests | ✅ Met |
| 6 | Returns `arr.length` when all elements less than target | `binarySearch.ts:7` — `hi = arr.length` enables this | `binarySearch.test.ts:27` (TargetAboveMax) | ✅ Met |
| 7 | Tests: exact match first element | — | `binarySearch.test.ts:15` | ✅ Met |
| 8 | Tests: exact match last element | — | `binarySearch.test.ts:19` | ✅ Met |
| 9 | Tests: value between elements | — | `binarySearch.test.ts:23` | ✅ Met |
| 10 | Tests: below minimum (returns 0) | — | `binarySearch.test.ts:11` | ✅ Met |
| 11 | Tests: above maximum (returns arr.length) | — | `binarySearch.test.ts:27` | ✅ Met |
| 12 | Tests: empty array (returns 0) | — | `binarySearch.test.ts:7` | ✅ Met |
| 13 | Tests: single-element array | — | `binarySearch.test.ts:31,35,39` | ✅ Met |
| 14 | Tests: duplicate values (returns first occurrence) | — | `binarySearch.test.ts:43` | ✅ Met |
| 15 | All existing tests pass without modification | 611/611 pass | `npm test` | ✅ Met |

**Summary:** 15/15 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

#### S1 — Issue #99 lists "4 call sites" but there are only 3

- **Category:** Documentation
- **Location:** Issue #99 body
- **Description:** The issue lists `src/lib/compare/delta.ts` and `timeAtDistance() in delta.ts` as separate entries, but they are the same call site in the same function in the same file. The PR correctly replaces 3 call sites across 3 files, which is all that exists.
- **Recommendation:** No action needed — the work is complete. Could update issue description for clarity but not worth a code change.

---

## Positive Observations

- **Clean mechanical refactor:** Each replacement is a 1-line change plus an import. The post-search logic at each call site is completely untouched, making the "no behavioural change" guarantee easy to verify by inspection.
- **Standard algorithm contract:** Using `hi = arr.length` (not `arr.length - 1`) gives the standard C++ `lower_bound` / Python `bisect_left` contract that any developer will recognise. The `Math.min` clamp at `lerp` and `timeAtDistance` is explicit about preserving the old extrapolation behaviour.
- **Good test coverage:** 11 unit tests for the utility cover all boundary cases specified in the acceptance criteria. Existing test suites (10 + 34 tests) exercise the modified call sites through their public interfaces, not just the search loop.
- **Correct `positionFromPoints` simplification:** The replacement of `if (points[lo].distance < targetDist) return null` with `if (lo >= points.length) return null` is both semantically equivalent and more explicit about intent.
- **TDD discipline:** Commits show tests written first (Task 1), then each replacement in separate commits, allowing easy bisection if any issue arises.

---

## Action Items

### Immediate Fixes (block merge)

None — the PR is ready to merge.

### Post-merge improvements

None identified.

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] N/A — Logging adequate for debugging production issues (utility function, no logging needed)
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
