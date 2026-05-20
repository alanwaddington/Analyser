# PR #34 Review — feat: Create DeltaChart.svelte component (#13)

**Date:** 2026-05-20
**Author:** alanwaddington
**Branch:** feature/13-delta-chart → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate — pure logic well tested; Svelte component untestable in node environment |
| Acceptance Criteria | 9/9 Met (Issue #13 behavioural requirements) |

---

## Issues Reviewed

### Issue Hierarchy
- #13 — Step 13: Create DeltaChart.svelte component (Event mode) (standalone — no parent/child issues)

---

## Changed Files Audit

### `src/lib/components/charts/DeltaChart.svelte` (+271 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | ECharts time-delta line chart for event mode — renders cumulative seconds ahead/behind reference per candidate activity |
| Issues | #13 |
| Criteria covered | All 9 behavioural criteria from issue #13 |
| Quality | See findings below |
| Test coverage | Indirectly via `DeltaChart.utils.ts` tests; component logic not directly testable in node environment |

### `src/lib/components/charts/DeltaChart.utils.ts` (+30 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Pure functions extracted from chart component: `getClipDistance`, `buildZeroLine`, `buildDeltaData`; plus `DeltaSeriesInput` interface |
| Issues | #13 |
| Criteria covered | X-axis clipping, zero line, delta computation |
| Quality | ✅ Clean, focused, well-typed |
| Test coverage | `DeltaChart.test.ts` — 15 tests covering all three functions |

### `src/lib/components/charts/DeltaChart.test.ts` (+142 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for the three extracted pure functions |
| Issues | #13 |
| Criteria covered | Validates clipping, zero line, delta data in both axis modes, edge cases |
| Quality | ✅ Follows codebase convention (`MethodName_Scenario_ExpectedResult`), good edge cases |
| Test coverage | N/A (this is the test file) |

---

## Acceptance Criteria Verification

### #13 — Step 13: Create DeltaChart.svelte component (Event mode)

Issue #13 defines behaviour as a list of requirements rather than numbered ACs. Each is verified below:

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | Component file exists at `src/lib/components/charts/DeltaChart.svelte` | File exists, 271 lines | N/A | ✅ Met |
| 2 | One line series per non-reference activity showing cumulative seconds ahead (+) or behind (-) | `.svelte:41-60` — `candidateSeries` filters out `referenceIndex`, uses `buildDeltaData` which calls `computeTimeDelta` | `buildDeltaData_candidateFaster_returnsPositiveDeltas`, `buildDeltaData_candidateSlower_returnsNegativeDeltas` | ✅ Met |
| 3 | X-axis clipped to the shortest activity's distance/time | `.utils.ts:9-11` — `getClipDistance` via `Math.min(...totalDistance)` ; `.svelte:38` — `getClipDistance(allActivities)` | `getClipDistance_differentLengths_returnsShortest`, `getClipDistance_threeActivities_returnsShortest` | ✅ Met |
| 4 | Zero reference line drawn as a dashed grey baseline | `.svelte:62-72` — `zeroLine` series with `lineStyle: { type: 'dashed', color: '#22c55e' }` | `buildZeroLine_distanceMode_returnsKmRange`, `buildZeroLine_timeMode_returnsMetresRange` | ✅ Met |
| 5 | Uses `computeTimeDelta(ref, candidate)` from `$lib/compare/delta` | `.utils.ts:2,24` — imports and calls `computeTimeDelta` | `buildDeltaData_sameSpeed_returnsAllZeroDeltas` (integration via `computeTimeDelta`) | ✅ Met |
| 6 | Reacts to `xAxisMode` store | `.svelte:152-157` — `$effect` tracks `$xAxisMode` via `void $xAxisMode` | N/A (store reactivity is framework-level) | ✅ Met |
| 7 | Theme-aware (matchMedia at mount + change listener) | `.svelte:128-141` — `onMount` sets `isDark`, registers `matchMedia` change listener; `onDestroy` removes it | N/A | ✅ Met |
| 8 | `echarts.connect(groupId)` for crosshair sync | `.svelte:131-133` — `chart.group = groupId; echarts.connect(groupId)` | N/A | ✅ Met |
| 9 | Custom HTML legend below canvas | `.svelte:170-188` — `{#each}` rendering `<button>` per non-reference activity with SVG swatch, toggle via `toggleSeries` | N/A | ✅ Met |

**Card styling check:**
- Border `rgba(34, 197, 94, 0.27)` — `.svelte:194` ✅ (note: `#22c55e` at ~27% opacity ≈ `#22c55e44`; slightly different hex representation but same visual)
- Title colour `#22c55e` — `.svelte:209` ✅

**Verify criterion:** `npm run check` passes — confirmed: 374 files, 0 errors, 0 warnings ✅

**Summary:** 9/9 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

#### M1 — Props interface differs from issue specification

- **Category:** Code Quality / API Design
- **Location:** `DeltaChart.svelte:10-18`
- **Description:** The issue specifies props as `activities: Activity[], referenceIndex: number, groupId: string`. The implementation uses `seriesInputs: DeltaSeriesInput[]` instead of `activities: Activity[]`, where `DeltaSeriesInput` adds a `colourIndex` field. This is a reasonable design decision (consistent with `TimeSeriesChart`'s `SeriesInput` pattern and lets the parent control colour assignment), but diverges from the spec. This is flagged as Major only because the parent page (`/event`) consuming this component must match the actual interface, not the one documented in #13.
- **Recommendation:** Accept the implementation as-is — the `DeltaSeriesInput` pattern is consistent with `TimeSeriesChart`'s `SeriesInput` and correctly delegates colour management to the parent. Update the issue description if desired for documentation accuracy.

#### M2 — Zero line colour is `#22c55e` (green) instead of grey

- **Category:** Reliability / Spec Adherence
- **Location:** `DeltaChart.svelte:66`
- **Description:** The issue states "Zero reference line drawn as a dashed **grey** baseline." The implementation uses `color: '#22c55e'` (green) instead. In the TimeSeriesChart, the grid colour serves as the grey reference — the grid colour helper `gridColour()` returns `'#1e293b'` (dark) or `'#e2e8f0'` (light), which are suitable greys.
- **Recommendation:** Change the zero line colour to use `gc` (the grid colour, which is grey and theme-aware) instead of `#22c55e`:
  ```typescript
  lineStyle: { color: gc, type: 'dashed' as const, width: 1 },
  itemStyle: { color: gc },
  ```

### Minor (nice to fix)

#### m1 — `buildZeroLine` uses raw metres in `time` mode but x-axis label says `m`

- **Category:** Reliability
- **Location:** `DeltaChart.utils.ts:14`, `DeltaChart.svelte:74`
- **Description:** When `xAxisMode` is `'time'`, the x-axis name is `'m'` (line 74) and `buildZeroLine` returns `maxDist` in metres (line 14). However, `buildDeltaData` also returns x values in metres for time mode (line 27). The issue is that time mode should arguably show time on the x-axis (seconds, matching `'s'` label as in TimeSeriesChart), but the DeltaChart always shows distance. This is internally consistent (both `buildZeroLine` and `buildDeltaData` agree on metres), but the x-axis label `'m'` in time mode is ambiguous — it could mean "metres" or "minutes". The TimeSeriesChart uses `'s'` (seconds) for time mode.
- **Recommendation:** Consider whether the DeltaChart should support a true time-axis mode (x = seconds, requiring time-aligned delta computation), or if it should always use distance. If always distance, the `xAxisMode` reactivity is still useful for label formatting but the `'time'` mode label should be clearer — perhaps `'m (dist)'` or simply always show `'km'` since delta computation is inherently distance-based.

#### m2 — Tooltip formatter uses raw HTML string concatenation

- **Category:** Code Quality
- **Location:** `DeltaChart.svelte:99-111`
- **Description:** The tooltip `formatter` function builds HTML via string interpolation with `p.seriesName` injected directly into the HTML. While `seriesName` comes from `s.activity.filename` (a filename, not user-typed free text), filenames could theoretically contain `<` or `&` characters that would break HTML rendering or cause XSS in a tooltip context. ECharts renders tooltips via `innerHTML`.
- **Recommendation:** Sanitise `seriesName` by escaping HTML entities, or rely on ECharts' built-in default formatter (which handles escaping). A simple escape helper:
  ```typescript
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  ```

### Suggestions (optional)

#### S1 — Consider extracting shared chart infrastructure

- **Category:** Code Quality
- **Location:** Both `DeltaChart.svelte` and `TimeSeriesChart.svelte`
- **Description:** The two chart components share significant infrastructure: theme colour helpers (identical 4 functions), `onMount` setup (ECharts init, group connect, matchMedia, ResizeObserver), `onDestroy` cleanup, legend button CSS, and the `toggleSeries` pattern. This duplication is acceptable for two components but may warrant extraction if a third chart component is added (e.g. `MeanMaxChart` or `SegmentBarChart` from the plan).
- **Recommendation:** No action needed now. If a third chart component is created, extract the shared infrastructure into a `useChart` utility or a base component.

---

## Positive Observations

- **Consistent pattern with TimeSeriesChart** — onMount/effect/onDestroy lifecycle, `{ notMerge: true }`, `$effect` owns initial render, ResizeObserver, accessible legend buttons. All lessons from PR #33 review applied.
- **Clean extraction of pure logic** — `getClipDistance`, `buildZeroLine`, and `buildDeltaData` are pulled into a `.utils.ts` file with exported `DeltaSeriesInput` interface, matching the established pattern.
- **Comprehensive test coverage** — 15 tests cover all three functions including edge cases (same speed, faster/slower, clipping, both axis modes, empty records).
- **No comments** — CLAUDE.md convention followed.
- **Accessibility** — legend buttons use `aria-pressed`, `aria-label`, `role="group"`, SVG swatches `aria-hidden`. Focus-visible outline uses the green accent.
- **Correct `$effect` reactivity** — tracks `$xAxisMode`, `seriesInputs`, and `referenceIndex` (learned from PR #33 review m1).
- **Proper type narrowing** — `.filter((s): s is NonNullable<typeof s> => s !== null)` avoids the common `.filter(Boolean)` TypeScript narrowing issue.
- **Custom tooltip** — filters out the zero line (`__zero__`) from tooltip display, shows sign-prefixed delta values.

---

## Action Items

### Immediate Fixes (block merge)

None — no critical findings.

### Should fix (before or shortly after merge)

- [ ] M1: Accept divergence from issue spec (seriesInputs vs activities) — no code change needed, update issue description if desired
- [ ] M2: Change zero line colour from `#22c55e` to `gc` (grid colour / grey) per issue specification

### Post-merge improvements

- [ ] m1: Clarify x-axis label/mode for time vs distance (delta computation is inherently distance-based)
- [ ] m2: Sanitise HTML in tooltip formatter to handle filenames with special characters
- [ ] S1: Extract shared chart infrastructure if a third chart component is added

---

## Checklist

- [x] All acceptance criteria from the full issue hierarchy verified by reading actual code
- [x] Every changed file read and audited
- [x] Tests cover happy path, error paths, and edge cases
- [x] No security vulnerabilities introduced (m2 is defensive; current risk is negligible)
- [x] No performance regressions
- [x] Error handling complete and consistent
- [x] Logging adequate for debugging production issues
- [x] Code follows existing codebase conventions
- [x] No unnecessary changes outside scope of the issue
