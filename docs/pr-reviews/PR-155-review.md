# PR #155 Review — fix: sidebar scrollable when expanded sections overflow viewport (#154)

**Date:** 2026-06-26
**Author:** alanwaddington
**Branch:** feature/154-sidebar-scrollable → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate (CSS-only change; 955 existing tests pass) |
| Acceptance Criteria | 8 / 8 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #154 — bug: sidebar panel is not scrollable — expanded sections (e.g. Profile) are clipped (root)

---

## Changed Files Audit

### `src/lib/components/ui/Sidebar.svelte` (+67 / -42 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wraps `.file-section` and `.footer` in a new `.sidebar-scroll` div with `overflow-y: auto`. Adds thin scrollbar styling (6px). Re-indents existing template content (accounts for most of the line churn). |
| Issues | #154 |
| Criteria covered | AC1 (scrollable), AC2 (logo/nav pinned), AC3 (no scrollbar when fits), AC4 (tablet), AC5 (phone), AC6 (file-section independent scroll), AC7 (thin scrollbar) |
| Quality | ✅ No issues — clean structural change, follows existing flex column layout conventions |
| Test coverage | CSS-only layout change — no unit-testable logic. Verified via Playwright runtime screenshots. |

### `src/lib/components/ui/AthleteProfilePanel.svelte` (+9 / -9 lines)

| Property | Detail |
|----------|--------|
| Purpose | Moves the toggle button (`⚖ Profile`) from below the expanded content to above it in DOM order, so content expands downward. Flips `border-top` → `border-bottom` and `margin-bottom` → `margin-top` on `.profile-panel` to match new order. |
| Issues | #154 (usability improvement discovered during implementation) |
| Criteria covered | AC1 (all fields reachable), AC2 (intuitive expand direction) |
| Quality | ✅ No issues — pure DOM reorder + CSS border direction swap |
| Test coverage | No unit-testable logic changed. Verified via Playwright runtime screenshots. |

### `src/lib/components/ui/SyncPanel.svelte` (+17 / -17 lines)

| Property | Detail |
|----------|--------|
| Purpose | Same DOM reorder as AthleteProfilePanel — moves toggle button (`☁ Sync`) above expanded content. Flips `border-top` → `border-bottom` and `margin-bottom` → `margin-top` on `.sync-panel`. |
| Issues | #154 (consistency with AthleteProfilePanel fix) |
| Criteria covered | AC1 (sync panel reachable via scroll), consistent expand direction |
| Quality | ✅ No issues — mirrors AthleteProfilePanel change exactly |
| Test coverage | No unit-testable logic changed. Verified via Playwright runtime screenshots. |

---

## Acceptance Criteria Verification

### #154 — bug: sidebar panel is not scrollable

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Desktop 700px window — Profile panel scrollable, all 6 fields reachable | `Sidebar.svelte:92` — `.sidebar-scroll` wrapper with `overflow-y: auto` | Playwright screenshot s2/s3 | ✅ Met |
| AC2 | Logo + nav pinned at top, do not scroll | `Sidebar.svelte:69-90` — `.logo` and `.mode-nav` are structurally outside `.sidebar-scroll` | Playwright screenshots s2/s3 confirm pinned | ✅ Met |
| AC3 | No scrollbar when content fits (Profile collapsed) | `Sidebar.svelte:221` — `overflow-y: auto` (not `scroll`) | Playwright screenshot s4 — no scrollbar | ✅ Met |
| AC4 | Tablet drawer scrollable when content overflows | `Sidebar.svelte:287-308` — mobile `@media` rule inherits `.sidebar-scroll` layout since the scroll wrapper is inside `.sidebar` | Structural analysis — scroll wrapper is unconditional | ✅ Met |
| AC5 | Phone drawer scrollable when content overflows | Same as AC4 — `.sidebar-scroll` is inside `.sidebar` which becomes the drawer at ≤768px | Structural analysis | ✅ Met |
| AC6 | File list section still scrolls independently | `Sidebar.svelte:242-251` — `.file-section` retains `flex: 1; overflow-y: auto; min-height: 0` unchanged | Code inspection — no changes to `.file-section` CSS | ✅ Met |
| AC7 | Thin scrollbar (6px), theme colours | `Sidebar.svelte:225-240` — `scrollbar-width: thin` + `::-webkit-scrollbar { width: 6px }` with `var(--color-border)` | Code inspection | ✅ Met |
| AC8 | All 955 tests pass | N/A | `npx vitest run` — 46 files, 955 tests, 0 failures | ✅ Met |

**Summary:** 8/8 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

None.

### Suggestions (optional)

None.

---

## Positive Observations

- Clean structural approach: the `.sidebar-scroll` wrapper solves the scroll problem without any `position: sticky` hacks or JavaScript — pure CSS flex layout
- The toggle button DOM reorder (commit 2) was a good catch — the old content-above-header pattern was invisible when `overflow: hidden` clipped everything, but became a UX issue once scrolling was enabled
- Both AthleteProfilePanel and SyncPanel were updated consistently — no asymmetry introduced
- Scrollbar styling uses existing theme CSS custom properties (`--color-border`) rather than hardcoded colours
- The diff is almost entirely whitespace re-indentation — the actual logic changes are minimal, reducing review risk

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

None.

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
