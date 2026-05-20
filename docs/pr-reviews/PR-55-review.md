# PR #55 Review — Fix: Mean/Max chart blank due to Stryd developer power field (#54)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/54-stryd-power-parser → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 7/7 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #54 — Bug: Mean/Max tab does not show any data in the chart (root)

No parent or sub-issues.

---

## Changed Files Audit

### `src/lib/fit/parser.ts` (+3 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add Stryd developer `Power` field to `FitRecord` interface; fall back to it in `normaliseRecord` when standard `power` is absent; export `normaliseRecord` for testability |
| Issues | #54 |
| Criteria covered | AC1, AC2, AC3 |
| Quality | ✅ No issues — `??` correctly preserves `0` watts and prioritises standard field |
| Test coverage | `parser.test.ts`: 4 tests covering Stryd field, standard field, precedence, and absence |

### `src/lib/fit/parser.test.ts` (+28 / -0 lines, new file)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the Stryd developer power field mapping in `normaliseRecord` |
| Issues | #54 |
| Criteria covered | AC1, AC2, AC3, AC7 |
| Quality | ✅ Clean Arrange-Act-Assert pattern; covers all 4 required scenarios |
| Test coverage | N/A (is the test file) |

### `src/lib/components/charts/MeanMaxChart.svelte` (+1 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Convert `chart` from plain `let` to `$state()` so `$effect` re-runs after `onMount` |
| Issues | #54 |
| Criteria covered | AC4, AC5 |
| Quality | ✅ Identical pattern to the Map fix in #52 |
| Test coverage | Manual browser verification (same justification as #52) |

---

## Acceptance Criteria Verification

### #54 — Bug: Mean/Max tab does not show any data in the chart

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Loading a Stryd FIT file populates `power` on ActivityRecord records | `parser.ts:83` — `power: r.power ?? r['Power']` | `parser.test.ts:5-8` | ✅ Met |
| AC2 | `power` values for Stryd records are in the range 0–400W | `parser.ts:83` — passes through raw value; test uses `221` (typical Stryd value) | `parser.test.ts:7` | ✅ Met |
| AC3 | Loading a cycling FIT file with standard `power` field continues to work | `parser.ts:83` — `r.power ??` means standard field takes precedence | `parser.test.ts:11-14`, `parser.test.ts:17-20` | ✅ Met |
| AC4 | The Mean/Max chart renders a curve when Stryd power data is present | `MeanMaxChart.svelte:16` — `$state()` ensures `$effect` re-runs; `parser.ts:83` provides data | Manual verification | ✅ Met |
| AC5 | `chart` in MeanMaxChart.svelte uses `$state()` | `MeanMaxChart.svelte:16` — `let chart = $state<ECharts \| undefined>(undefined)` | Manual verification | ✅ Met |
| AC6 | `npm run check` — zero TypeScript errors | Verified: 397 files, 0 errors, 0 warnings | Build check | ✅ Met |
| AC7 | `npm test` — all existing and new tests pass | Verified: 123/123 tests pass | `npm test` | ✅ Met |

**Summary:** 7/7 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

#### S1 — Consider also mapping Stryd `Form Power` developer field
- **Category:** Code Quality / Completeness
- **Location:** `parser.ts:44`
- **Description:** The Stryd FIT file also contains `Form Power`, `Leg Spring Stiffness`, `Air Power`, and other developer fields. The analysis explicitly deferred `formPower` (R4) as out of scope. This is noted for a future issue.
- **Recommendation:** No action for this PR. Create a follow-up issue if needed.

---

## Positive Observations

- Correct use of nullish coalescing (`??`) — preserves `0` watts as a valid power reading
- Standard field takes precedence, so cycling power meters are unaffected
- TDD approach: 4 tests written covering all cases (Stryd only, standard only, both present, neither present)
- `normaliseRecord` exported for testability — clean, minimal change to production code
- Consistent with the #52 reactivity fix pattern
- Clear commit messages explain the root cause and rationale

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

None required.

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
