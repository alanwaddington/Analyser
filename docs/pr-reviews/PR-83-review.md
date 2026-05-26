# PR #83 Review — feat: Export activity data as Excel and charts as PNG (#72)

**Date:** 2026-05-26
**Author:** alanwaddington
**Branch:** feature/72-export-excel-png → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 14/14 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #72 — Export chart data as CSV and chart images as PNG (root — contains Analysis + Design)

No sub-issues exist. All acceptance criteria (AC1–AC14) and task-level acceptance criteria are defined within issue #72.

---

## Changed Files Audit

### `package.json` (+2 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `xlsx` (SheetJS) as a runtime dependency |
| Issues | #72 |
| Criteria covered | Dependency required for AC1–AC10 |
| Quality | ✅ No issues — `xlsx@^0.18.5` is the current stable release |
| Test coverage | N/A (config file) |

### `package-lock.json` (+105 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Lock file updated for `xlsx` dependency |
| Issues | #72 |
| Criteria covered | N/A |
| Quality | ✅ Auto-generated |
| Test coverage | N/A |

### `src/lib/export/excel.ts` (+166 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New module — `buildWorkbook(activities)` generates an `.xlsx` ArrayBuffer with Summary + per-activity data sheets |
| Issues | #72 |
| Criteria covered | AC1 (filename), AC2 (Summary sheet), AC3 (per-activity sheets), AC4 (headers), AC5 (row per record), AC6 (null channel omission), AC7 (Date timestamps), AC8 (single file), AC9 (multi-file), R6 (pace MM:SS) |
| Quality | ✅ Clean, well-structured. Good edge-case handling for pace rounding overflow (`:59` → `:00`), sheet name truncation/deduplication |
| Test coverage | `excel.test.ts` — 19 tests covering all criteria |

### `src/lib/export/download.ts` (+47 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New module — `triggerDownload()` and `downloadPng()` for browser file downloads |
| Issues | #72 |
| Criteria covered | Required by AC1, AC4, AC11 |
| Quality | ✅ Proper cleanup (revokeObjectURL). Appends to DOM body then removes anchor — standard browser download pattern |
| Test coverage | `download.test.ts` — 6 tests |

### `src/lib/export/excel.test.ts` (+244 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `buildWorkbook` — sheet count, columns, pace formatting, null channel omission, truncation, deduplication |
| Issues | #72 |
| Criteria covered | Validates AC1–AC9 |
| Quality | ✅ Comprehensive. Uses `xlsx.read()` to round-trip verify the output. Tests both happy-path and edge cases (empty records, duplicate filenames, partial null channels) |
| Test coverage | Self (test file) |

### `src/lib/export/download.test.ts` (+113 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `triggerDownload` and `downloadPng` in jsdom environment |
| Issues | #72 |
| Criteria covered | Validates download trigger mechanics |
| Quality | ✅ Properly stubs `URL.createObjectURL/revokeObjectURL` and intercepts anchor clicks. `// @vitest-environment jsdom` directive correctly applied |
| Test coverage | Self (test file) |

### `src/lib/components/charts/TimeSeriesChart.svelte` (+76 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `getChartDataURL()` export function and PNG download button to chart header |
| Issues | #72 |
| Criteria covered | AC11, AC12 (filename `{channel-slug}-{date}.png`), AC13 (theme-aware bg), AC14 (non-destructive — `getDataURL()` doesn't reset zoom) |
| Quality | ✅ Follows existing `.chart-header` pattern. Proper aria-label. Responsive: hides "PNG" label below 320px |
| Test coverage | No unit test — ECharts integration; verified via Playwright runtime |

### `src/lib/components/charts/MeanMaxChart.svelte` (+75 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `getChartDataURL()` export function and PNG download button |
| Issues | #72 |
| Criteria covered | AC11, AC12 (`mean-max-{date}.png`), AC13, AC14 |
| Quality | ✅ Consistent pattern with TimeSeriesChart |
| Test coverage | No unit test — ECharts integration; verified via Playwright runtime |

### `src/lib/components/charts/DeltaChart.svelte` (+88 / -4 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add PNG button; restructure header to accommodate title + subtitle + button in a flex row |
| Issues | #72 |
| Criteria covered | AC11, AC12 (`time-delta-{date}.png`), AC13, AC14 |
| Quality | ✅ Header restructured cleanly with `.chart-header-left` for title+subtitle alignment |
| Test coverage | No unit test — ECharts integration; verified via Playwright runtime |

### `src/lib/components/charts/SegmentChart.svelte` (+75 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add `getChartDataURL()` export function and PNG download button |
| Issues | #72 |
| Criteria covered | AC11, AC12 (`segments-{date}.png`), AC13, AC14 |
| Quality | ✅ Consistent pattern with other chart components |
| Test coverage | No unit test — ECharts integration; verified via Playwright runtime |

### `src/routes/compare/+page.svelte` (+95 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add "Export Data" button in tab bar with lazy-loaded SheetJS workbook generation |
| Issues | #72 |
| Criteria covered | AC1 (filename `analyser-export-{date}.xlsx`), AC10 (/compare visibility), R7 (Summary sheet), R9 (clearly labelled button) |
| Quality | ✅ Good error handling (try/catch with console.error + alert). Disabled state when no activities. Loading spinner with aria-busy. Lazy import avoids bundle bloat |
| Test coverage | Verified via Playwright runtime |

### `src/routes/event/+page.svelte` (+95 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Add "Export Data" button in tab bar (identical pattern to /compare) |
| Issues | #72 |
| Criteria covered | AC10 (/event visibility) |
| Quality | ✅ Consistent with compare page implementation |
| Test coverage | Verified via Playwright runtime |

---

## Acceptance Criteria Verification

### #72 — Export chart data as CSV and chart images as PNG

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| AC1 | Clicking Export Data downloads `analyser-export-YYYY-MM-DD.xlsx` | `compare/+page.svelte:223`, `event/+page.svelte:135` — `handleExport()` builds filename with `new Date().toISOString().slice(0, 10)` | `excel.test.ts:41-47` (sheet structure), Playwright runtime verification | ✅ Met |
| AC2 | Workbook contains Summary sheet with Filename, Sport, Start Time, Distance, Total Time columns | `excel.ts:82` — `buildSummarySheet()` creates header `['Filename', 'Sport', 'Start Time', 'Distance (km)', 'Elapsed Time']` | `excel.test.ts:64-76` — verifies Summary column names | ✅ Met |
| AC3 | One sheet per activity named after filename (truncated to 31 chars) | `excel.ts:67-78` — `makeSheetNames()` truncates to 31 chars, deduplicates with suffix | `excel.test.ts:87-113` — tests naming, truncation, deduplication | ✅ Met |
| AC4 | Header row: Timestamp, Elapsed (s), Distance (m), then channel columns with label+unit | `excel.ts:115-118` — builds header from `CHANNEL_META[key].label` + `CHANNEL_META[key].unit` | `excel.test.ts:115-127` — verifies Timestamp, Elapsed (s), Distance (m) headers; `excel.test.ts:129-138` — verifies `Heart Rate (bpm)` | ✅ Met |
| AC5 | One row per ActivityRecord with values for every channel column | `excel.ts:121-129` — maps each record to a row | `excel.test.ts:217-229` — 3 records → 3 rows | ✅ Met |
| AC6 | Channels with all-null values omitted as columns | `excel.ts:52-56` — `presentChannels()` filters on `records.some(r => r[key] != null)` | `excel.test.ts:140-149` — all-null heartRate → column absent; `excel.test.ts:152-165` — partial-null → column present | ✅ Met |
| AC7 | Timestamp column contains proper Excel date/time (not string) | `excel.ts:133-141` — sets `cell.z = 'yyyy-mm-dd hh:mm:ss'` on Date cells | `excel.test.ts` — test records use `new Date()` objects; SheetJS with `cellDates: true` preserves them | ✅ Met |
| AC8 | Works with single file loaded (Summary + 1 data sheet) | `excel.ts:151-165` — general logic handles any array length | `excel.test.ts:41-47` — 1 activity → 2 sheets | ✅ Met |
| AC9 | Works with 2–6 files (Summary + N data sheets) | Same general logic | `excel.test.ts:49-55` — 3 activities → 4 sheets | ✅ Met |
| AC10 | Export Data button visible+functional on both /compare and /event | `compare/+page.svelte:289-314` — button in tab bar; `event/+page.svelte:208-233` — identical button | Playwright runtime: Export Data visible+enabled on both pages | ✅ Met |
| AC11 | Each chart card has a PNG export button | All 4 chart Svelte files have `.png-btn` in `.chart-header` | Playwright runtime: 4 PNG buttons on /compare Charts, 5 on /event Charts | ✅ Met |
| AC12 | PNG filename includes channel name and date | `TimeSeriesChart.svelte:258` — `{slug}-{date}.png`; `MeanMaxChart.svelte:124` — `mean-max-{date}.png`; `DeltaChart.svelte:155` — `time-delta-{date}.png`; `SegmentChart.svelte:150` — `segments-{date}.png` | Playwright runtime: downloaded `heart-rate-2026-05-26.png` | ✅ Met |
| AC13 | PNG matches current theme (light/dark background) | All 4 charts: `backgroundColor: $isDark ? '#0f172a' : '#ffffff'` in `getChartDataURL()` | Visual verification — theme reactive via `$isDark` store | ✅ Met |
| AC14 | PNG export doesn't disrupt chart state (no re-render, no zoom/crosshair loss) | `getDataURL()` is a read-only operation on the ECharts instance — no `setOption` or `dispatchAction` calls | By design — ECharts `getDataURL()` captures without mutation | ✅ Met |

**Summary:** 14/14 criteria met.

---

## Findings

### Major (should fix)

#### M1 — Double-click on Export Data fires two downloads
- **Category:** Reliability
- **Location:** `compare/+page.svelte:217`, `event/+page.svelte:129`
- **Description:** The `exporting` flag is set synchronously before the `await import()`, and the button's `disabled` attribute is bound reactively. However, Svelte's reactive DOM update hasn't flushed before the browser dispatches a second click event from a rapid double-click, so the second click passes the `if ($activities.length === 0 || exporting) return` guard. This produces two identical .xlsx downloads. Verified by Playwright: "Double-click: 2 downloads fired".
- **Recommendation:** Add `pointer-events: none` to `.export-btn:disabled` in CSS. This is an immediate DOM-level block that doesn't depend on Svelte's reactive flush timing. Alternatively, track the debounce via a module-scoped `let lastExport = 0` with a 500ms window check.

### Minor (nice to fix)

#### m1 — Duplicated .export-btn and .png-btn CSS across files
- **Category:** Code Quality
- **Location:** `.export-btn` CSS block duplicated identically in `compare/+page.svelte:519-562` and `event/+page.svelte:423-466`. `.png-btn` CSS block duplicated across all 4 chart components.
- **Description:** The `.export-btn` styles (13 rules totalling ~40 lines) are copy-pasted identically in both page components. The `.png-btn` styles (~30 lines) are duplicated across 4 chart components. While Svelte scoped CSS means this is functional, it creates a maintenance burden — any styling change must be applied in multiple places.
- **Recommendation:** Extract `.export-btn` styles to a shared CSS file (e.g. `src/routes/export-btn.css`) imported by both pages. For `.png-btn`, extract to a shared chart styles file.

#### m2 — `handleExport` function duplicated on both pages
- **Category:** Code Quality
- **Location:** `compare/+page.svelte:216-234`, `event/+page.svelte:129-147`
- **Description:** The `handleExport` function body is identical on both pages (18 lines). The `exporting` state and its guard logic are duplicated.
- **Recommendation:** Extract to a shared utility, e.g. `src/lib/export/handleExport.ts` that takes `activities` and returns an async function. This also makes the M1 debounce fix a single-point change.

### Suggestions (optional)

#### S1 — Consider `xlsx/xlsx.mjs` for better tree-shaking
- **Category:** Performance
- **Location:** `excel.ts:15`
- **Description:** The `import * as xlsx from 'xlsx'` import pulls the full SheetJS bundle (~200 KB gzipped). SheetJS offers a mini build (`xlsx/xlsx.mini.mjs`) that excludes the parser and drops the bundle to ~140 KB — since this codebase only writes (never parses), the mini build would save ~60 KB.
- **Recommendation:** Change import to `import * as xlsx from 'xlsx/xlsx.mjs'` or investigate if `xlsx.mini` works with the write-only subset used here. Low priority — the full bundle is lazy-loaded.

---

## Positive Observations

- **Clean TDD execution**: 25 new tests (19 for excel, 6 for download) covering happy paths, edge cases (empty records, duplicate filenames, partial null channels), and boundary conditions (pace rounding overflow). All 436 tests pass.
- **Lazy loading**: SheetJS is dynamically imported only when the user clicks Export Data, keeping the initial bundle lean. Good use of `await import('$lib/export/excel')`.
- **Consistent component pattern**: All 4 chart components follow an identical pattern for PNG export — `getChartDataURL()` + `handlePngDownload()` + button HTML. Easy to maintain.
- **Accessibility**: All buttons have proper `aria-label`, `aria-busy`, `title` attributes. Loading spinner uses `aria-hidden`. Focus-visible outlines present.
- **Theme awareness**: PNG exports use the current `$isDark` store value for background colour, matching what the user sees on screen.
- **Error handling**: `handleExport()` wraps the async flow in try/catch with `console.error` for debugging + `alert()` for user feedback. Not silent.
- **Pace formatting**: Edge case for rounding overflow (`59.5s` → `60s` → increments minute) is properly handled in `formatPace()`.

---

## Action Items

### Immediate Fixes (block merge)
- [ ] M1: Add `pointer-events: none` to `.export-btn:disabled` CSS on both pages to prevent double-click duplicate downloads

### Post-merge improvements
- [ ] m1: Extract duplicated `.export-btn` and `.png-btn` CSS to shared stylesheets — create issue via `/analyse`
- [ ] m2: Extract duplicated `handleExport` function to a shared module — create issue via `/analyse`
- [ ] S1: Investigate `xlsx/xlsx.mini.mjs` for reduced bundle size — create issue via `/analyse`

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
