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
- Multiple files loaded simultaneously for comparison (target: at least 5 files in one session)

## Core Domain Concepts

### FIT File Data
- **Record messages** — per-second (or per-sample) data: timestamp, position (lat/lon), distance, speed, heart_rate, power, cadence, temperature, etc.
- **Device info messages** — identify which physical device contributed each data stream (manufacturer, product, serial number, ANT+ device type)
- **Session / Lap messages** — aggregate summaries; laps can represent manual splits or auto-laps
- **Event messages** — start/stop/timer events embedded in the file

### Device Types to Support
| Device Type | Key Fields |
|-------------|------------|
| Heart Rate Monitor (HRM) | heart_rate |
| Power Meter | power, left/right balance, pedal smoothness |
| Core Body Temperature Sensor | core_temperature, skin_temperature |
| Smart Watch (primary unit) | all record fields, GPS, altitude |
| Speed/Cadence Sensor | speed, cadence |
| Running Dynamics Pod | vertical_oscillation, ground_contact_time, stride_length |

### Activity Alignment
When comparing multiple files the traces must be synchronised before any meaningful comparison can be made:
- **GPS-based alignment** — match activity start using embedded GPS timestamps (handles files recorded in different timezones or with clock drift)
- **Manual time offset** — per-file adjustment (in seconds) so the user can fine-tune sync where GPS alignment is insufficient
- **Distance-based alignment** — interpolate all record streams to a shared distance axis (required for event/course comparison)

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
- **Multi-channel time-series** — overlay two or more data streams on a shared time or distance axis (e.g. HR from HRM vs HR from watch, or power vs HR on dual y-axes)
- **Mean/Max power curve** — plot best average power over all durations (1 s to full activity length) for each file on one chart
- **Synchronised zoom/pan** — zooming one graph updates all others sharing the same axis; double-click or button to reset
- **Channel selector** — toggle individual device/metric streams on and off without reloading data

### Event Comparison Graphs
- **Time delta plot** — cumulative seconds gained/lost vs distance, with zero line as reference; positive = ahead, negative = behind
- **Overlay time-series** — each metric (HR, power, pace) plotted for all compared runs on a shared distance axis
- **Segment bar chart** — per-km or per-lap time difference as a bar chart to highlight worst/best segments

### General Graph Requirements
- Hover tooltips showing exact values at the cursor position across all series simultaneously
- Lap / split markers as vertical annotations on all charts
- Map trace (GPS route) coloured by a chosen metric (e.g. pace, HR zone) with comparison overlay where two routes share the same course
- Export graph as image (PNG) or underlying data (CSV)
- Per-graph naming so users can label what each view represents

## Sharing & Export

- Generate a shareable read-only link for a loaded comparison session
- Export original source files from a session for external use
- Export graphs as PNG; export data as CSV

## Device / Sensor Management

- Allow users to label known ANT+ device IDs (e.g. "Assioma Duo", "Polar H10") so they are recognised by name across future uploads
- Persist these labels locally (no account required as a baseline)

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
- Multi-device streams within a single file are identified via `device_index` on record messages
- Distance-aligned comparison requires linear interpolation of record data to a common distance axis
- Mean/max curve computation is O(n²) naively — use a sparse/sliding-window approach for large files
- ECharts `connect()` API links multiple chart instances for synchronised crosshair and zoom

## Architecture

```
src/
├── lib/
│   ├── fit/          # FIT parsing and normalisation (fit-file-parser wrapper)
│   ├── align/        # Activity alignment (GPS timestamp sync, distance interpolation)
│   ├── analytics/    # Smoothing, mean/max curves, summary statistics
│   ├── compare/      # Comparison engine (delta computation, segment analysis)
│   └── types.ts      # Shared domain types (Activity, Record, Device, Lap, etc.)
├── components/
│   ├── charts/       # ECharts wrappers (TimeSeries, DeltaPlot, MeanMax, SegmentBar)
│   ├── map/          # Leaflet map component
│   └── ui/           # Layout, file loader, channel selector, controls
└── routes/
    ├── /             # Landing / file upload
    ├── /compare      # Device data comparison view
    └── /event        # Event/course comparison view
```

### Data Flow

1. User drops `.fit` files onto the page
2. `fit/` layer parses each file in a Web Worker → normalised `Activity` objects
3. `align/` layer synchronises activities to a shared axis
4. `analytics/` layer computes smoothed series, mean/max curves, summaries
5. `compare/` layer computes deltas between activities
6. Components render ECharts instances (linked via `connect()`) and Leaflet map

## Out of Scope (for now)

- Editing or writing FIT files
- Uploading to third-party platforms (Garmin Connect, Strava, etc.)
- Real-time / live device streaming
