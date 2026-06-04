# PR #131 Review — Refactor: consolidate pace formatting into a single utility (#100)

**Date:** 2026-06-04
**Author:** alanwaddington
**Branch:** feature/100-consolidate-pace-formatting → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 17/17 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #100 — Refactor: consolidate pace formatting into a single utility (standalone — no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/utils/formatting.ts` (+7 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New file — single source of truth `formatPace(decimalMinutes): string` |
| Issues | #100 |
| Criteria covered | AC1 (single source of truth), AC4 (export signature), AC5–AC10 (format correctness) |
| Quality | ✅ No issues — clean, minimal, correct algorithm handles rollover via `Math.round` then `Math.floor`/`%` |
| Test coverage | `src/lib/utils/formatting.test.ts` — 8 dedicated tests |

### `src/lib/utils/formatting.test.ts` (+36 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New file — unit tests for `formatPace` |
| Issues | #100 |
| Criteria covered | AC5–AC10 (format values), AC16 (new unit tests) |
| Quality | ✅ No issues — follows project naming convention `methodName_scenario_expectedResult`, covers zero, whole, fractional, rollover, padding, double-digit |
| Test coverage | N/A (is the test file) |

### `src/lib/components/charts/TimeSeriesChart.utils.ts` (+3 / -8 lines)

| Property | Detail |
|----------|--------|
| Purpose | Remove local `paceFormat` implementation, import `formatPace` for internal use, re-export as `paceFormat` for existing consumers |
| Issues | #100 |
| Criteria covered | AC11 (no own implementation), AC2 (all call sites updated) |
| Quality | ✅ No issues — dual import+re-export pattern is clean; `formatStatValue` now calls `formatPace` directly |
| Test coverage | `TimeSeriesChart.utils.test.ts` — imports `paceFormat` via re-export, 6 paceFormat tests + `formatStatValue` pace test all pass unchanged |

### `src/lib/components/map/colourScale.ts` (+3 / -6 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace inline pace formatting in `formatMetricValue` with delegation to `formatPace` |
| Issues | #100 |
| Criteria covered | AC12 (`formatMetricValue` pace branch delegates) |
| Quality | ✅ No issues — switch/case simplified from block to single return |
| Test coverage | `colourScale.test.ts` — 3 pace-specific `formatMetricValue` tests pass unchanged |

### `src/lib/export/excel.ts` (+1 / -11 lines)

| Property | Detail |
|----------|--------|
| Purpose | Remove private `formatPace` function, import shared version |
| Issues | #100 |
| Criteria covered | AC13 (no own implementation) |
| Quality | ✅ No issues — clean removal, import added at correct position |
| Test coverage | `excel.test.ts` — `buildWorkbook` integration tests pass; pace formatting tested indirectly through workbook cell values |

### `src/routes/event/+page.svelte` (+2 / -6 lines)

| Property | Detail |
|----------|--------|
| Purpose | Remove local `formatPace(secPerKm)`, import shared `formatPace`, convert input unit at call site |
| Issues | #100 |
| Criteria covered | AC14 (no own implementation), AC2 (all call sites updated) |
| Quality | ✅ No issues — `formatPace(paceSecPerKm / 60) + ' /km'` correctly converts seconds-per-km to decimal-minutes before calling shared function |
| Test coverage | No direct unit test for event page (Svelte component); verified via Playwright runtime verification — pace cells show `7:47 /km` and `7:23 /km` correctly |

---

## Acceptance Criteria Verification

### #100 — Refactor: consolidate pace formatting into a single utility

#### Original Acceptance Criteria (Problem section)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | Single source of truth for pace formatting | `formatting.ts:2-6` | `formatting.test.ts` (8 tests) | ✅ Met |
| 2 | All existing call sites updated | All 4 files updated — see audit above | Existing tests pass unchanged | ✅ Met |
| 3 | Unit tests pass | 619/619 pass | Full suite | ✅ Met |

#### Analysis Acceptance Criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 4 | `formatting.ts` exports `formatPace(decimalMinutes: number): string` | `formatting.ts:2` | `formatting.test.ts:2` import | ✅ Met |
| 5 | `formatPace(5)` returns `"5:00"` | `formatting.ts:2-6` | `formatting.test.ts:9-11` | ✅ Met |
| 6 | `formatPace(5.5)` returns `"5:30"` | `formatting.ts:2-6` | `formatting.test.ts:13-15` | ✅ Met |
| 7 | `formatPace(4.9999)` returns `"5:00"` (rollover) | `formatting.ts:3` (`Math.round`) | `formatting.test.ts:17-19` | ✅ Met |
| 8 | `formatPace(0)` returns `"0:00"` | `formatting.ts:2-6` | `formatting.test.ts:5-7` | ✅ Met |
| 9 | `formatPace(6 + 5/60)` returns `"6:05"` (padded) | `formatting.ts:6` (`padStart`) | `formatting.test.ts:21-23` | ✅ Met |
| 10 | `formatPace(10.25)` returns `"10:15"` | `formatting.ts:2-6` | `formatting.test.ts:25-27` | ✅ Met |
| 11 | `TimeSeriesChart.utils.ts` no longer contains own `paceFormat` impl | Removed lines 102-107, re-export added at line 5 | `TimeSeriesChart.utils.test.ts` paceFormat tests pass via re-export | ✅ Met |
| 12 | `colourScale.ts:formatMetricValue()` pace branch delegates | `colourScale.ts:66` — `return formatPace(value)` | `colourScale.test.ts:92-104` | ✅ Met |
| 13 | `excel.ts` no longer contains own `formatPace` impl | Removed lines 38-46, import added at line 18 | `excel.test.ts` passes | ✅ Met |
| 14 | `event/+page.svelte` no longer contains own `formatPace` impl | Removed lines 207-211, import at line 24, call site at line 403 | Playwright verification: `7:47 /km`, `7:23 /km` | ✅ Met |
| 15 | All existing tests pass (`npm test`) | 619/619 | Full suite | ✅ Met |
| 16 | New unit tests in `formatting.test.ts` cover the cases | 8 tests covering all specified cases | `formatting.test.ts` | ✅ Met |
| 17 | No pace formatting invoked for cycling (parser guarantee) | `parser.ts:332` clears pace for non-running — unchanged by this PR | `parser.test.ts` (pre-existing) | ✅ Met |

**Summary:** 17/17 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

#### S1 — Dual import + re-export could be a single aliased import
- **Category:** Code Quality
- **Location:** `TimeSeriesChart.utils.ts:4-5`
- **Description:** The file has both `import { formatPace }` (for internal use in `formatStatValue`) and `export { formatPace as paceFormat }` (for external consumers). This is functionally correct but results in two import statements from the same module. An alternative would be `import { formatPace as paceFormat }` plus using `paceFormat` internally — but that would change the internal name from matching the canonical function name. The current approach is arguably clearer since it preserves the canonical name internally and the legacy name externally.
- **Recommendation:** No action needed — current approach is the clearest option given the constraints.

---

## Positive Observations

- Clean, minimal implementation — the shared `formatPace` is 5 lines of pure logic with no dependencies
- The `Math.round` approach elegantly handles the rollover edge case (4.9999 → 5:00) without explicit `if (seconds === 60)` branching — simpler than the removed `excel.ts` version which had explicit overflow handling
- Re-export pattern preserves backward compatibility — `TimeSeriesChart.svelte` and its test file require zero changes
- The event page call site conversion (`secPerKm / 60`) is mathematically correct and well-placed at the boundary
- Test naming follows the established project convention consistently
- Net code reduction: +52 / -31 across the PR, with 36 of the additions being tests — production code shrank by 15 lines

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

None required. The Could Have item (C8 — `formatDuration` consolidation) was explicitly deferred and is documented in the issue.

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
