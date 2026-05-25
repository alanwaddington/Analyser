# Analyser — Developer Guide

> **Version:** 1.0 · **Last updated:** May 2026

This guide covers the technical internals of the Analyser application for contributors and maintainers. It focuses on areas not already covered by inline code comments.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Architecture Overview](#2-architecture-overview)
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
4. [Responsive Layout](#4-responsive-layout)
5. [FIT Parsing](#5-fit-parsing)
6. [Testing](#6-testing)

---

## 1. Project Setup

```bash
npm install
npm run dev        # dev server on http://localhost:5173
npm run build      # production build
npm run check      # svelte-check + tsc
npm test           # vitest unit tests
```

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
│   ├── components/
│   │   ├── charts/   # ECharts wrappers
│   │   ├── map/      # Leaflet map
│   │   └── ui/       # Layout components, controls, SyncPanel
│   ├── server/
│   │   └── redis.ts  # Upstash Redis singleton (server-only)
│   ├── stores/
│   │   ├── deviceLabels.ts  # Device label persistence (localStorage)
│   │   ├── sync.ts          # Cross-device sync logic
│   │   ├── session.ts       # Activity session state
│   │   └── viewport.ts      # Responsive breakpoint store
│   ├── utils/        # Pure utility functions
│   ├── validation.ts # Shared regex constants (UUID, short code)
│   └── types.ts      # Domain types
└── routes/
    ├── api/
    │   └── labels/
    │       ├── [uuid]/+server.ts          # GET / PUT label store
    │       └── resolve/[code]/+server.ts  # GET short-code resolver
    ├── +layout.svelte   # App shell, initSync, ?sync= param
    ├── +page.svelte     # Landing / drop zone
    ├── compare/+page.svelte
    └── event/+page.svelte
```

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
| `initSync()` | `async () => void` | Call once from `+layout.svelte` `onMount`. SSR-safe. |
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
| `setOnLabelChange(fn)` | Registers a callback invoked after every `setDeviceLabel` / `removeDeviceLabel` |

Only one change callback can be registered at a time. `initSync` registers its push callback after the first pull, so subsequent label changes auto-push.

### 3.6 API Routes

See the full API reference in [`docs/api-reference.md`](api-reference.md).

**`GET /api/labels/[uuid]`** — returns `{ labels }` or 404.

**`PUT /api/labels/[uuid]`** — expects `{ labels: Record<string,string>, shortCode: string }`. Writes both `labels:{uuid}` and `code:{shortCode}` to Redis with a 90-day TTL.

**`GET /api/labels/resolve/[code]`** — resolves short code to UUID. Rate-limited at 10 req/min/IP to deter enumeration.

All routes validate inputs against `UUID_REGEX` / `SHORT_CODE_REGEX` from `src/lib/validation.ts` and return structured JSON errors on 400/404/429/500.

### 3.7 SyncPanel Component

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

### 3.8 Layout Wiring

**`src/routes/+layout.svelte`**

Two sync-related additions:

1. `onMount` calls `initSync()` — runs once per browser session.
2. URL parameter handling: if the page loads with `?sync={uuid}`, `adoptSyncIdentity(uuid)` is called and the param is stripped from the URL using `history.replaceState` to avoid sharing it inadvertently via browser history.

### 3.9 Validation

**`src/lib/validation.ts`**

Shared between API routes (server) and `SyncPanel` (client) to avoid duplication:

```ts
UUID_REGEX      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
SHORT_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{5}$/i
```

### 3.10 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Yes | REST endpoint for your Upstash Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Read-write token for the database |

These are read via `$env/dynamic/private` (SvelteKit server-only) in `src/lib/server/redis.ts`. They must be set in:

- **Local development:** `.env.local` (git-ignored, never committed)
- **Vercel:** Project Settings → Environment Variables

The Redis singleton (`getRedis()`) throws an explicit error if credentials are absent, which the API routes catch and surface as HTTP 500. This prevents silent failures.

### 3.11 Local Development Setup

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

---

## 6. Testing

Unit tests use **Vitest**. Test files live alongside the modules they test (e.g. `TimeSeriesChart.test.ts` next to `TimeSeriesChart.svelte`).

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

There are no integration or end-to-end tests at present. The API routes for sync are exercised manually — see section 3.11 for local setup.
