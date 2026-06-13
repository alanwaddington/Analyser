# PR #145 Review — Perf: pre-compute available channels during parse (#108)

**Date:** 2026-06-13
**Author:** alanwaddington
**Branch:** feature/108-precompute-available-channels → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 4/4 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #108 — Perf: pre-compute available channels during parse instead of on every render (standalone)

---

## Changed Files Audit

### `src/lib/types.ts` (+1 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `availableChannels: Set<ChannelKey>` to `Activity` interface |
| Issues | #108 |
| Criteria covered | AC1: Activity type includes availableChannels |
| Quality | ✅ No issues — field added at the end of the interface, correct type |
| Test coverage | Type verified transitively by all 35 test files compiling |

### `src/lib/fit/parser.ts` (+3 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Export `channelsPresentInRecords`, call it in `normalise()` to populate `availableChannels` |
| Issues | #108 |
| Criteria covered | AC2: Parser populates the set during normalisation |
| Quality | ✅ Placed after sport-specific mutations (cadence doubling, pace removal) so the set reflects final record state. `channelsPresentInRecords` is called twice at parse time (once here, once inside `buildDeviceStreams`) — acceptable trade-off vs changing `buildDeviceStreams` signature |
| Test coverage | `parser.test.ts`: 4 new tests for `channelsPresentInRecords` export |

### `src/lib/utils/channels.ts` (+5 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Refactor `deriveAvailableChannels()` from record scanning to set union |
| Issues | #108 |
| Criteria covered | AC3: deriveAvailableChannels reads from cached set, no record iteration; AC4: No change in which channels are reported |
| Quality | ✅ Clean implementation. `ALL_CHANNELS.filter()` preserves canonical ordering. O(files × channels) instead of O(files × records × channels) |
| Test coverage | `channels.test.ts`: 7 existing tests updated and passing |

### `src/lib/utils/channels.test.ts` (+4 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Update `makeActivity` to compute `availableChannels` from records via `channelsPresentInRecords` |
| Issues | #108 |
| Criteria covered | Test infrastructure for AC3, AC4 |
| Quality | ✅ Correctly imports `channelsPresentInRecords` from parser to build accurate test fixtures. Optional second parameter allows explicit override |
| Test coverage | Self — this is the test file |

### `src/lib/components/map/ActivityMap.svelte` (+2 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Fix undefined `activity.id` → `activities[i].id` in hover marker colour lookup |
| Issues | Pre-existing bug found during #108 work, not part of original issue scope |
| Criteria covered | N/A — bonus bug fix |
| Quality | ⚠️ See finding M1 below |
| Test coverage | No unit test for this specific hover marker code path (Svelte reactive effect inside `$effect`). Verified at runtime via Playwright during `/verify` |

### 16 test fixture files (+1 each / -0 lines each)

Files: `anchor.test.ts`, `distance.test.ts`, `timestamp.test.ts`, `DeltaChart.test.ts`, `MeanMaxChart.test.ts`, `SegmentChart.test.ts`, `ActivityMap.component.test.ts`, `ActivityMap.metricExtraction.test.ts`, `ActivityMap.test.ts`, `excel.test.ts`, `session.test.ts`, `deviceChannels.test.ts`, `indoorWarnings.test.ts`, `lapMarkers.test.ts`, `segments.test.ts`

| Property | Detail |
|----------|--------|
| Purpose | Add `availableChannels: new Set()` to `makeActivity` helpers for type compliance |
| Issues | #108 |
| Criteria covered | TypeScript compilation; no behavioural change |
| Quality | ✅ Correctly placed before `...overrides` in files that use spread patterns (MeanMaxChart, excel, anchor, ActivityMap.component) so the field can be overridden per-test |
| Test coverage | Self — these are test files |

### `src/lib/fit/parser.test.ts` (+34 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Import `channelsPresentInRecords`, add 4 tests for the newly exported function |
| Issues | #108 |
| Criteria covered | AC2 test coverage |
| Quality | ✅ Tests cover: empty records, single channel, multiple channels union, channel present in only one record |
| Test coverage | Self — this is the test file |

---

## Acceptance Criteria Verification

### #108 — Perf: pre-compute available channels during parse instead of on every render

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `Activity` type includes `availableChannels: Set<ChannelKey>` | `types.ts:100` | All 35 test files compile | ✅ Met |
| 2 | Parser populates the set during normalisation | `parser.ts:401` — calls `channelsPresentInRecords(records)` after cadence doubling and pace removal | `parser.test.ts:channelsPresentInRecords_*` (4 tests) | ✅ Met |
| 3 | `deriveAvailableChannels()` reads from the cached set, no record iteration | `channels.ts:20-26` — iterates `a.availableChannels` sets, not `a.records` | `channels.test.ts:deriveAvailableChannels_*` (7 tests) | ✅ Met |
| 4 | No change in which channels are reported as available | `channels.ts:25` — filters through `ALL_CHANNELS` which is identical to `ALL_RECORD_CHANNELS` in parser.ts (both 14 channels, same entries) | `channels.test.ts` — union, ordering, empty cases all pass | ✅ Met |

**Summary:** 4/4 criteria met.

---

## Findings

### Major (should fix)

#### M1 — Unnecessary change to line 242 in ActivityMap.svelte

- **Category:** Code Quality
- **Location:** `src/lib/components/map/ActivityMap.svelte:242`
- **Description:** The diff changes `activity.id` → `activities[i].id` in two locations. The fix at **line 380** (hover markers loop) is correct — `activity` is not declared in that loop scope. However, the change at **line 242** (trace rendering loop) is unnecessary: line 241 declares `const activity = activities[i]`, so `activity.id` was already correct and resolves to the same value. While semantically equivalent (no bug introduced), it obscures the local variable and makes the code inconsistent — the loop declares `activity` but then doesn't use it for the colour lookup.
- **Recommendation:** Revert line 242 to `colourMap.get(activity.id)` to preserve the intent of the local variable declaration. Alternatively, if `activities[i].id` is preferred, remove the unused `const activity = activities[i]` on line 241 — but that variable is used later in the loop, so reverting line 242 is the cleaner option.

### Minor (nice to fix)

#### m1 — Duplicate `ALL_RECORD_CHANNELS` / `ALL_CHANNELS` arrays

- **Category:** Code Quality
- **Location:** `src/lib/fit/parser.ts:170-180` and `src/lib/utils/channels.ts:3-18`
- **Description:** Two identical 14-element `ChannelKey[]` arrays exist in different files. If a new channel is added to one but not the other, `channelsPresentInRecords()` and `deriveAvailableChannels()` would silently diverge. This PR does not introduce the duplication (it existed before), but the refactoring increases the coupling — `deriveAvailableChannels` now depends on the parser's `channelsPresentInRecords` producing a superset of what `ALL_CHANNELS` filters for.
- **Recommendation:** Consider exporting `ALL_RECORD_CHANNELS` from `parser.ts` and importing it in `channels.ts` to make the single-source-of-truth explicit. Low priority — the arrays are type-checked as `ChannelKey[]` so a typo would be caught, but a missing entry would not.

#### m2 — Double record scan at parse time

- **Category:** Performance
- **Location:** `src/lib/fit/parser.ts:401-402`
- **Description:** `channelsPresentInRecords(records)` is called on line 401, and `buildDeviceStreams(devices, records)` on line 402 calls it again internally. For a 3,600-record file this means ~100k field checks instead of ~50k at parse time. This was a deliberate design trade-off (documented in the Design section) to avoid changing `buildDeviceStreams`' signature.
- **Recommendation:** No action needed — the cost is negligible at parse time (once per file load, <1ms). Noted for completeness.

### Suggestions (optional)

#### S1 — Consider a shared `makeActivity` test helper

- **Description:** 17 test files each define their own `makeActivity` helper with identical boilerplate. Adding `availableChannels` required touching all 17 files. A shared helper in `src/lib/test-utils.ts` would reduce future boilerplate churn.
- **Recommendation:** Not blocking. Could be addressed in a future cleanup PR.

---

## Positive Observations

- Clean separation of concerns: the refactoring changes 3 production files with minimal line count (+9/-4 net) for a meaningful performance improvement.
- `channelsPresentInRecords` is correctly called **after** sport-specific record mutations (`applyRunningCadenceDoubling`, `removeCyclingPace`) so `availableChannels` reflects the final record state. This is a subtle ordering detail that was handled correctly.
- Canonical channel ordering preserved via `ALL_CHANNELS.filter()` — the UI channel list order won't change.
- Test fixtures with `...overrides` spread correctly place `availableChannels` before the spread so tests can override the field.
- The `channels.test.ts` `makeActivity` helper imports `channelsPresentInRecords` to build accurate fixtures, ensuring tests validate real parser-consistent behaviour rather than hand-crafted sets.
- Bonus bug fix (hover marker colour) was identified, fixed, and separately committed — good commit hygiene.

---

## Action Items

### Before merge
- [ ] M1: Revert `activities[i].id` back to `activity.id` on line 242 of `ActivityMap.svelte` (the local variable is in scope there)

### Post-merge improvements
- [ ] m1: Consolidate `ALL_RECORD_CHANNELS` and `ALL_CHANNELS` into a single exported constant
- [ ] S1: Consider extracting a shared `makeActivity` test helper

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
- [x] No unnecessary changes outside scope of the issue (M1 noted — cosmetic, not harmful)
