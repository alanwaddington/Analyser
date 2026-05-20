# PR #47 Review — feat: Create /event Event Comparison page (#18)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/18-event-page → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 24/24 met |

---

## Issues Reviewed

### Issue Hierarchy
- #18 — Step 18: Create /event/+page.svelte (Event Comparison view) (standalone)

---

## Changed Files Audit

### `src/lib/utils/segments.ts` (+19 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure function `buildSegments(activity)` — converts an activity's laps to `Segment[]` for SegmentChart, with 1 km fallback when ≤1 lap |
| Issues | #18 |
| Criteria covered | AC10, AC13 |
| Quality | Clean, follows established pure-function utility pattern matching `buildLapMarkers`. Handles undefined activity, empty records, multi-lap, single-lap fallback, and sub-1km edge cases. |
| Test coverage | `segments.test.ts` — 7 tests covering all branches |

### `src/lib/utils/segments.test.ts` (+77 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `buildSegments` |
| Issues | #18 |
| Criteria covered | AC10, AC13 |
| Quality | Well-structured with `makeRecord`, `makeLap`, `makeActivity` helpers matching existing codebase test conventions (`lapMarkers.test.ts`, `channels.test.ts`). Tests cover: undefined activity, empty records, sub-1km, multi-lap, single-lap fallback, no-lap fallback, exactly 1 km boundary. |
| Test coverage | N/A — this is the test file |

### `src/routes/event/+page.svelte` (+370 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Event Comparison page with four tabs (Charts, Map, Segments, Summary), green accent, DeltaChart pinned, reference-aware charts/map, activity-row summary table |
| Issues | #18 |
| Criteria covered | AC1–AC9, AC11–AC24 |
| Quality | Clean composition of existing components. Mirrors `/compare` page structure precisely with event-specific differences. Uses `$derived` for all reactive derivations. `$effect` for channel init and redirect. Proper ARIA attributes. Theme-compatible CSS. |
| Test coverage | Type-checked via `npm run check`; component not unit-testable in Vitest node env (SvelteKit routing + component composition — expected, matches codebase pattern) |

---

## Acceptance Criteria Verification

### #18 — Step 18: Create /event/+page.svelte (Event Comparison view)

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | `src/routes/event/+page.svelte` file exists | File created | N/A | ✅ Met |
| AC2 | Tab bar renders four tabs: Charts, Map, Segments, Summary | `+page.svelte:19-24` — `TABS` array with four entries; `+page.svelte:92-103` — rendered via `{#each}` | N/A | ✅ Met |
| AC3 | Active tab has `#22c55e` green underline; inactive tabs no underline | `+page.svelte:229-232` — `.tab.active { color: #22c55e; border-bottom-color: #22c55e; }` and `:212-222` — `.tab { border-bottom: 2px solid transparent; }` | N/A | ✅ Met |
| AC4 | Only one tab's content visible at a time | `+page.svelte:112-192` — `{#if activeTab === 'charts'} ... {:else if} ...` | N/A | ✅ Met |
| AC5 | Charts tab is the default active tab | `+page.svelte:29` — `?? 'charts'` fallback | N/A | ✅ Met |
| AC6 | `ChannelToggleBar` appears below tab bar on Charts tab | `+page.svelte:113-115` — `<ChannelToggleBar channels={availableChannels} />` in toolbar div | N/A | ✅ Met |
| AC7 | `DeltaChart` pinned at top of Charts scroll area, always visible | `+page.svelte:117-123` — DeltaChart in its own card above the `{#if $activeChannels}` block | N/A | ✅ Met |
| AC8 | One `TimeSeriesChart` per active channel with `referenceIndex` prop set | `+page.svelte:127-136` — `{#each $activeChannels as channel}` with `referenceIndex={$referenceIndex}` | N/A | ✅ Met |
| AC9 | `seriesInputs` built as `activities.map((a, i) => ({ activity: a, colourIndex: i }))` | `+page.svelte:49-51` — exact pattern | N/A | ✅ Met |
| AC10 | Lap markers from reference activity's laps or 1 km fallback | `+page.svelte:52` — `buildLapMarkers($activities[$referenceIndex], $xAxisMode)` | `lapMarkers.test.ts` (existing, 9 tests) | ✅ Met |
| AC11 | All charts use group ID `'event-charts'` | `+page.svelte:121` — DeltaChart `groupId="event-charts"`; `+page.svelte:134` — TimeSeriesChart `groupId="event-charts"` | N/A | ✅ Met |
| AC12 | Map tab: ActivityMap with `activities`, `referenceIndex`, `hoveredDistance={null}` | `+page.svelte:142` — all three props present | N/A | ✅ Met |
| AC13 | Segments tab: SegmentChart with segments from reference laps or 1 km fallback | `+page.svelte:53` — `buildSegments($activities[$referenceIndex])`; `+page.svelte:149-155` — SegmentChart with `{segments}` | `segments.test.ts` — 7 tests | ✅ Met |
| AC14 | Segments tab shows "Load at least 2 activities" when < 2 | `+page.svelte:146-147` — `{#if $activities.length < 2}` with message | N/A | ✅ Met |
| AC15 | Summary table rows = activities with reference first, columns: Activity, Date, Total Time, Distance, Avg HR, Max HR, Avg Pace, Avg Power | `+page.svelte:54-58` — `summaryRows` sorted with reference first; `+page.svelte:162-170` — all 8 column headers | N/A | ✅ Met |
| AC16 | Reference row has `border-left: 3px solid #f59e0b` | `+page.svelte:366-369` — `.row-reference td:first-child { border-left: 3px solid #f59e0b; }` | N/A | ✅ Met |
| AC17 | Summary cells show `"—"` when field not present | `+page.svelte:183-186` — ternary with `'—'` fallback for HR, Pace, Power | N/A | ✅ Met |
| AC18 | Avg HR/Max HR use `summarise(extractChannel(records, 'heartRate'))`; Avg Power uses `summarise(extractChannel(records, 'power'))` | `+page.svelte:175-176` — exact pattern | N/A | ✅ Met |
| AC19 | Avg Pace computed from `totalDistance`/`totalElapsedTime`, formatted as min/km | `+page.svelte:177` — `totalElapsedTime / totalDistance * 1000`; `+page.svelte:83-87` — `formatPace` formats as `M:SS /km` | N/A | ✅ Met |
| AC20 | `$effect` calls `goto('/')` when `$activities.length === 0` | `+page.svelte:66-68` — exact pattern | N/A | ✅ Met |
| AC21 | Active tab reflected in URL (`?tab=`) for browser back/forward | `+page.svelte:28-29` — reads from `page.url.searchParams.get('tab')`; `+page.svelte:32-34` — `goto('?tab=${id}', { replaceState: true })` | N/A | ✅ Met |
| AC22 | Keyboard navigation (ArrowLeft/ArrowRight) and WAI-ARIA Tabs Pattern | `+page.svelte:36-46` — `handleTabKey` with ArrowLeft/ArrowRight; `+page.svelte:91-103` — `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`; `+page.svelte:106-111` — `role="tabpanel"`, `aria-labelledby` | N/A | ✅ Met |
| AC23 | `activeChannels` initialised to all available on first load | `+page.svelte:60-63` — `$effect` sets when `availableChannels.length > 0 && $activeChannels.length === 0` | N/A | ✅ Met |
| AC24 | `npm run check` passes with 0 errors and 0 warnings | 395 files, 0 errors, 0 warnings | N/A | ✅ Met |

**Summary:** 24/24 criteria met.

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

- **Clean utility extraction**: `buildSegments` is a pure function in a separate file, thoroughly tested with 7 tests covering all branches and edge cases. Follows the established pattern from `buildLapMarkers` and `deriveAvailableChannels`.
- **Exact pattern mirroring**: The `/event` page closely mirrors `/compare` in structure, layout, ARIA, and CSS — only changing what's event-specific (green accent, DeltaChart, Segments tab, activity-row summary). This consistency reduces cognitive load for both users and developers.
- **Smart type casting**: `seriesInputs as DeltaSeriesInput[]` and `as SegmentSeriesInput[]` correctly leverage the identical shape across all three `*SeriesInput` types without unnecessary separate derivations.
- **Reference-aware throughout**: All components receive `referenceIndex` from the store — DeltaChart, TimeSeriesChart, SegmentChart, and ActivityMap all get the prop, enabling dashed reference lines and reference-relative delta computation.
- **Summary table formatting**: Date, duration, and pace formatters are clean, handle edge cases (hours > 0 toggle, zero distance → `—`), and produce human-readable output (`5:23 /km`, `1:02:34`, `20 May 2026`).
- **Correct sort for reference row**: `summaryRows` sorts the reference activity to the top without mutating the original array, using a stable comparison function.
- **Full WAI-ARIA Tabs Pattern**: Unlike the original `/compare` page (which added `tabpanel` as a post-merge suggestion in PR #45), this page ships with complete ARIA from day one — `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`, `aria-labelledby`.

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
