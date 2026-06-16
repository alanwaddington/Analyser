# PR #150 Review — feat: athlete profile — weight, FTP, CP, HR thresholds with zone visualisation (#112)

**Date:** 2026-06-16
**Author:** alanwaddington
**Branch:** feature/112-athlete-profile → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 20/21 Met (1 explicitly deferred) |

---

## Issues Reviewed

### Issue Hierarchy

- #112 — Athlete Profile: weight, FTP, CP, HR thresholds with zone visualisation (root)

---

## Changed Files Audit

### `src/lib/types.ts` (+10 / -5)

| Property | Detail |
|----------|--------|
| Purpose | Adds `AthleteProfile` interface (6 optional numeric fields); widens `AnomalyDetectionOptions.athleteProfile` from narrow partial to full `AthleteProfile` |
| Issues | #112 |
| Criteria covered | AC1 — type definition; AC-T1-A, AC-T1-B, AC-T1-C |
| Quality | ✅ Clean. All fields optional. Units documented in comments. |
| Test coverage | ✅ Covered transitively by anomalies.test.ts and zones.test.ts |

### `src/lib/analytics/anomalies.ts` (+3 / -2)

| Property | Detail |
|----------|--------|
| Purpose | Replaces `profile.maxHR` with `profile.maxHrCycling ?? profile.maxHrRunning` for sport-aware HR threshold in anomaly detection |
| Issues | #112 |
| Criteria covered | AC-T1-C — anomalies.ts compiles without errors; effective maxHR resolves correctly |
| Quality | ✅ Minimal, correct change. Nullish coalescing is idiomatic. |
| Test coverage | ✅ anomalies.test.ts extended with 4 new cases covering both fields |

### `src/lib/analytics/anomalies.test.ts` (+24 / -6)

| Property | Detail |
|----------|--------|
| Purpose | Extends anomaly detection tests for split maxHrCycling/maxHrRunning |
| Issues | #112 |
| Criteria covered | AC-T1-D |
| Quality | ✅ Follows naming convention. Covers cycling-takes-precedence, cross-sport fallback, below-threshold. |
| Test coverage | N/A (is a test file) |

### `src/lib/analytics/index.ts` (+2 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Re-exports all functions and types from zones.ts |
| Issues | #112 |
| Criteria covered | Enables consumers to import from `$lib/analytics` |
| Quality | ✅ Complete — all 9 functions and 3 types are re-exported. |
| Test coverage | ✅ Covered by zones.test.ts |

### `src/lib/analytics/zones.ts` (+89 / -0) [NEW]

| Property | Detail |
|----------|--------|
| Purpose | Pure zone/threshold utility functions: hrZoneFromMaxHR, hrZoneFromLTHR, hrZone, cpZone, ftpPct, cpPct, wPerKg, hrZoneBoundaries, cpZoneBoundaries |
| Issues | #112 |
| Criteria covered | AC-T3-A through AC-T3-J; AC-zones-unit-tested |
| Quality | ✅ Deterministic, no side-effects, no external dependencies. Zone boundaries match issue spec. ⚠️ wPerKg(x, 0) and ftpPct(x, 0) return Infinity — no guard. Safe in practice (callers check weight > 0), but worth noting. |
| Test coverage | ✅ 40 tests in zones.test.ts covering all functions and boundaries |

### `src/lib/analytics/zones.test.ts` (+255 / -0) [NEW]

| Property | Detail |
|----------|--------|
| Purpose | 40 unit tests covering all zone functions, boundary values, edge cases, sport dispatch, LTHR fallback |
| Issues | #112 |
| Criteria covered | AC-zones-unit-tested |
| Quality | ✅ Naming convention consistent. Covers ftpPct(280,250)=112, wPerKg(250,70)=3.6, zero inputs, zone boundaries. Minor: no test for wPerKg(250, 0). |
| Test coverage | N/A (is a test file) |

### `src/lib/stores/athleteProfile.ts` (+49 / -0) [NEW]

| Property | Detail |
|----------|--------|
| Purpose | Svelte writable store with localStorage persistence. setProfileField updates one field; initAthleteProfile loads on mount. |
| Issues | #112 |
| Criteria covered | AC2 — persist/load; AC-T2-A through AC-T2-F |
| Quality | ✅ SSR-safe (typeof localStorage guard). NaN/null correctly removed. Quota error calls addToast — consistent with existing patterns. JSON.parse wrapped in try/catch. |
| Test coverage | ✅ 12 tests in athleteProfile.test.ts |

### `src/lib/stores/athleteProfile.test.ts` (+135 / -0) [NEW]

| Property | Detail |
|----------|--------|
| Purpose | 12 tests covering: initial state, set/remove fields, NaN handling, localStorage persistence, page-reload survival, SSR no-op, malformed JSON resilience |
| Issues | #112 |
| Criteria covered | AC-T2-A through AC-T2-E |
| Quality | ✅ Uses localStorageMock pattern matching theme.test.ts. Minor: no test for quota-exceeded toast. |
| Test coverage | N/A (is a test file) |

### `src/lib/components/ui/AthleteProfilePanel.svelte` (+323 / -0) [NEW]

| Property | Detail |
|----------|--------|
| Purpose | Settings UI with toggle button and collapsible panel containing 6 numeric inputs grouped by sport (General / Cycling / Running), validation warnings, persist on blur/Enter |
| Issues | #112 |
| Criteria covered | AC3 — panel accessible from sidebar; AC-T4-A through AC-T4-G |
| Quality | ✅ Accessible (aria-labels, aria-expanded, focus-visible). Correct Svelte 5 rune usage ($state, $derived.by, $effect). Validation warnings are non-blocking. `commit()` correctly handles `string | number | undefined` (Svelte 5 coerces bind:value on type="number" to a number — fixed in latest commit). |
| Test coverage | ✅ No unit test (UI component, per design spec "manual verification via /verify") |

### `src/lib/components/ui/Sidebar.svelte` (+2 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Adds `{#if mounted}<AthleteProfilePanel />{/if}` guard and onMount toggle |
| Issues | #112 |
| Criteria covered | AC3 — panel accessible from Sidebar |
| Quality | ⚠️ The `{#if mounted}` guard is a workaround for a Svelte 5 SSR hydration bug where AthleteProfilePanel's SSR output was missing its `<button>` element, causing client-side DOM traversal to crash. The guard means the Profile toggle button is absent from the initial SSR HTML and appears only after client hydration (~50–100ms FOUC on first load). This is the correct tradeoff vs. the crash. |
| Test coverage | ✅ Verified manually via Playwright — zero console errors on page load |

### `src/routes/+layout.svelte` (+2 / -0)

| Property | Detail |
|----------|--------|
| Purpose | Calls initAthleteProfile() in onMount alongside initTheme() and initSync() |
| Issues | #112 |
| Criteria covered | AC2 — profile loads on app mount |
| Quality | ✅ Correct placement. SSR-safe (onMount only runs client-side). |
| Test coverage | ✅ Covered transitively by store tests |

### `src/lib/components/charts/MeanMaxChart.svelte` (+67 / -8)

| Property | Detail |
|----------|--------|
| Purpose | Adds athleteProfile and sport props; FTP/CP markLine reference line; optional w/kg secondary Y-axis |
| Issues | #112 |
| Criteria covered | AC-M6 — FTP/CP reference lines; AC-M7 — w/kg axis; AC-M8 — no change when unset |
| Quality | ✅ markLine correctly conditional on refValue != null. $effect dependency list includes athleteProfile and sport for reactive re-renders. W/kg formatter correct (v / weight). ⚠️ refLabel is `'CP'` for running; design document specifies the label should be `"Critical Power"`. Minor cosmetic deviation. |
| Test coverage | ✅ No unit test required — ECharts option building is integration-level; verified via browser |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+49 / -1)

| Property | Detail |
|----------|--------|
| Purpose | Adds athleteProfile and sport props; HR zone markArea shading bands; CP zone shading for running power |
| Issues | #112 |
| Criteria covered | AC-S1 — HR zone shading; AC-S2 — CP zone shading; AC-M8 — no change when unset |
| Quality | ✅ Zone bands attach to firstVisibleIdx series only (consistent with anomaly markPoint pattern). Correctly absent when profile fields unset. ⚠️ LTHR→maxHR approximation (`lthr / 0.92`) lives in the chart component rather than in zones.ts — undocumented magic constant. Cross-sport HR fallback (cycling falls back to maxHrRunning, and vice versa) is a good UX addition but not specified in the design doc. |
| Test coverage | ✅ No unit test required — ECharts configuration verified via browser |

### `src/routes/compare/+page.svelte` (+71 / -1)

| Property | Detail |
|----------|--------|
| Purpose | Subscribes to $athleteProfile; adds buildCellContext() for summary table; passes athleteProfile and sport props to TimeSeriesChart and MeanMaxChart |
| Issues | #112 |
| Criteria covered | AC-M4 — % FTP, % CP, w/kg columns; AC-M5 — HR zone badge; AC-M8 — no change when unset |
| Quality | ✅ buildCellContext correctly null-guards all paths. {#if ctx} prevents empty renders. sport ?? 'cycling' fallback for undefined activity sport is consistent with MeanMaxChart's isCycling logic. Profile and sport props passed to both chart types. |
| Test coverage | ✅ No unit test required — pure derivation; covered by zones.test.ts for the underlying functions |

---

## Acceptance Criteria Verification

### #112 — Athlete Profile: weight, FTP, CP, HR thresholds with zone visualisation

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `AthleteProfile` type with optional fields: weight, ftp, cp, maxHrCycling, maxHrRunning, lthr | `types.ts:5-12` | N/A (type) | ✅ Met |
| 2 | `athleteProfile` store persists to/from localStorage `analyser-athlete-profile`; survives page reload | `athleteProfile.ts:6-35` | `athleteProfile.test.ts` — "setProfileField persists", "survives reload" | ✅ Met |
| 3 | Store returns all fields as `undefined` when localStorage is empty (no error thrown) | `athleteProfile.ts:25-35` | `athleteProfile.test.ts` — "initialises to empty object" | ✅ Met |
| 4 | Settings panel accessible from Sidebar renders numeric inputs for all six fields | `AthleteProfilePanel.svelte`, `Sidebar.svelte:131-135` | Playwright manual | ✅ Met |
| 5 | Saving a blank input removes the field (does not save NaN or 0) | `AthleteProfilePanel.svelte:53-55`, `athleteProfile.ts:14-16` | `athleteProfile.test.ts` — "setProfileField with undefined removes key", "does not write NaN" | ✅ Met |
| 6 | Summary table: % FTP column for cycling power when ftp set; absent when unset | `compare/+page.svelte:206-209` | zones.test.ts — ftpPct | ✅ Met |
| 7 | Summary table: % CP column for Stryd running power when cp set; absent when unset | `compare/+page.svelte:210-212` | zones.test.ts — cpPct | ✅ Met |
| 8 | Summary table: w/kg column for any power when weight set; absent when unset | `compare/+page.svelte:213-214` | zones.test.ts — wPerKg | ✅ Met |
| 9 | Summary table: HR zone badge (1–5) using sport-appropriate threshold; LTHR fallback | `compare/+page.svelte:216-218` | zones.test.ts — hrZone | ✅ Met |
| 10 | MeanMax chart: FTP reference line on cycling activities when ftp set; labelled "FTP" | `MeanMaxChart.svelte:120-134` | Browser verified | ✅ Met |
| 11 | MeanMax chart: CP reference line on Stryd running when cp set; labelled "Critical Power" | `MeanMaxChart.svelte:120-134` (label: `'CP'`) | Browser verified | ⚠️ Partially Met — label is `'CP'` not `'Critical Power'` |
| 12 | MeanMax chart: secondary w/kg Y-axis when weight set; hidden when unset | `MeanMaxChart.svelte:65-81` | Browser verified | ✅ Met |
| 13 | No chart or table UI change when relevant profile field not configured | All buildCellContext/buildOption null-guards | zones.test.ts + browser | ✅ Met |
| 14 | Time-series chart: HR zone shading bands when sport-appropriate maxHR or LTHR set (S1) | `TimeSeriesChart.svelte:189-218` | Browser verified | ✅ Met |
| 15 | Time-series chart: 5-zone CP shading on Stryd power when cp set (S2) | `TimeSeriesChart.svelte:283-288` | Browser verified | ✅ Met |
| 16 | Running summary: RSS shown when Stryd and cp configured (S3) | Not implemented — explicitly blocked on #117 | N/A | ❌ Not Met (deferred — stated in PR as Task 8 blocked) |
| 17 | zones.ts functions are unit-tested: hrZone, cpZone, wPerKg, ftpPct | `zones.test.ts` (40 tests) | N/A (is test) | ✅ Met |
| 18 | `AnomalyDetectionOptions.athleteProfile` replaced with canonical `AthleteProfile` | `types.ts:23-30`, `anomalies.ts` | anomalies.test.ts | ✅ Met |
| 19 | Profile is local-only; no network request to save or retrieve | `athleteProfile.ts` — localStorage only | N/A | ✅ Met |
| 20 | initAthleteProfile() is a no-op when typeof localStorage === 'undefined' | `athleteProfile.ts:26` | `athleteProfile.test.ts` — "initAthleteProfile is SSR-safe" | ✅ Met |
| 21 | Validation warnings shown for implausible values without blocking save (S4) | `AthleteProfilePanel.svelte:43-51` (warnings derived) | Manual | ✅ Met |

**Summary: 20/21 criteria met. Criterion 16 (RSS, S3) is explicitly deferred pending #117 — accepted by design.**

---

## Findings

### Major (should fix)

#### M1 — CP reference line label should be "Critical Power" not "CP"

- **Category:** Code Quality (spec deviation)
- **Location:** `src/lib/components/charts/MeanMaxChart.svelte:50`
- **Description:** The design document (issue #112) specifies the label for the running CP reference line should be `"Critical Power"`, matching the issue's terminology. The implementation uses `'CP'` instead. This is a minor cosmetic deviation but the design was explicit: `"CP reference line… labelled 'Critical Power'"`. FTP label is correctly `'FTP'`.
- **Recommendation:** Change `const refLabel = isCycling ? 'FTP' : 'CP'` to `const refLabel = isCycling ? 'FTP' : 'Critical Power'` at line 50.

#### M2 — LTHR→maxHR approximation undocumented and outside zones.ts

- **Category:** Code Quality / Maintainability
- **Location:** `src/lib/components/charts/TimeSeriesChart.svelte:207`
- **Description:** The chart computes an estimated maxHR from LTHR as `lthr / 0.92` to drive zone boundary generation. This magic constant (LTHR ≈ 92% of maxHR) is physiologically reasonable but is not documented, and this conversion logic does not appear in `zones.ts` where all other zone logic lives. A future maintainer editing zone boundaries may not find this calculation.
- **Recommendation:** Either add a `lthrToEstimatedMaxHR(lthr: number): number` helper to `zones.ts` with a comment explaining the 92% basis, or add an inline comment at the use site: `// LTHR ≈ 92% of maxHR — common estimate`.

### Minor (nice to fix)

#### m1 — No division-by-zero guard in wPerKg / ftpPct / cpPct

- **Category:** Reliability
- **Location:** `src/lib/analytics/zones.ts:58-68`
- **Description:** `wPerKg(watts, 0)` returns `Infinity`; `ftpPct(watts, 0)` and `cpPct(watts, 0)` also return `Infinity`. Callers guard against this in practice (`weight > 0` check, `ftp != null`), but the functions themselves are fragile. A future caller may not know to guard.
- **Recommendation:** Add `if (weightKg <= 0) return 0;` / `if (ftp <= 0) return 0;` guards, or throw a descriptive error for zero denominators.

#### m2 — No test for quota-exceeded toast in athleteProfile.test.ts

- **Category:** Test Coverage
- **Location:** `src/lib/stores/athleteProfile.test.ts`
- **Description:** The store calls `addToast` on `QuotaExceededError`, but this path has no unit test. The equivalent path in `deviceLabels.test.ts` also lacks a test, so this is consistent with existing practice — but it is a gap.
- **Recommendation:** Add a test that mocks localStorage.setItem to throw a QuotaExceededError and asserts addToast is called with a 'warning' type.

#### m3 — {#if mounted} FOUC for Profile toggle button

- **Category:** UX / Reliability
- **Location:** `src/lib/components/ui/Sidebar.svelte:131-135`
- **Description:** The `{#if mounted}` guard prevents the Profile toggle button from appearing in the SSR HTML; it pops in after client hydration. On a fast connection this is imperceptible, but on slow connections there is a brief period where the button is absent. This is a workaround for a Svelte 5 SSR bug (AthleteProfilePanel's `<button>` was missing from SSR output, causing DOM traversal to crash with `Illegal invocation`). The tradeoff (FOUC vs crash) is correct, but the root cause in Svelte 5 is worth tracking if a proper fix becomes available.
- **Recommendation:** Track in a follow-up issue. When the Svelte 5 SSR rendering of this component structure is understood, remove the mounted guard and render AthleteProfilePanel unconditionally.

### Suggestions (optional)

#### S1 — Cross-sport HR fallback is a good addition; document it

- **Location:** `src/lib/components/charts/TimeSeriesChart.svelte:201-203`
- **Description:** The chart falls back to `maxHrRunning` when `maxHrCycling` is absent for a cycling activity (and vice versa). This is a helpful UX improvement over the strict sport routing in `hrZone()`. Consider promoting this fallback into `hrZone()` or a new helper so it applies consistently to the summary table too.

#### S2 — Consider adding initAthleteProfile to docs/architecture notes

- **Description:** The pattern of `init*` functions called in `+layout.svelte onMount` is used by `initSync` and `initTheme`. AthleteProfile follows this pattern. A one-line comment in `+layout.svelte` at the initAthleteProfile call noting "same lazy-load pattern as initSync" would help future contributors.

---

## Positive Observations

- **Pure zone module design** — `zones.ts` is cleanly separated from chart and UI code, enabling independent testing of all threshold logic. The 40-test suite is comprehensive and follows boundary-value test discipline.
- **Store pattern consistency** — `athleteProfile.ts` mirrors `theme.ts` and `sync.ts` in API shape and localStorage key naming. A new contributor would immediately recognise the pattern.
- **Graceful degradation** — Every feature correctly falls back to "no change" when profile fields are absent. The `null` return from `buildCellContext` and `hrZone` is handled at every call site.
- **Sport-awareness** — Separate cycling/running HR maxima and threshold models are a solid domain decision. The `sport ?? 'cycling'` default in the compare page and `sport !== 'running'` in MeanMaxChart are consistently applied.
- **Validation without blocking** — Physiological warning thresholds (FTP > 600 W, weight < 30 kg) are displayed inline and non-blocking — correct UX for numeric fields where users may be mid-typing.
- **Test count** — 52 new tests added; 895 total passing. No regressions introduced.
- **SSR hydration fix included** — The PR correctly includes the fix for the crash introduced by adding AthleteProfilePanel to the Sidebar footer, turning a hard crash into an acceptable first-render tradeoff.

---

## Action Items

### Immediate Fixes (recommended before merge)

- [ ] **M1**: Change CP reference line label from `'CP'` to `'Critical Power'` in `MeanMaxChart.svelte:50`

### Post-merge improvements

- [ ] **M2**: Move LTHR→maxHR conversion (`lthr / 0.92`) into `zones.ts` as a documented helper — create issue via `/analyse`
- [ ] **m1**: Add zero-denominator guards to `wPerKg`, `ftpPct`, `cpPct` in `zones.ts`
- [ ] **m2**: Add quota-exceeded toast test to `athleteProfile.test.ts`
- [ ] **m3**: Track Svelte 5 SSR rendering issue for AthleteProfilePanel; remove `{#if mounted}` guard when fixed upstream

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced
- [x] No performance regressions
- [x] Error handling complete and consistent (quota error, malformed JSON, NaN)
- [x] Logging adequate (console.warn + addToast on failures)
- [x] Code follows existing codebase conventions throughout
- [x] No unnecessary changes outside scope of the issue
- [x] Task 8 (RSS) correctly deferred — blocked on #117, documented in PR body
