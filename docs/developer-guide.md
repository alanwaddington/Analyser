# Analyser — Developer Guide

> **Version:** 1.6 · **Last updated:** June 2026

This guide covers the technical internals of the Analyser application for contributors and maintainers. It focuses on areas not already covered by inline code comments.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Architecture Overview](#2-architecture-overview)
   - 2.1 [ECharts Lazy-Loading](#21-echarts-lazy-loading)
3. [Cross-Device Label Sync](#3-cross-device-label-sync)
   - 3.1 [Design Goals](#31-design-goals)
   - 3.2 [Data Model in Redis](#32-data-model-in-redis)
   - 3.3 [Identity Lifecycle](#33-identity-lifecycle)
   - 3.4 [Sync Store (`sync.ts`)](#34-sync-store-syncts)
   - 3.5 [DeviceLabels Integration](#35-devicelabels-integration)
   - 3.6 [API Routes](#36-api-routes)
   - 3.7 [SyncPanel Component](#37-syncpanel-component)
   - 3.8 [Layout Wiring](#38-layout-wiring)
   - 3.9 [Validation](#39-validation)
   - 3.10 [Environment Variables](#310-environment-variables)
   - 3.11 [Local Development Setup](#311-local-development-setup)
3a. [Map Tab — Metric Strip Chart](#3a-map-tab--metric-strip-chart)
3b. [Data Export](#3b-data-export)
3c. [Chart Stats Row](#3c-chart-stats-row)
3d. [Activity Alignment — GPS Anchor](#3d-activity-alignment--gps-anchor)
4. [Responsive Layout](#4-responsive-layout)
5. [FIT Parsing](#5-fit-parsing)
6. [Testing](#6-testing)

---

## 1. Project Setup

```bash
npm install
npm run dev        # dev server on http://localhost:5173
npm run build      # production build — also generates stats.html bundle report
npm run check      # svelte-check + tsc
npm test           # vitest unit tests
```

`npm run build` generates `stats.html` (via `rollup-plugin-visualizer`) in the project root. Open it in a browser after any build to inspect chunk sizes and identify modules that have regressed into the initial bundle. The file is gitignored.

The app uses **SvelteKit** with the **Vercel adapter** (`@sveltejs/adapter-vercel`). Deployment is to Vercel via GitHub Actions on push to `main`.

---

## 2. Architecture Overview

```
src/
├── lib/
│   ├── fit/          # FIT file parsing (Web Worker, normalisation, device classification)
│   ├── align/        # Activity alignment (timestamp sync, distance interpolation)
│   ├── analytics/    # Smoothing, mean/max curves, summary statistics
│   ├── compare/      # Delta computation, segment analysis
│   ├── export/       # Client-side data export
│   │   ├── excel.ts           # buildWorkbook(activities) → ArrayBuffer (.xlsx via SheetJS)
│   │   ├── exportActivities.ts # exportActivities(activities): lazy-loads excel.ts, triggers download
│   │   └── download.ts        # triggerDownload(), downloadPng(), localDateString()
│   ├── components/
│   │   ├── charts/   # ECharts wrappers (ECharts is lazy-loaded — see §2.1)
│   │   │             # - echarts-loader.ts: singleton loadECharts() — one dynamic import, cached for session
│   │   │             # - chart-skeleton.css: shared shimmer skeleton styles used by all four chart components
│   │   │             # - TimeSeriesChart.svelte: per-series stats row (min/avg/max, zoom-aware; pace inverted)
│   │   │             # - TimeSeriesChart.utils.ts: computeSeriesStats(), formatStatValue(), SeriesStats
│   │   │             # - StripChart.svelte: metric strip chart wrapper (map tab)
│   │   │             # - StripToggle.svelte: line/gradient pill toggle
│   │   │             # - StripChart.utils.ts: shouldShowGradient(), GRADIENT_COLOUR_TOKEN
│   │   │             # - png-btn.css: shared PNG download button styles
│   │   ├── map/      # Leaflet map + ActivityMap.component.test.ts (jsdom)
│   │   └── ui/       # Layout components, controls, SyncPanel
│   ├── server/
│   │   └── redis.ts  # Upstash Redis singleton (server-only)
│   ├── stores/
│   │   ├── deviceLabels.ts  # Device label persistence (localStorage)
│   │   ├── sync.ts          # Cross-device sync logic
│   │   ├── session.ts       # Activity session state; activityColourMap assigns stable colours by activity.id
│   │   ├── toast.ts         # Transient toast notification store (addToast, removeToast, auto-dismiss)
│   │   └── viewport.ts      # Responsive breakpoint store
│   ├── utils/        # Pure utility functions
│   │                 # - binarySearch.ts: lowerBound<T>(arr, key, target) — shared lower-bound binary search
│   │                 # - channels.ts: deriveAvailableChannels()
│   │                 # - deviceChannels.ts: deviceKey(), deriveDeviceLabel(), groupStreamsByChannel(), isComparableGroup()
│   │                 # - formatting.ts: formatPace(decimalMinutes) → "M:SS" string — single source of truth for pace display
│   │                 # - indoorWarnings.svelte.ts: createIndoorWarnings() composable
│   │                 # - lapMarkers.ts: buildLapMarkers()
│   │                 # - segments.ts: buildSegments()
│   ├── validation.ts # Shared regex constants (UUID, short code)
│   └── types.ts      # Domain types
└── routes/
    ├── api/
    │   └── labels/
    │       ├── [uuid]/+server.ts          # GET / PUT label store
    │       └── resolve/[code]/+server.ts  # GET short-code resolver
    ├── export-btn.css   # Shared CSS for the Export Data button in tab bars
    ├── map-panel.css    # Shared CSS for Map tab layout (.map-wrap--has-strip, .strip-wrap)
    ├── +layout.svelte   # App shell, initSync, ?sync= param
    ├── +page.svelte     # Landing / drop zone
    ├── compare/+page.svelte
    └── event/+page.svelte
```

### 2.1 ECharts Lazy-Loading

ECharts (≈1.1 MB / 374 kB gzipped) is **not in the initial bundle**. It is deferred to a separate async chunk and fetched only when the first chart component mounts.

#### How it works

All four chart components (`TimeSeriesChart`, `DeltaChart`, `MeanMaxChart`, `SegmentChart`) import ECharts through a shared singleton loader:

```ts
// src/lib/components/charts/echarts-loader.ts
import type * as EChartsNamespace from 'echarts';
export type EChartsModule = typeof EChartsNamespace;

let cached: Promise<EChartsModule> | null = null;

export function loadECharts(): Promise<EChartsModule> {
  if (!cached) {
    cached = import('echarts') as Promise<EChartsModule>;
  }
  return cached;
}
```

Each chart component calls `loadECharts()` inside an `async onMount`:

```ts
onMount(async () => {
  ec = await loadECharts();               // dynamic import (first call fetches; subsequent calls return cache)
  chart = ec.init(container, undefined, { renderer: 'canvas' });
  chart.setOption(buildOption(), { notMerge: true }); // explicit initial render
  // ... event binding, ResizeObserver, etc.
  ready = true;
});
```

#### Why `chart.setOption()` is called explicitly in `onMount`

Three of the four chart components (`TimeSeriesChart`, `DeltaChart`, `SegmentChart`) declare `chart` as a plain `let` variable rather than `$state`. Because `chart` is not reactive, the Svelte `$effect` that normally calls `chart?.setOption()` fires *before* the `await loadECharts()` resolves — hitting a no-op. The explicit `setOption` call immediately after `ec.init()` guarantees the first render regardless of reactive timing.

`MeanMaxChart` uses `let chart = $state<ECharts | undefined>(undefined)` — assigning the chart instance triggers the `$effect` reactively — but still includes the explicit `setOption` call for consistency and to make all four components follow the same pattern.

#### Loading skeleton

While `loadECharts()` is in flight the chart canvas (`bind:this={container}`) stays in the DOM with `visibility: hidden` so `ec.init()` can be called on an element with real dimensions. A shimmer placeholder div replaces the visual space:

```svelte
{#if !ready}
  <div class="chart-canvas chart-skeleton" aria-hidden="true"></div>
{/if}
<div bind:this={container} class="chart-canvas" style:visibility={ready ? 'visible' : 'hidden'}></div>
```

Skeleton styles live in `src/lib/components/charts/chart-skeleton.css` (imported by all four chart components) and use CSS custom properties defined in `src/routes/layout.css`:

```css
/* dark theme (default) */
--skeleton-from: #1e293b;
--skeleton-to:   #334155;

/* light theme */
--skeleton-from: #e2e8f0;
--skeleton-to:   #f1f5f9;
```

#### Bundle verification

`rollup-plugin-visualizer` is configured in `vite.config.ts`. Every `npm run build` writes `stats.html` to the project root (gitignored). Open it to verify ECharts appears only as a dynamic entry (`isDynamicEntry: true` in the Vite manifest) and is absent from all entry-point sync dependency trees.

#### Adding a new chart component

If you add a fifth chart component:

1. Import from the shared loader: `import { loadECharts, type EChartsModule } from './echarts-loader'`
2. Keep `import type { ECharts, EChartsOption } from 'echarts'` — type-only imports are erased at compile time and do not create a bundle dependency
3. Use `async onMount`, call `loadECharts()`, call `chart.setOption(buildOption(), { notMerge: true })` immediately after `ec.init()`
4. Import `chart-skeleton.css` and add the skeleton/visibility template pattern

---

## 3. Cross-Device Label Sync

PR #80 added cross-device sync for device labels. Users rename sensor pills (e.g. "Device 1" → "Polar H10") and those names are shared across all their browsers and devices without requiring an account.

### 3.1 Design Goals

- **Account-free** — identity is a randomly generated UUID stored in `localStorage`, not tied to any login.
- **Cloud-authoritative** — the Upstash Redis store is treated as the source of truth; local state is overwritten on pull.
- **Fire-and-forget pushes** — label changes auto-push in the background; errors surface in the UI but never block local usage.
- **Human-readable codes** — a short 8-character code (e.g. `E6Y-NXEMF`) derived from the UUID lets users type the code on another device instead of scanning a QR.
- **90-day TTL** — entries in Redis expire after 90 days of inactivity with no explicit deletion needed.

### 3.2 Data Model in Redis

Two key types are stored:

| Key pattern | Value | TTL |
|-------------|-------|-----|
| `labels:{uuid}` | JSON object: `{ [antDeviceKey]: labelString }` | 90 days, rolling |
| `code:{shortCode}` | UUID string | 90 days, rolling |

Both keys are refreshed together on every PUT, so activity on one extends the other's TTL automatically.

The `antDeviceKey` format is defined by `deviceKey()` in `src/lib/utils/deviceChannels.ts` — it encodes manufacturer, product ID, and device type into a stable string used as the label map key.

### 3.3 Identity Lifecycle

```
First visit:
  crypto.randomUUID() → uuid
  deriveShortCode(uuid) → shortCode
  localStorage: SYNC_ID_KEY, SYNC_CODE_KEY
  PUT /api/labels/{uuid} → seed remote with current labels

Returning visit:
  Read uuid / shortCode from localStorage
  GET /api/labels/{uuid} → pull remote labels → replaceAllLabels()

Label change (any visit):
  setOnLabelChange hook → pushLabels(uuid, shortCode) [fire and forget]

Adopt external identity (QR / copy-link / short code):
  adoptSyncIdentity(uuid) → store uuid in localStorage → pullLabels(uuid)

Reset identity:
  crypto.randomUUID() → new uuid
  localStorage cleared of old identity
  pushLabels(newUuid, newShortCode) → seed remote under new identity
```

### 3.4 Sync Store (`sync.ts`)

**Location:** `src/lib/stores/sync.ts`

Exports:

| Export | Type | Description |
|--------|------|-------------|
| `syncStatus` | `Writable<SyncStatus>` | Reactive store for UI state (uuid, shortCode, lastSynced, error) |
| `initSync()` | `async () => (() => void) \| undefined` | Idempotent — safe to call multiple times; second call is a no-op. Returns a cleanup function on first call (call in `onDestroy` to deregister hook and allow HMR reinit); returns `undefined` if already initialised. SSR-safe. |
| `pushLabels(uuid, shortCode)` | `async` | Upload current labels to Redis. Errors update `syncStatus.error`. |
| `pullLabels(uuid)` | `async` | Download labels from Redis and call `replaceAllLabels()`. |
| `resolveCode(code)` | `async → uuid` | Resolve short code to UUID via API. Throws on 404. |
| `adoptSyncIdentity(uuid)` | `async` | Replace local identity with external UUID and pull. |
| `resetSyncIdentity()` | `async` | Generate fresh UUID, push current labels under it. |
| `deriveShortCode(uuid)` | `string` | Pure function: BigInt base-36 encode of UUID, 8 chars, `XXX-XXXXX`. |
| `getSyncStatus()` | `SyncStatus` | Non-reactive snapshot (for use outside Svelte components). |

**`SyncStatus` shape:**

```ts
type SyncStatus = {
  uuid:       string | null;
  shortCode:  string | null;
  lastSynced: string | null; // ISO timestamp
  error:      string | null;
};
```

### 3.5 DeviceLabels Integration

**Location:** `src/lib/stores/deviceLabels.ts`

Three additions support sync:

| Function | Description |
|----------|-------------|
| `getAllLabels()` | Returns a snapshot `Record<string, string>` of all stored labels |
| `replaceAllLabels(map)` | Overwrites localStorage with the provided map and notifies the store |
| `setOnLabelChange(fn \| null)` | Registers a callback invoked after every `setDeviceLabel` / `removeDeviceLabel`. Pass `null` to deregister. |

Only one change callback can be registered at a time. `initSync` registers its push callback after the initial push/pull, so subsequent label changes auto-push. The cleanup function returned by `initSync` calls `setOnLabelChange(null)` to deregister on teardown.

### 3.6 Toast Notification Store

**Location:** `src/lib/stores/toast.ts`  
**Component:** `src/lib/components/ui/ToastContainer.svelte`

A lightweight, reusable toast system for surfacing transient non-blocking messages to the user. The store is framework-agnostic — any module can call `addToast` without importing Svelte components.

#### API

| Export | Signature | Description |
|--------|-----------|-------------|
| `toasts` | `Readable<Toast[]>` | Reactive list of active toasts. Read-only — prevents external mutation. |
| `addToast` | `(message: string, level?: ToastLevel, duration?: number) => void` | Adds a toast. Default level: `'warning'`. Default duration: `5000` ms. |
| `removeToast` | `(id: number) => void` | Removes a toast immediately and clears its auto-dismiss timer. |

#### Types

```ts
type ToastLevel = 'info' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
}
```

#### Behaviour

- Each toast is assigned a unique auto-incrementing `id`.
- `addToast` schedules a `setTimeout` to call `removeToast(id)` after `duration` ms. The timer handle is stored in a `Map<id, timer>` and cleared by `removeToast` to prevent orphaned timers when a toast is dismissed early.
- `removeToast` with an unknown `id` is a safe no-op.

#### ToastContainer component

`ToastContainer.svelte` subscribes to `$toasts` and renders the most recent `MAX_VISIBLE` (3) toasts as a fixed-position stack (bottom-right on desktop; full-width above the bottom nav bar on phone). It is mounted **once** in `+layout.svelte` so toasts are visible on every page.

Each toast has a level-appropriate left-border accent and dismiss button (`×`). Colours use hardcoded semantic values (amber/blue/red) against `--color-card` / `--color-text` backgrounds, ensuring correct appearance in both light and dark themes.

#### Current callers

| Caller | Level | Message |
|--------|-------|---------|
| `deviceLabels.ts` — `saveLabels` catch | `warning` | `'Device label could not be saved — storage full'` (QuotaExceededError) or `'Device label could not be saved'` (other errors) |

### 3.7 API Routes

See the full API reference in [`docs/api-reference.md`](api-reference.md).

**`GET /api/labels/[uuid]`** — returns `{ labels }` or 404.

**`PUT /api/labels/[uuid]`** — expects `{ labels: Record<string,string>, shortCode: string }`. Writes both `labels:{uuid}` and `code:{shortCode}` to Redis with a 90-day TTL.

**`GET /api/labels/resolve/[code]`** — resolves short code to UUID. Rate-limited at 10 req/min/IP to deter enumeration.

All routes validate inputs against `UUID_REGEX` / `SHORT_CODE_REGEX` from `src/lib/validation.ts` and return structured JSON errors on 400/404/429/500.

### 3.8 SyncPanel Component

**Location:** `src/lib/components/ui/SyncPanel.svelte`

A collapsible panel rendered in the Sidebar footer. It is always mounted (not conditionally rendered) so the sync toggle row is always visible.

Key internal state:

| State | Type | Purpose |
|-------|------|---------|
| `isOpen` | `boolean` | Controls panel expansion |
| `codeInput` | `string` | Bound to the short-code text input |
| `codeError` / `codeSuccess` | `string\|null` / `boolean` | Inline validation feedback |
| `isResolving` | `boolean` | Disables input during async resolve |
| `copied` | `boolean` | Briefly true after clipboard write, drives button label |

Derived values:

- `syncUrl` — `${origin}?sync=${uuid}`, used for both QR generation and copy-link.
- `qrSvg` — generated client-side via [`uqr`](https://github.com/unjs/uqr) (`renderSVG(syncUrl)`). No server round-trip.

The component validates code input against `SHORT_CODE_REGEX` before hitting the API, providing immediate feedback on format errors.

### 3.9 Layout Wiring

**`src/routes/+layout.svelte`**

Three sync-related wiring points:

1. `onMount` calls `initSync()` — idempotent; safe if called more than once (e.g. during HMR). Stores the returned cleanup function in `cleanupSync`.
2. `onDestroy` calls `cleanupSync?.()` — deregisters the label-change hook and resets the initialised flag, enabling a clean reinit if the layout remounts (HMR).
3. URL parameter handling: if the page loads with `?sync={uuid}`, `adoptSyncIdentity(uuid)` is called and the param is stripped from the URL using `history.replaceState` to avoid sharing it inadvertently via browser history.

### 3.10 Validation

**`src/lib/validation.ts`**

Shared between API routes (server) and `SyncPanel` (client) to avoid duplication:

```ts
UUID_REGEX      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
SHORT_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{5}$/i
```

### 3.11 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Yes | REST endpoint for your Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Read-write token for the database |

These are read via `$env/dynamic/private` (SvelteKit server-only) in `src/lib/server/redis.ts`. They must be set in:

- **Local development:** `.env.local` (git-ignored, never committed)
- **Vercel:** Project Settings → Environment Variables

The Redis singleton (`getRedis()`) throws an explicit error if credentials are absent, which the API routes catch and surface as HTTP 500. This prevents silent failures.

### 3.12 Local Development Setup

1. Create an [Upstash](https://upstash.com) account and create a Redis database (free tier is sufficient).
2. Copy the REST URL and token from the Upstash console.
3. Create `.env.local` in the project root:

```env
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

4. Run `npm run dev` — sync features are fully functional locally.

> **Tip:** If you do not configure Redis, the app still works — sync API calls will return 500 and `syncStatus.error` will be set, but all FIT file analysis features continue to function normally.

---

## 3a. Map Tab — Metric Strip Chart

PR #82 added a co-visible metric strip chart to the Map tab on both `/compare` and `/event` pages. When the user selects a metric in the **Colour by** picker, a chart for that channel slides in below the map with full bidirectional hover sync.

### Component hierarchy

```
compare/+page.svelte (or event/+page.svelte)
  └── .map-panel  (flex column)
        ├── .map-wrap  (flex: 7)
        │     └── <ActivityMap
        │           onMetricChannelChange={ch => mapMetricChannel = ch}
        │           hoveredDistance={stripHoveredDistance}
        │         />
        └── .strip-wrap  (flex: 3, shown only when mapMetricChannel !== null)
              └── <CollapsiblePanel>  (collapses on tablet/phone)
                    └── <StripChart
                          channel={mapMetricChannel}
                          seriesInputs={stripSeriesInputs}
                          lapMarkers={...}
                          onHoverDistance={handleStripHoverDistance}
                          externalHoverDistance={mapStripHoveredDistance}
                        />
```

### Hover sync

The strip chart uses a **second, independent hover loop** (`stripHoveredDistance` / `mapStripHoveredDistance`), completely separate from the existing Charts-tab ↔ Map loop (`chartHoveredDistance` / `mapHoveredDistance`). This separation is intentional:

- The existing loop is **gated on `$xAxisMode === 'distance'`** — it only fires when the Charts tab is in distance mode.
- The strip loop is **never gated** — the strip chart always operates in distance mode (`forceDistanceAxis={true}`), so the sync is always valid regardless of the global x-axis setting.

### Key design points

| Concern | Approach |
|---------|---------|
| Strip always uses distance axis | `forceDistanceAxis={true}` prop on `TimeSeriesChart` inside `StripChart` |
| Isolated zoom/pan | `groupId="map-strip"` — separate ECharts connect group from `"compare-charts"` / `"event-charts"` |
| Gradient mode | `shouldShowGradient()` utility in `StripChart.utils.ts`; single-file only (multi-file stays as lines) |
| Shared layout CSS | `.map-wrap--has-strip` and `.strip-wrap` styles extracted to `src/routes/map-panel.css` and imported in both pages |
| Magic-string safety | Gradient sentinel value is `GRADIENT_COLOUR_TOKEN = '__gradient__'` (exported constant, not inline string) |

### `ActivityMap` — `onMetricChannelChange` callback

`ActivityMap.svelte` accepts an optional `onMetricChannelChange?: (channel: ChannelKey | null) => void` prop. It fires via a `$effect` whenever the internal `metricChannel` state changes (on picker selection and on file change/reset). Existing callers that do not pass this prop are unaffected.

---

## 3b. Data Export

PR #83 added two export paths to the app: an Excel workbook download and per-chart PNG downloads.

### Module layout

| File | Responsibility |
|------|---------------|
| `src/lib/export/excel.ts` | `buildWorkbook(activities)` — builds a SheetJS workbook in memory and returns it as an `ArrayBuffer` |
| `src/lib/export/exportActivities.ts` | `exportActivities(activities)` — async entry point: lazy-imports `excel.ts`, calls `buildWorkbook`, then calls `triggerDownload` |
| `src/lib/export/download.ts` | `triggerDownload(data, filename, mime)`, `downloadPng(dataUrl, filename)`, `localDateString()` |

`excel.ts` is lazy-imported in `exportActivities.ts` so that SheetJS (the `xlsx` package) is only bundled into a dynamically loaded chunk, keeping the main bundle lighter.

### Excel workbook structure

`buildWorkbook` produces:

1. **Summary sheet** — one row per activity with filename, sport, start time (Excel datetime), distance (km), and elapsed time (H:MM:SS or M:SS).
2. **Per-activity sheets** — one row per `ActivityRecord`. Sheet names are taken from `activity.filename`, truncated to 31 characters (Excel limit), and de-duplicated with ` (N)` suffixes if needed.

Column selection is dynamic: `presentChannels()` filters `CHANNEL_KEYS` to only those with at least one non-null value in the activity, keeping sheets clean for activities that lack certain sensors.

Pace is formatted as an `"M:SS"` string by `formatPace()` rather than stored as a decimal, since Excel has no built-in pace format and decimal values are not human-readable.

Timestamps use JavaScript `Date` objects with `cellDates: true` in the SheetJS write options, with `yyyy-mm-dd hh:mm:ss` cell format applied to datetime columns.

### PNG download

Each chart component calls `chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: bgColour })` on its ECharts instance, then passes the resulting base64 data URL to `downloadPng()`. `downloadPng` decodes the base64 string to a `Uint8Array`, wraps it in a `Blob`, and calls `triggerDownload` to initiate the browser download.

The background colour is read from the CSS custom property `--color-bg-primary` at download time so that the PNG matches the user's current theme.

### `localDateString()`

`new Date().toISOString()` returns UTC, which rolls over to the next day before midnight for users in UTC− timezones. `localDateString()` uses `toLocaleDateString('en-CA')` instead, which produces an ISO-format (`YYYY-MM-DD`) date in the user's local timezone.

---

## 3c. Chart Stats Row

PR #85 added a compact stats row below each `TimeSeriesChart` showing minimum, average, and maximum for every active series (added in PR #86). Stats update reactively when devices are toggled, and recalculate when the user zooms into a region.

**Pace inversion (PR #88):** Because pace is an inverted metric (lower min/km = faster), `computeSeriesStats()` swaps the min/max values for the `pace` channel so that `SeriesStats.max` holds the fastest (numerically smallest) pace and `SeriesStats.min` holds the slowest. The template renders pace as `max / avg / min` so numbers still read ascending left-to-right, consistent with the pace chart's inverted y-axis.

### Module layout

| File | Responsibility |
|------|---------------|
| `src/lib/components/charts/TimeSeriesChart.utils.ts` | `computeSeriesStats()`, `formatStatValue()`, `SeriesStats` interface |
| `src/lib/components/charts/TimeSeriesChart.svelte` | `zoomRange` state, `seriesStats` derived value, `.chart-stats` HTML/CSS |

### Key functions

**`formatStatValue(value, channel)`** — formats a raw number for display. Pace channels use `paceFormat()` (M:SS — re-exported from `$lib/utils/formatting` as the shared `formatPace`); integer channels (heartRate, power, cadence) round to zero decimal places; float channels (speed, temperature) show one decimal.

**`computeSeriesStats(data, channel, label, colour, xRange?)`** — slices `data` to the optional `xRange` window, passes y-values to `summarise()`, and returns a `SeriesStats` object (or `null` if no data). The `xRange` is provided by the zoom handler.

**`SeriesStats` interface:**

```ts
interface SeriesStats {
  label:   string;
  colour:  string;
  min:     string;   // formatted for display (pace: slowest; others: numeric minimum)
  avg:     string;   // formatted for display
  max:     string;   // formatted for display (pace: fastest; others: numeric maximum)
  minRaw:  number;
  avgRaw:  number;
  maxRaw:  number;
  count:   number;
  xMin:    number;
  xMax:    number;
  unit:    string;
}
```

### Zoom integration

`TimeSeriesChart.svelte` listens to ECharts' `dataZoom` event. When a zoom is active, the x-axis extent is read from ECharts' internal model via `chart.getModel().getComponent('xAxis', 0)` and stored in `zoomRange`. The `seriesStats` derived value re-runs whenever `zoomRange` changes, slicing each series' data to the visible window.

`zoomRange` is reset to `undefined` on every chart rebuild (new data, smoothing change, axis mode change), so stats always reflect the full dataset after a rebuild.

### Data source vs Summary tab

The stats row and the Summary tab use the same `summarise()` function but different data sources:

| Surface | Data source | Notes |
|---------|-------------|-------|
| Stats row | `buildData()` | Smoothed; distance-axis interpolated when in distance mode |
| Summary tab | `extractChannel(activity.records, ch)` | Raw unsmoothed records |

When smoothing is 1 s and the axis is time, the two surfaces agree closely. In distance mode or with smoothing > 1 s, values may differ. Both surfaces carry a `title` tooltip explaining the difference.

---

## 3d. Activity Alignment — GPS Anchor and Indoor Detection

PR #91 replaced raw start-time-difference alignment with GPS-anchor-based alignment. PR #92 extended this to handle indoor activities (TrainerRoad, Zwift, treadmill) where GPS is absent or synthetic.

### Indoor activity detection

`classifyIndoor(subSport, records)` in `src/lib/fit/parser.ts` determines `activity.isIndoor` at parse time using two signals:

1. **`sub_sport` field** (primary) — if the FIT session contains a recognised indoor sub_sport value, the activity is classified as indoor regardless of GPS presence. The full set is:

   ```ts
   const INDOOR_SUB_SPORTS = new Set([
     'indoor_cycling', 'virtual_activity', 'spin', 'stationary_bike',
     'treadmill', 'indoor_rowing', 'indoor_running', 'indoor_walking',
     'virtual_ride', 'virtual_run',
   ]);
   ```

   > **Key insight:** Both Zwift (`virtual_activity`) and TrainerRoad (`indoor_cycling`) embed fake GPS coordinates in every record (Zwift uses virtual-world positions; TrainerRoad uses a Central Park, NYC placeholder). GPS presence cannot be used as the indoor detector — `sub_sport` is authoritative.

2. **GPS-absence fallback** — only fires when `sub_sport` is entirely absent (`undefined`) and all records lack a GPS position. Covers older devices that do not write `sub_sport`.

`activity.subSport` stores the raw sub_sport string from the FIT session (or `undefined`). `activity.isIndoor: boolean` is always populated.

### Anchor hierarchy

`findAnchor(activity)` in `src/lib/align/anchor.ts` branches on `activity.isIndoor`:

**Outdoor path** (unchanged from #91):

| Priority | Source | `AnchorSource` |
|----------|--------|----------------|
| 1 | FIT timer-start event (within 30 s) | `'timer'` |
| 2 | First GPS record with speed > 0 | `'gpsMovement'` |
| 3 | First GPS record (stationary) | `'gpsFix'` |
| 4 | File start | `'fileStart'` |

**Indoor path** (added in #92 — GPS signals are skipped entirely):

| Priority | Source | `AnchorSource` |
|----------|--------|----------------|
| 1 | FIT timer-start event (within 30 s) | `'timer'` |
| 2 | First `workout_step` timestamp (within 30 s) | `'workoutStep'` |
| 3 | First record with speed/power/cadence > 0 | `'indoorMovement'` |
| 4 | File start | `'fileStart'` |

The result is an `AlignmentAnchor` stored on `Activity` at parse time:

```ts
type AnchorSource = 'timer' | 'gpsMovement' | 'gpsFix' | 'fileStart'
                  | 'workoutStep' | 'indoorMovement';

interface AlignmentAnchor {
  recordIndex:    number;
  distanceMetres: number;
  elapsedSeconds: number;
  timestamp:      Date;
  source:         AnchorSource;
}
```

`activity.anchor` is computed once in `parser.ts → normalise()` and available to all downstream code. The new `Activity` fields supporting indoor alignment are:

| Field | Type | Description |
|-------|------|-------------|
| `subSport` | `string \| undefined` | Raw FIT `sub_sport` value |
| `isIndoor` | `boolean` | Computed by `classifyIndoor()` at parse time |
| `firstIndoorMovementIndex` | `number \| null` | First record with speed/power/cadence > 0 |
| `firstWorkoutStepTime` | `Date \| null` | Timestamp of first `workout_step` FIT message |

### Time-axis alignment

`computeAnchoredOffsets(activities)` in `src/lib/align/timestamp.ts` aligns files relative to the first loaded file's anchor timestamp rather than raw `startTime` values.

The `TimeOffsetControl` component shows a colour-coded anchor badge per file. Labels and tooltips are defined in `TimeOffsetControl.utils.ts` as `ANCHOR_LABELS` and `ANCHOR_TITLES` (both typed as `Record<AnchorSource, string>` for compile-time completeness):

| Badge | Colour | Anchor source |
|-------|--------|---------------|
| Timer | Blue | `'timer'` |
| GPS move | Blue | `'gpsMovement'` |
| GPS fix | Amber | `'gpsFix'` |
| File start | Grey | `'fileStart'` |
| Workout | Green | `'workoutStep'` |
| Indoor | Green | `'indoorMovement'` |

### Distance-axis re-zeroing

`interpolateToDistanceAxis(records, axis, distanceOffset)` shifts the distance axis so that `distanceOffset` maps to 0 km. `activity.anchor.distanceMetres` is passed as `distanceOffset` in both Compare and Event pages.

### Indoor/mixed session warnings — `createIndoorWarnings()`

`src/lib/utils/indoorWarnings.svelte.ts` exports a Svelte 5 runes composable that encapsulates the shared indoor warning state used by both Compare and Event pages:

```ts
const indoor = createIndoorWarnings(() => $activities);
// indoor.hasMixedIndoorOutdoor — any indoor + any outdoor file loaded (requires ≥2 files)
// indoor.allIndoor             — all loaded files are indoor (single file or more)
// indoor.mixedWarningDismissed — dismissal state for amber banner
// indoor.indoorInfoDismissed   — dismissal state for blue banner
```

The composable owns the dismissal reset `$effect` (fires on every `$activities` change). Each page adds two separate `$effect` blocks for axis auto-switching:

- **Mixed session:** `if (hasMixedIndoorOutdoor && $xAxisMode === 'distance') xAxisMode.set('time')` — locks to Time because mixed distance axes are incompatible.
- **All-indoor session:** `if (allIndoor && untrack(() => $xAxisMode) === 'distance') xAxisMode.set('time')` — defaults to Time on file load but uses `untrack()` so the user can manually switch back to Distance. `untrack()` prevents `$xAxisMode` from becoming a reactive dependency, limiting the effect to firing only when the file set changes.

CSS for the banners is in `src/routes/indoor-warning.css` (shared by both pages).

### Proximity warning

`anchorsAreDistant(activities)` returns `true` when any two GPS-anchored activities have anchor positions more than `GPS_PROXIMITY_THRESHOLD_M` (50 m) apart. Both pages show a dismissible amber banner. Indoor activities whose anchors have no GPS position are excluded from the comparison, so a pure-TR file (no GPS) paired with a Zwift file never triggers a false proximity warning.

---

## 4. Responsive Layout

The app is fully responsive across three viewport tiers. Breakpoints are defined in two places that must stay in sync:

- **CSS:** `--bp-phone: 480px` and `--bp-tablet: 768px` in `src/routes/layout.css`
- **JS:** `PHONE_MAX = 480` and `TABLET_MAX = 768` in `src/lib/stores/viewport.ts`

The `viewport` readable store emits `'phone' | 'tablet' | 'desktop'` via `window.matchMedia` listeners. It is SSR-safe (defaults to `'desktop'`).

Key responsive components:

| Component | Behaviour change at ≤768px |
|-----------|---------------------------|
| `Sidebar.svelte` | Switches to `position: fixed` slide-out drawer |
| `+layout.svelte` | Renders hamburger button (fixed, top-left, 44×44px) and backdrop |
| `CollapsiblePanel.svelte` | Wraps toolbar controls; `display: contents` on desktop, collapsible on mobile |
| `+layout.svelte` (phone only) | Renders bottom navigation bar at ≤480px |

---

## 5. FIT Parsing

FIT files are parsed by `fit-file-parser` running in a **Web Worker** to avoid blocking the UI thread. The worker is created in `src/lib/fit/parser.ts`.

Key parsing details:

- `STRING_DEVICE_TYPE` mapping converts `fit-file-parser`'s snake_case string outputs (e.g. `'heart_rate'`) back to numeric ANT+ constants.
- Device deduplication: duplicate `device_index` entries are discarded (only first occurrence retained).
- Two-pass channel allocation: external sensors (known ANT+ types) claim channels first; the watch claims remaining channels; any still-unclaimed channels are merged into the first device as a safety net.
- Enhanced fields: `enhanced_speed` and `enhanced_altitude` are preferred over `speed` and `altitude`.
- Stryd developer fields: `Power` (capital P), `stance_time`, `step_length` are mapped to standard channel keys.

**Sport-specific post-processing** is applied after record normalisation:

| Sport | Function | Reason |
|-------|----------|--------|
| `running` | `applyRunningCadenceDoubling(records)` | FIT cadence is single-leg (one foot per minute). Doubles to get conventional spm (steps per minute). |
| `cycling` | `removeCyclingPace(records)` | Pace (min/km) is not a meaningful cycling metric. Clears all `pace` values so the channel is excluded from device streams and charts entirely. |

Both functions are exported from `parser.ts` for unit testing.

**Lap building** is handled by `buildLaps(fitLaps, records)`, which also exported for direct unit testing. It derives `startDistance` and `endDistance` from the running cursor position in the records array rather than from the FIT lap's `start_distance` field. This makes it resilient to Garmin devices that write `start_distance = 0` for every lap (per-lap relative) rather than cumulative from the session start. Laps with `total_distance = 0` are returned as zero-length entries (`startIndex === endIndex`, `startDistance === endDistance`) without advancing the cursor.

---

## 6. Testing

Unit tests use **Vitest**. Test files live alongside the modules they test (e.g. `TimeSeriesChart.test.ts` next to `TimeSeriesChart.svelte`).

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

### Test environments

Most tests run in the default **`node`** environment (pure utility functions with no DOM). Component tests that mount Svelte components require a DOM and use **`jsdom`**.

To mark a test file as a component test, add this directive as the **first line** of the file:

```typescript
// @vitest-environment jsdom
```

**Why the `browser` resolve condition is needed for component tests:**

Svelte 5 exports both a browser build (`index.js`) and a server build (`index-server.js`). In `node` environment, Vite resolves to the server build, which throws `"mount(...) is not available on the server"`. The `vite.config.ts` sets `resolve.conditions: ['browser']` **only when `mode === 'test'`** so that jsdom component tests use the browser build. The production build is unaffected (Vite's built-in defaults include `browser` for client bundles).

```typescript
// vite.config.ts — mode-conditional resolve
export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), sveltekit(), visualizer({ filename: 'stats.html', open: false, gzipSize: true })],
  build: { chunkSizeWarningLimit: 1200 }, // ECharts async chunk is ~1.1 MB — suppress expected warning
  ...(mode === 'test' ? { resolve: { conditions: ['browser'] } } : {}),
  // ...
}));
```

**Mocking Leaflet in component tests:**

`ActivityMap.svelte` dynamically imports Leaflet in `onMount`. In jsdom, Leaflet's browser DOM APIs are unavailable. Mock Leaflet at the module level:

```typescript
vi.mock('leaflet', () => { /* minimal stubs for map, tileLayer, control, etc. */ });
vi.mock('leaflet/dist/leaflet.css', () => ({}));
```

Also stub `ResizeObserver` (not implemented in jsdom):

```typescript
vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
```

There are no integration or end-to-end tests at present. The API routes for sync are exercised manually — see section 3.11 for local setup.
