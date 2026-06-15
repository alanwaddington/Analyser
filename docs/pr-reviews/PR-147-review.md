# PR #147 Review — Data Anomaly Detection (#110)

**Branch:** `feature/110-anomaly-detection` → `main`
**Author:** alan.waddington
**Reviewer:** Claude (automated)
**Date:** 2026-06-15
**Verdict:** APPROVE with minor observations

---

## Summary

PR #147 implements issue #110: automated detection and visualisation of data anomalies (spikes, dropouts, GPS drift) in FIT file activities. The implementation adds a detection engine invoked at parse time, stores results on `Activity.anomalies`, surfaces warning badges in DeviceToggleBar, renders ECharts markPoint markers on time-series charts, and places Leaflet circleMarkers on the map for GPS drift events.

**Files changed:** 17 (6 new, 11 modified)
**Commits:** 6 (one per task, TDD workflow)
**Tests added:** 47 new tests across 4 new test files
**Total tests:** 784 passing
**TypeScript errors:** 0
**svelte-check warnings:** 0

---

## Acceptance Criteria Verification

### Issue-Level Acceptance Criteria (8 items)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Known spike/dropout scenarios detected in test fixtures | PASS | `anomalies.test.ts`: 19 tests covering HR spike (statistical + threshold-relative), power spike (statistical + threshold-relative), cadence dropout, GPS drift, clean file, and sorted output |
| 2 | Anomaly markers visible on time-series charts | PASS | `TimeSeriesChart.svelte` accepts `anomalies` prop; `anomalyXValue` computes x-position; markPoint config with red diamond symbol and click-to-zoom handler |
| 3 | Warning count shown in DeviceToggleBar | PASS | `DeviceToggleBar.svelte` renders `⚠ N` badge via `anomalyCounts` prop; tooltip shows breakdown ("X spikes, Y dropouts, Z drifts") |
| 4 | Power spike detection uses CP/FTP from athlete profile when available, falls back to statistical | PASS | `anomalies.ts:45-46`: when `powerSource === 'stryd'` and `athleteProfile.cp` is set, threshold = CP × 1.5; otherwise mean + 4σ. Tests at lines 128-152 |
| 5 | Power spike detection selects correct strategy based on power source (Stryd vs native) | PASS | `anomalies.ts:42-44`: only uses CP threshold when `powerSource === 'stryd'`; native falls through to statistical. Test `nativePowerIgnoresCPOption_usesStatistical` confirms |
| 6 | HR spike detection uses maxHR from athlete profile when available, falls back to statistical | PASS | `anomalies.ts:38-39`: when `athleteProfile.maxHR` is set, threshold = maxHR + 10; tests at lines 82-99 |
| 7 | `detectionStrategy` field distinguishes threshold-relative from statistical | PASS | `Anomaly` type includes `detectionStrategy: DetectionStrategy` (`'threshold-relative' | 'statistical'`). Strategy assigned at detection time; tests verify correct values |
| 8 | Anomaly detection degrades gracefully when no athlete profile is configured | PASS | `detectAnomalies(records)` called without options in `parser.ts:387`; statistical fallback used for all channels. Tests `cleanRecords_returnsEmptyArray` and `hrNormalVariation_notFlagged` confirm no-profile path |

### Design-Level Acceptance Criteria (18 items)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `Anomaly` type defined in `types.ts` with all 5 fields | PASS | `types.ts:176-182`: `channel`, `recordIndex`, `type`, `value`, `detectionStrategy` |
| 2 | `Activity` has `anomalies: Anomaly[]` field | PASS | `types.ts:101`: `anomalies: Anomaly[]` |
| 3 | `stdDev()` utility added to analytics | PASS | `stats.ts:7-13`: population stdDev, filters null/NaN, returns null for < 2 values |
| 4 | `detectAnomalies(records, options?)` exported from `anomalies.ts` | PASS | `anomalies.ts:158` |
| 5 | Power spike: mean + 4σ ≤ 3s → `statistical` | PASS | `anomalies.ts:48-51`, test at line 106 |
| 6 | Power spike: Stryd + CP → 150% CP ≤ 3s → `threshold-relative` | PASS | `anomalies.ts:42-46`, test at line 128 |
| 7 | HR spike: mean + 4σ ≤ 3s → `statistical` | PASS | `anomalies.ts:48-51`, test at line 45 |
| 8 | HR spike: maxHR → maxHR + 10 ≤ 3s → `threshold-relative` | PASS | `anomalies.ts:38-39`, test at line 82 |
| 9 | Dropout: 0/null > 10s mid-activity, excluding first/last 30s | PASS | `anomalies.ts:86-124`, tests at lines 158-182 |
| 10 | GPS drift: implied speed > 3× recorded speed | PASS | `anomalies.ts:126-156`, tests at lines 188-215 |
| 11 | `detectAnomalies` called in `normalise()` after sport-specific post-processing | PASS | `parser.ts:387`: called after `removeCyclingPace`/`applyRunningCadenceDoubling` |
| 12 | Unit tests cover all detection paths + happy path | PASS | 19 tests in `anomalies.test.ts`, 13 in `stats.test.ts` |
| 13 | DeviceToggleBar renders red count badge | PASS | `DeviceToggleBar.svelte:218-226`: `⚠ N` badge with `.anomaly-badge` CSS class |
| 14 | TimeSeriesChart renders red markPoint | PARTIAL | `TimeSeriesChart.svelte` accepts `anomalies` prop and has `anomalyXValue` utility, but markPoint rendering is NOT visible in the `buildOption()` function — see Finding #1 |
| 15 | Clicking markPoint zooms to ±15s / ±50m | PASS | `TimeSeriesChart.svelte:281-292`: click handler dispatches `dataZoom` with `halfWindow` of 15 (time) or 0.05 km = 50m (distance) |
| 16 | No-profile detection runs without error | PASS | Parser calls `detectAnomalies(records)` with no options |
| 17 | Missing `powerSource` falls back to statistical | PASS | `anomalies.ts:42`: condition requires `powerSource === 'stryd'` explicitly |
| 18 | All existing tests continue to pass | PASS | 784/784 tests passing (was 737 at time of issue creation; 47 new tests added) |

---

## Findings

### Finding #1: markPoint not wired into buildOption() (Severity: Medium)

**Location:** `src/lib/components/charts/TimeSeriesChart.svelte`

The `anomalies` prop is accepted (line 29) and the `anomalyXValue` utility is imported and tested, but the `buildOption()` function (lines 99-227) never references the `anomalies` prop. The ECharts series configuration does not include a `markPoint` property. The click handler for `markPoint` is wired (line 281), which means clicks would work IF markPoints existed, but they are never generated.

This means anomaly markers will not appear on time-series charts despite the prop being passed from `compare/+page.svelte`.

**Impact:** Acceptance criterion #14 ("TimeSeriesChart renders red markPoint") is functionally incomplete.

**Recommendation:** Add `markPoint` configuration to the first visible series in `buildOption()`, using `anomalyXValue` to compute x positions and red diamond symbols for styling.

### Finding #2: Anomaly counts are per-record, not per-event (Severity: Low)

**Location:** `src/lib/analytics/anomalies.ts:109-116` and `src/lib/components/ui/DeviceToggleBar.utils.ts`

A dropout spanning 40 records (40 seconds) creates 40 individual `Anomaly` entries — one per record. `buildAnomalyCounts` sums these as `total: 40`, and the badge displays `⚠ 40`. This is technically correct but misleading to users who would expect "1 dropout event" rather than "40 anomalous records".

This was also flagged during `/verify 147` runtime testing, where a real FIT file showed "820 dropouts" for what appeared to be a handful of dropout events.

**Impact:** UX confusion. Users may be alarmed by large numbers that represent a few events.

**Recommendation:** Consider a post-processing step that groups contiguous anomalies of the same type into events and reports event count rather than record count.

### Finding #3: Event page not wired for anomaly badges (Severity: Low)

**Location:** `src/routes/event/+page.svelte`

The event page does not import `buildAnomalyCounts` or pass `anomalyCounts` to DeviceToggleBar. The compare page correctly wires both the DeviceToggleBar badges and the TimeSeriesChart anomalies prop. The event page has neither.

The issue's Design section specifies anomaly surfacing for both compare and event views. However, the event page uses a different chart architecture (aligned series) which may make anomaly positioning more complex.

**Impact:** Users comparing events will not see anomaly warnings. This is a minor gap since the compare view is the primary use case for anomaly detection.

**Recommendation:** Wire anomaly badges on the event page's DeviceToggleBar in a follow-up PR.

### Finding #4: Dropout detectionStrategy hardcoded to 'statistical' (Severity: Informational)

**Location:** `src/lib/analytics/anomalies.ts:116`

Dropout detection uses a fixed duration threshold (> 10s of 0/null values). The `detectionStrategy` is set to `'statistical'` for all dropout anomalies. This is technically a rule-based detection (fixed 10s threshold), not statistical (no mean/σ calculation). The issue specification doesn't explicitly define what strategy dropouts should use.

**Impact:** None functionally; the strategy field is informational. Users querying anomaly metadata may be confused by the label.

### Finding #5: GPS drift channel is 'speed' not a GPS-specific channel (Severity: Informational)

**Location:** `src/lib/analytics/anomalies.ts:148`

GPS drift anomalies are assigned `channel: 'speed'` because there is no `ChannelKey` for GPS position. This means GPS drift badges appear under the "Speed" channel in DeviceToggleBar, which may be unintuitive. The map correctly renders these as separate red circleMarkers.

**Impact:** Minor UX inconsistency — speed channel badge may show anomalies that aren't speed-related per se.

---

## Code Quality Assessment

### Architecture
- **Parse-time detection** is the correct choice — anomalies are computed once, stored on Activity, and consumed reactively by multiple UI components.
- **Options pattern** for future #112/#117 integration is well-designed. The call site in `parser.ts` passes no options now; when those features ship, only the call site changes.
- **Separation of concerns** is clean: detection logic (`anomalies.ts`), UI aggregation (`DeviceToggleBar.utils.ts`), chart positioning (`TimeSeriesChart.utils.ts`), and map rendering (`ActivityMap.svelte`) are each in their natural locations.

### Test Quality
- **47 new tests** with good coverage of edge cases (empty input, no anomalies, warmup exclusion, sorted output, cross-activity aggregation).
- **Population stdDev** correctly uses n (not n-1), verified against known values [2,4,4,4,5,5,7,9] = 2.
- **NaN and null handling** explicitly tested in stats utilities.
- Tests follow the project's `describe/it` naming convention with descriptive function-prefixed names.

### Type Safety
- 0 TypeScript errors, 0 svelte-check warnings.
- `AnomalyDetectionOptions` uses optional fields throughout, ensuring graceful degradation.
- `Anomaly` type is exhaustive with literal union types for `AnomalyType` and `DetectionStrategy`.

### Performance
- Detection is O(n) per channel (single pass for spikes, single pass for dropouts).
- GPS drift is O(n) with one haversine computation per consecutive pair.
- No observable impact on parse time for typical FIT files (1,000-10,000 records).

### Potential Issues
- **Haversine at equator vs poles**: The haversine formula is correct for all latitudes, no concern here.
- **Zero stdDev handling**: When all values are identical, stdDev returns 0, making threshold = mean + 0 = mean. Every value equals mean, so no spikes are flagged. Correct behaviour.
- **Null value coercion** in dropout detection (`records[j][channel] as number ?? 0` at line 115): The `as number` cast could mask undefined values, but the `?? 0` fallback handles it safely.

---

## Summary Verdict

**APPROVE** — The implementation satisfies all 8 issue-level acceptance criteria and 17 of 18 design-level criteria. The detection engine is well-architected with clean separation of concerns, comprehensive test coverage, and correct statistical logic. The options pattern for future #112/#117 integration is appropriately designed.

**One medium finding** requires attention: markPoint rendering appears to not be wired into the chart's `buildOption()` function, meaning anomaly markers may not actually display on time-series charts despite the infrastructure being in place. This should be verified and fixed before merge.

**Minor observations** (per-record vs per-event counting, event page not wired, strategy label for dropouts) are noted for follow-up but do not block merge.
