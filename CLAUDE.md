## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: tailwindcss, sveltekit-adapter

---

# Analyser

A FIT file analysis application with two primary capabilities:

1. **Device Data Comparison** — compare sensor/device streams (Heart Rate, Power, Core Temperature, Smart Watch metrics, etc.) from one or more `.fit` files side-by-side.
2. **Event Comparison** — compare repeated events at the same course (e.g. parkrun) across multiple `.fit` files to identify where time was gained or lost.

## Project Goals

- Parse `.fit` files using the ANT/Garmin FIT protocol standard
- Support multi-device, multi-stream data within a single file (e.g. paired HRM + Power Meter + Core Sensor alongside a watch)
- Allow users to overlay and compare device data channels visually and statistically
- Allow users to compare two or more runs of the same course/event, aligned by distance or elapsed time, to surface segment-level time differences

## File Support

- Primary format: `.fit` (ANT/Garmin FIT protocol)
- Secondary formats to consider: `.tcx`, `.gpx` (for broader device compatibility)
- Multiple files loaded simultaneously for comparison: **1–6 files** per session (hardcoded limit via `MAX_FILES` constant)
- Cross-file device comparison mode: load multiple `.fit` files to compare individual device streams across activities (e.g. compare HRM data from two different runs, or HR vs Power from a single file with multiple sensors)

## Core Domain Concepts

### FIT File Data
- **Record messages** — per-second (or per-sample) data: timestamp, position (lat/lon), distance, speed (km/h), pace (min/km), heart_rate, power, cadence, temperature, etc.
- **Device info messages** — identify which physical device contributed each data stream (manufacturer, product, serial number, ANT+ device type)
- **Session / Lap messages** — aggregate summaries; laps can represent manual splits or auto-laps
- **Event messages** — start/stop/timer events embedded in the file

### Device Types and Streams
| Device Type | Key Fields | ANT+ Type |
|-------------|------------|-----------|
| Heart Rate Monitor (HRM) | heart_rate | 120 |
| Power Meter (bike) | power, left/right balance | 11 |
| Core Body Temperature Sensor | core_temperature, skin_temperature | — |
| Smart Watch (primary unit) | all record fields, GPS, altitude, speed, pace | — |
| Speed/Cadence Sensor | speed, cadence | 121 (combined), 122 (cadence only), 123 (speed only) |
| Running Dynamics Pod | vertical_oscillation, ground_contact_time, stride_length | 36 |

**DeviceStream concept:** A `DeviceStream` pairs a `Device` with the list of `ChannelKey` it contributes to. The parser assigns channels to devices using a two-pass algorithm:
- **Pass 1 (external sensors):** Devices with a known `antDeviceType` claim their standard channels (e.g. HRM claims `heartRate`, Power Meter claims `power`, etc.)
- **Pass 2 (watch/primary):** Devices with no `antDeviceType` (the watch or creator device) claim remaining channels not yet assigned
- **Safety net:** Any channels still unassigned after both passes (e.g. `stance_time` from a Garmin/Stryd developer field) are merged into the first device's stream to prevent loss of data

In the **compare view**, each `DeviceStream` becomes a `CrossFileStream` with a composite key (`activityId:deviceIndex`) and a reference to its source `Activity`, enabling side-by-side comparison across files.

### Cross-File Device Comparison
A core feature that enables users to load 1–6 `.fit` files and compare their individual device streams side-by-side:
- **Flat device stream list** — all `DeviceStream` objects across all files are flattened into a single list of `CrossFileStream` objects, each tagged with its source `Activity` and a globally unique key format: `${activityId}:${deviceIndex}`.
- **Device grouping by file** — the DeviceToggleBar component groups devices by their source filename in multi-file mode, with colour-coded headers (from `FILE_COLOURS` palette) to distinguish files at a glance.
- **Comparable channel indicators** — a channel is marked as "comparable" when 2+ devices (from any files) contribute to it. The ✦ symbol appears in the UI for such channels, signaling that a meaningful comparison exists.
- **Active device state** — `activeDeviceIndices` store (a `Set<string>`) tracks which device streams are currently toggled on. Charts render only data from active devices, allowing users to selectively focus on specific sensors.
- **Per-file colour coding** — each file is assigned a unique colour from `FILE_COLOURS` array; all series from that file in time-series charts use the same colour for visual cohesion.

### Activity Alignment
When comparing multiple files the traces must be synchronised before any meaningful comparison can be made:
- **GPS-based timestamp alignment** — the first loaded file serves as the reference (offset = 0). All other files are offset relative to their start time difference from the reference file. This handles files recorded at different times or with clock drift.
- **Manual time offset control** — per-file adjustment (in seconds) for fine-tuning GPS alignment where activities do not have perfectly aligned timestamps. TimeOffsetControl UI allows ±10s and ±1s nudges or direct numeric input.
- **Distance-based alignment** — interpolate all record streams to a shared distance axis (required for event/course comparison)
- **Session overlap detection** — warns users when loaded files appear to be from different sessions (>1 hour apart start time). In time-axis mode, a banner suggests switching to distance mode for more meaningful comparison.

### Event Comparison (e.g. Parkrun)
- Match two or more activities at the same course
- Align traces by **distance** (primary) or elapsed time
- Compute cumulative and per-segment time delta
- Highlight where the athlete was ahead/behind relative to a reference run
- Surface correlated metrics at those points (e.g. HR was higher, power was lower)

## Data Processing Requirements

- **Smoothing** — configurable rolling-average smoothing per channel (e.g. 1 s raw through to 30 s smoothed) to reduce sensor noise without hiding real variation
- **Mean/Max summaries** — for power and other channels, compute mean-max curves (best average over every duration) to enable fitness benchmarking
- **Per-file summary statistics** — average, max, and total for each metric, shown alongside graphs for quick comparison
- **Left/right power balance** — where available from a dual-sided power meter, treat left and right as separate channels

## Graphing Requirements

Graphs are a core output of the application, not an optional extra. Both use cases require rich visual comparison.

### Device Data Comparison Graphs
- **Multi-channel time-series** — overlay two or more data streams (from one or multiple files) on a shared time or distance axis. For cross-file comparison, series are colour-coded by file; each device contributing that channel is displayed as a separate line.
- **Mean/Max power curve** — plot best average power over all durations (1 s to full activity length) for each file on one chart. Only files with at least one active device are shown (enables device selection to filter curves).
- **Pace chart with inverted axis** — pace displayed with faster times (lower min/km values) at the top, with M:SS formatting
- **Synchronised zoom/pan** — zooming one graph updates all others sharing the same axis; double-click or button to reset
- **Device toggle bar** — in single-file mode, shows checkboxes for each device/channel combo; in multi-file mode, devices are grouped by filename header (colour-coded per file) with a ✦ indicator for channels where multiple devices can be compared
- **Summary table** — per-device statistics (average, max, total) aligned to the active devices shown in charts, making device comparison easy at a glance

### Event Comparison Graphs
- **Time delta plot** — cumulative seconds gained/lost vs distance, with zero line as reference; positive = ahead, negative = behind
- **Overlay time-series** — each metric (pace, speed, HR, power) plotted for all compared runs on a shared distance axis, with pace using inverted y-axis for intuitive comparison (faster = higher on chart)
- **Segment bar chart** — per-km or per-lap time difference as a bar chart to highlight worst/best segments

### General Graph Requirements
- Hover tooltips showing exact values at the cursor position across all series simultaneously (pace formatted as M:SS)
- Lap / split markers as vertical annotations on all charts
- Map trace (GPS route) coloured by a chosen metric (e.g. pace, speed, HR zone) with comparison overlay where two routes share the same course
- Export graph as image (PNG) or underlying data (CSV)
- Per-graph naming so users can label what each view represents

## Sharing & Export

- Generate a shareable read-only link for a loaded comparison session
- Export original source files from a session for external use
- Export graphs as PNG; export data as CSV

## Device / Sensor Management

- Allow users to label known ANT+ device IDs (e.g. "Assioma Duo", "Polar H10") so they are recognised by name across future uploads
- Persist these labels locally (no account required as a baseline)

## Parser Robustness (PR #59)

The FIT parser includes several enhancements to handle edge cases and modern Garmin/Stryd device fields:

- **STRING_DEVICE_TYPE mapping:** `fit-file-parser` outputs known ANT+ device types as lowercase snake_case strings (`'heart_rate'`, `'bike_power'`, etc.). The parser maps these back to numeric ANT+ constants so the device classification logic remains consistent.
- **Device deduplication:** Some FIT files include the same `device_index` multiple times (e.g. once at start and once at end). Only the first occurrence is retained, preventing duplicate entries in `deviceStreams` and `crossFileStreams`.
- **Enhanced field priority:** Parser prefers `enhanced_speed` and `enhanced_altitude` over base `speed` and `altitude` fields (modern Garmin devices use enhanced variants for better accuracy).
- **Stryd/Garmin developer fields:** Parser recognises `Power` (capital P) field from Stryd running power meter and maps `stance_time` and `step_length` to `groundContactTime` and `strideLength` respectively.
- **Safe channel allocation:** The two-pass allocation ensures no channels are lost, even when device_info is absent or incomplete. The safety net catches unclaimed channels and merges them into the primary device rather than creating orphaned entries.

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **SvelteKit** | Less boilerplate than React, reactive by default, excellent for data-heavy UIs |
| Language | **TypeScript** | Type safety across the full codebase |
| Styling | **TailwindCSS** | Utility-first, pairs cleanly with Svelte components |
| FIT parsing | **fit-file-parser** | Runs entirely in the browser — no backend needed for core features |
| Charting | **ECharts** | Handles large datasets well; built-in zoom, pan, and multi-chart sync |
| Maps | **Leaflet + OpenStreetMap** | Free GPS trace rendering, no API key required |
| Deployment | **Vercel** (`@sveltejs/adapter-vercel`) | Auto-deploys from GitHub, free tier, no custom domain required |
| Persistence | **None (v1)** | Session-only; files loaded fresh each time |

### Key Technical Notes

- FIT file spec: Flexible and Interoperable Data Transfer (FIT) Protocol, maintained by Garmin/ANT+
- `fit-file-parser` runs in the browser via a Web Worker to avoid blocking the UI thread on large files
- Speed is recorded in km/h; pace (min/km) is derived per record as 60 / speed_kmh
- Multi-device streams within a single file are identified via `device_index` on record messages
- Cross-file devices are identified by composite key: `${activity.id}:${device.deviceIndex}` (globally unique per session)
- Distance-aligned comparison requires linear interpolation of all record channels (including speed and pace) to a common distance axis
- Pace chart displays with inverted y-axis (faster pace = lower min/km value appears higher on chart) for intuitive interpretation
- Mean/max curve computation is O(n²) naively — use a sparse/sliding-window approach for large files
- ECharts `connect()` API links multiple chart instances for synchronised crosshair and zoom
- Timestamp alignment: `computeTimeOffsets(activities)` calculates per-file offsets relative to the first loaded file. `activitiesOverlap(activities)` checks if all files start within 1 hour of each other; returns false to trigger the session warning banner.
- Parser `STRING_DEVICE_TYPE` mapping converts fit-file-parser's string device type outputs ('heart_rate', 'bike_power', etc.) back to numeric ANT+ constants for consistent device classification
- Parser device deduplication: some FIT files list the same `device_index` multiple times; only the first occurrence is kept to avoid duplicate entries in `deviceStreams` and `crossFileStreams`
- Parser safety net: after assigning channels to known ANT+ device types (Pass 1) and to watch/primary devices (Pass 2), any remaining channels are merged into the first device to avoid losing data or creating spurious "device with no channels" entries

## Architecture

```
src/
├── lib/
│   ├── fit/          # FIT parsing and normalisation (fit-file-parser wrapper)
│   │                 # - parser.ts: parseFitFile, normaliseRecord, normaliseDeviceInfo, buildDeviceStreams
│   │                 #   STRING_DEVICE_TYPE mapping, device deduplication, channel allocation
│   ├── align/        # Activity alignment (GPS timestamp sync, distance interpolation)
│   │                 # - timestamp.ts: computeTimeOffsets, activitiesOverlap (1-hour overlap detection)
│   │                 # - distance.ts: interpolateToDistanceAxis
│   ├── analytics/    # Smoothing, mean/max curves, summary statistics
│   ├── compare/      # Comparison engine (delta computation, segment analysis)
│   ├── components/
│   │   ├── charts/   # ECharts wrappers (TimeSeries, DeltaPlot, MeanMax, SegmentBar)
│   │   │             # Each includes .svelte component, .utils.ts (pure functions), .test.ts (unit tests)
│   │   ├── map/      # Leaflet map component (ActivityMap.svelte, ActivityMap.utils.ts, ActivityMap.test.ts)
│   │   └── ui/       # Layout, file loader, channel selector, controls
│   │                 # - DeviceToggleBar.svelte: multi-file device grouping, comparable indicators (✦)
│   │                 # - TimeOffsetControl.svelte: per-file manual time-offset fine-tuning UI
│   ├── stores/       # Svelte stores (activities, smoothing, xAxisMode, referenceIndex, etc.)
│   │                 # - session.ts: activeDeviceIndices (Set<string>), timeOffsets (Map<activityId, offset>)
│   ├── utils/        # Shared pure utility functions
│   │   ├── deviceChannels.ts     # deviceKey, deriveDeviceLabel, groupStreamsByChannel, isComparableGroup
│   │   ├── lapMarkers.ts         # buildLapMarkers(activity, xAxisMode) → LapMarker[]
│   │   ├── segments.ts           # buildSegments(activity) → Segment[]
│   │   └── ...
│   └── types.ts      # Shared domain types
│                     # - Activity, ActivityRecord, Device, DeviceStream, Lap, ChannelKey
│                     # - CrossFileStream (activity-tagged stream with composite key)
│                     # - FILE_COLOURS, DEVICE_COLOURS, MAX_FILES constant
└── routes/
    ├── +layout.svelte              # App shell (sidebar + main)
    ├── +page.svelte                # Landing / drop zone
    ├── compare/
    │   └── +page.svelte            # Device data comparison view (1–6 files)
    │                                # - Builds crossFileStreams from all activities
    │                                # - Time-axis warning banner if files don't overlap
    └── event/
        └── +page.svelte            # Event/course comparison view
```

### Data Flow (Device Comparison)

1. User drops 1–6 `.fit` files onto the landing page
2. `fit/` layer parses each file in a Web Worker (non-blocking) → normalised `Activity` objects with `deviceStreams`
   - Parser deduplicates `device_index` entries
   - Parser uses `STRING_DEVICE_TYPE` mapping to resolve device types
   - Parser runs a two-pass channel allocation: external sensors (known ANT+ types) → watch/primary device → unclaimed safety net
3. Activities stored in `activities` session store
4. Compare page derives `crossFileStreams` by flattening all `deviceStreams` across all activities, each tagged with its source activity and a composite key
5. Compare page computes `computeTimeOffsets()` to align files by start time difference; `activitiesOverlap()` detects if a session warning should show
6. Compare page initialises `activeDeviceIndices` to all selectable streams (those with channels); `timeOffsets` store holds per-file offsets (editable via TimeOffsetControl)
7. Compare page renders:
   - DeviceToggleBar (groups devices by file, shows comparable indicators)
   - TimeOffsetControl (if multi-file + time-axis mode)
   - Session warning banner (if files don't overlap and time-axis is active)
   - Charts tab: time-series for each active channel, with series colour-coded by file
   - Summary tab: per-device statistics for all active devices
   - Mean/Max tab: curves for all files with at least one active device
   - Map tab: GPS traces from all activities
8. Store updates (`activeDeviceIndices`, `timeOffsets`) trigger chart re-renders via derived reactive state

## Out of Scope (for now)

- Editing or writing FIT files
- Uploading to third-party platforms (Garmin Connect, Strava, etc.)
- Real-time / live device streaming
