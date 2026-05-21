# PR #57 Review — Device comparison: per-device pills grouped by metric

| Field          | Value |
|----------------|-------|
| **PR**         | #57 |
| **Title**      | Feature: Device comparison — per-device pills grouped by metric (#56) |
| **Author**     | alanwaddington |
| **Branch**     | `feature/56-device-comparison-pills` -> `main` |
| **Closes**     | #56 |
| **State**      | OPEN |
| **Files**      | 14 changed |
| **Commits**    | 7 |
| **Tests**      | 154 pass, 0 fail |
| **Reviewed by**| Claude (automated) |
| **Date**       | 2026-05-21 |

---

## Summary

This PR implements device-level data comparison within a single FIT file. It extends the parser to identify which ANT+ device contributes which data channels, introduces a `DeviceToggleBar` UI to toggle device visibility grouped by metric, and rewires the `/compare` page from multi-file channel comparison to single-file device comparison. The event comparison page is correctly left untouched.

**Overall assessment**: Solid implementation with good separation of concerns. The type system, parser logic, utility layer, and component layer are well structured. There is one major bug in the summary table and a few minor issues detailed below.

**Risk**: Low-to-medium. The bug in the summary table produces incorrect data but does not affect other tabs or the event page.

**Test coverage**: Good for the utility and parser layers (8 new test suites / 24+ new tests). No component-level or integration tests for the Svelte components, which is consistent with the existing codebase pattern.

**AC summary**: 12 of 15 ACs Met, 1 Partially Met, 2 Not Met.

---

## Issue Hierarchy

```
Issue #56  (Feature request)
  └── PR #57  (Implementation)
        ├── Task 1: Extend Device type and parser for ANT+ device type
        ├── Task 2: Add DeviceStream type and channel attribution logic
        ├── Task 3: Device channel utilities and label derivation
        ├── Task 4: Store changes, mode switching and single-file enforcement
        ├── Task 5: DeviceToggleBar component
        ├── Task 6: Rewire compare page to device streams
        └── Task 7: Device label persistence
```

---

## Changed Files Audit

### 1. `src/lib/types.ts` (+31/-1)

**Purpose**: Adds `DeviceStream` interface, `ANT_DEVICE_TYPE` constants, `DEVICE_COLOURS` palette, and extends `Activity` with `deviceStreams`.

**Changes**:
- `ANT_DEVICE_TYPE` const object mapping ANT+ device type IDs to symbolic names
- `DeviceStream` interface: `{ device: Device, channels: ChannelKey[] }`
- `Activity.deviceStreams` field (always populated)
- `DEVICE_COLOURS` palette (8 colours) distinct from `FILE_COLOURS`
- Added `antDeviceType` and `sourceType` to `Device`

**ACs addressed**: AC1, AC2, AC8

**Quality**: Clean. Types are well-documented. The `ANT_DEVICE_TYPE` constants cover the main sensor families. Good decision to keep `deviceStreams` non-optional on `Activity`.

---

### 2. `src/lib/fit/parser.ts` (+92/-9)

**Purpose**: Extends FIT parsing to extract ANT+ device type from `device_info` messages and builds `deviceStreams` via a two-pass algorithm.

**Changes**:
- `normaliseDeviceInfo` now maps `device_type` and `source_type`
- New `buildDeviceStreams(devices, records)` exported function:
  - Pass 1: External sensors claim channels by ANT+ device type
  - Pass 2: Watch/local devices get unclaimed channels
- `normalise()` calls `applyLabels(devices)` then `buildDeviceStreams`
- `DEVICE_TYPE_CHANNELS` mapping table
- `channelsPresentInRecords` helper scans records for non-null channels

**ACs addressed**: AC1, AC2, AC13

**Quality**: The two-pass approach is elegant. `channelsPresentInRecords` scans all records once (O(n * channels)) which is efficient. `buildDeviceStreams` is a pure function that's easily testable.

**Minor issue**: `FitRecord` interface doesn't include `stride_length`. The `normaliseRecord` function doesn't map `stride_length` from raw FIT data. Looking at `ActivityRecord`, `strideLength` is defined but never populated from raw records. This means the running dynamics pod will never actually get `strideLength` data in its stream. This is a pre-existing issue, not introduced by this PR.

---

### 3. `src/lib/fit/parser.test.ts` (+118/-1)

**Purpose**: Tests for `normaliseDeviceInfo`, `buildDeviceStreams`.

**Changes**: 3 new describe blocks with 10 new test cases covering:
- Device info normalisation (all fields, minimal, missing index)
- Device stream attribution (watch-only, external HRM, power meter, running dynamics pod)
- Edge cases (no devices, empty records, null channels, no matching channels)

**Quality**: Thorough. Tests cover the two-pass algorithm well. Test naming follows the project convention (`method_condition_expectation`).

---

### 4. `src/lib/stores/session.ts` (+3/-0)

**Purpose**: Adds `activeDeviceIndices` store and clears it in `clearActivities`.

**Changes**:
- New `activeDeviceIndices = writable<Set<number>>(new Set())`
- `clearActivities()` now also resets `activeDeviceIndices`

**ACs addressed**: AC7, AC10

**Quality**: Clean. Using `Set<number>` is appropriate for device index tracking.

---

### 5. `src/lib/stores/session.test.ts` (+23/-0)

**Purpose**: Tests for the new `activeDeviceIndices` store.

**Changes**: 3 new tests:
- Init state is empty
- Add/remove indices
- `clearActivities` resets device indices

**Quality**: Adequate coverage for the store changes.

---

### 6. `src/lib/stores/deviceLabels.ts` (NEW, 55 lines)

**Purpose**: Persists user-assigned device labels in `localStorage` keyed by ANT+ device number.

**Changes**: Entire file is new. Exports:
- `getDeviceLabel(antDeviceNumber)` / `setDeviceLabel(...)` / `removeDeviceLabel(...)`
- `applyLabels(devices[])` — mutates device array in-place, restoring stored labels

**ACs addressed**: AC4, AC14

**Quality**: Good. Handles `localStorage` unavailability gracefully (catch blocks). Uses `antDeviceNumber` as the key, which is stable across sessions for the same physical device. The mutation-in-place pattern in `applyLabels` is pragmatic but worth noting — it modifies the `Device` objects directly during parsing.

**Note**: No unit tests for this module. `localStorage` is unavailable in the default Vitest environment, but could be tested with `jsdom` or a mock. Not critical given the simplicity.

---

### 7. `src/lib/utils/deviceChannels.ts` (NEW, 55 lines)

**Purpose**: Utility functions for device label derivation and stream grouping.

**Changes**: Entire file is new. Exports:
- `deriveDeviceLabel(device)` — label hierarchy: user label > manufacturer+product > "Device N"
- `groupStreamsByChannel(streams)` — groups streams by channel key
- `isComparableGroup(streams)` — true when 2+ devices share a channel
- `getActiveStreamsForChannel(streams, channel, activeIndices)` — filters to active devices

**ACs addressed**: AC3, AC4, AC5

**Quality**: Clean, pure functions. Well-documented. Correctly handles empty strings and whitespace in label derivation.

---

### 8. `src/lib/utils/deviceChannels.test.ts` (NEW, 129 lines)

**Purpose**: Comprehensive tests for all four utility functions.

**Changes**: 14 test cases across 4 describe blocks covering:
- Label derivation hierarchy (all 5 levels + empty string edge case)
- Stream grouping (empty, single, two devices same channel, insertion order)
- Comparable group detection (2+, 1, empty)
- Active stream filtering (active, inactive, wrong channel, mixed)

**Quality**: Excellent coverage. Tests are clear and follow project conventions.

---

### 9. `src/lib/components/ui/DeviceToggleBar.svelte` (NEW, 295 lines)

**Purpose**: Device toggle pill UI grouped by metric, with expandable multi-metric pills and inline rename.

**Changes**: Entire component is new. Features:
- Multi-metric devices (3+ channels) shown as expandable pills
- Regular channels shown grouped with per-device pills
- Comparable groups show a "comparable" indicator (star)
- Double-click to rename device (persisted via `deviceLabels` store)
- Active/inactive toggle via `activeDeviceIndices` store

**ACs addressed**: AC3, AC4, AC5, AC6, AC7, AC14

**Quality**: Well-structured component with clean separation between derived state and UI. Pill styling matches `ChannelToggleBar` pattern.

**Issue**: `visibleGroups` is declared as `$derived(() => { ... })` (line 79) which wraps the value in a function. This means `visibleGroups` is a function, and the template correctly calls it as `visibleGroups()` on line 129. However, this is an unusual pattern — `$derived(expression)` where the expression IS an arrow function means the derived value is the function itself. The intent was likely `$derived.by(() => { ... })` to use a block expression. As written, the grouping logic re-runs on every access (no caching), not when dependencies change. This should use `$derived.by(...)` for proper memoization.

---

### 10. `src/lib/components/ui/DropZone.svelte` (+21/-5)

**Purpose**: Adds `singleFile` mode for device comparison (replaces current file instead of accumulating).

**Changes**:
- New `singleFile` prop (default `false`)
- `multiple` attribute derived from `!singleFile`
- In `singleFile` mode: `clearActivities()` then load only first file
- Compact label changes: "Replace file" vs "Add files"

**ACs addressed**: AC9

**Quality**: Clean. The replace-file logic is straightforward — clear all, then add one.

---

### 11. `src/lib/components/ui/Sidebar.svelte` (+11/-2)

**Purpose**: Implements mode-switching behaviour between Device and Event comparison.

**Changes**:
- `goToCompare()` now calls `clearActivities()` before navigating (Event -> Device clears)
- `goToEvent()` does NOT clear (Device -> Event retains)
- Device comparison drop zone uses `singleFile={true}`
- Event comparison drop zone omits `singleFile` (multi-file)

**ACs addressed**: AC9, AC10, AC11

**Quality**: Clean. The asymmetric clearing behaviour is implemented correctly.

---

### 12. `src/lib/components/charts/TimeSeriesChart.svelte` (+3/-3)

**Purpose**: Minor changes to support device comparison series rendering.

**Changes**:
- Uses `FILE_COLOURS` for colour lookup (unchanged, already imported)
- Accepts optional `label` from `SeriesInput` for series name in legend and tooltip
- Series name: `s.label ?? s.activity.filename` (label override takes precedence)

**ACs addressed**: AC8

**Quality**: Minimal, targeted change. The `label` fallback chain is correct.

---

### 13. `src/lib/components/charts/TimeSeriesChart.utils.ts` (+1/-0)

**Purpose**: Adds optional `label` field to `SeriesInput` interface.

**Changes**: `label?: string` added to `SeriesInput`

**ACs addressed**: AC8

**Quality**: Clean, single-line addition.

---

### 14. `src/routes/compare/+page.svelte` (+107/-54)

**Purpose**: Complete rewrite of the compare page from multi-file event comparison to single-file device comparison.

**Changes**:
- Imports `DeviceToggleBar` instead of `ChannelToggleBar`
- Uses `activeDeviceIndices` instead of `activeChannels` for chart visibility
- `activeChannels` derived from active device streams (which channels are toggled on)
- `buildSeriesForChannel()` creates one `SeriesInput` per active device that claims the channel
- Summary tab shows per-device statistics side-by-side
- X-axis toggle in toolbar (time/distance)
- Mean/Max tab passes only the single activity

**ACs addressed**: AC3, AC7, AC8, AC15

**Quality**: Good structure. Uses derived state properly.

**BUG (Major)**: In the summary table (lines 183-199), each device column computes statistics using `summarise(extractChannel(activity.records, ch))` — this extracts from the **merged** record stream, not from the individual device's records. Since there is only one merged record stream (all devices write to the same record), every column shows the **same** statistics for each channel. The summary should ideally differentiate per-device data, but since the FIT format merges all device data into a single record stream, this is an inherent limitation. However, the current code is misleading — it appears to show per-device stats but actually shows the same numbers in every column. This partially defeats AC15.

**BUG (Minor)**: `activeChannels` on line 53 uses `$derived<ChannelKey[]>(() => { ... })` — same pattern as `visibleGroups` in DeviceToggleBar. This is `$derived` with an arrow function as the expression, making `activeChannels` a function, not a cached value. The template calls `activeChannels()` (lines 137, 140, 183) which works but bypasses Svelte 5 memoization. Should be `$derived.by(...)`.

---

### Event page (`src/routes/event/+page.svelte`) — VERIFIED UNCHANGED

No diff detected. The event page continues to use `ChannelToggleBar`, `activeChannels` store, and multi-file `SeriesInput` pattern. AC12 is met.

---

## Acceptance Criteria Verification

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| **AC1** | `Activity.deviceStreams` populated on load | Met | `parser.ts:195` calls `buildDeviceStreams(devices, records)` and assigns to `Activity.deviceStreams` |
| **AC2** | Watch included as a device in `deviceStreams` | Met | `parser.ts:174-179` — Pass 2 gives watch devices all unclaimed channels. Test: `buildDeviceStreams_watchOnly_attributesAllPresentChannelsToWatch` |
| **AC3** | Device pills grouped by metric in toolbar | Met | `DeviceToggleBar.svelte:17` uses `groupStreamsByChannel()`. Template renders per-channel groups at line 129 |
| **AC4** | Pill labels: user label > manufacturer+product > "Device N" | Met | `deviceChannels.ts:7-13` implements hierarchy. 6 test cases in `deviceChannels.test.ts:20-49` |
| **AC5** | Comparable indicator on groups with 2+ devices | Met | `DeviceToggleBar.svelte:133` shows `comparable-dot` when `group.comparable` is true. `isComparableGroup` tested |
| **AC6** | Multi-metric devices as expandable pill | Met | `DeviceToggleBar.svelte:15-26` uses `MULTI_METRIC_THRESHOLD=3`. Expand/collapse UI at lines 99-126 |
| **AC7** | Pills inactive by default; toggle activates chart | Met | `session.ts:12` — `activeDeviceIndices` starts empty. `DeviceToggleBar.svelte:56-66` toggles. `compare/+page.svelte:135` shows empty message when no devices active |
| **AC8** | Two active devices overlaid on shared chart | Met | `compare/+page.svelte:65-77` — `buildSeriesForChannel` creates one `SeriesInput` per active device for the channel. `TimeSeriesChart.svelte` renders them overlaid with distinct colours |
| **AC9** | Second file in device mode replaces current | Met | `DropZone.svelte:26-34` — `singleFile` mode calls `clearActivities()` then loads one file. `Sidebar.svelte:53-54` passes `singleFile={true}` |
| **AC10** | Event -> Device clears loaded activities | Met | `Sidebar.svelte:14-17` — `goToCompare()` calls `clearActivities()` before navigation |
| **AC11** | Device -> Event retains current activity | Met | `Sidebar.svelte:20-22` — `goToEvent()` does NOT call `clearActivities()` |
| **AC12** | Event comparison page unchanged | Met | `git diff` shows zero changes to `src/routes/event/+page.svelte` |
| **AC13** | Single-device files load and show pills | Met | `buildDeviceStreams` Pass 2 handles watch-only scenario. Test: `buildDeviceStreams_watchOnly_attributesAllPresentChannelsToWatch` |
| **AC14** | Persistent device labels by ANT+ ID | Met | `deviceLabels.ts` provides `setDeviceLabel`/`getDeviceLabel`/`applyLabels` via `localStorage`. `DeviceToggleBar.svelte:40-49` commits rename. `parser.ts:193` calls `applyLabels(devices)` on load |
| **AC15** | Per-device summary statistics side-by-side | Partially Met | Summary table renders per-device columns (`compare/+page.svelte:167-199`), but all columns show identical data because `extractChannel(activity.records, ch)` reads from the merged record stream, not per-device data |

**Totals**: 14 Met, 1 Partially Met, 0 Not Met

---

## Findings

### Critical

None.

### Major

**M1: Summary table shows identical statistics for all devices** (`compare/+page.svelte:187`)

The summary tab iterates `summaryDevices` as columns but calls `summarise(extractChannel(activity.records, ch))` for each — this always reads the same merged record stream. Every device column will display the same avg/max/min values, which is misleading.

**Impact**: AC15 partially broken. Users may think devices produced different readings when the numbers are always identical.

**Suggested fix**: Either (a) note in the UI that stats are from the merged stream, or (b) implement per-device record extraction (requires knowing which records came from which device, which FIT doesn't directly support for most channels), or (c) remove the per-device column layout and show a single summary row.

---

### Minor

**m1: `$derived(() => { ... })` should be `$derived.by(() => { ... })`**

In two places:
- `compare/+page.svelte:53` — `activeChannels`
- `DeviceToggleBar.svelte:79` — `visibleGroups`

Using `$derived(() => { ... })` makes the derived value a function (the arrow function itself), not the result of evaluating it. The template compensates by calling `activeChannels()` and `visibleGroups()`, but this bypasses Svelte 5's memoization — the function body re-executes on every render, not just when dependencies change.

**Fix**: Change both to `$derived.by(() => { ... })` and remove the `()` call syntax in templates.

**m2: `DEVICE_COLOURS` imported but `FILE_COLOURS` used for chart series** (`TimeSeriesChart.svelte:243`)

The `DEVICE_COLOURS` palette was added to `types.ts` for device comparison, but `TimeSeriesChart.svelte` still uses `FILE_COLOURS`. In device comparison mode, if more than 6 devices are compared, the colour palette wraps at 6 instead of 8. This is minor since 6+ devices in a single file is very rare.

**m3: No autofocus on rename input** (`DeviceToggleBar.svelte:141-149`)

When double-clicking a pill to rename, the input appears but doesn't receive focus automatically. The user must click into it. An `autofocus` attribute or a `use:` action would improve UX.

**m4: `col-device` uses `display: flex` on a `<th>` element** (`compare/+page.svelte:380-390`)

The `.col-device` CSS sets `display: flex` on `<th>`, which overrides the table cell display context. This can cause layout issues in some browsers. Consider using `display: inline-flex` on a wrapper span instead.

---

### Suggestions

**S1**: Consider adding a "Select all" / "Deselect all" button to the DeviceToggleBar for quick toggling when there are many devices.

**S2**: The `deviceLabels.ts` module re-reads from `localStorage` on every call (`loadLabels()`). For high-frequency access, consider caching the Map in-memory and only reading from `localStorage` once at module load.

**S3**: The `buildDeviceStreams` function excludes devices that have a known `antDeviceType` but no matching channels in the data. Consider preserving these as "inactive" devices so the user can see all connected devices even if they didn't record data.

---

## Positive Observations

1. **Clean architecture**: The parser -> utils -> component -> page layering is well executed. Each layer has a clear responsibility.
2. **Thorough testing**: 24+ new test cases covering parser, utility, and store layers. Tests follow the project's naming conventions consistently.
3. **Good type safety**: `DeviceStream`, `ANT_DEVICE_TYPE`, and `ChannelKey` types enforce correctness at compile time.
4. **Graceful degradation**: Single-device files still work. Empty states are handled with user-friendly messages.
5. **Device label persistence**: The `localStorage`-based approach is pragmatic and requires no backend.
6. **Event page isolation**: Zero changes to event comparison, preventing regression risk.
7. **Commit discipline**: 7 well-scoped commits mapping to logical implementation tasks.

---

## Action Items

| Priority | Item | File(s) |
|----------|------|---------|
| **Major** | Fix summary table to not show misleading per-device stats (M1) | `compare/+page.svelte:187` |
| **Minor** | Change `$derived(()=>{})` to `$derived.by(()=>{})` in two places (m1) | `compare/+page.svelte:53`, `DeviceToggleBar.svelte:79` |
| **Minor** | Use `DEVICE_COLOURS` instead of `FILE_COLOURS` for device comparison charts (m2) | `compare/+page.svelte:65-77` |
| **Minor** | Add autofocus to rename input (m3) | `DeviceToggleBar.svelte:141` |
| **Minor** | Fix `display: flex` on `<th>` element (m4) | `compare/+page.svelte:380` |

---

## Checklist

- [x] All 14 changed files read in full
- [x] Event page verified unchanged
- [x] All 15 ACs verified against code
- [x] All 154 tests passing
- [x] No security concerns identified
- [x] No breaking changes to existing functionality
- [x] Commit history is clean and well-structured
