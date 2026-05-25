# Analyser — User Guide

> **Version:** 1.5 · **Last updated:** May 2026

Analyser is a browser-based tool for inspecting and comparing `.fit` activity files from Garmin devices and other ANT+ sensors. It runs entirely in your browser — no account, no upload, no server. Files are parsed locally.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [The Interface](#2-the-interface)
3. [Device Comparison — Single File](#3-device-comparison--single-file)
   - 3.1 [Device Toggle Bar](#31-device-toggle-bar)
   - 3.2 [Charts Tab](#32-charts-tab)
   - 3.3 [Summary Tab](#33-summary-tab)
   - 3.4 [Mean/Max Tab](#34-meanmax-tab)
   - 3.5 [Map Tab](#35-map-tab)
4. [Device Comparison — Multiple Files](#4-device-comparison--multiple-files)
   - 4.1 [Loading Multiple Files](#41-loading-multiple-files)
   - 4.2 [Different-Session Files](#42-different-session-files)
   - 4.3 [Multi-File Device Bar](#43-multi-file-device-bar)
   - 4.4 [Fine-Tuning Timing](#44-fine-tuning-timing)
5. [Event Comparison](#5-event-comparison)
6. [Syncing Device Labels Across Devices](#6-syncing-device-labels-across-devices)
   - 6.1 [How Sync Works](#61-how-sync-works)
   - 6.2 [Linking a Second Device](#62-linking-a-second-device)
   - 6.3 [Sync Status and Errors](#63-sync-status-and-errors)
   - 6.4 [Resetting Your Sync Identity](#64-resetting-your-sync-identity)
7. [Reference](#7-reference)

---

## 1. Getting Started

Open Analyser in your browser. You are greeted with the landing page, which contains a drop zone and a file picker.

![Landing page showing the drop zone](screenshots/01-landing-page.png)

**To load a file:**

- **Drag and drop** one or more `.fit` files onto the drop zone, or
- Click **Choose files** to open the system file picker.

You can load **up to 6 files** at once. Once the files are parsed, you are taken directly to the **Device Comparison** view.

> **Supported format:** `.fit` (Flexible and Interoperable Data Transfer — the standard format exported by Garmin watches, Wahoo computers, and most ANT+ devices). Files from `.tcx` and `.gpx` sources are not currently supported.

---

## 2. The Interface

After loading a file, the application has two main views:

| View | What it shows |
|------|---------------|
| ⚡ **Device Comparison** | Sensor streams from one or more files displayed side-by-side on a shared time or distance axis |
| 🏃 **Event Comparison** | Two or more runs of the same course aligned by distance, showing where time was gained or lost |

The **Device Comparison** view (described in sections 3–4) is the primary view and opens automatically when you load a file.

### Navigation

On a **desktop** browser, the two views are accessible from the left sidebar. Click **⚡ Device Comparison** or **🏃 Event Comparison** to switch modes.

On a **tablet or phone**, the sidebar is hidden by default. Tap the **☰ menu button** in the top-left corner to slide out the navigation drawer. Tap any item or tap outside the drawer to close it. You can also swipe left across the drawer to close it.

On a **phone** (narrow screen), a **bottom navigation bar** appears at the foot of the screen with the same ⚡ Device and 🏃 Event buttons for quick switching without opening the drawer.

### Toolbar Controls

On tablet and phone, the toolbar controls (Device Toggle Bar, Channel Toggle Bar, Fine-tune timing) are hidden behind a collapsible panel. Tap the **Devices & Options** (or **Channels & Options**) button to expand or collapse the controls. On desktop the controls are always visible.

### Theme

The **Theme** control is in the bottom of the sidebar (or navigation drawer), between the X-axis toggle and the Smoothing slider.

| Option | Behaviour |
|--------|-----------|
| **🖥 Sys** (default) | Follows your operating system's dark/light preference |
| **☀ Lit** | Forces the light theme regardless of OS setting |
| **🌙 Drk** | Forces the dark theme regardless of OS setting |

Your choice is saved in your browser and restored the next time you open Analyser.

---

## 3. Device Comparison — Single File

Loading a single file opens the Device Comparison view with all detected sensor streams active.

![Device Comparison overview with a single Ayr Parkrun FIT file loaded](screenshots/02-compare-overview.png)

The view is divided into:

- **Left sidebar** — navigation and file controls
- **Device Toggle Bar** — sensors detected in the file, grouped by channel
- **Tab panel** — Charts, Summary, Mean/Max, and Map tabs

---

### 3.1 Device Toggle Bar

The Device Toggle Bar sits at the top of the content area and lists every sensor stream detected in the loaded file.

![Device Toggle Bar showing sensors grouped by channel](screenshots/03-device-toggle-bar.png)

**Key concepts:**

- Each **pill** represents one device contributing to a channel (e.g. a Polar H10 contributing Heart Rate).
- **Active** devices (highlighted in blue) are included in all charts and statistics. Click a pill to toggle it on or off.
- Channels with a **✦** indicator have data from two or more devices — these are directly comparable.
- **Multi-metric devices** (devices recording 3+ channels, such as a Garmin watch) appear as a single expandable pill. Click the **▾** arrow to see the individual channels.
- Devices that were connected but recorded no data are shown as dashed, semi-transparent pills and cannot be toggled.

**Renaming a device:**

Double-click any device pill to rename it. Type the new label and press **Enter** to confirm, or **Escape** to cancel. Labels are saved locally in your browser and are restored automatically the next time you load a file from the same device — this works for all device types, including Garmin watches, Stryd pods, ANT+ sensors, and BLE devices.

---

### 3.2 Charts Tab

The Charts tab displays time-series data for every active channel.

![Charts tab showing heart rate, power, and cadence over time](screenshots/04-charts-tab.png)

**Reading the charts:**

- Each chart plots one channel (e.g. Heart Rate, Power, Pace).
- The **X axis** is either elapsed time or distance — toggle between them with the **Time / Distance** buttons at the top.
- Multiple devices contributing to the same channel each appear as a separate line.
- **Pace** uses an inverted Y axis — faster pace (lower min/km) appears higher on the chart, which matches the intuition of "going faster".

**Interacting with the charts:**

| Action | Effect |
|--------|--------|
| Hover | Tooltip shows exact values across all series at that position |
| Click + drag | Zoom in on a time/distance range |
| Double-click | Reset zoom |
| Scroll wheel | Zoom in/out (all charts stay synchronised) |

**Lap markers** appear as faint vertical lines across all charts. Hover a marker to see the lap number and split time.

**Smoothing:**

A smoothing control lets you apply a rolling average to reduce sensor noise. Increase the window (in seconds) to smooth out spikes; set it to 1 s for raw data. Smoothing applies to all channels simultaneously.

---

### 3.3 Summary Tab

The Summary tab shows aggregate statistics for every active device and channel.

![Summary tab showing per-device statistics](screenshots/05-summary-tab.png)

For each channel, the table shows:

| Column | Meaning |
|--------|---------|
| **Device** | The sensor that recorded this channel |
| **Avg** | Time-weighted average over the active portion of the activity |
| **Max** | Peak value recorded |
| **Total** | Cumulative value (distance, calories) — shown where applicable |

Toggling devices in the Device Toggle Bar updates the Summary table immediately.

---

### 3.4 Mean/Max Tab

The Mean/Max tab plots the **best average power** (or other metric) over every possible duration, from one second up to the full activity length.

![Mean/Max tab showing power curve](screenshots/06-meanmax-tab.png)

This is the standard "Critical Power curve" or "Power Duration curve" used in cycling and running:

- The Y axis is the best average power achieved for the duration on the X axis.
- A high, flat curve indicates sustained high output; a steep drop-off indicates strength over short durations but limited endurance.
- When multiple files are loaded, each file produces its own curve — load two sessions to compare fitness progress.

---

### 3.5 Map Tab

The Map tab renders the GPS route recorded in the activity.

![Map tab showing GPS route from the Ayr Parkrun](screenshots/07-map-basic.png)

**Tile layers:**

A **Map Layer** panel is always visible in the **top-left** corner of the map. Click any layer name to switch the base map:

![Map showing the always-visible tile layer panel with five providers](screenshots/08-map-tile-switcher.png)

| Layer | Best for |
|-------|---------|
| **Streets** (default) | Road runs, orientating yourself |
| **Satellite** | Seeing the actual terrain |
| **Topo** | Hilly routes — contour lines visible |
| **Cycling** | Bike-specific road markings |
| **Dark** | Low-glare, high-contrast viewing |

**Metric colouring:**

Use the **Colour by** dropdown in the **top-right** of the map to shade the route by a metric such as pace, heart rate, or power. The colour gradient runs from blue (low values) to red (high values). A legend appears in the bottom-right showing the value range.

**Hover interaction:**

Hovering over the map route shows a crosshair on all open charts, letting you pinpoint exactly what your metrics were at a specific GPS location.

---

## 4. Device Comparison — Multiple Files

Analyser supports loading up to **6 files simultaneously**, enabling you to compare sensor data across different activities or devices.

### 4.1 Loading Multiple Files

Select multiple `.fit` files in the file picker (hold Shift or Cmd/Ctrl to select more than one), or drag and drop multiple files onto the drop zone at once.

![Multi-file compare overview with two Zwift TrainerRoad sessions loaded](screenshots/09-multifile-overview.png)

> **Note:** If the loaded files are from different sessions (start times more than 1 hour apart), Device Comparison will be unavailable — see [section 4.2](#42-different-session-files).

---

### 4.2 Different-Session Files

Device Comparison is designed for files recorded **during the same session** — for example, two devices worn simultaneously on the same run. Comparing files from completely different activities (different days, different events) produces charts with no meaningful relationship between the data streams.

If you load two or more files whose start times are more than 1 hour apart, Analyser detects this and shows an explanation panel instead of charts:

![Gate panel shown when files are from different sessions](screenshots/15-different-sessions-gate.png)

The **⚡ Device Comparison** button in the sidebar also appears greyed-out with a tooltip explaining why it is unavailable.

**What to do:**

- Click **Switch to Event Comparison →** to use the 🏃 Event Comparison view, which is designed for comparing runs of the same course across different sessions.
- Or remove one of the loaded files (using the × button in the sidebar) until the remaining files are from the same session.

Once the remaining files overlap in time (within 1 hour), Device Comparison becomes available again automatically.

---

### 4.3 Multi-File Device Bar

In multi-file mode the Device Toggle Bar groups sensors by their source file, with a coloured left-border header for each file.

![Multi-file device bar grouped by file with colour-coded headers](screenshots/10-multifile-device-bar.png)

- Each file gets a unique **colour** (blue, orange, green, purple, …). All chart series from that file share the same colour.
- Channels with data from two or more files display the **✦** comparable indicator — these are the most valuable channels to compare.
- Use the **Select all / Deselect all** button to quickly show or hide everything.

---

### 4.4 Fine-Tuning Timing

Even when files are from the same session, GPS clocks sometimes drift by a few seconds. The **Fine-tune timing** control lets you shift any file forwards or backwards in time to align the traces precisely.

![Fine-tune timing panel with per-file offset controls](screenshots/12-time-offset-control.png)

Click the **⏱ Fine-tune timing** button (below the Device Toggle Bar, visible in multi-file + time-axis mode) to expand the panel. This control is only relevant when files are from the **same session** — if they are from different sessions, the gate panel is shown instead (see [section 4.2](#42-different-session-files)).

| Control | Function |
|---------|---------|
| **−10 / −1** buttons | Shift the file 10 s or 1 s earlier |
| **+1 / +10** buttons | Shift the file 1 s or 10 s later |
| **Numeric input** | Type an exact offset in seconds |
| **↺** (Reset) | Return to the auto-computed offset |

The first loaded file is always the **reference** (offset = 0). All other files are shifted relative to it. The offset is shown in the **N adjusted** badge on the toggle button.

---

## 5. Event Comparison


The **Event Comparison** view (🏃) is designed for comparing multiple runs of the same course — for example, several parkruns on the same route — aligned by **distance** to show exactly where time was gained or lost.

![Event Comparison view](screenshots/14-event-comparison.png)

Load two or more `.fit` files, then switch to the Event Comparison tab. The view provides:

- **Time delta plot** — cumulative seconds gained or lost versus distance. Positive values mean you were ahead of the reference run; negative values mean you were behind.
- **Overlaid time-series charts** — pace, speed, heart rate, and power for all files on a shared distance axis.
- **Segment bar chart** — per-kilometre or per-lap time difference, highlighting your best and worst segments.

> **Tip:** Select a reference run using the controls in the sidebar. The time delta is calculated relative to the reference. Try different reference runs to understand where you consistently gain or lose time.

---

## 6. Syncing Device Labels Across Devices

Device labels you create (by double-clicking a sensor pill) are saved in your browser's local storage. The **Sync** feature lets you share those labels across multiple browsers or devices — for example, so your phone and laptop both show "Polar H10" instead of "Device 1".

Sync is **automatic and account-free**. No sign-in is required. Each browser is assigned a private sync identity (a UUID stored in local storage) the first time it loads Analyser.

### 6.1 How Sync Works

1. On first load, Analyser generates a unique sync identity (UUID) for your browser and pushes your current labels to a cloud key-value store under that identity.
2. On every subsequent load, Analyser pulls the latest labels from the cloud and applies them locally — the cloud is the source of truth.
3. Whenever you rename or remove a device label, the change is automatically pushed to the cloud in the background.
4. All data is keyed by your private UUID. No one else can read or modify your labels without that UUID.

> **Privacy note:** Labels are stored in Upstash Redis and expire automatically after **90 days** of inactivity. No personal information is stored — only the device labels you assign (e.g. "Polar H10", "Assioma Duo") keyed by a randomly generated UUID.

### 6.2 Linking a Second Device

To share your labels with a second browser or device:

1. Open the **Sync** panel in the sidebar footer (click the ☁ Sync toggle).
2. On the first device:
   - **Scan the QR code** with the second device's camera app — this opens Analyser with the sync identity pre-loaded.
   - Or click **📋 Copy link** and paste the URL into the second device's browser.
   - Or note the **short sync code** (format: `XXX-XXXXX`, e.g. `E6Y-NXEMF`).
3. On the second device, open Analyser and expand the Sync panel:
   - If you used the QR code or copied link, Analyser automatically pulls labels from the first device's identity — no further action needed.
   - If using the short code, type it into the **Link another device** input and press **→** (or Enter). Analyser resolves the code and pulls labels.

After linking, both devices share the same sync identity and labels stay in sync automatically.

> **Tip:** The QR code and copy-link methods are the most convenient. Use the short code when typing a URL isn't practical.

### 6.3 Sync Status and Errors

The Sync panel shows a status line:

| Status | Meaning |
|--------|---------|
| ☁ Syncing across devices ✓ · *N min ago* | Labels synced successfully; time since last sync |
| Setting up sync… | Initial sync in progress (first visit) |
| ⚠ Sync error — retry | A push or pull failed; click **retry** to try again |

Network errors are non-fatal — if a push fails, your local labels are unchanged and the error is shown in the panel. Analyser will retry automatically on the next label change.

### 6.4 Resetting Your Sync Identity

If you want to **break the link** between devices (e.g. after lending your laptop to someone):

1. Open the Sync panel and click **Reset sync identity** at the bottom.
2. Confirm when prompted.

A new UUID is generated and your current labels are pushed under the new identity. Devices still using the old identity will no longer receive your label updates.

> **Note:** Resetting does not delete the old identity from the cloud — it simply stops being used. The old data will expire after 90 days of inactivity.

---

## 7. Reference

### Sync — Quick Reference

| Action | How |
|--------|-----|
| Open Sync panel | Click **☁ Sync** in the sidebar footer |
| Share labels with another device | QR code, Copy link, or short code |
| Enter a short code | Type `XXX-XXXXX` in the **Link another device** input and press → |
| Break the link / start fresh | **Reset sync identity** in the Sync panel |
| Check last sync time | Status line in the Sync panel |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Double-click** a chart | Reset zoom |
| **Enter** (in rename input) | Confirm device rename |
| **Escape** (in rename input) | Cancel device rename |
| **Enter** (in offset input) | Confirm time offset |

### Supported Sensor Types

| Sensor | Channels recorded |
|--------|------------------|
| Heart Rate Monitor (HRM) | Heart Rate |
| Power Meter (bike) | Power, Left/Right balance |
| Stryd Running Power | Power, Form Power, Ground Contact Time, Stride Length |
| Core Body Temperature | Core Temperature, Skin Temperature |
| Speed/Cadence Sensor | Speed, Cadence |
| Running Dynamics Pod | Vertical Oscillation, Ground Contact Time, Stride Length |
| Watch / Primary device | All remaining channels: GPS, Altitude, Speed, Pace, Temperature |

### File Limits

- **Maximum files per session:** 6
- **Supported format:** `.fit` (ANT/Garmin FIT protocol)
- All parsing happens **locally in your browser** — no data is uploaded to any server.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| File loads but no charts appear | No sensor data in the file | Check the Device Toggle Bar — all devices may be deselected or no-data |
| Device Comparison shows "unavailable" panel | Files are from different sessions (start times >1 hour apart) | Use **Event Comparison** (🏃) to compare runs of the same course, or remove the out-of-session file |
| Two same-session files don't align on the time axis | GPS clock drift between devices | Adjust offsets using the Fine-tune timing panel (section 4.4) |
| Map shows no route | FIT file has no GPS data | Some indoor activities (turbo trainer, treadmill) do not record GPS |
| Pace chart looks upside-down | Expected — faster pace (lower min/km) is plotted higher | This is correct; it matches the intuition of "going faster = higher on chart" |
| Device name shows as "Device N" | Device not yet labelled | Double-click the pill to rename it; the label is saved in your browser and restored for future sessions with any device of the same type |
| Sync panel shows "⚠ Sync error" | Network error or server unavailable | Click **retry** in the Sync panel; your local labels are unaffected |
| Short code entry says "Code not found" | Code is invalid, mistyped, or the 90-day TTL has expired | Check the code format (`XXX-XXXXX`) and re-copy it from the originating device |
| Labels on second device are out of date | Sync has not triggered yet | Open the Sync panel — pulling happens automatically on load; refresh the page if needed |
| Sync panel shows "Setting up sync…" for a long time | Connectivity issue on first visit | Check your network; the sync identity is assigned locally first so labels still work offline |

---

*Screenshots taken using real activity files: Ayr Parkrun and Zwift/TrainerRoad sessions.*
