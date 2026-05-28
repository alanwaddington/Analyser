# PR #89 Review — Invert min/max labels for pace in chart stats row (#88)

**Date:** 2026-05-28
**Author:** alanwaddington
**Branch:** feature/88-pace-stats-inversion → feature/86-chart-stats-min
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass ✅ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 4/4 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #88 — Invert min/max labels for pace in chart stats row (enhancement)

---

## Changed Files Audit

### `src/lib/components/charts/TimeSeriesChart.utils.ts` (+9 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Swap min/max values for the `pace` channel in `computeSeriesStats()` so fastest pace = max, slowest = min |
| Issues | #88 |
| Criteria covered | AC1 (fastest=max, slowest=min), AC3 (other channels unaffected) |
| Quality | ✅ No issues — clean two-variable swap, well-scoped conditional |
| Test coverage | `TimeSeriesChart.test.ts`: 3 pace-specific tests + `TimeSeriesChart.utils.test.ts`: 1 pace test |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+1 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Render `max / avg / min` order for pace channel; keep `min / avg / max` for all others |
| Issues | #88 |
| Criteria covered | AC2 (display order max/avg/min for pace) |
| Quality | ✅ No issues — inline `{#if}` is appropriate for a single-line conditional |
| Test coverage | Verified via Playwright runtime observation during /verify |

### `src/lib/components/charts/TimeSeriesChart.test.ts` (+18 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Replace single pace test with 3 targeted tests (min=slowest, max=fastest, avg=unchanged) |
| Issues | #88 |
| Criteria covered | AC4 (unit tests cover pace inversion) |
| Quality | ✅ Good test naming, clear comments explaining the inversion logic |
| Test coverage | N/A (is test file) |

### `src/lib/components/charts/TimeSeriesChart.utils.test.ts` (+2 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Update existing pace test to expect inverted min/max values |
| Issues | #88 |
| Criteria covered | AC4 (unit tests cover pace inversion) |
| Quality | ✅ Inline comments explain the inversion clearly |
| Test coverage | N/A (is test file) |

---

## Acceptance Criteria Verification

### #88 — Invert min/max labels for pace in chart stats row

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | Pace stats row displays fastest pace labelled `max` and slowest pace labelled `min` | `TimeSeriesChart.utils.ts:81-82` — conditional swap for `pace` channel | `TimeSeriesChart.test.ts:202-216` — `computeSeriesStats_pace_minIsSlowstPace`, `computeSeriesStats_pace_maxIsFastestPace` | ✅ Met |
| 2 | Display order is `max / avg / min` for pace (numbers remain ascending left-to-right) | `TimeSeriesChart.svelte:383` — `{#if channel === 'pace'}max...min{:else}min...max{/if}` | Verified via Playwright runtime | ✅ Met |
| 3 | All other channels are unaffected | `TimeSeriesChart.utils.ts:81-82` — swap only when `channel === 'pace'`; template else-branch preserves original order | `TimeSeriesChart.test.ts:191-194,224-228,230-236` — heart rate and speed tests unchanged and passing | ✅ Met |
| 4 | Unit tests cover the pace inversion | `TimeSeriesChart.test.ts:202-222` — 3 new tests; `TimeSeriesChart.utils.test.ts:104-105` — updated assertions | N/A | ✅ Met |

**Summary:** 4/4 criteria met.

---

## Findings

### Minor (nice to fix)

#### m1 — Typo in test name: "Slowst" instead of "Slowest"

- **Category:** Code Quality
- **Location:** `TimeSeriesChart.test.ts:202`
- **Description:** Test name `computeSeriesStats_pace_minIsSlowstPace` is missing the "e" — should be `Slowest`.
- **Recommendation:** Rename to `computeSeriesStats_pace_minIsSlowestPace`.

---

## Positive Observations

- The swap is cleanly implemented with two local variables (`statMin`, `statMax`) rather than mutating the `summarise()` result, keeping the function pure
- The comment on lines 78-80 clearly explains the "why" — future readers will immediately understand the inversion logic
- Both test files were updated to cover the inversion, ensuring no stale assertions remain
- The template conditional is minimal and doesn't introduce extra markup or CSS — just reorders the text labels
- The Summary tab (`compare/+page.svelte:447`) uses `ChannelSummary` directly from `summarise()`, not `SeriesStats`, so it is correctly unaffected by this change — no cross-contamination

---

## Action Items

### Immediate Fixes (block merge)
None.

### Post-merge improvements
- [ ] m1: Fix typo in test name `minIsSlowstPace` → `minIsSlowestPace`

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
