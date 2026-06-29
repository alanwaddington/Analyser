# PR #161 Review — feat: undo/redo history for device label edits (#116)

**Date:** 2026-06-29
**Author:** alanwaddington
**Branch:** feature/116-device-label-undo → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 12/12 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #116 — Device label undo/history (root — contains both Analysis and Design sections)

No sub-issues or parent issues detected.

---

## Changed Files Audit

### `src/lib/stores/deviceLabels.ts` (+74 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add in-memory undo/redo history stack (`LabelEdit[]`), `recordEdit()`, `undoLabelEdit()`, `redoLabelEdit()`, `getEditHistory()`, `canUndo()`, `canRedo()`, `clearEditHistory()` |
| Issues | #116 |
| Criteria covered | AC-1, AC-2, AC-3, AC-4, AC-7, AC-8, AC-9, AC-10, AC-11 |
| Quality | ✅ Clean separation — history recording is explicit via `recordEdit()`, avoiding recursion in undo/redo. Return value from `undoLabelEdit()`/`redoLabelEdit()` enables UI sync. |
| Test coverage | `deviceLabels.test.ts`: 30 new tests across 6 describe blocks |

### `src/lib/components/ui/LabelHistoryPopover.svelte` (+233 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New component: hover-triggered popover displaying last 5 rename edits per device, with undo button |
| Issues | #116 |
| Criteria covered | AC-5, AC-6, AC-12 |
| Quality | ✅ Good a11y (`role="tooltip"`, `aria-label`). `prefers-reduced-motion` respected. See M1 below. |
| Test coverage | ⚠️ No unit test file — component is presentational; tested via runtime Playwright verification |

### `src/lib/components/ui/DeviceToggleBar.svelte` (+124 / -27 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire undo/redo keyboard shortcuts, integrate popover on hover, update `commitRename()` to record edits, add `applyEditToReactiveState()` for UI sync |
| Issues | #116 |
| Criteria covered | AC-1, AC-2, AC-5, AC-6, AC-7, AC-12 |
| Quality | ✅ `$effect` cleanup properly removes keydown listener. `role="group"` on hover wrapper addresses a11y. See m1 below. |
| Test coverage | ⚠️ No unit test — Svelte component with DOM interaction; covered by Playwright runtime verification |

### `src/lib/utils/relativeTime.ts` (+21 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New pure utility: convert timestamp to human-readable relative time string |
| Issues | #116 |
| Criteria covered | AC-5 (timestamp display in popover) |
| Quality | ✅ Testable `now` parameter. Clean tier structure (just now → min → hr → yesterday → date). |
| Test coverage | `relativeTime.test.ts`: 11 tests covering all tiers and edge cases |

### `src/lib/stores/deviceLabels.test.ts` (+262 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add tests for all new history functions |
| Issues | #116 |
| Criteria covered | Test evidence for AC-1 through AC-11 |
| Quality | ✅ Follows existing patterns — `vi.resetModules()`, dynamic imports, `makeDevice()` helper. Toast mock via `vi.mock()`. |
| Test coverage | N/A (is the test file) |

### `src/lib/utils/relativeTime.test.ts` (+70 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `relativeTime()` |
| Issues | #116 |
| Criteria covered | Test evidence for timestamp display |
| Quality | ✅ All tiers tested including boundary (exactly 60s, exactly 1hr, exactly 48hr) and future timestamp |
| Test coverage | N/A (is the test file) |

---

## Acceptance Criteria Verification

### #116 — Device label undo/history

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-1 | Ctrl+Z (Cmd+Z) reverts most recent label edit | `DeviceToggleBar.svelte:160-165` — keydown handler calls `undoLabelEdit()` + `applyEditToReactiveState()` | `deviceLabels.test.ts:430-479` — undoLabelEdit tests | ✅ Met |
| AC-2 | Ctrl+Z when no input focused reverts global edit | `DeviceToggleBar.svelte:159` — `renamingDevice !== null` guard skips when editing; fires globally otherwise | `deviceLabels.test.ts:470-479` — multipleEdits_undoesInOrder | ✅ Met |
| AC-3 | Undo triggers `_onLabelChange` → Redis sync | `deviceLabels.ts:164-167` — `undoLabelEdit()` calls `setDeviceLabel()`/`removeDeviceLabel()` which fire `_onLabelChange?.()` | `deviceLabels.test.ts:328-333` — setOnLabelChange tests confirm callback fires on set/remove | ✅ Met |
| AC-4 | Toast confirms revert | `deviceLabels.ts:169` — `addToast('Label change undone', 'info')` | `deviceLabels.test.ts:457-460` — undoLabelEdit_firesAddToast | ✅ Met |
| AC-5 | Popover on hover with last 5 edits + timestamps | `LabelHistoryPopover.svelte:20-51` — renders history entries with `relativeTime()`. `DeviceToggleBar.svelte:260-268,336-344` — popover rendered on `hoveredKey === cfs.key`. `deviceLabels.ts:193-196` — `getEditHistory(key)` returns newest-first, max 5 | `deviceLabels.test.ts:533-571` — getEditHistory tests (filter, limit, ordering) | ✅ Met |
| AC-6 | Undo button in popover for mouse users | `LabelHistoryPopover.svelte:45-51` — `{#if canUndoDevice}` renders `↩ Undo last rename` button. `DeviceToggleBar.svelte:266-267` — `onundo` callback calls `undoLabelEdit()` + state sync | Playwright verified | ✅ Met |
| AC-7 | Ctrl+Shift+Z / Ctrl+Y redo; redo stack cleared on new edit | `DeviceToggleBar.svelte:166-171` — keydown handler. `deviceLabels.ts:177-186` — `redoLabelEdit()`. `deviceLabels.ts:153` — `_redoStack = []` in `recordEdit()` | `deviceLabels.test.ts:383-388` — recordEdit_clearsRedoStack. `deviceLabels.test.ts:486-527` — redoLabelEdit tests | ✅ Met |
| AC-8 | History capped at 20 entries | `deviceLabels.ts:6,152` — `MAX_HISTORY = 20`, `if (length > MAX_HISTORY) shift()` | `deviceLabels.test.ts:391-398` — recordEdit_exceedsMaxHistory_dropsOldest | ✅ Met |
| AC-9 | In-memory only; cleared on refresh | `deviceLabels.ts:15-16` — module-level `let _editHistory` / `let _redoStack` — no localStorage persistence | `deviceLabels.test.ts:577-595` — clearEditHistory tests (module reset in beforeEach proves memory-only) | ✅ Met |
| AC-10 | Undo cleared label restores previous | `deviceLabels.ts:164-165` — `if (edit.from) setDeviceLabel(...)` | `deviceLabels.test.ts:443-448` — undoLabelEdit_fromIsNonEmpty_setsFromLabel | ✅ Met |
| AC-11 | Undo on empty stack = no-op | `deviceLabels.ts:161-162` — `if (!edit) return undefined` | `deviceLabels.test.ts:431-434` — undoLabelEdit_emptyHistory_doesNothing (no throw, no toast) | ✅ Met |
| AC-12 | Popover closes on mouse leave / Escape | `DeviceToggleBar.svelte:250,325` — `onmouseleave` resets `hoveredKey`. `DeviceToggleBar.svelte:172-174` — Escape handler sets `hoveredKey = null` | Playwright verified | ✅ Met |

**Summary:** 12/12 criteria met.

---

## Findings

### Major (should fix)

#### M1 — Popover hardcodes dark theme colours; invisible in light mode
- **Category:** Code Quality / Reliability
- **Location:** `LabelHistoryPopover.svelte:65-77`
- **Description:** The popover uses hardcoded dark colours (`#0a1628` background, `#1e2d45` border, `#e2e8f0` text). The rest of the app uses CSS custom properties (`var(--color-bg)`, `var(--color-border)`, `var(--color-text)`) for theme adaptability. In light mode, the dark popover creates a jarring visual contrast. While it remains readable (dark bg with light text), it doesn't match the surrounding light UI.
- **Recommendation:** Replace hardcoded colours with CSS custom properties used elsewhere in the app, or add a dedicated set of `--popover-*` variables that adapt to the theme. The grid texture background could use `var(--color-border)` at low opacity.

### Minor (nice to fix)

#### m1 — `canUndoDevice` checks global undo, not device-specific undo
- **Category:** Code Quality
- **Location:** `DeviceToggleBar.svelte:265,341`
- **Description:** The `canUndoDevice` prop passes `canUndo()` which checks the global history stack, not whether the most recent edit was for *this* device. The undo button appears on every popover if any edit exists, even if it would undo a different device's label. This matches the PR description ("acts on the global last edit, same as Ctrl+Z") but the prop name `canUndoDevice` implies device-scoped logic.
- **Recommendation:** Either rename the prop to `canUndoAny` to clarify semantics, or implement device-scoped undo checking: `canUndo() && getEditHistory(dKey)[0]?.deviceKey === dKey`. Low priority — current behaviour is functional and documented.

#### m2 — `LabelEdit.timestamp` used as `{#each}` keying could collide
- **Category:** Reliability
- **Location:** `LabelHistoryPopover.svelte:31`
- **Description:** `{#each history as edit (edit.timestamp)}` uses the timestamp as the Svelte keying identifier. Two edits within the same millisecond (e.g., rapid programmatic calls in tests) would share a key, causing Svelte to skip the duplicate. In practice this is extremely unlikely for human-driven renames.
- **Recommendation:** Consider using the edit's index or a composite key (`${edit.timestamp}:${edit.deviceKey}:${edit.to}`) for robustness. Low priority — unlikely in real usage.

### Suggestions (optional)

#### S1 — `import(...)` type annotation in function parameter
- **Category:** Code Quality
- **Location:** `DeviceToggleBar.svelte:143`
- **Description:** `function applyEditToReactiveState(edit: import('$lib/stores/deviceLabels').LabelEdit, label: string)` uses a dynamic import type annotation. While valid TypeScript, it's unusual given that `LabelEdit` could be imported at the top of the script block alongside the other deviceLabels imports.
- **Recommendation:** Add `import type { LabelEdit } from '$lib/stores/deviceLabels'` to the top-level imports (can be combined with the existing import statement) and use `LabelEdit` directly in the signature.

---

## Positive Observations

- **Clean undo/redo architecture** — separating `recordEdit()` from `setDeviceLabel()` avoids the infinite recursion trap elegantly. The functions are composable and testable in isolation.
- **Thorough test coverage** — 41 new tests covering happy paths, edge cases (empty stack, cap overflow, ordering), and cross-function interactions (undo→redo→new edit clears redo).
- **Reactive UI sync pattern** — `applyEditToReactiveState()` correctly bridges the gap between the store (localStorage) and the component's reactive `renamedLabels` map. This was caught and fixed during verification.
- **`relativeTime()` design** — the injectable `now` parameter makes the utility fully testable without mocking `Date.now()`. Clean separation of concerns.
- **Accessibility** — `role="tooltip"`, `aria-label`, `role="group"` on hover wrappers, `focus-visible` on undo button, `prefers-reduced-motion` support.

---

## Action Items

### Immediate Fixes (block merge)
(none)

### Post-merge improvements
- [ ] M1: Adapt popover colours to respect theme CSS custom properties
- [ ] m1: Rename `canUndoDevice` prop to `canUndoAny` or implement device-scoped check
- [ ] m2: Use a more robust key for `{#each}` in the popover entry list

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
