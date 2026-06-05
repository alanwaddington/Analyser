# PR #142 Review — feat: FIT parser error handling and record validation (#106)

**Date:** 2026-06-05
**Author:** alanwaddington
**Branch:** feature/106-parser-error-handling -> main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 7/8 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #106 — Bug: FIT parser has no error handling for corrupted or malformed files (standalone — no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/fit/parser.ts` (+33 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `filterNegativeElapsed()`, `ensureSortedByElapsed()`, `DISTANCE_EPSILON_M` constant, integrate into `normalise()`, and apply epsilon in `buildLaps` |
| Issues | #106 |
| Criteria covered | AC3 (negative elapsed filtering), AC4 (auto-sort), AC5 (warning toast on re-sort — partial, missing `console.warn`), AC6 (epsilon in buildLaps) |
| Quality | See findings m1 and M1 |
| Test coverage | `parser.test.ts` — 10 new tests covering filter, sort, epsilon constant, and epsilon boundary |

### `src/lib/fit/parser.test.ts` (+106 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add tests for `filterNegativeElapsed`, `ensureSortedByElapsed`, `DISTANCE_EPSILON_M`, and buildLaps epsilon tolerance |
| Issues | #106 |
| Criteria covered | AC8 (new tests) |
| Quality | Good coverage of edge cases (empty, single, zero, negative). `makeElapsedRecord` helper avoids collision with existing `makeRecord`. |
| Test coverage | N/A — this is the test file |

### `src/lib/components/ui/DropZone.svelte` (+7 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Import `addToast` and call it in both catch blocks (single-file and multi-file) alongside existing inline error |
| Issues | #106 |
| Criteria covered | AC1 (error toast on corrupt file), AC2 (filename in toast message) |
| Quality | No issues. Clean belt-and-suspenders pattern — inline error preserved, toast added. Each failed file in multi-file mode gets its own toast. |
| Test coverage | Playwright-verified (no component unit test — acceptable for catch-block wiring) |

---

## Acceptance Criteria Verification

### #106 — Bug: FIT parser has no error handling for corrupted or malformed files

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Dropping a truncated or corrupt FIT file shows a user-friendly error message via both inline DropZone text and a toast notification (`'error'` level) | `DropZone.svelte:33-35` (single-file), `DropZone.svelte:57-59` (multi-file) — both set inline `error` and call `addToast(msg, 'error')` | Playwright-verified in `/verify 142` | Met |
| AC2 | The error toast includes the filename so the user knows which file failed | `DropZone.svelte:33` — message format is `${filename}: ${error}` | Playwright capture shows `"corrupt.fit: Incorrect header size"` | Met |
| AC3 | Records with negative `elapsedSeconds` are silently filtered out during normalisation | `parser.ts:340-342` — `filterNegativeElapsed` returns filtered array; `parser.ts:370` calls it in `normalise()` | `parser.test.ts:700-725` — 4 tests (allPositive, someNegative, allNegative, zeroRetained) | Met |
| AC4 | If records are not sorted by `elapsedSeconds` after normalisation, they are re-sorted in ascending order | `parser.ts:346-358` — `ensureSortedByElapsed` detects and sorts in-place; `parser.ts:374` calls it in `normalise()` | `parser.test.ts:729-751` — 4 tests (alreadySorted, unsorted, single, empty) | Met |
| AC5 | When records are re-sorted, a `console.warn` is logged and a toast notification (`'warning'` level) is shown with the filename | `parser.ts:357` — `addToast(...)` called with `'warning'` level and filename. **No `console.warn` call.** | `parser.test.ts:737-742` — verifies return value and sort order, but does not assert `console.warn` or `addToast` were called | Not Met |
| AC6 | Lap building uses epsilon tolerance (e.g. 0.5 m) for distance comparisons instead of strict `<=` | `parser.ts:9` — `DISTANCE_EPSILON_M = 0.5`; `parser.ts:452` — `records[cursor].distance <= targetDist + DISTANCE_EPSILON_M` | `parser.test.ts:765-786` — 2 tests (within epsilon included, beyond epsilon excluded) | Met |
| AC7 | Existing tests pass without modification | Import line updated (additive only), no existing test bodies changed | 667 total tests pass | Met |
| AC8 | New tests cover: negative elapsed filtering, out-of-order sorting, epsilon lap distance comparison, and error toast on parse failure | `parser.test.ts` — 10 new tests: 4 filter, 4 sort, 1 epsilon constant, 2 epsilon boundary | All 10 tests pass | Met |

**Summary:** 7/8 criteria met. AC5 partially met — toast fires but `console.warn` is missing.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

#### M1 — Missing `console.warn` for out-of-order records

- **Category:** Code Quality / Acceptance Criteria
- **Location:** `parser.ts:346-358`
- **Description:** AC5 explicitly requires "a `console.warn` is logged and a toast notification is shown" when records are re-sorted. The implementation calls `addToast(...)` but omits `console.warn`. While the toast surfaces the issue to the user, the `console.warn` is important for developer debugging — it appears in browser DevTools even when toasts have been dismissed.
- **Recommendation:** Add `console.warn('[parser] "${filename}": records were out of order — sorted by elapsedSeconds');` before the `addToast` call in `ensureSortedByElapsed`.

### Minor (nice to fix)

#### m1 — No `console.warn` for negative elapsed filtering

- **Category:** Code Quality
- **Location:** `parser.ts:370-373`
- **Description:** When records with negative elapsed time are removed, `normalise()` shows a toast but does not log a `console.warn`. This is acceptable per AC3 ("silently filtered"), but the toast makes it not fully silent. For debugging consistency with the sort path, a `console.warn` alongside the toast would help developers diagnosing issues in DevTools.
- **Recommendation:** Add `console.warn('[parser] "${filename}": ${count} record(s) with negative elapsed time removed');` in the same `if` block that calls `addToast`. Low priority — current behaviour is reasonable.

#### m2 — `ensureSortedByElapsed` has side effect (toast) that makes unit testing less pure

- **Category:** Code Quality
- **Location:** `parser.ts:357`
- **Description:** `ensureSortedByElapsed` calls `addToast` directly, coupling it to the toast store. This works fine in production but means the unit test calls the real toast store (no mock). The test only asserts the return value and sort order, not that the toast was actually emitted. This is acceptable for now, but if the function were refactored to return the result and let the caller toast, it would be easier to test and follow single-responsibility more closely.
- **Recommendation:** No change needed for this PR. If the toast store or parser.ts grow more complex in the future, consider extracting the notification side effect to the caller (`normalise()`), similar to how `filterNegativeElapsed` is pure and the caller toasts.

### Suggestions (optional)

#### S1 — Boundary value test at exactly DISTANCE_EPSILON_M

- **Category:** Test Coverage
- **Location:** `parser.test.ts:765-786`
- **Description:** The epsilon tests cover 0.3 m (within) and 1.0 m (beyond), but not the exact boundary value of 0.5 m. Adding a test at exactly `targetDist + 0.5` would document that the boundary is inclusive (`<=`).

---

## Positive Observations

- **Minimal, focused change** — only 3 files touched, all directly related to the issue. No scope creep.
- **Good defensive ordering** — `filterNegativeElapsed` runs before `ensureSortedByElapsed`, which is correct (removing negative values first avoids sorting garbage data).
- **Belt-and-suspenders error reporting** — DropZone preserves the existing inline error AND adds a toast, so errors are visible both in-context and app-wide.
- **Per-file toast in multi-file mode** — each failed file gets its own toast (not a combined message), which is the right UX when multiple files fail.
- **Good test naming** — `MethodName_Scenario_ExpectedResult` convention followed consistently.
- **Epsilon constant is exported** — allows other modules (e.g. distance.ts) to use the same tolerance in the future.
- **`rawRecords.length` comparison** — the negative-elapsed toast includes the count of removed records, which is more informative than a generic "some records were removed" message.

---

## Action Items

### Immediate Fixes (block merge)

- [ ] M1: Add `console.warn` in `ensureSortedByElapsed` alongside the `addToast` call (required by AC5)

### Post-merge improvements

- [ ] m1: Consider adding `console.warn` for negative elapsed filtering for debugging consistency
- [ ] m2: Consider extracting toast side effects from `ensureSortedByElapsed` to the caller for purer function design
- [ ] S1: Add boundary value test at exactly `DISTANCE_EPSILON_M` (0.5 m)

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues — except M1 (`console.warn` missing)
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
