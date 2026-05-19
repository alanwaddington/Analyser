# PR #26 Review — feat: Create FileList.svelte component (#5)

**Date:** 2026-05-19
**Author:** alanwaddington
**Branch:** feature/5-filelist -> main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | N/A (UI component — visual verification + type checking) |
| Acceptance Criteria | 14/14 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #5 — Step 5: Create FileList.svelte component (implementation)

---

## Changed Files Audit

### `src/lib/components/ui/FileList.svelte` (+136 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Reactive file list with compare and event display modes |
| Issues | #5 |
| Criteria covered | All 14 acceptance criteria |
| Quality | ✅ No issues |
| Test coverage | N/A — UI component, verified via `npm run check` |

---

## Acceptance Criteria Verification

### #5 — Step 5: Create FileList.svelte component

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `FileList.svelte` created at correct path | File exists, 136 lines | N/A | ✅ Met |
| 2 | Accepts `mode: 'compare' \| 'event'` prop | Line 5: `$props()` with typed mode | N/A | ✅ Met |
| 3 | Renders one row per activity from the store | Lines 19–51: `{#each $activities as activity, i}` | N/A | ✅ Met |
| 4 | Colour dot using `FILE_COLOURS[index]` | Line 20, 33: `FILE_COLOURS[i % FILE_COLOURS.length]`, applied as background | N/A | ✅ Met |
| 5 | Displays activity filename | Line 35: `{activity.filename}` | N/A | ✅ Met |
| 6 | Compare mode: device count with singular/plural | Line 37: `device{activity.devices.length !== 1 ? 's' : ''}` | N/A | ✅ Met |
| 7 | Event mode: formatted date + finish time | Line 39: `{formatDate(activity.startTime)} · {formatTime(activity.totalElapsedTime)}` | N/A | ✅ Met |
| 8 | Event mode: amber left border on reference row | Line 27: `border-left: 3px solid #f59e0b` | N/A | ✅ Met |
| 9 | Event mode: "Reference" badge on reference row | Lines 42–44: `{#if isRef}<span class="ref-badge">Reference</span>{/if}` | N/A | ✅ Met |
| 10 | Event mode: clicking row sets referenceIndex | Line 30: `onclick={() => mode === 'event' && referenceIndex.set(i)}` | N/A | ✅ Met |
| 11 | Event mode: hover state showing interactivity | Lines 74–79: `.event-row` cursor pointer + hover background | N/A | ✅ Met |
| 12 | Compare mode: rows NOT clickable | Lines 28–30: role/tabindex undefined, onclick guards on mode | N/A | ✅ Met |
| 13 | Remove button calls `removeActivity(activity.id)` | Line 47: `onclick` with `stopPropagation` + `removeActivity(activity.id)` | N/A | ✅ Met |
| 14 | `npm run check` passes with zero errors | Confirmed: 0 errors, 0 warnings | N/A | ✅ Met |

**Summary:** 14/14 criteria met.

---

## Findings

No critical, major, or minor findings.

---

## Positive Observations

- Clean separation of mode-specific behaviour using conditional classes and template blocks
- Proper `stopPropagation` on remove button prevents reference-set in event mode
- Keyboard accessibility: `role="button"`, `tabindex={0}`, Enter key handler for event mode rows
- `aria-label` on remove button for screen reader support
- Filename truncation with ellipsis prevents layout overflow
- Colour dot wraps with modulo (`i % FILE_COLOURS.length`) — safe even if somehow > 6 files
- `svelte-ignore` comment is appropriate — the dynamic `role="button"` makes the tabindex semantically correct at runtime

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
- [x] Tests cover happy path, error paths, and edge cases (N/A — UI component)
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
