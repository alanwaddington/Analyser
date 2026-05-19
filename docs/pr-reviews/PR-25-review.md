# PR #25 Review — feat: Create DropZone.svelte component (#4)

**Date:** 2026-05-19
**Author:** alanwaddington
**Branch:** feature/4-dropzone -> main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | N/A (UI component — visual verification + type checking) |
| Acceptance Criteria | 12/12 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #4 — Step 4: Create DropZone.svelte component (implementation)

---

## Changed Files Audit

### `src/lib/components/ui/DropZone.svelte` (+188 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Reusable file drop zone with two modes (full panel and compact button) |
| Issues | #4 |
| Criteria covered | All 12 acceptance criteria |
| Quality | See findings below |
| Test coverage | N/A — UI glue component, verified via `npm run check` |

---

## Acceptance Criteria Verification

### #4 — Step 4: Create DropZone.svelte component

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `DropZone.svelte` created at `src/lib/components/ui/DropZone.svelte` | File exists, 188 lines | N/A | ✅ Met |
| 2 | `compact=false` renders centred panel with drop icon, "Drop .fit files here", and "Browse files" button | Lines 81–93: icon ⬇, primary text, secondary text ".fit supported", browse-btn span | N/A | ✅ Met |
| 3 | `compact=true` renders single-line dashed "+ Add files" button | Lines 69–79: `dropzone-compact` label with "+ Add files" text | N/A | ✅ Met |
| 4 | Both modes handle `dragover` event and apply visible drag-over style | Lines 48–50 (`onDragOver`), CSS `.dragover` class changes border/text to `#3b82f6` (lines 121–124, 171–173) | N/A | ✅ Met |
| 5 | Both modes handle `drop` event and process dropped files | Lines 57–61 (`onDrop`), both labels have `ondrop={onDrop}` | N/A | ✅ Met |
| 6 | Both modes include hidden `<input type="file" multiple accept=".fit">` wrapped in `<label>` | Lines 77, 88: `<input ... multiple accept=".fit" hidden>` inside `<label>` | N/A | ✅ Met |
| 7 | Non-`.fit` files silently ignored | Line 18: `filter(f => f.name.endsWith('.fit'))` | N/A | ✅ Met |
| 8 | At `MAX_FILES`, inline warning shown, no files loaded | Lines 22–26: `slots <= 0` check, sets warning | N/A | ✅ Met |
| 9 | Exceeding `MAX_FILES` loads what fits, warns about rest | Lines 28–30: `slice(0, slots)`, warning for skipped | N/A | ✅ Met |
| 10 | Each file read as `ArrayBuffer`, passed to `parseFitFile()`, result to `addActivity()` | Lines 35–38: `file.arrayBuffer()` → `parseFitFile(buffer, file.name)` → `addActivity(activity)` | N/A | ✅ Met |
| 11 | `parseFitFile()` rejection shows inline error naming file; other files continue | Lines 39–40: catch block pushes `file.name: message`; loop continues | N/A | ✅ Met |
| 12 | `npm run check` passes with zero errors | Confirmed: 0 errors, 0 warnings | N/A | ✅ Met |

**Summary:** 12/12 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

#### m1 — MAX_FILES race condition with concurrent drops

- **Category:** Reliability
- **Location:** `DropZone.svelte:21`
- **Description:** `get(activities)` reads the store count at the start of `handleFiles`, but since parsing is async (line 36–38), a second drop event fired while the first batch is still parsing could read a stale count and exceed `MAX_FILES`. In practice this is unlikely (files parse fast), but the guard could be tightened by checking the count before each `addActivity` call rather than once at the top.
- **Recommendation:** Move the `MAX_FILES` check inside the loop, reading `get(activities).length` before each `addActivity()` call. Alternatively, accept as a known limitation given the low practical risk.

### Suggestions (optional)

#### S1 — Case-insensitive `.fit` extension check

- **Category:** Code Quality
- **Location:** `DropZone.svelte:18`
- **Description:** `f.name.endsWith('.fit')` is case-sensitive. Files from some devices may use `.FIT` or `.Fit`. Using `.toLowerCase().endsWith('.fit')` would broaden compatibility.
- **Recommendation:** Change to `f.name.toLowerCase().endsWith('.fit')`.

---

## Positive Observations

- Clean Svelte 5 runes usage — `$state`, `$props`, `bind:this` all idiomatic
- Per-file error handling catches and displays failures without blocking the batch
- CSS uses `var(--color-*)` theme tokens consistently
- Component is focused and minimal — no unnecessary abstractions
- Warning and error messages clear on next interaction (lines 15–16)

---

## Action Items

### Immediate Fixes (block merge)
None.

### Post-merge improvements
- [ ] m1: Consider tightening MAX_FILES guard for concurrent drops
- [ ] S1: Case-insensitive `.fit` extension matching

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases (N/A — UI component)
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
