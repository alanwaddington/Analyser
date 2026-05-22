# Analyser — User Guide

> **Version:** 1.0 · **Last updated:** May 2026

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
   - 4.2 [Multi-File Device Bar](#42-multi-file-device-bar)
   - 4.3 [Fine-Tuning Timing](#43-fine-tuning-timing)
5. [Event Comparison](#5-event-comparison)
6. [Reference](#6-reference)

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

After loading a file, the application has two main views accessible from the top navigation bar:

| View | What it shows |
|------|---------------|
| ⚡ **Device Comparison** | Sensor streams from one or more files displayed side-by-side on a shared time or distance axis |
| 🏃 **Event Comparison** | Two or more runs of the same course aligned by distance, showing where time was gained or lost |

The **Device Comparison** view (described in sections 3–4) is the primary view and opens automatically when you load a file.

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

Double-click any device pill to rename it. Type the new label and press **Enter** to confirm, or **Escape** to cancel. Labels are saved locally and will be recognised the next time a file from the same ANT+ device is loaded.

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

Click the layer control icon in the **top-left** corner of the map to switch between five map styles:

![Tile layer switcher expanded showing five providers](screenshots/08-map-tile-switcher.png)

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

A **session warning banner** appears if the loaded files have start times more than 1 hour apart — this usually means the files are from different sessions. In that case, the **Distance axis** is recommended for a meaningful comparison (use the Time/Distance toggle at the top of the page).

---

### 4.2 Multi-File Device Bar

In multi-file mode the Device Toggle Bar groups sensors by their source file, with a coloured left-border header for each file.

![Multi-file device bar grouped by file with colour-coded headers](screenshots/10-multifile-device-bar.png)

- Each file gets a unique **colour** (blue, orange, green, purple, …). All chart series from that file share the same colour.
- Channels with data from two or more files display the **✦** comparable indicator — these are the most valuable channels to compare.
- Use the **Select all / Deselect all** button to quickly show or hide everything.

---

### 4.3 Fine-Tuning Timing

Even when files are from the same session, GPS clocks sometimes drift by a few seconds. The **Fine-tune timing** control lets you shift any file forwards or backwards in time to align the traces precisely.

![Fine-tune timing panel with per-file offset controls](screenshots/12-time-offset-control.png)

Click the **⏱ Fine-tune timing** button (below the Device Toggle Bar, visible in multi-file + time-axis mode) to expand the panel.

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

## 6. Reference

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
| Two files don't align on the time axis | Different session start times | Use Distance axis, or adjust offsets in the Fine-tune timing panel |
| Map shows no route | FIT file has no GPS data | Some indoor activities (turbo trainer, treadmill) do not record GPS |
| Pace chart looks upside-down | Expected — faster pace (lower min/km) is plotted higher | This is correct; it matches the intuition of "going faster = higher on chart" |
| Device name shows as "Device N" | ANT+ device ID not yet labelled | Double-click the pill to rename it; the label is saved for future sessions |

---

*Screenshots taken using real activity files: Ayr Parkrun and Zwift/TrainerRoad sessions.*
