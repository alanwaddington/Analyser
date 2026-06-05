# PR #140 Review — feat: toast notification system + surface localStorage write failures (#105)

**Date:** 2026-06-05
**Author:** alanwaddington
**Branch:** feature/105-toast-notifications → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 8/8 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #105 — Bug: localStorage quota exceeded not handled in deviceLabels store (standalone — no parent or sub-issues)

---

## Changed Files Audit

### `src/lib/stores/toast.ts` (+25 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New reusable toast store — module-level state with `addToast`, `removeToast`, and auto-dismiss via `setTimeout` |
| Issues | #105 |
| Criteria covered | AC4 (auto-dismiss), AC5 (reusable `addToast`), AC6 (non-blocking — store-only, no modal) |
| Quality | ✅ Clean, minimal implementation. Follows existing store patterns (`viewport.ts`, `theme.ts`). `toasts` exported as `Readable` prevents external mutation. |
| Test coverage | `src/lib/stores/toast.test.ts` — 12 tests covering add, remove, auto-dismiss, levels, IDs |

### `src/lib/stores/toast.test.ts` (+104 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for toast store |
| Issues | #105 |
| Criteria covered | Verifies AC4 (auto-dismiss timing), AC5 (addToast API), default level, unique IDs |
| Quality | ✅ Good use of `vi.resetModules()` to reset module-level counter between tests. Fake timers properly cleaned up in `afterEach`. Tests cover happy path, edge cases (unknown ID removal), and timing boundary (2999ms vs 3000ms). |
| Test coverage | N/A — this is the test file |

### `src/lib/components/ui/ToastContainer.svelte` (+113 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Svelte component rendering toast notifications from the store. Fixed bottom-right positioning, level-accented left border, dismiss button, fly transition, MAX_VISIBLE=3 cap. |
| Issues | #105 |
| Criteria covered | AC3 (UI toast shown), AC6 (non-blocking — `pointer-events: none` on container, `auto` on toasts), AC7 (theme-aware via `--color-card`, `--color-border`, `--color-text`) |
| Quality | ✅ No issues. Uses CSS custom properties for full light/dark compatibility. `aria-live="polite"` for screen readers. Phone breakpoint clears bottom nav. |
| Test coverage | No component-level test file. Verified via Playwright runtime observation (all three levels render, dismiss works, MAX_VISIBLE cap works). |

### `src/lib/stores/deviceLabels.ts` (+7 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Updated `saveLabels` catch block to log `console.warn` and call `addToast` instead of silently swallowing errors. Added `import { addToast } from './toast'`. |
| Issues | #105 |
| Criteria covered | AC1 (console.warn), AC2 (no crash — try/catch preserved), AC3 (toast shown on failure) |
| Quality | ✅ Differentiates `QuotaExceededError` from other exceptions with a targeted message. Generic fallback message for non-quota errors. |
| Test coverage | Existing `deviceLabels.test.ts` (40 tests) — covers `saveLabels` via `setDeviceLabel`/`removeDeviceLabel`. |

### `src/routes/+layout.svelte` (+3 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Import and mount `<ToastContainer />` in the app shell so toasts are visible on all pages |
| Issues | #105 |
| Criteria covered | AC3 (app-wide visibility), AC6 (non-blocking — positioned outside main content flow) |
| Quality | ✅ Minimal change. Component placed between `<main>` and the bottom nav conditional, which is the correct DOM order for z-index stacking. |
| Test coverage | Verified via Playwright — container present on `/`, `/compare`, `/event`. |

---

## Acceptance Criteria Verification

### #105 — Bug: localStorage quota exceeded not handled in deviceLabels store

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | `saveLabels` catch block logs a `console.warn` with a descriptive message | `deviceLabels.ts:73` — `console.warn('[deviceLabels] localStorage write failed:', e)` | Existing deviceLabels tests exercise `saveLabels` path; toast.test.ts covers store side | ✅ Met |
| AC2 | App does not crash when `localStorage.setItem` throws (already met — verify preserved) | `deviceLabels.ts:66-75` — try/catch preserved, catch block handles gracefully | Existing deviceLabels tests pass | ✅ Met |
| AC3 | A toast notification is shown to the user when a label fails to persist | `deviceLabels.ts:74` — `addToast(msg, 'warning')` called in catch block; `ToastContainer.svelte` renders it | Playwright verification confirmed toast renders | ✅ Met |
| AC4 | Toast auto-dismisses after a configurable timeout (default ~5 seconds) | `toast.ts:21,24` — `duration = 5000` default, `setTimeout(() => removeToast(id), duration)` | `toast.test.ts:62-79` — auto-dismiss at 3000ms, boundary test at 2999ms, default 5000ms | ✅ Met |
| AC5 | Toast component is reusable — `addToast(message, level?)` can be called from any module | `toast.ts:21` — exported function, no component dependency | `toast.test.ts:26-60` — all three levels, multiple toasts, unique IDs | ✅ Met |
| AC6 | Toast is non-blocking — does not prevent interaction with the rest of the app | `ToastContainer.svelte:50` — `pointer-events: none` on container; `:54` — `pointer-events: auto` only on individual toasts | Playwright verification — app interactive while toasts displayed | ✅ Met |
| AC7 | Toast is visible in both light and dark themes | `ToastContainer.svelte:59-66` — uses `var(--color-card)`, `var(--color-border)`, `var(--color-text)` | Playwright verification — dark theme screenshot confirms `rgb(10, 15, 26)` background | ✅ Met |
| AC8 | Existing tests pass without modification | No existing test files were modified | Full suite: 655 tests pass (12 new + 643 existing) | ✅ Met |

**Summary:** 8/8 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

#### m1 — Timer leak on rapid toast creation

- **Category:** Reliability
- **Location:** `toast.ts:24`
- **Description:** `addToast` creates a `setTimeout` that is never cleared, even if the toast is manually dismissed via `removeToast` before the timer fires. When a user dismisses a toast early, the `setTimeout` callback still fires and calls `removeToast(id)` — which is a harmless no-op (the filter finds nothing). However, in a pathological scenario with hundreds of rapid toasts, timer handles accumulate. In practice this is negligible — toasts are rare, short-lived events — but storing and clearing the timer handle in `removeToast` would be cleaner.
- **Recommendation:** Store timer handles in a `Map<number, ReturnType<typeof setTimeout>>` and call `clearTimeout` in `removeToast`. Low priority — current behaviour is correct, just slightly wasteful.

### Suggestions (optional)

#### S1 — Consider `success` level for future use

- **Category:** Code Quality
- **Location:** `toast.ts:4`
- **Description:** The `ToastLevel` type supports `info | warning | error`. A `success` level (green accent) is a common UX pattern for confirming actions (e.g. "Labels synced successfully"). Not needed for this PR, but worth considering when the toast system sees broader adoption.

---

## Positive Observations

- **Minimal, focused change** — only 5 files touched, all directly related to the issue. No scope creep.
- **Test quality** — 12 tests with `vi.resetModules()` to isolate module-level state between tests, fake timers for deterministic timing assertions, and boundary testing (2999ms vs 3000ms). The `removeToast_unknownId_isNoOp` test is a good defensive check.
- **Accessibility** — `aria-live="polite"`, `role="status"`, `aria-label="Dismiss notification"`, and `focus-visible` outline on the dismiss button. Screen reader compatible out of the box.
- **Theme compatibility** — all colours derive from CSS custom properties except the level accents (which are intentionally hardcoded for consistent semantic meaning across themes).
- **Responsive design** — phone breakpoint correctly clears the 56px bottom nav + safe area inset. Container switches from right-aligned to full-width on phone.
- **Good error differentiation** — the catch block distinguishes `QuotaExceededError` from other localStorage failures, providing a more specific user-facing message for the quota case.

---

## Action Items

### Immediate Fixes (block merge)

None — PR is ready to merge.

### Post-merge improvements

- [ ] m1: Clear `setTimeout` handles when toasts are manually dismissed — low priority, current behaviour is correct

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
