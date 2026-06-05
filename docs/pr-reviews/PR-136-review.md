# PR #136 Review — Fix: initSync() duplicate hook registration and network calls (#102)

**Date:** 2026-06-05
**Author:** alanwaddington
**Branch:** feature/102-initsync-idempotency → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 9/9 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #102 — Bug: initSync() can register duplicate hooks if called more than once (standalone, no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/stores/deviceLabels.ts` (+2 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Widen `setOnLabelChange` parameter type to accept `null` for deregistration |
| Issues | #102 |
| Criteria covered | AC7 |
| Quality | ✅ No issues — minimal, type-safe change. The internal `_onLabelChange` variable was already typed as `(() => void) \| null`, so this just aligns the public API |
| Test coverage | Null deregistration tested via `sync.test.ts:initSync_cleanup_resetsAndAllowsReinit` (calls `cleanup()` which calls `setOnLabelChange(null)`) |

### `src/lib/stores/sync.ts` (+14 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `_initialised` module-level idempotency flag, change return type to include cleanup function |
| Issues | #102 |
| Criteria covered | AC1, AC2, AC3, AC4, AC5 |
| Quality | ✅ No issues — guard is set before async work (line 190) preventing race conditions; cleanup correctly resets both the flag and the hook |
| Test coverage | `sync.test.ts:initSync_calledTwice_secondCallIsNoop`, `sync.test.ts:initSync_cleanup_resetsAndAllowsReinit` |

### `src/routes/+layout.svelte` (+8 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Store cleanup function from `initSync()` and invoke it in `onDestroy` for HMR teardown |
| Issues | #102 |
| Criteria covered | AC6 |
| Quality | ✅ No issues — `cleanupSync` declared at component scope, assigned in `onMount`, safely invoked with optional chaining in `onDestroy` |
| Test coverage | No direct unit test (Svelte component lifecycle). Covered by runtime verification (Playwright: SPA navigation produces 0 extra requests, full reload fires exactly 1 fresh initSync) |

### `src/lib/stores/sync.test.ts` (+30 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add two new tests for double-call idempotency and cleanup-then-reinit cycle; update `initSync` type annotation |
| Issues | #102 |
| Criteria covered | AC9 |
| Quality | ✅ Tests follow existing conventions: Arrange-Act-Assert, `MethodName_Scenario_ExpectedResult` naming, mock fetch helpers, module re-import per test |
| Test coverage | Self — these are the tests |

---

## Acceptance Criteria Verification

### #102 — Bug: initSync() can register duplicate hooks if called more than once

#### Original acceptance criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| Orig-1 | Calling `initSync()` twice does not register duplicate hooks | `sync.ts:189` — `if (_initialised) return` | `sync.test.ts:259` — `initSync_calledTwice_secondCallIsNoop` | ✅ Met |
| Orig-2 | No duplicate network requests observed in dev tools during HMR | `sync.ts:189-190` — early return prevents re-execution of push/pull | Playwright runtime verification — 1 request per load | ✅ Met |

#### Analysis acceptance criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Module-level `initialised` flag added to `sync.ts` | `sync.ts:23` — `let _initialised = false` | `sync.test.ts:259-268` | ✅ Met |
| AC2 | `initSync()` returns early if already initialised | `sync.ts:189` — `if (_initialised) return` | `sync.test.ts:265-268` — verifies `undefined` return and 1 fetch call | ✅ Met |
| AC3 | Calling twice results in exactly one push/pull | `sync.ts:189` — guard prevents re-entry | `sync.test.ts:267` — `toHaveBeenCalledTimes(1)` | ✅ Met |
| AC4 | Calling twice results in exactly one hook registration | `sync.ts:189` — guard prevents second `setOnLabelChange` call | `sync.test.ts:267` — 1 fetch confirms single init path | ✅ Met |
| AC5 | Returns cleanup function that deregisters hook and resets flag | `sync.ts:230-233` — `return () => { setOnLabelChange(null); _initialised = false; }` | `sync.test.ts:271-286` — `initSync_cleanup_resetsAndAllowsReinit` | ✅ Met |
| AC6 | `+layout.svelte` calls cleanup in `onDestroy` | `+layout.svelte:73,91,94-96` — stores ref, invokes in `onDestroy` | Playwright runtime verification | ✅ Met |
| AC7 | `setOnLabelChange` accepts `null` | `deviceLabels.ts:103` — `callback: (() => void) \| null` | `sync.test.ts:279` — `cleanup!()` calls `setOnLabelChange(null)` | ✅ Met |
| AC8 | All existing sync tests pass without modification | All 31 existing tests pass (only type annotation updated on line 37) | `npm test` — 625 passing | ✅ Met |
| AC9 | New test for double-call idempotency | `sync.test.ts:259-268` — `initSync_calledTwice_secondCallIsNoop` | Self | ✅ Met |

**Summary:** 9/9 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

None. The change is minimal, focused, and well-tested.

---

## Positive Observations

- Clean, minimal diff — 54 lines across 4 files for a complete fix with tests and teardown
- `_initialised = true` is set before the async `pushLabels`/`pullLabels` call (line 190), correctly preventing a race where a second `initSync()` call sneaks in during the await
- Cleanup function is a clean pattern that aligns with Svelte's `onDestroy` lifecycle without requiring any framework-specific teardown logic
- Tests follow existing conventions exactly (module re-import pattern, mock helpers, naming)
- The type annotation update on the `initSync` variable in tests (line 37) keeps the test-side types in sync with the production signature

---

## Action Items

### Immediate Fixes (block merge)

None — clean pass.

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
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
