# PR #148 Review — Enhancement: export data as CSV in addition to XLSX (#111)

**Date:** 2026-06-16
**Author:** alanwaddington
**Branch:** feature/111-csv-export → main
**State:** Open

---

## Summary

| Item | Result |
|------|--------|
| Overall Assessment | Pass with comments ⚠️ |
| Risk Level | Low |
| Test Coverage | Adequate |
| Acceptance Criteria | 15/15 Met |

---

## Issues Reviewed

### Issue Hierarchy
- #111 — Enhancement: export data as CSV in addition to XLSX (root — contains Analysis + Design)

---

## Changed Files Audit

### `src/lib/export/columns.ts` (+49 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New shared column utilities extracted from `excel.ts` — `CHANNEL_KEYS`, `presentChannels()`, `buildHeaderLabel()`, `formatCellValue()`, `escapeCsvField()`, `ExportFormat` type |
| Issues | #111 |
| Criteria covered | Shared column-builder utility; RFC 4180 escaping; pace formatting; null omission |
| Quality | ✅ Clean, focused functions. `escapeCsvField` correctly handles commas, quotes, newlines, and CR. |
| Test coverage | `columns.test.ts` — 28 tests |

### `src/lib/export/columns.test.ts` (+170 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for all shared column utilities |
| Issues | #111 |
| Criteria covered | Tests for `presentChannels`, `buildHeaderLabel`, `formatCellValue`, `escapeCsvField` |
| Quality | ✅ Good coverage — null/undefined, pace M:SS formatting, all escape edge cases, channel ordering |
| Test coverage | Self (test file) |

### `src/lib/export/csv.ts` (+47 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | New `buildCsv(activities)` function producing RFC 4180 CSV strings |
| Issues | #111 |
| Criteria covered | Single/multi-file CSV; activity column; CRLF line endings; channel null omission; pace formatting; ISO 8601 timestamps |
| Quality | ✅ Clean implementation. Uses shared column utilities. See M1 finding below. |
| Test coverage | `csv.test.ts` — 20 tests |

### `src/lib/export/csv.test.ts` (+217 / -0 lines)

| Property | Detail |
|----------|--------|
| Purpose | Unit tests for `buildCsv` covering all acceptance criteria scenarios |
| Issues | #111 |
| Criteria covered | Single-activity, multi-activity, row counts, column omission, pace formatting, RFC 4180 escaping, null values, CRLF |
| Quality | ✅ Thorough. Helper functions `parseCsv()` and `parseCsvAsObjects()` are well-crafted. |
| Test coverage | Self (test file) |

### `src/lib/export/excel.ts` (+4 / -40 lines)

| Property | Detail |
|----------|--------|
| Purpose | Refactored to import `presentChannels`, `buildHeaderLabel`, `formatCellValue` from `columns.ts` instead of defining them locally |
| Issues | #111 |
| Criteria covered | Existing XLSX export unaffected |
| Quality | ✅ Clean extraction. Removed unused `CHANNEL_META` import and `formatPace` import. |
| Test coverage | `excel.test.ts` — 19 existing tests pass unmodified |

### `src/lib/export/exportActivities.ts` (+28 / -13 lines)

| Property | Detail |
|----------|--------|
| Purpose | Extended to accept `format: ExportFormat` parameter; branches to CSV or XLSX builder |
| Issues | #111 |
| Criteria covered | Format branching; CSV download with `.csv` extension and `text/csv` MIME; XLSX unchanged |
| Quality | ✅ Lazy imports preserved. CSV wrapped in UTF-8 Blob. Default is `'csv'`. |
| Test coverage | Covered indirectly by csv.test.ts and excel.test.ts; integration verified manually |

### `src/routes/export-btn.css` (+59 / -1 lines)

| Property | Detail |
|----------|--------|
| Purpose | Added `.export-group`, `.export-format-toggle`, `.format-btn` styles; removed `margin-left: auto` from `.export-btn` |
| Issues | #111 |
| Criteria covered | Format toggle styling; responsive phone breakpoint; accessibility focus-visible |
| Quality | ✅ Consistent with existing `.axis-toggle` pattern. Responsive adjustments at ≤480px. |
| Test coverage | Visual — no automated CSS tests in project |

### `src/routes/compare/+page.svelte` (+55 / -29 lines)

| Property | Detail |
|----------|--------|
| Purpose | Added `ExportFormat` import, `exportFormat` state (default `'csv'`), format toggle markup, passes format to `handleExport` |
| Issues | #111 |
| Criteria covered | Format selector on `/compare`; CSV default; ARIA radiogroup/radio; dynamic aria-label |
| Quality | ✅ Markup matches product-designer spec. Accessible with role/aria-checked. |
| Test coverage | Visual — no component tests for page-level Svelte; verified in production build |

### `src/routes/event/+page.svelte` (+55 / -29 lines)

| Property | Detail |
|----------|--------|
| Purpose | Identical changes to compare page — format toggle + handler update |
| Issues | #111 |
| Criteria covered | Format selector on `/event`; CSV default; ARIA radiogroup/radio; dynamic aria-label |
| Quality | ✅ Exact parity with compare page. |
| Test coverage | Visual — same as compare page |

---

## Acceptance Criteria Verification

### #111 — Enhancement: export data as CSV in addition to XLSX

#### Original Issue Acceptance Criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | Single-file CSV export produces valid, openable CSV with correct headers | `csv.ts:22-26` — builds header row with Timestamp, Elapsed (s), Distance (m), channel headers | `csv.test.ts:58-64` | ✅ Met |
| 2 | Pace formatted as M:SS (not raw seconds) in CSV | `columns.ts:39` via `formatPace()` | `csv.test.ts:161-177` (3 tests) | ✅ Met |
| 3 | Multi-file export prompts for format (one file / merged) | `compare/+page.svelte:324-341`, `event/+page.svelte:229-246` — segmented toggle | Visual | ✅ Met |
| 4 | Existing XLSX export unaffected | `exportActivities.ts:32-39` — else branch unchanged; `excel.ts` refactored to use shared utils but logic identical | `excel.test.ts` — all 19 tests pass | ✅ Met |

#### Analysis Section Acceptance Criteria

| # | Criterion | Implementation | Test | Verdict |
|---|-----------|----------------|------|---------|
| 1 | `buildCsv([activity])` returns a string beginning with the correct header row | `csv.ts:13-47` | `csv.test.ts:51-64` | ✅ Met |
| 2 | Header row for single-activity export does NOT include an `activity` column | `csv.ts:23-25` — `multi` check | `csv.test.ts:66-70` | ✅ Met |
| 3 | Header row for multi-activity export includes `activity` as the first column | `csv.ts:23-24` | `csv.test.ts:98-102` | ✅ Met |
| 4 | Each data row in a multi-file export has the source `filename` in the `activity` column | `csv.ts:40` | `csv.test.ts:104-113` | ✅ Met |
| 5 | Pace values formatted as `M:SS` strings | `columns.ts:39` → `formatPace()` | `csv.test.ts:161-177` | ✅ Met |
| 6 | Channels with all-null values across all records omitted | `columns.ts:24-28` via `presentChannels()` on flattened records | `csv.test.ts:135-141` | ✅ Met |
| 7 | Channels present in at least one record appear as a column | `columns.ts:24-28` — `some(r => r[key] != null)` | `csv.test.ts:143-157` (2 tests) | ✅ Met |
| 8 | `triggerDownload` called with `text/csv` MIME and `analyser-export-YYYY-MM-DD.csv` filename | `exportActivities.ts:27-31` | Integration (verified in build audit) | ✅ Met |
| 9 | Single-file CSV: exactly `(record count)` data rows + 1 header | `csv.ts:29-43` — iterates all records | `csv.test.ts:72-94` (3 tests) | ✅ Met |
| 10 | Multi-file merged CSV: sum of all activities' record counts as data rows | `csv.ts:29` — nested loop over all activities | `csv.test.ts:115-125` | ✅ Met |
| 11 | Commas and quotes properly escaped per RFC 4180 | `columns.ts:44-48` — `escapeCsvField()` | `csv.test.ts:181-186`, `columns.test.ts:142-169` | ✅ Met |
| 12 | Existing XLSX export flow entirely unaffected | `excel.ts` refactored but identical logic; `exportActivities.ts` else-branch unchanged | `excel.test.ts` — 19 tests unmodified | ✅ Met |
| 13 | Export UI on `/compare` and `/event` provides format selector; CSV is the default | Both pages: `exportFormat = $state<ExportFormat>('csv')` + toggle markup | Visual | ✅ Met |
| 14 | Format selector state is local to the page | `$state` (not store) — scoped to component | Code inspection | ✅ Met |
| 15 | Unit tests cover all scenarios | `columns.test.ts` (28 tests) + `csv.test.ts` (20 tests) | Self | ✅ Met |

**Summary:** 15/15 criteria met.

---

## Findings

### Critical (must fix before merge)

None.

### Major (should fix)

#### M1 — `buildCsv` with empty activities array throws or produces header-only output

- **Category:** Reliability
- **Location:** `csv.ts:17`
- **Description:** `buildCsv([])` (empty array) calls `activities.flatMap(a => a.records)` which returns `[]`, then `presentChannels([])` returns `[]`, producing a header row of just `Timestamp,Elapsed (s),Distance (m)` with no `activity` column. This is technically valid but undocumented. More importantly, calling `exportActivities([], 'csv')` would download an empty-looking CSV. Both pages guard against this (`$activities.length === 0 || exporting` disables the button), so this path is unreachable in practice, but a defensive early return in `buildCsv` would be cleaner.
- **Recommendation:** Add a guard at the top of `buildCsv`: `if (activities.length === 0) return '';` — or document that callers must pass a non-empty array. Low priority since the UI already prevents this.

### Minor (nice to fix)

#### m1 — `ChannelKey` type import unused in `excel.ts`

- **Category:** Code Quality
- **Location:** `excel.ts:16`
- **Description:** After refactoring, `ChannelKey` is imported but no longer directly referenced in `excel.ts` — `presentChannels` and `buildHeaderLabel` accept and return it internally, but the file itself only uses `Activity`. TypeScript doesn't error on unused type imports, but it's dead code.
- **Recommendation:** Remove the `ChannelKey` import from `excel.ts:16`.

#### m2 — `parseCsvAsObjects` helper doesn't handle quoted fields with commas

- **Category:** Code Quality
- **Location:** `csv.test.ts:41`
- **Description:** The `parseCsvAsObjects` test helper uses a naive `row.split(',')` which would break if a quoted field contained commas. This doesn't affect any current test (the RFC 4180 escaping test uses `expect(csv).toContain(...)` instead), but if a future test tried to parse a quoted-comma row as an object, it would silently produce wrong results.
- **Recommendation:** Acceptable for now since no test exercises this path through `parseCsvAsObjects`. Add a comment noting the limitation, or switch to a proper CSV parse if quoted-field tests are added later.

### Suggestions (optional)

#### S1 — Consider a trailing CRLF

- **Category:** Standards compliance
- **Description:** RFC 4180 Section 2 Rule 2 says "The last record in the file may or may not have an ending line break." The current implementation does not add a trailing CRLF after the last row. Most parsers accept both, and many CSV generators omit it, so this is compliant. However, some strict parsers (and `wc -l`) expect a trailing newline.
- **Recommendation:** No action required. Document the choice if anyone raises it.

---

## Positive Observations

- **Clean extraction pattern** — `columns.ts` is a well-scoped shared module. The refactor of `excel.ts` to consume it was surgical (4 added, 40 removed) with zero behavioral change, proven by all 19 existing tests passing unmodified.
- **No new dependencies** — CSV generation is pure string manipulation. The `escapeCsvField` function is correct and concise.
- **Consistent UI pattern** — The format toggle reuses the existing axis-toggle visual language. ARIA attributes (`role="radiogroup"`, `role="radio"`, `aria-checked`) are complete and correct.
- **TDD discipline** — 48 new tests with clear naming (`buildCsv_singleActivity_noActivityColumn`) following the project's `Method_Scenario_Expected` convention.
- **Lazy imports preserved** — Both `csv.ts` and `excel.ts` are still dynamically imported in `exportActivities`, keeping the initial bundle lean.
- **Future-proof** — The `ExportFormat` type and shared `columns.ts` module are ready to receive `'tcx'` (#149) and source-qualified power columns (#117) without structural changes.

---

## Action Items

### Immediate Fixes (block merge)

None.

### Post-merge improvements

- [ ] m1: Remove unused `ChannelKey` import from `excel.ts` — trivial cleanup
- [ ] m2: Add comment to `parseCsvAsObjects` about quoted-field limitation — or replace with proper parser if needed later

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
