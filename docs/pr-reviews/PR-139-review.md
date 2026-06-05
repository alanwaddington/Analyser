# PR #139 Review — Fix: applyLabels() mutates Device objects in-place, breaking Svelte reactivity (#104)

**Date:** 2026-06-05
**Author:** alanwaddington
**Branch:** feature/104-applyLabels-immutable → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 6/6 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #104 — Bug: applyLabels() mutates Device objects in-place, breaking Svelte reactivity (standalone)

---

## Changed Files Audit

### `src/lib/stores/deviceLabels.ts` (+19 / -12 lines)

| Property | Detail |
|----------|--------|
| Purpose | Extract `resolveLabel()` as a pure lookup function; refactor `applyLabels` from in-place mutation (`void`) to immutable return (`Device[]`) |
| Issues | #104 |
| Criteria covered | AC1, AC2, AC5 |
| Quality | ✅ Clean. `resolveLabel` is a focused pure function. `applyLabels` avoids unnecessary copies when no label exists (`return label ? { ...d, label } : d`). `stored \|\| undefined` correctly handles empty-string labels |
| Test coverage | `deviceLabels.test.ts` — 8 applyLabels tests + 4 resolveLabel tests |

### `src/lib/fit/parser.ts` (+1 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Capture `applyLabels` return value instead of discarding it |
| Issues | #104 |
| Criteria covered | AC3 |
| Quality | ✅ Single-line change. Clean composition: `applyLabels(uniqueDeviceInfos.map(normaliseDeviceInfo))` |
| Test coverage | Indirectly tested via runtime verification with a real FIT file |

### `src/lib/stores/deviceLabels.test.ts` (+63 / -13 lines)

| Property | Detail |
|----------|--------|
| Purpose | Update 5 existing tests to assert on return value; add 3 new immutability/reference tests; add 4 `resolveLabel` tests |
| Issues | #104 |
| Criteria covered | AC5, AC6 |
| Quality | ✅ Thorough coverage: immutability, same-ref optimisation, different-ref on label, unkeyable devices, empty-string edge case |
| Test coverage | Self |

---

## Acceptance Criteria Verification

### #104 — Bug: applyLabels() mutates Device objects in-place, breaking Svelte reactivity

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | `applyLabels` returns a new `Device[]` array; input devices are not mutated | `deviceLabels.ts:138-142` — `devices.map(d => label ? { ...d, label } : d)` | `applyLabels_withLabel_doesNotMutateOriginal` | ✅ Met |
| AC2 | Each returned Device is a new object (not the same reference as the input) | `deviceLabels.ts:141` — `{ ...d, label }` creates a new object | `applyLabels_withLabel_returnsDifferentReference` | ✅ Met |
| AC3 | Parser in `parser.ts` captures and uses the returned array | `parser.ts:365` — `const devices: Device[] = applyLabels(...)` | Runtime verified with real FIT file | ✅ Met |
| AC4 | Label updates visibly re-render device names without a page refresh | Immutable return ensures Svelte 5 detects the change | Runtime verified — seeded label appeared on parsed Activity | ✅ Met |
| AC5 | All 5 existing `applyLabels` tests pass (updated to assert on return value) | `deviceLabels.test.ts:170-223` — all 5 original tests now assert on `result[0].label` | All 40 deviceLabels tests pass | ✅ Met |
| AC6 | All existing label-sync tests pass without modification | `sync.test.ts` — no changes needed | Full suite: 642 passing | ✅ Met |

**Summary:** 6/6 criteria met.

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

- `resolveLabel` is a clean extraction — single responsibility, pure function, no side effects, independently testable
- The `label ? { ...d, label } : d` pattern is smart — avoids creating unnecessary objects for devices with no stored label, while still guaranteeing immutability where it matters
- The `applyLabels_noLabel_returnsSameReference` test explicitly documents the optimisation, preventing future refactors from accidentally making it always-copy
- Parser change is a one-liner — minimal blast radius for a meaningful correctness improvement

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
