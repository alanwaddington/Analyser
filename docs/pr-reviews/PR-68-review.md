# PR #68 Review — Fix: svelte-check warnings — a11y autofocus and CSS appearance (#63)

**Date:** 2026-05-22
**Author:** alanwaddington
**Branch:** feature/63-fix-svelte-check-warnings → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate (no testable logic changed) |
| Acceptance Criteria | 8 Met / 8 Total |

---

## Issues Reviewed

### Issue Hierarchy
- #63 — Fix svelte-check warnings: a11y autofocus and CSS appearance compatibility (standalone)

---

## Changed Files Audit

### `src/lib/components/ui/DeviceToggleBar.svelte` (+6 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace `autofocus` HTML attribute with `use:focusOnMount` Svelte action to eliminate a11y warning |
| Issues | #63 |
| Criteria covered | AC1, AC2, AC3 |
| Quality | ✅ Clean idiomatic Svelte action; works correctly inside `{#each}` loops |
| Test coverage | N/A — DOM focus behaviour; verified via runtime (Playwright) |

### `src/lib/components/ui/TimeOffsetControl.svelte` (+1 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add standard `appearance: textfield` alongside vendor-prefixed `-moz-appearance: textfield` |
| Issues | #63 |
| Criteria covered | AC4, AC5 |
| Quality | ✅ Standard property placed before vendor prefix (correct cascade order) |
| Test coverage | N/A — CSS property; verified via runtime (compiled CSS inspection) |

---

## Acceptance Criteria Verification

### #63 — Fix svelte-check warnings: a11y autofocus and CSS appearance compatibility

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | `autofocus` attribute removed from rename input in DeviceToggleBar | `DeviceToggleBar.svelte:187` — `use:focusOnMount` replaces `autofocus` | Playwright: DOM attribute absent | ✅ Met |
| AC2 | Programmatic `focus()` called on mount, preserving UX | `DeviceToggleBar.svelte:106` — `function focusOnMount(node) { node.focus(); }` | Playwright: `activeElement` is rename-input | ✅ Met |
| AC3 | `svelte-check` no longer reports `a11y_autofocus` warning | `svelte-check` output: 0 WARNINGS | N/A (toolchain) | ✅ Met |
| AC4 | `appearance: textfield` added alongside `-moz-appearance` | `TimeOffsetControl.svelte:273` — both properties present | Playwright: compiled CSS rule contains `appearance: textfield` | ✅ Met |
| AC5 | `svelte-check` no longer reports CSS appearance warning | `svelte-check` output: 0 WARNINGS | N/A (toolchain) | ✅ Met |
| AC6 | Full test suite passes | 268/268 tests pass | `npx vitest run` | ✅ Met |
| AC7 | Inline rename flow still works (dblclick → focused → Enter/Escape) | Playwright: focus on mount ✅, Escape dismisses ✅ | Runtime verified | ✅ Met |
| AC8 | Number input spinners remain hidden | `appearance: textfield` compiles to CSS; `-moz-appearance` retained for Firefox | Runtime verified | ✅ Met |

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

- Svelte `use:` action is the idiomatic pattern for DOM side effects on mount — correctly chosen over `bind:this` + `$effect` (which would be awkward inside an `{#each}` loop)
- CSS property ordering is correct: standard property before vendor prefix
- Minimal diff — exactly the lines needed, nothing else touched

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
