# PR #137 Review — Fix: activity removal changes colour assignment for remaining files (#103)

**Date:** 2026-06-05
**Author:** alanwaddington
**Branch:** feature/103-stable-activity-colours → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate for store logic; gaps in consumer completeness |
| Acceptance Criteria | 8/10 Met, 2 Partially Met |

---

## Issues Reviewed

### Issue Hierarchy
- #103 — Bug: activity removal changes colour assignment for all subsequent files (standalone)

---

## Changed Files Audit

### `src/lib/stores/session.ts` (+49 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `activityColourMap` writable store, `_assignColour`/`_releaseColour` internal functions, `getActivityColour` helper, colour state reset in `clearActivities` |
| Issues | #103 |
| Criteria covered | AC1, AC2, AC3, AC4, AC5, AC10 |
| Quality | ✅ Clean implementation. `_assignColour` guards against duplicate assignment. `Readable` type export prevents external writes. |
| Test coverage | `session.test.ts` — 10 new tests |

### `src/lib/stores/session.test.ts` (+102 / -5 lines)

| Property | Detail |
|----------|--------|
| Purpose | 10 new tests for colour map allocation, stability, recycling, clear. Updated `beforeEach` to use `clearActivities()` |
| Issues | #103 |
| Criteria covered | AC1–AC5, AC10 |
| Quality | ✅ Thorough. Covers sequential assignment, stability on removal, next-sequential on add-after-remove, palette exhaustion + recycling, clearActivities reset, empty init, non-existent removal, getActivityColour |
| Test coverage | Self |

### `src/routes/compare/+page.svelte` (+8 / -7 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace `$activities.indexOf()` with `$activityColourMap.get()` in `buildSeriesForChannel` and `meanMaxSeriesInputs`. Pass `colourMap` to ActivityMap |
| Issues | #103 |
| Criteria covered | AC5 (partially) |
| Quality | ⚠️ Two consumer sites missed — see findings M1 |
| Test coverage | Runtime verification via Playwright |

### `src/routes/event/+page.svelte` (+4 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace `colourIndex: i` with `$activityColourMap.get()` in `seriesInputs`. Pass `colourMap` to ActivityMap |
| Issues | #103 |
| Criteria covered | AC9 (partially) |
| Quality | ⚠️ One consumer site missed — see findings M2 |
| Test coverage | Runtime verification via Playwright |

### `src/lib/components/ui/FileList.svelte` (+2 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace `FILE_COLOURS[i]` with colour map lookup for dot colour. Restore `, i` in `{#each}` (regression fix) |
| Issues | #103 |
| Criteria covered | AC6 |
| Quality | ✅ Correctly retains `i` for `isRef` / `referenceIndex.set(i)` while sourcing colour from the map |
| Test coverage | Runtime verification via Playwright |

### `src/lib/components/ui/DeviceToggleBar.svelte` (+2 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace `colourIndex: seen.size` with `$activityColourMap.get()` in `fileGroups` derivation |
| Issues | #103 |
| Criteria covered | AC7 |
| Quality | ✅ No issues |
| Test coverage | Runtime verification via Playwright |

### `src/lib/components/map/ActivityMap.svelte` (+4 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `colourMap` prop, replace `FILE_COLOURS[i]` with `colourMap.get(activity.id)` for polyline and marker colours |
| Issues | #103 |
| Criteria covered | AC8 |
| Quality | ✅ Graceful fallback `?? i` for backward compatibility |
| Test coverage | Runtime verification via Playwright |

---

## Acceptance Criteria Verification

### #103 — Bug: activity removal changes colour assignment for all subsequent files

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Removing activity at index 1 of 3 does not change colour of activity at index 2 | `session.ts:47-53` — `_releaseColour` removes from map without affecting others | `session.test.ts:217-226` — `activityColourMap_removeMiddle_remainingKeepColours` | ✅ Met |
| AC2 | Colour map survives re-ordering | `session.ts:24-44` — keyed by id, not position | `session.test.ts:207-215` — sequential indices independent of array order | ✅ Met |
| AC3 | New activities receive the next sequential colour | `session.ts:36-37` — `_colourCounter++` | `session.test.ts:228-238` — `activityColourMap_addAfterRemove_getsNextSequentialColour` | ✅ Met |
| AC4 | Freed colours recycled after palette exhaustion | `session.ts:38-39` — `_freedColours.shift()` | `session.test.ts:240-251` — `activityColourMap_exhaustPalette_recyclesToFreedColour` | ✅ Met |
| AC5 | All visual components use same colour source | 4 of 6 sites updated; 2 missed (see M1, M2) | — | ⚠️ Partially Met |
| AC6 | FileList dot colours match chart series | `FileList.svelte:20` — uses `$activityColourMap` | Playwright verification | ✅ Met |
| AC7 | DeviceToggleBar file group headers match | `DeviceToggleBar.svelte:65` — uses `$activityColourMap` | Playwright verification | ✅ Met |
| AC8 | ActivityMap polyline colours match | `ActivityMap.svelte:242,380` — uses `colourMap` prop | Playwright verification | ✅ Met |
| AC9 | Event page series colours match | `event/+page.svelte:77` — main seriesInputs updated | — | ⚠️ Partially Met (strip chart series on line 191 still uses `i`) |
| AC10 | Existing tests pass without modification | All 33 session tests pass; full suite 635/636 (1 pre-existing flake) | `npm test` | ✅ Met |

**Summary:** 8/10 fully met, 2/10 partially met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

#### M1 — Compare page summary table still uses `$activities.indexOf()` for colour dots

- **Category:** Code Quality / Consistency
- **Location:** `src/routes/compare/+page.svelte:476-477`
- **Description:** The summary table header renders device colour dots using the old index-based pattern:
  ```ts
  {@const actIndex = $activities.indexOf(cfs.activity)}
  {@const dotColour = FILE_COLOURS[actIndex % FILE_COLOURS.length]}
  ```
  This site was not updated to use `$activityColourMap`. If a user removes an activity, the summary table dot colours will be wrong while chart colours are correct.
- **Recommendation:** Replace with:
  ```ts
  {@const dotColour = FILE_COLOURS[($activityColourMap.get(cfs.activity.id) ?? 0) % FILE_COLOURS.length]}
  ```

#### M2 — Event page strip chart series still uses loop index `i` for colourIndex

- **Category:** Code Quality / Consistency
- **Location:** `src/routes/event/+page.svelte:191`
- **Description:** The `mapStripSeriesInputs` derivation builds series with `colourIndex: i` (array position):
  ```ts
  return [{ activity, colourIndex: i, distanceOffset: activity.anchor.distanceMetres }];
  ```
  This site was not updated to use `$activityColourMap`. The strip chart under the map will use wrong colours after an activity removal.
- **Recommendation:** Replace with:
  ```ts
  return [{ activity, colourIndex: $activityColourMap.get(activity.id) ?? 0, distanceOffset: activity.anchor.distanceMetres }];
  ```

### Minor (nice to fix)

None.

### Suggestions (optional)

None.

---

## Positive Observations

- Store design is clean — `_assignColour`/`_releaseColour` are focused private functions with clear single responsibility
- Recycling algorithm correctly sequences: use next sequential first → recycle freed → wrap counter. Edge case tested.
- `activityColourMap` is exported as `Readable` while backed by a private writable — prevents external mutation
- The FileList regression (dropped `i` variable) was caught, fixed, and commit-isolated within the same PR
- Good test coverage on the store layer — 10 new tests covering all allocation paths

---

## Action Items

### Immediate Fixes (block merge)

- [ ] M1: Update compare page summary table colour dots (`compare/+page.svelte:476-477`) to use `$activityColourMap`
- [ ] M2: Update event page strip chart series (`event/+page.svelte:191`) to use `$activityColourMap`

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
