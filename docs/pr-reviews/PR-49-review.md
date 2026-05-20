# PR #49 Review — feat: Add pace (min/km) and speed (km/h) channels

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/pace-speed-channels → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | N/A (ad-hoc feature, no tracked issue) |

---

## Issues Reviewed

### Issue Hierarchy
- No GitHub issue — ad-hoc feature request from conversation

---

## Changed Files Audit

### `src/lib/types.ts` (+7 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `pace?: number` to `Record`, `'pace'` to `ChannelKey` union, pace entry to `CHANNEL_META`; update speed unit from `'m/s'` to `'km/h'` |
| Issues | N/A |
| Criteria covered | Speed unit correction, pace channel data model |
| Quality | ✅ Clean. `pace` positioned after `speed` in all three locations (Record, ChannelKey, CHANNEL_META) for logical grouping |
| Test coverage | Type coverage via `npm run check` |

### `src/lib/fit/parser.ts` (+2 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Change `speedUnit` from `'m/s'` to `'km/h'`; derive pace as `60 / speed` (min/km) on each record |
| Issues | N/A |
| Criteria covered | Speed unit conversion, pace derivation |
| Quality | ⚠️ Minor indentation inconsistency on line 80 — `pace:` has extra tab vs sibling properties. Logic is correct: `r.speed && r.speed > 0` guards against undefined and division by zero. |
| Test coverage | No parser unit tests (pre-existing — parsing requires binary FIT data) |

### `src/lib/utils/channels.ts` (+1 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `'pace'` to `ALL_CHANNELS` array after `'speed'` |
| Issues | N/A |
| Criteria covered | Pace channel discovery |
| Quality | ✅ No issues. Canonical ordering maintained (pace grouped with speed). |
| Test coverage | Existing `channels.test.ts` — 7 tests still passing |

### `src/lib/components/charts/TimeSeriesChart.utils.ts` (+7 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `paceFormat(decimalMinutes): string` pure function — converts decimal min/km to `M:SS` string |
| Issues | N/A |
| Criteria covered | Pace axis and tooltip formatting |
| Quality | ✅ Clean implementation. Uses `Math.round(decimalMinutes * 60)` then integer division/modulo — correctly handles rounding edge cases (e.g. 4.9999 → "5:00"). |
| Test coverage | `TimeSeriesChart.utils.test.ts` — 6 tests |

### `src/lib/components/charts/TimeSeriesChart.utils.test.ts` (+28 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `paceFormat` |
| Issues | N/A |
| Criteria covered | Pace formatting correctness |
| Quality | ✅ Good edge case coverage: whole minutes, half/quarter/three-quarter, 60s rollover, single-digit padding |
| Test coverage | N/A — this is the test file |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+8 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Import `paceFormat`; add pace-specific y-axis config (inverted, M:SS axis labels, M:SS tooltip) |
| Issues | N/A |
| Criteria covered | Pace chart rendering |
| Quality | ✅ Conditional spreads (`...(channel === 'pace' ? {...} : {})`) keep the change minimal without disrupting other channels. `inverse: channel === 'pace'` correctly flips axis so faster pace appears at top. `valueFormatter` type guard (`typeof v === 'number'`) handles ECharts' polymorphic tooltip callback safely. |
| Test coverage | Type-checked via `npm run check`; visual verification required in browser |

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

None.

### Minor (nice to fix)

#### m1 — Indentation inconsistency in parser.ts

- **Category:** Code Quality
- **Location:** `src/lib/fit/parser.ts:80`
- **Description:** The `pace:` property has an extra tab of indentation compared to its sibling properties (`speed:`, `heartRate:`, etc.) in the record mapping object literal.
- **Recommendation:** Align `pace:` to the same indentation level as `speed:` on line 79 (two tabs).

### Suggestions (optional)

#### S1 — Add `'pace'` to distance interpolation channel list

- **Category:** Completeness
- **Location:** `src/lib/align/distance.ts:21-25`
- **Description:** The `channelKeys` array in `interpolateToDistanceAxis` is hardcoded and does not include `'pace'`. This function is not currently consumed by any component, so there is no runtime impact. However, when distance alignment is wired up, pace data would be silently dropped during interpolation.
- **Recommendation:** Add `'pace'` after `'speed'` in the `channelKeys` array in `distance.ts:22`. Alternatively, derive the array from the `Record` type to prevent future drift.

---

## Positive Observations

- **Clean derivation**: Pace is computed once at parse time (`60 / speed_kmh`), stored as a first-class channel, and flows through the entire rendering pipeline without special-casing outside the chart axis formatting. No redundant computation.
- **Robust `paceFormat`**: Using `Math.round(decimalMinutes * 60)` then integer division avoids floating-point drift that would occur with `Math.floor(decimal) + (decimal - floor) * 60`. The 60-second rollover test confirms this works correctly.
- **Minimal change surface**: Only 6 files changed with +53/-7 lines. The conditional spreads in `buildOption()` keep pace-specific logic isolated without restructuring the function.
- **Correct axis inversion**: `inverse: true` for pace means lower numerical values (faster pace) appear at the top of the chart — matching the convention used by Garmin Connect, Strava, and other running analysis tools.
- **Guard against division by zero**: `r.speed && r.speed > 0` on `parser.ts:80` prevents `Infinity` or `NaN` pace values when speed is zero or undefined.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] m1: Fix indentation of `pace:` line in `parser.ts:80`
- [ ] S1: Add `'pace'` to `distance.ts` channel list when distance interpolation is wired up

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
