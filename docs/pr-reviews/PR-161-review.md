# PR #161 Review — feat: undo/redo history for device label edits (#116)

**Date:** 2026-06-29
**Author:** alanwaddington
**Branch:** feature/116-device-label-undo → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 12/12 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #116 — Enhancement: undo / history for device label edits (root — contains both Analysis and Design sections)

No sub-issues or parent issues detected.

---

## Changed Files Audit

### `src/lib/stores/deviceLabels.ts` (+80 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add in-memory undo/redo history stack (`LabelEdit[]`), `recordEdit()`, `undoLabelEdit()`, `redoLabelEdit()`, `getEditHistory()`, `canUndo()`, `canRedo()`, `canUndoFor()`, `clearEditHistory()` |
| Issues | #116 |
| Criteria covered | AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-9, AC-10, AC-11 |
| Quality | ✅ Clean separation — history recording is explicit via `recordEdit()`, avoiding recursion in undo/redo. Return value from `undoLabelEdit()`/`redoLabelEdit()` enables UI sync. `canUndoFor(key)` provides device-scoped undo checking. |
| Test coverage | `deviceLabels.test.ts`: 35 new tests across 7 describe blocks (including `canUndoFor` block with 5 tests) |

### `src/lib/components/ui/LabelHistoryPopover.svelte` (+233 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New component: hover-triggered popover displaying last 5 rename edits per device, with undo button |
| Issues | #116 |
| Criteria covered | AC-5, AC-6, AC-12 |
| Quality | ✅ Good a11y (`role="tooltip"`, `aria-label`). `prefers-reduced-motion` respected. Uses CSS custom properties (`var(--color-card)`, `var(--color-border)`, `var(--color-text)`, `var(--color-muted)`) for theme adaptability. Composite `{#each}` key prevents collisions. |
| Test coverage | ⚠️ No unit test file — component is presentational; tested via runtime Playwright verification |

### `src/lib/components/ui/DeviceToggleBar.svelte` (+154 / -27 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire undo/redo keyboard shortcuts, integrate popover on hover, update `commitRename()` to record edits, add `applyEditToReactiveState()` for UI sync, add `historyTick` reactive counter for popover state freshness |
| Issues | #116 |
| Criteria covered | AC-1, AC-2, AC-5, AC-6, AC-7, AC-12 |
| Quality | ✅ `$effect` cleanup properly removes keydown listener. `role="group"` on hover wrapper addresses a11y. `historyTick` counter pattern correctly bridges non-reactive module arrays to Svelte's reactive system. `e.key.toLowerCase()` handles cross-browser Shift key casing. `::after` pseudo-element bridges hover gap between pill and popover. Top-level `import type { LabelEdit }` used instead of inline `import()`. |
| Test coverage | ⚠️ No unit test — Svelte component with DOM interaction; covered by Playwright runtime verification |

### `src/lib/utils/relativeTime.ts` (+21 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New pure utility: convert timestamp to human-readable relative time string |
| Issues | #116 |
| Criteria covered | AC-5 (timestamp display in popover) |
| Quality | ✅ Testable `now` parameter. Clean tier structure (just now → min → hr → yesterday → date). |
| Test coverage | `relativeTime.test.ts`: 11 tests covering all tiers and edge cases |

### `src/lib/stores/deviceLabels.test.ts` (+303 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add tests for all new history functions including `canUndoFor` |
| Issues | #116 |
| Criteria covered | Test evidence for AC-1 through AC-11 |
| Quality | ✅ Follows existing patterns — `vi.resetModules()`, dynamic imports, `makeDevice()` helper. Toast mock via `vi.mock()`. `canUndoFor` describe block properly re-imports after `resetModules`. |
| Test coverage | N/A (is the test file) |

### `src/lib/utils/relativeTime.test.ts` (+70 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `relativeTime()` |
| Issues | #116 |
| Criteria covered | Test evidence for timestamp display |
| Quality | ✅ All tiers tested including boundary (exactly 60s, exactly 1hr, exactly 48hr) and future timestamp |
| Test coverage | N/A (is the test file) |

### `docs/pr-reviews/PR-161-review.md` (+183 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | PR review report (this file — superseded by current revision) |
| Issues | N/A — review artifact |
| Criteria covered | N/A |
| Quality | ✅ |
| Test coverage | N/A |

---

## Acceptance Criteria Verification

### #116 — Device label undo/history

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-1 | Ctrl+Z (Cmd+Z) reverts most recent label edit | `DeviceToggleBar.svelte:176-182` — keydown handler calls `undoLabelEdit()` + `applyEditToReactiveState()` | `deviceLabels.test.ts:430-479` — undoLabelEdit tests | ✅ Met |
| AC-2 | Ctrl+Z when no input focused reverts global edit | `DeviceToggleBar.svelte:177` — `renamingDevice !== null` guard skips when editing; fires globally otherwise | `deviceLabels.test.ts:470-479` — multipleEdits_undoesInOrder | ✅ Met |
| AC-3 | Undo triggers `_onLabelChange` → Redis sync | `deviceLabels.ts:164-167` — `undoLabelEdit()` calls `setDeviceLabel()`/`removeDeviceLabel()` which fire `_onLabelChange?.()` | `deviceLabels.test.ts:328-333` — setOnLabelChange tests confirm callback fires on set/remove | ✅ Met |
| AC-4 | Toast confirms revert | `deviceLabels.ts:169` — `addToast('Label change undone', 'info')` | `deviceLabels.test.ts:457-460` — undoLabelEdit_firesAddToast | ✅ Met |
| AC-5 | Popover on hover with last 5 edits + timestamps | `LabelHistoryPopover.svelte:20-51` — renders history entries with `relativeTime()`. `DeviceToggleBar.svelte:267-268,341-344` — popover rendered on `hoveredKey === cfs.key`. `deviceLabels.ts:193-196` — `getEditHistory(key)` returns newest-first, max 5 | `deviceLabels.test.ts:533-571` — getEditHistory tests (filter, limit, ordering) | ✅ Met |
| AC-6 | Undo button in popover for mouse users | `LabelHistoryPopover.svelte:45-51` — `{#if canUndoDevice}` renders `↩ Undo last rename` button. `DeviceToggleBar.svelte:283-284` — `onundo` callback calls `undoLabelEdit()` + state sync. `canUndoFor(dKey)` ensures button only shows when this device's edit is the most recent. | Playwright verified | ✅ Met |
| AC-7 | Ctrl+Shift+Z / Ctrl+Y redo; redo stack cleared on new edit | `DeviceToggleBar.svelte:183-189` — keydown handler with `e.key.toLowerCase()` for cross-browser compatibility. `deviceLabels.ts:177-186` — `redoLabelEdit()`. `deviceLabels.ts:153` — `_redoStack = []` in `recordEdit()` | `deviceLabels.test.ts:383-388` — recordEdit_clearsRedoStack. `deviceLabels.test.ts:486-527` — redoLabelEdit tests | ✅ Met |
| AC-8 | History capped at 20 entries | `deviceLabels.ts:6,152` — `MAX_HISTORY = 20`, `if (length > MAX_HISTORY) shift()` | `deviceLabels.test.ts:391-398` — recordEdit_exceedsMaxHistory_dropsOldest | ✅ Met |
| AC-9 | In-memory only; cleared on refresh | `deviceLabels.ts:15-16` — module-level `let _editHistory` / `let _redoStack` — no localStorage persistence | `deviceLabels.test.ts:577-595` — clearEditHistory tests (module reset in beforeEach proves memory-only) | ✅ Met |
| AC-10 | Undo cleared label restores previous | `deviceLabels.ts:164-165` — `if (edit.from) setDeviceLabel(...)` | `deviceLabels.test.ts:443-448` — undoLabelEdit_fromIsNonEmpty_setsFromLabel | ✅ Met |
| AC-11 | Undo on empty stack = no-op | `deviceLabels.ts:161-162` — `if (!edit) return undefined` | `deviceLabels.test.ts:431-434` — undoLabelEdit_emptyHistory_doesNothing (no throw, no toast) | ✅ Met |
| AC-12 | Popover closes on mouse leave / Escape | `DeviceToggleBar.svelte:267,342` — `onmouseleave` via `scheduleCloseHover` (200ms timer). `DeviceToggleBar.svelte:190-191` — Escape handler sets `hoveredKey = null`. `::after` bridge prevents premature `mouseleave` across gap. | Playwright verified | ✅ Met |

**Summary:** 12/12 criteria met.

---

## Findings

### Critical (must fix before merge)

(none)

### Major (should fix)

(none)

### Minor (nice to fix)

(none)

### Suggestions (optional)

(none)

### Previously identified findings (all resolved)

The initial review identified 4 findings — all have been fixed in subsequent commits:

| ID | Finding | Fix commit | Status |
|----|---------|------------|--------|
| M1 | Popover hardcoded dark theme colours; invisible in light mode | `f4a5ca3` — replaced all hardcoded colours with CSS custom properties (`var(--color-card)`, `var(--color-border)`, `var(--color-text)`, `var(--color-muted)`) | ✅ Resolved |
| m1 | `canUndoDevice` used global `canUndo()` instead of device-scoped check | `f4a5ca3` — added `canUndoFor(key)` function; popover undo button now only appears when this device's edit is the most recent | ✅ Resolved |
| m2 | `{#each}` key used `edit.timestamp` alone, risking collision | `f4a5ca3` — changed to composite key `` `${edit.timestamp}:${edit.deviceKey}:${edit.to}` `` | ✅ Resolved |
| S1 | Inline `import()` type annotation instead of top-level import | `f4a5ca3` — added `import type { LabelEdit }` at top level | ✅ Resolved |

### Bugs found and fixed during runtime verification

Two additional bugs were discovered during Playwright runtime verification and fixed:

| Bug | Fix commit | Detail |
|-----|------------|--------|
| Stale popover state after Ctrl+Z | `6896a77` | `getEditHistory()` and `canUndoFor()` read plain JS module-level arrays that Svelte cannot track. Popover props weren't re-evaluated after history mutations. Fixed by adding `historyTick` counter (`$state(0)`) bumped on every mutation, read in prop expressions to create a Svelte dependency. |
| Ctrl+Shift+Z redo broken in Chromium | `6896a77` | `e.key` with Shift held is uppercase `'Z'` in Chromium, but handler checked `e.key === 'z'`. Fixed with `e.key.toLowerCase() === 'z'`. |

---

## Positive Observations

- **Clean undo/redo architecture** — separating `recordEdit()` from `setDeviceLabel()` avoids the infinite recursion trap elegantly. The functions are composable and testable in isolation.
- **Thorough test coverage** — 41 new tests covering happy paths, edge cases (empty stack, cap overflow, ordering), cross-function interactions (undo→redo→new edit clears redo), and the new `canUndoFor` function.
- **Reactive UI sync pattern** — `applyEditToReactiveState()` correctly bridges the gap between the store (localStorage) and the component's reactive `renamedLabels` map. The `historyTick` counter pattern is a clean solution to the Svelte reactivity gap for module-level arrays.
- **`relativeTime()` design** — the injectable `now` parameter makes the utility fully testable without mocking `Date.now()`. Clean separation of concerns.
- **Accessibility** — `role="tooltip"`, `aria-label`, `role="group"` on hover wrappers, `focus-visible` on undo button, `prefers-reduced-motion` support.
- **Cross-browser robustness** — `e.key.toLowerCase()` normalisation handles the Chromium/Firefox key event casing difference for Shift+key combos.
- **CSS gap bridging** — the `::after` pseudo-element on `.pill-wrap` ensures the popover undo button is reachable by mouse despite the absolute positioning gap.
- **Theme adaptability** — all popover colours use CSS custom properties, ensuring correct rendering in both dark and light themes.

---

## Action Items

### Immediate Fixes (block merge)
(none)

### Post-merge improvements
(none — all findings resolved)

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
- [x] Logging adequate for debugging production issues (toast feedback on undo)
