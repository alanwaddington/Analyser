# Analyser

A browser-based FIT file analysis application for cyclists and runners. Load one to six `.fit` files to compare device streams side-by-side, visualise GPS routes coloured by metric, and identify where time was gained or lost across repeated events on the same course.

## Features

### Device Data Comparison
- Parse and display per-second record data: heart rate, power, pace, cadence, speed, altitude, temperature, core temperature, and more
- Multi-device support within a single file — each sensor (HRM, power meter, Core sensor) is assigned its own stream
- Compare streams across up to 6 files simultaneously, colour-coded by file
- Channel selector with ✦ indicator for channels where multiple devices can be compared
- Smoothing slider (1 s–30 s rolling average) shared across all charts and the map
- Time-offset controls for fine-tuning GPS timestamp alignment between files

### GPS Map
- Interactive Leaflet/OpenStreetMap map showing GPS traces for all loaded activities
- **Metric-coloured polylines** — colour each segment of the route by the value of any chosen metric (pace, heart rate, power, cadence, etc.) using a blue→green→yellow→red gradient
- In-map channel selector and gradient legend with formatted min/max labels
- Reference activity shown with a dashed overlay so it remains identifiable on the heatmap
- Bidirectional hover sync — hovering on a chart moves a marker on the map, and hovering on the map scrubs the chart crosshair

### Charts
- **Time-series** — overlay any channel from any combination of active devices on a shared time or distance axis
- **Mean/Max power curve** — best average power over all durations per file
- **Delta plot** — cumulative seconds ahead/behind a reference run, vs distance
- **Segment bar chart** — per-km time difference to surface best and worst splits
- Synchronised zoom/pan across all charts; lap/split markers as vertical annotations
- Pace displayed with inverted axis (faster = higher) and M:SS tooltip formatting

### Event Comparison
- Align two or more runs of the same course by distance
- Cumulative and per-segment time delta highlighting where the athlete was ahead or behind
- Overlay pace, speed, HR, and power on a shared distance axis

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | SvelteKit (Svelte 5 runes) |
| Language | TypeScript |
| Styling | TailwindCSS |
| FIT parsing | fit-file-parser (browser, Web Worker) |
| Charting | ECharts |
| Maps | Leaflet + OpenStreetMap |
| Deployment | Vercel (`@sveltejs/adapter-vercel`) |

## Getting Started

```sh
npm install
npm run dev          # start dev server at http://localhost:5173
npm run dev -- --open  # open browser automatically
```

## Building

```sh
npm run build        # production build
npm run preview      # preview the production build locally
```

## Testing

```sh
npx vitest run       # run the full test suite once
npx vitest           # watch mode
```

## Architecture

```
src/
├── lib/
│   ├── fit/          # FIT file parser (fit-file-parser wrapper)
│   ├── align/        # Activity alignment (timestamp sync, distance interpolation)
│   ├── analytics/    # Smoothing, mean/max curves, summary statistics
│   ├── compare/      # Delta computation, segment analysis
│   ├── components/
│   │   ├── charts/   # ECharts wrappers: TimeSeries, DeltaChart, MeanMax, SegmentChart
│   │   ├── map/      # Leaflet map: ActivityMap, colourScale, utils
│   │   └── ui/       # DeviceToggleBar, DropZone, SmoothingSlider, TimeOffsetControl, …
│   ├── stores/       # Svelte stores: session state, device labels
│   ├── utils/        # Pure utilities: channels, deviceChannels, lapMarkers, segments
│   └── types.ts      # Shared domain types
└── routes/
    ├── +page.svelte          # Landing / file drop zone
    ├── compare/+page.svelte  # Device data comparison view
    └── event/+page.svelte    # Event/course comparison view
```

## Colour Scale

Metric-coloured map polylines and any other value-to-colour mappings use a 4-stop gradient:

| Stop | Colour | Meaning |
|------|--------|---------|
| Min  | Blue `#0064ff` | Fast / low (e.g. fast pace, low HR) |
| 33%  | Green `#00c864` | Moderate |
| 67%  | Yellow `#ffd900` | Elevated |
| Max  | Red `#ff3200` | Slow / high (e.g. slow pace, high HR) |

The scale is always mapped to the global min/max across all loaded activities so comparisons are meaningful.

## Deployment

The app deploys automatically to Vercel on push to `main`. No backend is required — all FIT parsing runs in the browser.
