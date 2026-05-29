# PR #98 Review — Feature: Auto-default to Time axis when all loaded activities are indoor (#96)

**Date:** 2026-05-29
**Author:** alanwaddington
**Branch:** feature/96-auto-time-axis-indoor → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 10/10 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #96 — Auto-default to Time axis when all loaded activities are indoor (standalone — no parent/child issues)

---

## Changed Files Audit

### `src/lib/utils/indoorWarnings.svelte.ts` (+2 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Lower `allIndoor` threshold from `length > 1` to `length >= 1` so a single indoor file triggers the flag |
| Issues | #96 |
| Criteria covered | AC1, AC2, AC8 |
| Quality | ✅ No issues — minimal, focused change |
| Test coverage | `indoorWarnings.test.ts`: 6 tests for `allIndoor`, 5 for `hasMixedIndoorOutdoor` |

### `src/lib/utils/indoorWarnings.test.ts` (+88 / -0 lines, new file)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `createIndoorWarnings()` — covers `allIndoor` and `hasMixedIndoorOutdoor` derived state across all input combinations |
| Issues | #96 |
| Criteria covered | AC10 |
| Quality | ✅ Clean test structure, correct `makeActivity` factory following existing patterns |
| Test coverage | N/A — this is the test file |

### `src/routes/compare/+page.svelte` (+8 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `$effect` that auto-switches `xAxisMode` to `'time'` when `indoor.allIndoor` is true; uses `untrack()` to avoid re-firing on manual axis toggles |
| Issues | #96 |
| Criteria covered | AC1, AC2, AC5, AC6 |
| Quality | ✅ `untrack()` correctly prevents `$xAxisMode` from becoming a reactive dependency; mirrors existing `hasMixedIndoorOutdoor` pattern |
| Test coverage | Runtime verified via Playwright |

### `src/routes/event/+page.svelte` (+8 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same `$effect` addition as Compare page |
| Issues | #96 |
| Criteria covered | AC7 |
| Quality | ✅ Identical pattern to Compare page |
| Test coverage | Runtime verified via Playwright |

---

## Acceptance Criteria Verification

### #96 — Auto-default to Time axis when all loaded activities are indoor

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Loading a single indoor file sets xAxisMode to 'time' | `indoorWarnings.svelte.ts:24` (`length >= 1`) + `compare/+page.svelte:206` (`$effect`) | `allIndoor_singleIndoorActivity_returnsTrue` + runtime | ✅ Met |
| AC2 | Loading multiple indoor files sets xAxisMode to 'time' | Same as AC1 | `allIndoor_multipleIndoorActivities_returnsTrue` + runtime | ✅ Met |
| AC3 | Mix of indoor + outdoor leaves xAxisMode at 'distance' | `hasMixedIndoorOutdoor` handles this (pre-existing); `allIndoor` returns false for mixed | `allIndoor_mixedIndoorAndOutdoor_returnsFalse` | ✅ Met |
| AC4 | Loading only outdoor files leaves xAxisMode at 'distance' | `allIndoor` returns false when `every(a => a.isIndoor)` fails | `allIndoor_singleOutdoorActivity_returnsFalse` + runtime | ✅ Met |
| AC5 | Manual axis toggle after auto-switch is respected | `untrack(() => $xAxisMode)` in `$effect` prevents re-fire on manual toggle | Runtime verified via Playwright | ✅ Met |
| AC6 | Auto-switch applies on Compare page | `compare/+page.svelte:202-207` | Runtime verified | ✅ Met |
| AC7 | Auto-switch applies on Event page | `event/+page.svelte:106-111` | Runtime verified | ✅ Met |
| AC8 | All-indoor info banner displays for single indoor file | `allIndoor` now true for `length >= 1`; banner condition `indoor.allIndoor && !indoor.hasMixedIndoorOutdoor` already exists | Runtime verified | ✅ Met |
| AC9 | Removing all files and loading outdoor resets to distance | `allIndoor` goes false when file set changes; `xAxisMode` store default is 'distance' | Runtime verified | ✅ Met |
| AC10 | All existing tests pass; new tests cover auto-switch | 600 tests passing; 11 new tests | Full suite verified | ✅ Met |

**Summary:** 10/10 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions

#### S1 — Consider `untrack` for the existing `hasMixedIndoorOutdoor` effect too
- **Category:** Code Quality (consistency)
- **Location:** `compare/+page.svelte:199`, `event/+page.svelte:103`
- **Description:** The existing `hasMixedIndoorOutdoor` effect reads `$xAxisMode === 'distance'` without `untrack()`, so it fights manual toggles for mixed indoor/outdoor sessions. The new `allIndoor` effect uses `untrack()` for the same pattern. The two effects now have different semantics for the same UX concern. This may be intentional (mixed sessions can't meaningfully use distance, so blocking it is correct), but worth acknowledging the asymmetry.
- **Recommendation:** No action needed for this PR — the mixed-session case is arguably different (distance is genuinely incompatible vs. merely suboptimal for all-indoor). If the user requests it, adding `untrack()` to the mixed effect would make them consistent.

---

## Positive Observations

- **`untrack()` usage** — correctly identified and fixed the reactive-dependency bug that caused the `$effect` to fight manual toggles. This is a subtle Svelte 5 reactivity pitfall handled well.
- **Minimal change** — 4 lines of production code across 2 files, plus the threshold change. Zero risk to existing functionality.
- **Comprehensive test coverage** — 11 new tests cover all combinations: empty, single indoor/outdoor, multiple indoor/outdoor, and mixed. The `makeActivity` factory follows the existing codebase pattern from `lapMarkers.test.ts`.
- **Mirror pattern** — both pages have identical `$effect` implementations, making behaviour consistent across Device Comparison and Event Comparison.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements
- [ ] S1: Consider adding `untrack()` to the existing `hasMixedIndoorOutdoor` effect if the user wants manual override there too

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
