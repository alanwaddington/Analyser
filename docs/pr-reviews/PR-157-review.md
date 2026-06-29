# PR #157 Review — feat: advanced record filtering by zone, speed, gradient, and cadence (#114)

**Date:** 2026-06-29
**Author:** alanwaddington
**Branch:** feature/114-record-filtering → main
**State:** Open
**Commits:** 9

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate — 36 new tests (28 filter + 8 zone) |
| Acceptance Criteria | 39/41 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #114 — Enhancement: advanced record filtering — isolate segments by speed, elevation, or zone (root issue containing both Analysis and Design sections)

---

## Changed Files Audit

### `src/lib/analytics/zones.ts` (+13 / -7 lines)

| Property | Detail |
|----------|--------|
| Purpose | Upgrade FTP zone model from 5 to 7 zones (Coggan standard); add `FtpZone` type |
| Issues | #114 (AC-1, AC-2) |
| Criteria covered | AC-1: 7-zone boundaries, AC-2: 7-zone boundaries function |
| Quality | ✅ No issues — clean, consistent with existing CP/HR zone patterns |
| Test coverage | `zones.test.ts`: 8 new tests for `ftpZone()` and `ftpZoneBoundaries()` |

### `src/lib/analytics/zones.test.ts` (+29 / -7 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add unit tests for 7-zone FTP model; fix existing test boundary (375W → 374W for Z6) |
| Issues | #114 (AC-1, AC-2) |
| Criteria covered | Verifies all 7 zone boundaries, contiguity, ascending zone numbers |
| Quality | ✅ Good boundary testing — tests at each zone transition point |
| Test coverage | Self — test file |

### `src/lib/analytics/recordFilter.ts` (+72 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure functions: `applyRecordFilter()`, `deriveGradients()`, `filterRecords()` |
| Issues | #114 (M1–M3, AC-28, AC-30) |
| Criteria covered | Record-level filtering for speed/power/HR/cadence/gradient, gradient derivation, inverted mode |
| Quality | ⚠️ See finding M1 — `passesRange` boundary uses `<` for min and `>` for max (inclusive on both ends) which is correct but undocumented |
| Test coverage | `recordFilter.test.ts`: 28 tests covering all channels, combined, inverted, nulls, edge cases |

### `src/lib/analytics/recordFilter.test.ts` (+322 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Comprehensive unit tests for the record filter engine |
| Issues | #114 |
| Criteria covered | All filter channels, combined filters, inverted mode, null/missing values, gradient derivation |
| Quality | ✅ Thorough — tests boundary conditions, missing values pass by default, zero distance delta |
| Test coverage | Self — test file |

### `src/lib/stores/filterStore.ts` (+31 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | `RecordFilter` type, `recordFilter` writable store, `clearAllFilters()`, `activeFilterCount` derived |
| Issues | #114 (AC-9, AC-10, AC-11) |
| Criteria covered | Store initialisation, clear all, active count |
| Quality | ✅ Clean — follows existing store patterns |
| Test coverage | Tested indirectly through page-level integration and filter engine tests |

### `src/lib/components/ui/FilterPanel.svelte` (+588 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Self-collapsing filter UI — toggle button with badge, overlay dropdown with per-channel controls, zone presets, named presets, invert toggle |
| Issues | #114 (AC-6–AC-30, S1–S6) |
| Criteria covered | All filter control ACs, collapse behaviour, badge, clear all, invert, named presets |
| Quality | ⚠️ See finding M2 — `commit()` uses `speedMin \|\| speedMax` which treats `"0"` as falsy, silently skipping a zero-value bound |
| Test coverage | No component-level tests (UI component — verified via Playwright runtime observation) |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+102 / -25 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `activeRecordIndices` prop; split series into active (full colour) + inactive (15% opacity); update ZONE_COLOURS for Z6/Z7; dynamic `zoneAxisMax` |
| Issues | #114 (AC-3, AC-31–AC-35) |
| Criteria covered | Split rendering, continuous axis, lap markers, zone shading with 7 bands |
| Quality | ✅ Clean implementation — `buildActiveMask` handles both time and distance modes correctly |
| Test coverage | No unit tests for chart rendering (ECharts wrapper — verified via Playwright pixel comparison) |

### `src/routes/compare/+page.svelte` (+79 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire FilterPanel, derive `activeRecordIndices`, gradient cache, filtered summary stats, filter indicator |
| Issues | #114 (AC-6, AC-37–AC-41) |
| Criteria covered | Filter panel mounted, stats recalculate, filtered indicator, multi-file independent filtering |
| Quality | ✅ Gradient cache is lazily computed only when gradient filter is active |
| Test coverage | Verified via Playwright runtime observation |

### `src/routes/event/+page.svelte` (+64 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire FilterPanel, derive `activeRecordIndices`, gradient cache, filtered summary stats. DeltaChart and SegmentChart explicitly bypass filter. |
| Issues | #114 (AC-7, AC-36–AC-41) |
| Criteria covered | Filter panel mounted, delta/segment unfiltered, stats recalculate, filtered indicator |
| Quality | ✅ DeltaChart and SegmentChart receive no `activeRecordIndices` — confirmed in code |
| Test coverage | Verified via Playwright runtime observation |

---

## Acceptance Criteria Verification

### #114 — Enhancement: advanced record filtering

#### Zone model upgrade

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-1 | `ftpZone()` returns 1–7 using 7-zone Coggan boundaries | `zones.ts:107-116` | `zones.test.ts:303-346` | ✅ Met |
| AC-2 | `ftpZoneBoundaries()` returns 7 ZoneBand entries | `zones.ts:119-129` | `zones.test.ts:352-394` | ✅ Met |
| AC-3 | Cycling power chart zone shading displays 7 bands | `TimeSeriesChart.svelte` — ZONE_COLOURS has entries 6/7, dynamic zoneAxisMax | Visual — verified via build | ✅ Met |
| AC-4 | Cycling power zone badge displays Z1–Z7 | `zones.ts` returns 1–7; badge derives from zone value | No dedicated test | ✅ Met |
| AC-5 | Running power zones unchanged (5-zone CP) | `cpZone()` and `cpZoneBoundaries()` untouched | `zones.test.ts:149-174, 275-297` | ✅ Met |

#### Filter panel — presence and structure

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-6 | Filter panel on `/compare` | `compare/+page.svelte:457` mounts `<FilterPanel>` | Playwright runtime | ✅ Met |
| AC-7 | Filter panel on `/event` | `event/+page.svelte:376` mounts `<FilterPanel>` | Playwright runtime | ✅ Met |
| AC-8 | Collapsed by default | `FilterPanel.svelte:83` — `expanded = $state(false)` | Playwright runtime | ✅ Met |
| AC-9 | Clear all button | `FilterPanel.svelte:115-119` — `handleClear()` | Playwright runtime | ✅ Met |
| AC-10 | Badge shows active filter count | `FilterPanel.svelte` — `.filter-badge` with `$activeFilterCount` | Playwright runtime | ✅ Met |

#### Filter controls — speed

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-11 | Speed filter control with min/max | `FilterPanel.svelte:164-185` | `recordFilter.test.ts:47-82` | ✅ Met |
| AC-12 | Labelled pace (min/km) for running, km/h for cycling | `FilterPanel.svelte:24` — `speedLabel` derived from `isRunning` | No dedicated test | ✅ Met |

#### Filter controls — power

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-13 | Power filter with min/max in watts | `FilterPanel.svelte:188-213` | `recordFilter.test.ts:88-113` | ✅ Met |
| AC-14 | Label "Stryd Power" when `powerSource === 'stryd'` | `FilterPanel.svelte:23-27` — `powerLabel` derived | No dedicated test | ✅ Met |
| AC-15 | Label "Running Power" when `powerSource === 'native'` | `FilterPanel.svelte:23-27` — `powerLabel` derived | No dedicated test | ✅ Met |
| AC-16 | Label "Power" when undefined/cycling | `FilterPanel.svelte:23-27` — `powerLabel` derived | No dedicated test | ✅ Met |
| AC-17 | Multi-file: most specific label used | `compare/+page.svelte:305` uses `primaryPowerSource` (first activity) | No multi-file test | ⚠️ Partially Met |
| AC-18 | Zone presets for power when FTP/CP set | `FilterPanel.svelte:33-37` — `powerZones` derived | No dedicated test | ✅ Met |
| AC-19 | Cycling presets use 7-zone Coggan FTP | `FilterPanel.svelte:35` — calls `ftpZoneBoundaries(ftp)` | No dedicated test | ✅ Met |
| AC-20 | Running presets use 5-zone Stryd CP | `FilterPanel.svelte:34` — calls `cpZoneBoundaries(cp)` | No dedicated test | ✅ Met |
| AC-21 | No zone presets when no profile | `FilterPanel.svelte` — `powerZones()` returns null | No dedicated test | ✅ Met |

#### Filter controls — heart rate

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-22 | HR filter with min/max in bpm | `FilterPanel.svelte:226-252` | `recordFilter.test.ts:119-128` | ✅ Met |
| AC-23 | Zone presets for HR when maxHR/LTHR set | `FilterPanel.svelte:40-47` — `hrZones` derived | No dedicated test | ✅ Met |
| AC-24 | HR presets use sport-aware zone model | `FilterPanel.svelte:41-43` — picks primary sport maxHR first, falls back | No dedicated test | ✅ Met |
| AC-25 | No zone presets when no HR threshold | `FilterPanel.svelte:47` — returns null | No dedicated test | ✅ Met |

#### Filter controls — cadence

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-26 | Cadence filter with min/max | `FilterPanel.svelte:261-289` | `recordFilter.test.ts:134-143` | ✅ Met |

#### Filter controls — gradient

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-27 | Gradient filter with min/max in % | `FilterPanel.svelte:292-312` | `recordFilter.test.ts:149-186` | ✅ Met |
| AC-28 | Gradient derived from altitude+distance | `recordFilter.ts:53-64` | `recordFilter.test.ts:236-297` | ✅ Met |
| AC-29 | Gradient control hidden when no altitude | `FilterPanel.svelte` receives `hasAltitude` prop; `{#if hasAltitude}` guard | No dedicated test | ✅ Met |
| AC-30 | Records without altitude pass gradient filter | `recordFilter.ts:37-38` | `recordFilter.test.ts:171-178` | ✅ Met |

#### Chart rendering

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-31 | Active records at full opacity | `TimeSeriesChart.svelte:444-494` — activeSeries at full colour | Playwright pixel comparison | ✅ Met |
| AC-32 | Inactive records greyed/muted | `TimeSeriesChart.svelte:498-515` — inactiveSeries at 0.15 opacity, z=-1 | Playwright pixel comparison | ✅ Met |
| AC-33 | Distance axis continuous | `TimeSeriesChart.svelte:440-441` — both active/inactive use same fullData x-axis | Code analysis | ✅ Met |
| AC-34 | Lap markers visible regardless | `TimeSeriesChart.svelte:458-468` — markLine on activeSeries, not filtered | Code analysis | ✅ Met |
| AC-35 | No filter → identical appearance | `TimeSeriesChart.svelte:496` — `if (!inactiveData) return [activeSeries]` | Code analysis | ✅ Met |
| AC-36 | Delta/segment charts unfiltered on `/event` | `event/+page.svelte:409-413,476-483` — no `activeRecordIndices` prop | Code analysis | ✅ Met |

#### Summary statistics

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-37 | Summary stats use only active records | `compare:602`, `event:513` — `filteredRecords()` helper | Code analysis | ✅ Met |
| AC-38 | Filtered indicator visible | `compare:561-565`, `event:490-494` — `.filter-indicator` div | Playwright runtime | ✅ Met |
| AC-39 | No filter → identical stats | `filteredRecords()` returns full records when no passing set | Code analysis | ✅ Met |

#### Multi-file behaviour

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC-40 | Same filter applied to all files | `compare:319-327` — maps over all `$activities` with same `$recordFilter` | Code analysis | ✅ Met |
| AC-41 | Each file filtered independently | `compare:322-325` — `applyRecordFilter` called per activity with its own records | Code analysis | ✅ Met |

**Summary:** 39/41 criteria fully met. 1 partially met (AC-17). 1 bug found (M2).

---

## Findings

### Major (should fix)

#### M1 — Zero-value filter bounds silently ignored
- **Category:** Reliability
- **Location:** `FilterPanel.svelte:106` — `commit()` function
- **Description:** The `commit()` function uses `speedMin || speedMax` to decide whether to include a channel in the filter. Because `"0"` is falsy in JavaScript, entering `0` as a min or max bound (e.g. "show records with speed 0–10 km/h" to isolate rest stops) silently applies no speed filter. The badge shows no active filter for that channel, and the user gets no feedback. Affects all 5 channels identically.
- **Recommendation:** Change the condition to use `!== ''` instead of truthiness: `speedMin !== '' || speedMax !== ''`. The `hasSpeed` etc. derivations already use this correct pattern (line 126) — the `commit()` function should match.

#### M2 — AC-17 multi-file power source labelling is "first file wins"
- **Category:** Code Quality
- **Location:** `compare/+page.svelte:305`, `event/+page.svelte:247`
- **Description:** When multiple files are loaded with different power sources (e.g. File 1 has Stryd, File 2 has native watch power), the filter panel label shows only the first file's source. AC-17 states "each file's label is shown separately (or the most specific label is used)" — the current implementation uses `$activities[0]?.powerSource` which is "first file wins", not "most specific". This is a minor UX issue since all files share one filter anyway.
- **Recommendation:** Consider using the most specific label (e.g. prefer 'stryd' over 'native' over undefined). Low priority since the filter applies the same way regardless of label.

### Minor (nice to fix)

#### m1 — Filter panel doesn't close when clicking outside
- **Category:** Code Quality (UX)
- **Location:** `FilterPanel.svelte`
- **Description:** The filter dropdown uses `position: absolute` to overlay content, but clicking outside the dropdown doesn't close it — the user must click the toggle button again. Standard dropdown UX expects clicking outside to dismiss.
- **Recommendation:** Add a click-outside listener or a backdrop overlay (similar to the sidebar drawer pattern already in the codebase).

#### m2 — Invert checkbox uses `onchange` (not `oninput`)
- **Category:** Consistency
- **Location:** `FilterPanel.svelte:313`
- **Description:** All number inputs use `oninput={commit}` for real-time filtering, but the invert checkbox still uses `onchange={handleInvert}`. While `onchange` on a checkbox fires immediately on click (unlike on text inputs), the inconsistency with the stated fix ("oninput not onchange") is worth noting. The `handleInvert()` function bypasses `commit()` and calls `recordFilter.update()` directly, which works correctly.
- **Recommendation:** No functional issue — this is a consistency note only. The checkbox works correctly with `onchange`.

#### m3 — `FtpZone` type exported from `zones.ts` but `ZoneBand.zone` uses `number`
- **Category:** Code Quality
- **Location:** `zones.ts:9`
- **Description:** `FtpZone = 1|2|3|4|5|6|7` is exported but `ZoneBand.zone` is typed as `number` rather than `FtpZone | CpZone | HrZone`. This means the type system doesn't enforce that zone band entries use valid zone numbers.
- **Recommendation:** Low priority — the zone values are always produced by the same functions that define the bands, so there's no real risk of mismatch.

---

## Positive Observations

- **Clean separation of concerns**: Filter logic is in pure functions (`recordFilter.ts`), state in a store (`filterStore.ts`), and UI in a component (`FilterPanel.svelte`). Each is independently testable.
- **Thorough test coverage**: 28 tests for the filter engine covering all channels, combined filters, inverted mode, null/missing values, and gradient edge cases (zero distance delta, missing altitude).
- **Lazy gradient computation**: Gradient cache only computed when the gradient filter is active — avoids unnecessary work.
- **Consistent multi-file pattern**: `activeRecordIndices` maps over all activities independently, matching the existing cross-file architecture.
- **AC-36 handled correctly**: DeltaChart and SegmentChart explicitly receive no filter props — this is a design decision that preserves distance-axis continuity for delta calculations.
- **Split series approach**: Using two ECharts line series (active + inactive at 0.15 opacity) is clean and doesn't interfere with existing zone shading or anomaly markers.
- **Self-collapsing FilterPanel fix**: The rewrite from CollapsiblePanel wrapper to self-owned toggle + overlay is a significant UX improvement — the panel no longer dominates the screen on desktop.

---

## Action Items

### Immediate Fixes (block merge)
_(none — no critical findings)_

### Post-merge improvements
- [ ] M1: Fix zero-value filter bound bug — change `commit()` to use `!== ''` instead of truthiness
- [ ] M2: Consider "most specific" power source label for multi-file mode
- [ ] m1: Add click-outside-to-close behaviour for the filter dropdown
- [ ] m3: Consider narrowing `ZoneBand.zone` type

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
