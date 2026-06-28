# PR #156 Review — feat: custom event segments with Shift+drag creation and per-segment stats (#113)

**Date:** 2026-06-28 (updated after review-fix commit 93d403b)
**Author:** alanwaddington
**Branch:** feature/113-custom-segments → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 16/16 Met |

All 16 acceptance criteria verified against code. All 5 findings from the initial review (M1, m1, m2, m3, S1) resolved in commit `93d403b`. One new minor observation noted below (test import inconsistency — no action required before merge).

---

## Issues Reviewed

### Issue Hierarchy
- #113 — Enhancement: user-defined custom segments for event comparison (root — no parent, no sub-issues)

---

## Changed Files Audit

### `src/lib/analytics/segmentStats.ts` (+132 / -0)

| Property | Detail |
|----------|--------|
| Purpose | New pure function `computeSegmentStats()` — computes time, pace, avg/max power, % CP/FTP, avgHR, HR zone distribution for a segment of an activity |
| Issues | #113 |
| Criteria covered | AC5, AC6, AC7, AC8, AC9 |
| Quality | ✅ Clean pure function, no side effects. Early-return guard for empty records and out-of-range segments. Consistent with existing `segmentTime` guard logic. |
| Test coverage | `segmentStats.test.ts` — 25 tests covering time, pace, power, HR, CP%, FTP%, zone distribution, no-profile fallback |

### `src/lib/analytics/segmentStats.test.ts` (+339 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `computeSegmentStats` |
| Issues | #113 |
| Criteria covered | AC16 (unit tests for segment stats) |
| Quality | ✅ Comprehensive coverage: 7 describe blocks, 25 tests, covers happy paths, edge cases (empty activity, out-of-range segment, no power, no HR, no profile), and all profile combinations |
| Test coverage | Is the test itself |

### `src/lib/components/charts/SegmentChart.svelte` (+169 / -6)

| Property | Detail |
|----------|--------|
| Purpose | Adds per-segment stats table below chart; dashed purple border on custom segment bars; enhanced tooltip showing time/pace/power/HR/zone stats |
| Issues | #113 |
| Criteria covered | AC2 (visual distinction), AC5 (power label), AC6 (% CP), AC7 (% FTP), AC8 (HR zones), AC9 (fallback), S1 (visual distinction) |
| Quality | ✅ Tooltip correctly sanitises all string values via `esc()`. Table conditionally renders power/HR columns only when at least one row has data. Custom segment rows styled purple via `.seg-custom`. |
| Test coverage | ⚠️ No automated test for tooltip rendering or table display — manual verification required |

### `src/lib/components/charts/SegmentChart.utils.ts` (+2 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Extends `Segment` interface with `custom?: boolean` and `id?: string` |
| Issues | #113 |
| Criteria covered | AC2, AC4 (custom flag carried through merge) |
| Quality | ✅ Minimal, additive change |
| Test coverage | Indirectly via `segments.test.ts` |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+418 / -1)

| Property | Detail |
|----------|--------|
| Purpose | Adds: ECharts brush component (Shift+drag) in distance mode; name-prompt UI; custom segment markArea bands; `onSegmentResize` drag-handle interaction; `onDestroy` cleanup for dedup map and resize listeners |
| Issues | #113 |
| Criteria covered | AC1 (drag to select), AC3 (bands persist via parent), S2 (vertical bands), S4 (resize drag handles), m2 fix (dedup cleanup), S1 fix (drag handles) |
| Quality | ✅ Brush state is module-level (`<script module>`) to share across all chart instances. Resize drag uses ZRender intercept (`e.stop()`) to prevent pan/zoom conflicts. `effectiveBands` gives real-time preview during drag. `onDestroy` now cleans up both `_brushGroupHandledMs[groupId]` (m2) and the window-level resize listeners. |
| Test coverage | ⚠️ Chart interaction not unit-testable; covered by Playwright probe P2/P3/P11 |

### `src/lib/components/ui/SegmentManager.svelte` (+444 / -0)

| Property | Detail |
|----------|--------|
| Purpose | New component: lists custom segments for current course with inline rename/resize/delete and JSON import/export |
| Issues | #113 |
| Criteria covered | AC10 (rename), AC11 (resize), AC12 (delete), AC13 (management panel), S3 (management panel), S5 (import/export) |
| Quality | ✅ Delete requires confirmation via `confirmDelete` state. Import validates format and `startDist < endDist` (m1 fix). Export names file `segments-{courseKey}.json`. Empty-state message present. |
| Test coverage | ⚠️ No automated component test — manual verification via Playwright P3 |

### `src/lib/stores/customSegments.ts` (+133 / -0)

| Property | Detail |
|----------|--------|
| Purpose | New store: CRUD operations for custom segments with localStorage persistence keyed by course identity |
| Issues | #113 |
| Criteria covered | AC3 (persist), AC10 (rename), AC11 (resize), AC12 (delete), AC14 (sync via onChange hook) |
| Quality | ✅ `getSegments` returns a copy (`[...array]`) to trigger Svelte reactivity. `replaceAllSegments` does not fire onChange (system write, not user action). `saveCache` handles `QuotaExceededError` with a toast. `addToast` import is appropriate. |
| Test coverage | `customSegments.test.ts` — 35 tests covering all CRUD paths, persistence, malformed data, onChange hook |

### `src/lib/stores/customSegments.test.ts` (+360 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the custom segments store |
| Issues | #113 |
| Criteria covered | AC16 (unit tests for storage and course identity) |
| Quality | ✅ Uses `vi.resetModules()` before each test to clear module-level cache — correct pattern for this store. Mocks `localStorage` and `crypto.randomUUID` cleanly. |
| Test coverage | Is the test itself |

### `src/lib/stores/sync.ts` (+22 / -6)

| Property | Detail |
|----------|--------|
| Purpose | Extends push/pull payload to include segments; wires `setOnSegmentChange` hook; adds `resetSyncIdentity` DELETE of old UUID's KV keys |
| Issues | #113 |
| Criteria covered | AC14 (segments sync across devices); M1 fix (orphan KV cleanup) |
| Quality | ✅ `pushLabels` sends segments alongside labels. `pullLabels` applies `replaceAllSegments` when present. `initSync` registers `setOnSegmentChange(triggerPush)` matching the label pattern exactly. `resetSyncIdentity` fires DELETE fire-and-forget with `.catch(() => {})` — failure is non-blocking. Comment notes code index key left to expire via TTL (deliberate). |
| Test coverage | ⚠️ No automated test for DELETE path or sync round-trip — existing sync tests unchanged |

### `src/lib/types.ts` (+7 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Adds `CustomSegment` interface as the canonical definition (m3 fix) |
| Issues | #113 |
| Criteria covered | m3 (canonical type location) |
| Quality | ✅ Correctly placed before `AnomalyDetectionOptions`. All 5 production import sites updated. |
| Test coverage | Compile-time only |

### `src/lib/utils/segments.ts` (+23 / -8)

| Property | Detail |
|----------|--------|
| Purpose | Extends `buildSegments()` to accept and merge `CustomSegment[]` after auto-lap segments |
| Issues | #113 |
| Criteria covered | AC4 (custom segments appear alongside auto-laps) |
| Quality | ✅ Custom segments appended with `custom: true` and `id` set. Auto-lap segments untouched (no `custom` field). |
| Test coverage | `segments.test.ts` — 6 new tests for merging, custom flag, id preservation |

### `src/lib/utils/segments.test.ts` (+74 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `buildSegments` with custom segments |
| Issues | #113 |
| Criteria covered | AC16 (unit tests for merge with auto-laps) |
| Quality | ✅ Covers: ordering, custom flag presence, id preservation, empty custom array, multiple custom segments |
| Test coverage | Is the test itself |

### `src/routes/api/labels/[uuid]/+server.ts` (+61 / -11)

| Property | Detail |
|----------|--------|
| Purpose | Adds `segments` field to GET/PUT payload; adds new `DELETE` handler to purge KV keys on identity reset |
| Issues | #113 |
| Criteria covered | AC14 (sync payload includes segments); M1 fix (DELETE endpoint) |
| Quality | ✅ `DELETE` validates UUID via `UUID_REGEX` before touching KV. Both `labels:${uuid}` and `segments:${uuid}` deleted atomically via `Promise.all`. GET returns `segments` only if present in KV (backwards-compatible). PUT validator accepts optional `segments` field. |
| Test coverage | ⚠️ No automated API test for DELETE handler — covered by Playwright P6/P7 |

### `src/routes/event/+page.svelte` (+43 / -1)

| Property | Detail |
|----------|--------|
| Purpose | Wires up all custom segment functionality: `currentCourseKey`, reactive `customSegments`, `customSegmentBands` (with `id`), `handleSegmentCreate`, `handleSegmentResize`, renders `SegmentManager` in CollapsiblePanel |
| Issues | #113 |
| Criteria covered | AC1, AC3, AC4, AC10, AC11, AC12, AC13, S4 |
| Quality | ✅ `segmentsRevision` counter correctly triggers re-derivation from store on all CRUD operations. `customSegmentBands` includes `id` field for resize wiring. `handleSegmentResize` delegates to `resizeSegment` + `refreshCustomSegments`. |
| Test coverage | Playwright P2/P3/P9/P11 |

### `test-fixtures/Ayr_Parkrun_4.fit` and `Ayr_Parkrun_5.fit` (binary)

| Property | Detail |
|----------|--------|
| Purpose | Real FIT files added as test fixtures for end-to-end Playwright verification |
| Quality | ✅ Appropriate — enables realistic integration testing |
| Test coverage | Used by Playwright verify156.spec.ts |

---

## Acceptance Criteria Verification

### #113 — Enhancement: user-defined custom segments for event comparison

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | User can drag-select a distance range on any time-series chart (distance mode); a prompt appears for a name | `TimeSeriesChart.svelte` brush component + `pendingSegment` state + name prompt UI | Playwright P2/P11 | ✅ Met |
| AC2 | Custom segments appear in SegmentChart with a visual distinction (dashed border) | `SegmentChart.svelte:97-99` — `borderColor: '#8b5cf6', borderType: 'dashed'` | SegmentChart visual (manual) | ✅ Met |
| AC3 | Custom segments persist across page reloads | `customSegments.ts:47-56` — `saveCache` writes to localStorage; `getCache` reads on first access | `customSegments.test.ts:144-152` | ✅ Met |
| AC4 | Custom segments appear alongside auto-laps in event comparison view | `segments.ts:25-33` — `buildSegments` appends with `custom:true`; `event/+page.svelte:103` passes to charts | `segments.test.ts:78-148` | ✅ Met |
| AC5 | Per-segment power stats labelled by source (Stryd vs native watch) | `segmentStats.ts:18-24` — `derivePowerLabel` maps `powerSource`; `SegmentChart.svelte:155` renders `stats.powerLabel` | `segmentStats.test.ts:225-252` | ✅ Met |
| AC6 | When CP set, per-segment stats show avg % CP for running power | `segmentStats.ts:86-88` — `cpPct(avgPower, profile.cp)` when `isRunning && profile.cp` | `segmentStats.test.ts:156-189` | ✅ Met |
| AC7 | When FTP set, per-segment stats show avg % FTP for cycling power | `segmentStats.ts:88-90` — `ftpPct(avgPower, profile.ftp)` when `!isRunning && profile.ftp` | `segmentStats.test.ts:195-218` | ✅ Met |
| AC8 | When maxHR or LTHR set, per-segment stats show HR zone distribution | `segmentStats.ts:100-119` — 5-bucket zone distribution; `SegmentChart.svelte` table renders zone data | `segmentStats.test.ts:258-322` | ✅ Met |
| AC9 | Only absolute values shown when no profile thresholds configured | `segmentStats.ts:83-90,102-109` — all profile-derived fields null when `profile` absent or thresholds zero | `segmentStats.test.ts:328-339` | ✅ Met |
| AC10 | User can rename a custom segment after creation | `customSegments.ts:74-83` — `renameSegment`; `SegmentManager.svelte:57-63` — inline edit | `customSegments.test.ts:159-182` | ✅ Met |
| AC11 | User can resize a custom segment (change start/end distance) | `customSegments.ts:86-96` — `resizeSegment`; `SegmentManager.svelte:57-63` — distance inputs; `TimeSeriesChart` drag handles | `customSegments.test.ts:188-214` | ✅ Met |
| AC12 | User can delete a custom segment | `customSegments.ts:99-108` — `removeSegment`; `SegmentManager.svelte:66-79` — delete with confirmation | `customSegments.test.ts:220-243` | ✅ Met |
| AC13 | A segment management panel lists custom segments with rename/resize/delete controls | `SegmentManager.svelte` (444 lines); rendered in `event/+page.svelte` CollapsiblePanel | Playwright P3 | ✅ Met |
| AC14 | Custom segments included in sync payload — creating on one device makes it available on another | `sync.ts:79-84` — `pushLabels` sends `segments`; `sync.ts:121-123` — `pullLabels` applies `replaceAllSegments`; `/api/labels/[uuid]` GET/PUT handles `segments` field | ⚠️ No automated sync integration test | ✅ Met |
| AC15 | All existing tests pass (955+ tests, 0 failures) | PR states 1021 tests, 0 failures; `npm run check` passes with 0 errors | CI | ✅ Met |
| AC16 | New unit tests cover: segment storage, course identity, segment stats, merge with auto-laps | `customSegments.test.ts` (35 tests), `segmentStats.test.ts` (25 tests), `segments.test.ts` (6 new tests) | All passing | ✅ Met |

**Summary: 16/16 criteria met.**

---

## Findings

### Previous Review Findings — All Resolved

The following findings from the initial review have been fully addressed in commit `93d403b`:

| Finding | Description | Resolution |
|---------|-------------|------------|
| M1 — KV orphan on identity reset | `resetSyncIdentity` left old UUID's KV keys (`labels:${uuid}`, `segments:${uuid}`) in place | `DELETE /api/labels/[uuid]` endpoint added; `resetSyncIdentity` fires DELETE fire-and-forget before switching identity |
| m1 — Import validation missing | SegmentManager JSON import accepted segments where `startDist >= endDist` | `SegmentManager.svelte:109-111` — throws with descriptive error when `startDist >= endDist` |
| m2 — `_brushGroupHandledMs` leak | `onDestroy` did not remove the per-group dedup entry, leaving stale timestamps after unmount | `TimeSeriesChart.svelte:702` — `delete _brushGroupHandledMs[groupId]` added to `onDestroy` |
| m3 — `CustomSegment` type location | `CustomSegment` defined in `customSegments.ts` rather than `types.ts` | Moved to `src/lib/types.ts:199-204`; all 5 import sites updated; `customSegments.ts` re-exports for backward compatibility |
| S1 — No drag handles for resize | Segment boundaries had no visual affordance for dragging | ZRender `mousemove`/`mousedown` intercept with `col-resize` cursor, real-time preview via `effectiveBands`, commit via `onSegmentResize` prop; `event/+page.svelte` wired to `resizeSegment` |

### New Findings

#### Minor (nice to fix)

##### m1 — `segments.test.ts` imports `CustomSegment` from store instead of `types.ts`

- **Category:** Code Quality
- **Location:** `src/lib/utils/segments.test.ts:4`
- **Description:** `import type { CustomSegment } from '$lib/stores/customSegments'` — the m3 fix updated all 5 production import sites to use `$lib/types`, but this test file still imports via the store re-export. The re-export in `customSegments.ts` (`export type { CustomSegment }`) means it compiles and runs correctly, but it's inconsistent with the m3 intent.
- **Recommendation:** Change line 4 to `import type { CustomSegment } from '$lib/types'`. One-line fix. *(Non-blocking — no action required before merge.)*

---

## Positive Observations

- **Brush interaction robustness** — the journey from naive per-instance state to module-level `<script module>` is well-documented in the commit history. The final design correctly handles all edge cases: key-repeat flooding, Shift-release-before-mouseup race, `ec.connect()` broadcast to all instances, and per-group dedup with timestamp comparison.
- **Svelte 5 reactivity pattern** — `getSegments` returning a copy (`[...(getCache()[key] ?? [])]`) to break reference equality is a subtle but correct fix. The `segmentsRevision` counter pattern in the event page is a clean way to force re-derivation from a non-reactive module store.
- **Test coverage quality** — 35 store tests, 25 stats tests, 6 merge tests. Each test is named with the `functionName_condition_expectedBehaviour` convention used throughout the codebase. Edge cases (malformed localStorage, segment beyond activity end, no profile) are explicitly covered.
- **Backwards compatibility** — sync payload extension is genuinely backwards-compatible: `segments` is optional in both GET and PUT, old clients ignore the new field, new clients handle missing field gracefully.
- **DELETE endpoint design** — leaves the `code:${shortCode}` index key to expire via 90-day TTL rather than deleting it (noted in JSDoc). Correct decision: a secondary lookup key becoming stale is harmless, and a dangling short code just returns 404 on resolve.
- **Resize drag handle UX** — `e.stop()` prevents drag from triggering ECharts' `dataZoom:inside` pan; `chart.setOption({ dataZoom: [{ type: 'inside', disabled: true }] })` during drag ensures clean separation; re-enabled on mouseup. Window-level move/up handlers handle out-of-canvas dragging. Minimum 1m enforcement in the commit handler prevents zero-width segments.

---

## Action Items

### Immediate Fixes (block merge)
None.

### Post-merge improvements
- [ ] m1: Update `src/lib/utils/segments.test.ts:4` to import `CustomSegment` from `'$lib/types'` instead of `'$lib/stores/customSegments'` — one-line consistency fix

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
