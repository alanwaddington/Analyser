# PR #152 Review — feat(#117): w/kg, power zones, and source-aware display for cycling and running power

**Date:** 2026-06-26
**Author:** alanwaddington
**Branch:** feature/117-power-source-detection → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 6/6 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #117 — Enhancement: w/kg, power zones, and source-aware display for cycling and running power (Stryd, Garmin, COROS, Suunto)

Issue #117 body is empty; acceptance criteria are derived from the PR description's task checklist and the CLAUDE.md design section documenting the intended behaviour.

---

## Changed Files Audit

### `CLAUDE.md` (+3 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Document Stryd-first power precedence, powerSource detection, and manufacturer-aware device labels |
| Issues | #117 |
| Criteria covered | Task 1, Task 2 documentation |
| Quality | ✅ No issues — accurate, well-structured documentation |
| Test coverage | N/A — documentation |

### `src/lib/analytics/rss.ts` (+10 / -0 lines) NEW

| Property | Detail |
|----------|--------|
| Purpose | Implement Running Stress Score formula: `(durationS × avgPower × IF²) / (CP × 3600)` |
| Issues | #117 Task 5 |
| Criteria covered | RSS computation |
| Quality | ⚠️ See M1 — no guard against `cp === 0` (division by zero) |
| Test coverage | `rss.test.ts` — 7 tests covering at-CP, above, below, zero duration, zero power, proportionality |

### `src/lib/analytics/rss.test.ts` (+43 / -0 lines) NEW

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for computeRSS |
| Issues | #117 Task 5 |
| Criteria covered | RSS correctness verification |
| Quality | ✅ Good coverage — tests mathematical properties (linearity, proportionality, edge cases) |
| Test coverage | Self — 7 tests, all well-named following project conventions |

### `src/lib/analytics/zones.ts` (+23 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `ftpZone()` and `ftpZoneBoundaries()` implementing Coggan 5-zone cycling power model |
| Issues | #117 Task 6 |
| Criteria covered | FTP zone classification and boundary computation |
| Quality | ✅ Clean implementation, consistent with existing `cpZone`/`cpZoneBoundaries` pattern |
| Test coverage | `zones.test.ts` — 12 new tests covering zone boundaries, contiguity, edge values |

### `src/lib/analytics/zones.test.ts` (+77 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Tests for ftpZone and ftpZoneBoundaries |
| Issues | #117 Task 6 |
| Criteria covered | Zone classification correctness |
| Quality | ✅ Thorough — boundary tests, contiguity, ascending zone numbers, specific FTP percentages |
| Test coverage | Self — 12 tests |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+3 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire FTP zone shading for cycling power (non-running sport with FTP set) |
| Issues | #117 Task 6 |
| Criteria covered | FTP zone shading in charts |
| Quality | ✅ Clean — adds one `else if` branch matching the existing pattern for CP zone shading |
| Test coverage | Visual feature — verified via Playwright in runtime verification |

### `src/lib/components/map/ActivityMap.svelte` (+26 / -8 lines)

| Property | Detail |
|----------|--------|
| Purpose | Fix Leaflet "Initialize failed: invalid dom." error by deferring `L.map()` until container has non-zero dimensions |
| Issues | Pre-existing bug fix (discovered during #117 verification) |
| Criteria covered | N/A — bonus bug fix |
| Quality | ✅ Well-designed — extracts `initLeafletMap()`, uses `getBoundingClientRect` for jsdom test compatibility, ResizeObserver fires on tab reveal |
| Test coverage | Existing `ActivityMap.component.test.ts` — 4 tests pass (previously 3 were failing due to this bug) |

### `src/lib/components/ui/DeviceToggleBar.svelte` (+3 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pass `stream` and `activity` to `deriveDeviceLabel()` for source-aware labelling |
| Issues | #117 Task 2 |
| Criteria covered | Device toggle bar shows source-aware labels |
| Quality | ✅ Minimal, correct — updates 3 call sites to pass new optional params |
| Test coverage | Integration — covered by `deviceChannels.test.ts` unit tests on `deriveDeviceLabel` |

### `src/lib/fit/parser.ts` (+30 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Stryd-first power precedence (`r['Power'] ?? r.power`), Form Power extraction, `detectPowerSource()`, `powerSource` on Activity |
| Issues | #117 Task 1, Task 5 |
| Criteria covered | Power source detection, Stryd priority, Form Power channel |
| Quality | ✅ Clean — Stryd detection before normalisation, `detectPowerSource` is a pure testable function |
| Test coverage | `parser.test.ts` — 9 new tests for power mapping, Form Power, and detectPowerSource |

### `src/lib/fit/parser.test.ts` (+60 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Tests for Stryd-first precedence, Form Power mapping, detectPowerSource |
| Issues | #117 Task 1, Task 5 |
| Criteria covered | Parser correctness for power source detection |
| Quality | ✅ Good — covers Stryd-only, native-only, both-present, no-power, and sport-based classification |
| Test coverage | Self — 9 new tests |

### `src/lib/types.ts` (+4 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `formPower` to ActivityRecord, `powerSource` to Activity, `'formPower'` to ChannelKey union and CHANNEL_META |
| Issues | #117 Task 1, Task 5 |
| Criteria covered | Type system support for new fields |
| Quality | ✅ Correct type additions — `powerSource` union matches detectPowerSource return type |
| Test coverage | Structural — enforced by TypeScript compiler |

### `src/lib/utils/deviceChannels.ts` (+29 / -3 lines)

| Property | Detail |
|----------|--------|
| Purpose | Source-aware device labels via extended `deriveDeviceLabel()`, MANUFACTURER_NAMES map |
| Issues | #117 Task 2 |
| Criteria covered | "Stryd", "[Manufacturer] Running Power" labels |
| Quality | ✅ Well-structured — backwards-compatible optional params, clean fallback chain |
| Test coverage | `deviceChannels.test.ts` — 10 new tests covering all manufacturer variants, user label priority, cycling fallthrough |

### `src/lib/utils/deviceChannels.test.ts` (+73 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Tests for source-aware device label derivation |
| Issues | #117 Task 2 |
| Criteria covered | Label correctness across manufacturers and power sources |
| Quality | ✅ Thorough — tests Stryd, Garmin, Suunto, COROS, unknown, cycling, non-power device, no-activity fallback, user-label priority |
| Test coverage | Self — 10 tests |

### `src/lib/utils/summaryContext.ts` (+33 / -0 lines) NEW

| Property | Detail |
|----------|--------|
| Purpose | Shared `buildCellContext()` utility for summary table contextual stats (w/kg, %FTP, %CP, HR zone) |
| Issues | #117 Task 3 |
| Criteria covered | Shared context computation extracted from compare page |
| Quality | ✅ Clean extraction — eliminates duplication between compare and event pages |
| Test coverage | `summaryContext.test.ts` — 11 tests |

### `src/lib/utils/summaryContext.test.ts` (+71 / -0 lines) NEW

| Property | Detail |
|----------|--------|
| Purpose | Tests for buildCellContext |
| Issues | #117 Task 3 |
| Criteria covered | Context computation correctness |
| Quality | ✅ Good — tests power w/kg, %FTP cycling, %CP running, cross-sport guard (FTP not for running, CP not for cycling), HR zones, non-applicable channels |
| Test coverage | Self — 11 tests |

### `src/routes/compare/+page.svelte` (+32 / -30 lines)

| Property | Detail |
|----------|--------|
| Purpose | Wire buildCellContext (replacing inline function), add Form Power ratio, RSS row, source-aware device labels in summary table |
| Issues | #117 Task 3, 4, 5 |
| Criteria covered | Compare page summary table integration |
| Quality | ✅ Clean refactor — imports shared utility, removes inline duplication, RSS row correctly gated on `cp != null && sport === 'running'` |
| Test coverage | Integration — covered by summaryContext.test.ts + runtime verification |

### `src/routes/event/+page.svelte` (+71 / -2 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add athlete profile integration (w/kg, %CP/%FTP, HR zone badges, Form Power, RSS) to event page summary table |
| Issues | #117 Task 4, 5 |
| Criteria covered | Event page summary table enrichment |
| Quality | ⚠️ See m1 — zone-badge and cell-context CSS is duplicated from compare page |
| Test coverage | Integration — covered by summaryContext.test.ts + runtime verification |

---

## Acceptance Criteria Verification

### #117 — w/kg, power zones, and source-aware display

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `detectPowerSource()` + Stryd-first power precedence + `powerSource` on Activity | `parser.ts:146-155` (detectPowerSource), `parser.ts:168` (r['Power'] ?? r.power), `parser.ts:432` (powerSource assignment) | `parser.test.ts` — 9 tests | ✅ Met |
| 2 | `deriveDeviceLabel()` source-aware labels + `MANUFACTURER_NAMES` + DeviceToggleBar updated | `deviceChannels.ts:4-10,20-34` (MANUFACTURER_NAMES + label logic), `DeviceToggleBar.svelte:304,313,322` (3 call sites updated) | `deviceChannels.test.ts` — 10 tests | ✅ Met |
| 3 | `buildCellContext()` shared utility (power: w/kg, %FTP/%CP; HR: zone) | `summaryContext.ts:12-33` | `summaryContext.test.ts` — 11 tests | ✅ Met |
| 4 | Compare and event page summary tables wired to `buildCellContext` | `compare/+page.svelte:548`, `event/+page.svelte:435-436` | Integration — summaryContext.test.ts | ✅ Met |
| 5 | `computeRSS()` + Form Power extraction + Form Power Ratio and RSS rows in both summary tables | `rss.ts:6-9`, `parser.ts:169` (formPower), `compare/+page.svelte:549-560,570-588`, `event/+page.svelte:425-476` | `rss.test.ts` — 7 tests, `parser.test.ts` — 3 tests | ✅ Met |
| 6 | `ftpZone()` + `ftpZoneBoundaries()` + FTP zone shading in TimeSeriesChart for cycling power | `zones.ts:105-123`, `TimeSeriesChart.svelte:211-212` | `zones.test.ts` — 12 tests | ✅ Met |

**Summary:** 6/6 criteria met.

---

## Findings

### Major (should fix)

#### M1 — `computeRSS()` does not guard against `cp === 0` (division by zero)

- **Category:** Reliability
- **Location:** `src/lib/analytics/rss.ts:8-9`
- **Description:** The function divides by `cp` twice (`avgPower / cp` and `/ (cp * 3600)`). If `cp` is 0, the result is `Infinity` or `NaN`. The UI input `<input id="ap-cp" min="0">` allows zero. While callers gate on `$athleteProfile.cp != null`, they do not check `!= 0`. A user entering `0` for CP would see `Infinity` or `NaN` displayed in the RSS row.
- **Recommendation:** Add `if (cp <= 0) return 0;` as an early guard in `computeRSS()`, matching the pattern used by `ftpPct()` and `cpPct()` in zones.ts. Alternatively, change the input `min` to `1`.

### Minor (nice to fix)

#### m1 — Zone-badge and cell-context CSS duplicated between compare and event pages

- **Category:** Code Quality
- **Location:** `src/routes/compare/+page.svelte:989-1008` and `src/routes/event/+page.svelte:806-825`
- **Description:** The `.zone-badge`, `.zone-badge--1` through `--5`, `.cell-context`, and light-theme overrides are identical in both page components (~28 lines each). This is a maintainability risk — a colour change to a zone badge would need to be made in two places.
- **Recommendation:** Extract to a shared component (e.g. `ZoneBadge.svelte`) or a shared CSS file imported by both pages. Low priority since Svelte scoped CSS makes this a common pattern, and the duplication is small.

#### m2 — Typo in RSS docstring: "analagous" → "analogous"

- **Category:** Code Quality
- **Location:** `src/lib/analytics/rss.ts:2`
- **Description:** Minor spelling: "analagous" should be "analogous".
- **Recommendation:** Fix the typo.

### Suggestions (optional)

#### S1 — `computeRSS` could accept a guard for negative values

- **Category:** Reliability
- **Location:** `src/lib/analytics/rss.ts:6-9`
- **Description:** Negative `avgPower` or `durationS` are physically impossible but not guarded. The function would return a negative RSS. Consider clamping or returning 0.
- **Recommendation:** Low priority — callers pass data from parsed FIT files where negatives are highly unlikely after the parser's `filterNegativeElapsed` pass.

---

## Positive Observations

- **Clean extraction of `buildCellContext()`** — the inline function was correctly identified as duplicated logic and extracted into a shared utility with comprehensive tests. Both pages now import from the same source.
- **Thorough test coverage** — 49 new tests across 5 test files, covering mathematical properties (RSS), zone boundaries (FTP), device label derivation (10 manufacturer/source combinations), and shared context computation. Test naming follows the `MethodName_Scenario_Expected` convention consistently.
- **Backwards-compatible API extension** — `deriveDeviceLabel()` adds optional params without breaking existing callers that pass only a `Device`.
- **Well-designed Leaflet deferred init** — the `initLeafletMap()` extraction with `getBoundingClientRect` check is a clean fix that works in both jsdom (tests) and real browsers. The ResizeObserver pattern handles both "map tab already active" and "map tab revealed later" scenarios.
- **Correct sport-gating** — FTP is correctly used only for non-running activities, CP only for running. The `buildCellContext` tests explicitly verify that FTP doesn't leak into running and CP doesn't leak into cycling.
- **detectPowerSource as a pure function** — extracting detection logic into a pure, separately tested function rather than burying it in the normalise pipeline is good design.

---

## Action Items

### Immediate Fixes (block merge)

_(none — no Critical findings)_

### Should fix before merge
- [ ] M1: Add `cp <= 0` guard in `computeRSS()` to prevent `Infinity`/`NaN` when user enters 0 for CP

### Post-merge improvements
- [ ] m1: Extract zone-badge CSS into shared component or CSS file
- [ ] m2: Fix "analagous" typo in RSS docstring

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent (except M1 — cp=0 edge case)
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
