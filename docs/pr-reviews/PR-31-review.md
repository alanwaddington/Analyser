# PR #31 Review — feat: Rewrite +layout.svelte as app shell (#10)

**Date:** 2026-05-19
**Author:** alanwaddington
**Branch:** feature/10-layout-shell -> main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | N/A (structural layout + reactive side-effect) |
| Acceptance Criteria | 9/9 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #10 — Step 10: Rewrite +layout.svelte (app shell) (implementation)

---

## Changed Files Audit

### `src/routes/+layout.svelte` (+30 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Rewrite minimal layout into flex-based app shell with Sidebar + main content area + lastMode sync |
| Issues | #10 |
| Criteria covered | All 9 acceptance criteria |
| Quality | ✅ No issues |
| Test coverage | N/A — structural layout with one reactive side-effect |

---

## Acceptance Criteria Verification

### #10 — Step 10: Rewrite +layout.svelte (app shell)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | Flex container with `height: 100vh` | Lines 28–30: `.shell { display: flex; height: 100vh; overflow: hidden }` | N/A | ✅ Met |
| 2 | `<Sidebar />` rendered on left | Line 20: `<Sidebar />` inside `.shell` div | N/A | ✅ Met |
| 3 | `<main>` fills remaining width (`flex: 1`) with `overflow-y: auto` | Lines 33–36: `.main-area { flex: 1; overflow-y: auto }` | N/A | ✅ Met |
| 4 | `{@render children()}` inside `<main>` | Line 22: `{@render children()}` inside `<main class="main-area">` | N/A | ✅ Met |
| 5 | `$effect` sets `lastMode` to `'compare'` when pathname starts with `/compare` | Line 12: `if (path.startsWith('/compare')) lastMode.set('compare')` | N/A | ✅ Met |
| 6 | `$effect` sets `lastMode` to `'event'` when pathname starts with `/event` | Line 13: `else if (path.startsWith('/event')) lastMode.set('event')` | N/A | ✅ Met |
| 7 | `$effect` does NOT update `lastMode` when pathname is `/` | Lines 12–13: only `/compare` and `/event` branches — no else clause | N/A | ✅ Met |
| 8 | Existing favicon and layout.css imports preserved | Lines 2–3: `import './layout.css'` and `import favicon`; Line 17: `<svelte:head>` | N/A | ✅ Met |
| 9 | `npm run check` passes | Confirmed: 0 errors, 0 warnings | N/A | ✅ Met |

**Summary:** 9/9 criteria met.

---

## Findings

No critical, major, or minor findings.

---

## Positive Observations

- `overflow: hidden` on `.shell` prevents double scrollbar (sidebar never scrolls at shell level; file section handles its own scroll)
- `$effect` uses `page` from `$app/state` consistent with Sidebar's usage — no mixing of `$app/stores` and `$app/state`
- `startsWith` for route matching correctly handles potential sub-routes (e.g. `/compare/123` in future)
- Clean separation: layout handles structure and `lastMode` sync only; Sidebar handles its own rendering

---

## Action Items

None.

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases (N/A)
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
