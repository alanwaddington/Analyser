<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { activities, activeDeviceIndices, xAxisMode, smoothing, timeOffsets, activityColourMap } from '$lib/stores/session';
	import { sessionLinkState } from '$lib/session/sessionLink';
	import { deviceKey as stableDeviceKey } from '$lib/utils/deviceKey';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import type { ChannelKey, CrossFileStream } from '$lib/types';
	import { buildLapMarkers } from '$lib/utils/lapMarkers';
	import { summarise } from '$lib/analytics/summary';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import type { SeriesInput } from '$lib/components/charts/TimeSeriesChart.utils';
	import TimeSeriesChart from '$lib/components/charts/TimeSeriesChart.svelte';
	import MeanMaxChart from '$lib/components/charts/MeanMaxChart.svelte';
	import ActivityMap from '$lib/components/map/ActivityMap.svelte';
	import StripChart from '$lib/components/charts/StripChart.svelte';
	import DeviceToggleBar from '$lib/components/ui/DeviceToggleBar.svelte';
	import TimeOffsetControl from '$lib/components/ui/TimeOffsetControl.svelte';
	import { getActiveStreamsForChannel, deriveDeviceLabel, deviceKey } from '$lib/utils/deviceChannels';
	import { computeAnchoredOffsets, activitiesOverlap, anchorsAreDistant } from '$lib/align';
	import type { AnchorSource } from '$lib/types';
	import { deriveAvailableChannels } from '$lib/utils/channels';
	import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';
	import { buildAnomalyCounts } from '$lib/components/ui/DeviceToggleBar.utils';
	import { groupAnomalyEvents } from '$lib/analytics/anomalies';
	import { athleteProfile } from '$lib/stores/athleteProfile';
	import type { AthleteProfile } from '$lib/types';
	import { buildCellContext } from '$lib/utils/summaryContext';
	import type { CellContext } from '$lib/utils/summaryContext';
	import { computeRSS } from '$lib/analytics/rss';
	import { exportActivities } from '$lib/export/exportActivities';
	import type { ExportFormat } from '$lib/export/columns';
	import { untrack } from 'svelte';
	import { createIndoorWarnings } from '$lib/utils/indoorWarnings.svelte';
	import { recordFilter, activeFilterCount } from '$lib/stores/filterStore';
	import { applyRecordFilter, deriveGradients, filterRecords } from '$lib/analytics/recordFilter';
	import FilterPanel from '$lib/components/ui/FilterPanel.svelte';
	import '../map-panel.css';
	import '../export-btn.css';
	import '../indoor-warning.css';

	const TABS = [
		{ id: 'charts', label: 'Charts' },
		{ id: 'map', label: 'Map' },
		{ id: 'meanmax', label: 'Mean/Max' },
		{ id: 'summary', label: 'Summary' },
	] as const;

	type TabId = (typeof TABS)[number]['id'];

	const activeTab = $derived<TabId>(
		(page.url.searchParams.get('tab') as TabId | null) ?? 'charts',
	);

	function setTab(id: TabId) {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('tab', id);
		goto(`?${params}`, { replaceState: true });
	}

	// Scroll the active tab button into view when the active tab changes (AC15).
	// Needed when a non-default tab is loaded via URL param on a narrow viewport.
	$effect(() => {
		const id = activeTab; // reactive dependency
		if (browser) {
			document.getElementById(`tab-${id}`)?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'nearest',
			});
		}
	});

	function handleTabKey(e: KeyboardEvent, currentId: TabId) {
		const ids = TABS.map(t => t.id);
		const idx = ids.indexOf(currentId);
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			setTab(ids[(idx + 1) % ids.length]);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			setTab(ids[(idx - 1 + ids.length) % ids.length]);
		}
	}

	// True when more than one file is loaded
	const multiFile = $derived($activities.length > 1);
	const anomalyCounts = $derived(buildAnomalyCounts($activities));

	// Flat list of all CrossFileStream objects across all loaded activities
	const crossFileStreams = $derived.by<CrossFileStream[]>(() => {
		const result: CrossFileStream[] = [];
		for (const activity of $activities) {
			for (const stream of activity.deviceStreams) {
				result.push({
					stream,
					activity,
					key: deviceKey(activity.id, stream.device.deviceIndex),
				});
			}
		}
		return result;
	});

	// Auto-computed time offsets anchored to GPS movement / timer event (used as defaults and for reset)
	const autoOffsets = $derived(computeAnchoredOffsets($activities));

	// Per-file distance offsets for re-zeroing charts to the GPS anchor point
	const distanceOffsets = $derived(
		new Map($activities.map(a => [a.id, a.anchor.distanceMetres]))
	);

	// Per-file anchor sources for the alignment indicator in TimeOffsetControl
	const anchorSources = $derived(
		new Map<string, AnchorSource>($activities.map(a => [a.id, a.anchor.source]))
	);

	// Initialise the timeOffsets store whenever activities change.
	// The store may then be overridden by TimeOffsetControl for manual fine-tuning.
	$effect(() => {
		timeOffsets.set(computeAnchoredOffsets($activities));
	});

	// Auto-select all streams with data whenever the file set changes, so charts
	// display immediately on load without requiring manual pill clicks.
	$effect(() => {
		const selectableKeys = crossFileStreams
			.filter(cfs => cfs.stream.channels.length > 0)
			.map(cfs => cfs.key);
		activeDeviceIndices.set(new Set(selectableKeys));
	});

	// Device keys pending application from a decoded session link.
	// Stored separately so sessionLinkState can be consumed immediately while
	// device matching waits for crossFileStreams to populate.
	let pendingDeviceKeys = $state<string[] | null>(null);

	// Effect 1: consume sessionLinkState immediately. Apply file-independent fields
	// (smoothing, xAxisMode, tab) right away and stash device keys for Effect 2.
	// Declared after the auto-select effect so device overrides run after defaults are set.
	$effect(() => {
		const linkState = $sessionLinkState;
		if (!linkState) return;

		if (linkState.s != null) smoothing.set(linkState.s);
		if (linkState.x) xAxisMode.set(linkState.x);
		if (linkState.t) {
			const validTabs = TABS.map(tab => tab.id) as string[];
			if (validTabs.includes(linkState.t)) setTab(linkState.t as TabId);
		}
		if (linkState.d) pendingDeviceKeys = linkState.d;

		sessionLinkState.set(null); // always consume immediately
	});

	// Effect 2: apply pending device selection once crossFileStreams are populated.
	$effect(() => {
		if (!pendingDeviceKeys || crossFileStreams.length === 0) return;
		const keys = pendingDeviceKeys;
		const matchedKeys = new Set<string>();
		for (const cfs of crossFileStreams) {
			const sk = stableDeviceKey(cfs.stream.device);
			if (sk && keys.includes(sk)) matchedKeys.add(cfs.key);
		}
		if (matchedKeys.size > 0) activeDeviceIndices.set(matchedKeys);
		pendingDeviceKeys = null;
	});

	// Lap markers from first activity (used for chart annotations)
	const lapMarkers = $derived(buildLapMarkers($activities[0], $xAxisMode));

	// Channels with data in at least one loaded activity (for the map metric selector)
	const mapAvailableChannels = $derived(deriveAvailableChannels($activities));

	// Channels that have at least one currently active device across all files
	const activeChannels = $derived.by<ChannelKey[]>(() => {
		if (crossFileStreams.length === 0 || $activeDeviceIndices.size === 0) return [];
		const channels = new Set<ChannelKey>();
		for (const cfs of crossFileStreams) {
			if ($activeDeviceIndices.has(cfs.key)) {
				cfs.stream.channels.forEach(ch => channels.add(ch));
			}
		}
		return Array.from(channels);
	});

	// Build series inputs for one channel — one entry per active CrossFileStream claiming it
	function buildSeriesForChannel(channel: ChannelKey): SeriesInput[] {
		const activeStreams = getActiveStreamsForChannel(
			crossFileStreams,
			channel,
			$activeDeviceIndices,
		);
		return activeStreams.map((cfs) => {
			const colourIdx = $activityColourMap.get(cfs.activity.id) ?? 0;
			return {
				activity: cfs.activity,
				colourIndex: colourIdx,
				colour: FILE_COLOURS[colourIdx % FILE_COLOURS.length],
				label: deriveDeviceLabel(cfs.stream.device, cfs.stream, cfs.activity),
				timeOffset: $timeOffsets.get(cfs.activity.id) ?? 0,
				distanceOffset: distanceOffsets.get(cfs.activity.id) ?? 0,
			};
		});
	}

	// Mean/Max: one series per file that has at least one active device.
	// Filters out files whose devices are all toggled off so their curves disappear
	// when deselected, consistent with the Charts and Summary tabs.
	const meanMaxSeriesInputs = $derived.by(() => {
		const activeActivityIds = new Set(
			crossFileStreams
				.filter(cfs => $activeDeviceIndices.has(cfs.key))
				.map(cfs => cfs.activity.id)
		);
		return $activities
			.filter(a => activeActivityIds.has(a.id))
			.map(a => {
				const colourIdx = $activityColourMap.get(a.id) ?? 0;
				return {
					activity: a,
					colourIndex: colourIdx,
					colour: FILE_COLOURS[colourIdx % FILE_COLOURS.length],
					label: a.filename,
				};
			});
	});

	// Active CrossFileStreams for the summary table columns
	const activeCrossFileStreams = $derived(
		crossFileStreams.filter(cfs => $activeDeviceIndices.has(cfs.key))
	);

	// ── Different-sessions gate ───────────────────────────────────────────────
	// True when 2+ files are loaded but their start times are >1 hour apart.
	// In this state the tab UI is replaced by an explanation panel.
	const differentSessions = $derived(!activitiesOverlap($activities));

	// True when GPS anchors from different files are far apart (>50m), suggesting different locations
	const locationMismatch = $derived($activities.length > 1 && anchorsAreDistant($activities));
	let locationWarningDismissed = $state(false);

	const indoor = createIndoorWarnings(() => $activities);

	// Reset location warning whenever the file set changes
	$effect(() => { void $activities; locationWarningDismissed = false; });

	// Force Time mode when a mixed session is detected — distance is not meaningful
	$effect(() => {
		if (indoor.hasMixedIndoorOutdoor && $xAxisMode === 'distance') xAxisMode.set('time');
	});

	// Force Time mode when all activities are indoor — distance is device-estimated, not GPS.
	// untrack() prevents $xAxisMode from becoming a dependency so the effect only re-fires
	// on file-set changes, allowing the user to manually switch to Distance if desired.
	$effect(() => {
		if (indoor.allIndoor && untrack(() => $xAxisMode) === 'distance') xAxisMode.set('time');
	});

	$effect(() => {
		if ($activities.length === 0) goto('/');
	});

	// ── Bidirectional map↔chart hover sync ───────────────────────────────────

	/** Distance in metres from chart hover → shown as position marker on map */
	let chartHoveredDistance = $state<number | null>(null);

	/** Distance in metres from map hover → drives chart crosshairs */
	let mapHoveredDistance = $state<number | null>(null);

	function handleChartHoverDistance(distMetres: number | null) {
		if ($xAxisMode !== 'distance') return;
		chartHoveredDistance = distMetres;
	}

	function handleMapHoverDistance(distMetres: number | null) {
		if ($xAxisMode !== 'distance') return;
		mapHoveredDistance = distMetres;
	}

	// Clear both directions when switching away from distance mode
	$effect(() => {
		if ($xAxisMode !== 'distance') {
			chartHoveredDistance = null;
			mapHoveredDistance = null;
		}
	});

	// ── Map tab strip chart ───────────────────────────────────────────────────

	/** The metric channel currently selected in the Colour by picker (null = None) */
	let mapMetricChannel = $state<ChannelKey | null>(null);

	/** Distance in metres from strip chart hover → shown as position marker on map */
	let stripHoveredDistance = $state<number | null>(null);

	/** Distance in metres from map hover → drives strip chart crosshair */
	let mapStripHoveredDistance = $state<number | null>(null);

	/** True while the export file is being generated/downloaded */
	let exporting = $state(false);
	let exportFormat = $state<ExportFormat>('csv');

	async function handleExport() {
		if ($activities.length === 0 || exporting) return;
		exporting = true;
		try {
			await exportActivities($activities, exportFormat);
		} catch (err) {
			console.error('[Export] Failed to generate file:', err);
			alert('Export failed. Please try again.');
		} finally {
			exporting = false;
		}
	}

	// Note: unlike handleChartHoverDistance / handleMapHoverDistance (which are
	// gated on $xAxisMode === 'distance'), these strip handlers are NOT gated.
	// The strip chart always uses distance mode via forceDistanceAxis={true}, so
	// strip↔map hover sync is valid regardless of the global xAxisMode setting.
	function handleStripHoverDistance(distMetres: number | null) {
		stripHoveredDistance = distMetres;
	}

	function handleMapStripHoverDistance(distMetres: number | null) {
		mapStripHoveredDistance = distMetres;
	}

	/** Series inputs for the strip chart — one per file, using the same buildSeriesForChannel logic */
	const stripSeriesInputs = $derived.by(() => {
		if (!mapMetricChannel) return [];
		return buildSeriesForChannel(mapMetricChannel);
	});

	// ── Record filter ─────────────────────────────────────────────────────────

	/** Whether any loaded activity has altitude data (needed to show gradient filter control). */
	const hasAltitude = $derived($activities.some(a => a.records.some(r => r.altitude != null)));

	/** Primary sport and power source for FilterPanel hints/zone presets. */
	const primarySport = $derived($activities[0]?.sport ?? '');
	const primaryPowerSource = $derived.by(() => {
		const priority: Record<string, number> = { stryd: 3, native: 2, cycling: 1 };
		let best: typeof $activities[0]['powerSource'] = undefined;
		let bestP = 0;
		for (const a of $activities) {
			const p = priority[a.powerSource ?? ''] ?? 0;
			if (p > bestP) { bestP = p; best = a.powerSource; }
		}
		return best;
	});

	/**
	 * Gradient arrays for each activity, computed lazily only when the gradient filter has
	 * at least one bound set. Stored as a plain Map (not $state) since it's re-derived each
	 * time via $derived.by.
	 */
	const gradientCache = $derived.by<Map<string, (number | null)[]>>(() => {
		if ($recordFilter.gradient?.min == null && $recordFilter.gradient?.max == null) {
			return new Map();
		}
		return new Map($activities.map(a => [a.id, deriveGradients(a.records)]));
	});

	/** Passing record index sets for each activity, keyed by activity.id. */
	const activeRecordIndices = $derived.by<Map<string, Set<number>>>(() => {
		void $recordFilter;
		return new Map(
			$activities.map(a => [
				a.id,
				applyRecordFilter(a.records, $recordFilter, gradientCache.get(a.id)),
			])
		);
	});

	/** Filtered records per activity (for summary stats). */
	function filteredRecords(activityId: string, records: typeof $activities[0]['records']) {
		const passing = activeRecordIndices.get(activityId);
		return passing ? filterRecords(records, passing) : records;
	}
</script>

<div class="page">
	{#if differentSessions}
		<!-- Gate panel: files are from different sessions — compare is meaningless -->
		<div class="gate-panel">
			<div class="gate-card">
				<span class="gate-icon" aria-hidden="true">⚠</span>
				<h2 class="gate-heading">Device Comparison unavailable</h2>
				<p class="gate-body">
					The loaded files are from different sessions (start times more than
					1&nbsp;hour apart). Device Comparison requires files from the same
					session to produce meaningful results.
				</p>
				<button class="gate-cta" onclick={() => goto('/event')}>
					Switch to Event Comparison →
				</button>
				<p class="gate-hint">
					Or remove one of the loaded files to compare devices from the same session.
				</p>
			</div>
		</div>
	{:else}
	<div class="tab-bar" role="tablist" aria-label="Compare views">
		{#each TABS as tab}
			<button
				id="tab-{tab.id}"
				role="tab"
				class="tab"
				class:active={activeTab === tab.id}
				aria-selected={activeTab === tab.id}
				aria-controls="panel-{tab.id}"
				onclick={() => setTab(tab.id)}
				onkeydown={(e) => handleTabKey(e, tab.id)}
			>{tab.label}</button>
		{/each}
		<div class="export-group">
			<div class="export-format-toggle" role="radiogroup" aria-label="Export format">
				<button
					class="format-btn"
					class:format-active={exportFormat === 'csv'}
					onclick={() => exportFormat = 'csv'}
					role="radio"
					aria-checked={exportFormat === 'csv'}
					type="button"
				>CSV</button>
				<button
					class="format-btn"
					class:format-active={exportFormat === 'xlsx'}
					onclick={() => exportFormat = 'xlsx'}
					role="radio"
					aria-checked={exportFormat === 'xlsx'}
					type="button"
				>Excel</button>
			</div>
			<button
				class="export-btn"
				onclick={handleExport}
				disabled={$activities.length === 0 || exporting}
				aria-label={exporting
					? 'Exporting data, please wait'
					: exportFormat === 'csv'
						? 'Export activity data as CSV'
						: 'Export activity data as Excel'}
				aria-busy={exporting}
				type="button"
			>
				{#if exporting}
					<svg class="export-spinner" width="11" height="11" viewBox="0 0 11 11"
						aria-hidden="true" focusable="false">
						<circle cx="5.5" cy="5.5" r="4" fill="none"
							stroke="currentColor" stroke-width="1.4"
							stroke-dasharray="16 8" stroke-linecap="round"/>
					</svg>
					<span>Exporting…</span>
				{:else}
					<svg width="11" height="11" viewBox="0 0 11 11" fill="none"
						aria-hidden="true" focusable="false">
						<path d="M5.5 1v6M2.5 4.5l3 3 3-3M1 9.5h9"
							stroke="currentColor" stroke-width="1.4"
							stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					<span>Export Data</span>
				{/if}
			</button>
		</div>
	</div>

	<div
		class="tab-content"
		id="panel-{activeTab}"
		role="tabpanel"
		aria-labelledby="tab-{activeTab}"
	>
		<!-- Charts panel — always in DOM so ECharts instances survive tab switches -->
		<div class="charts-panel" class:tab-hidden={activeTab !== 'charts'}>
			<CollapsiblePanel title="Devices & Options">
				<div class="toolbar">
					<DeviceToggleBar streams={crossFileStreams} {multiFile} {anomalyCounts} />
					{#if multiFile && $xAxisMode === 'time'}
						<div class="toc-wrap">
							<TimeOffsetControl activities={$activities} {autoOffsets} {anchorSources} />
						</div>
					{/if}
					<div class="axis-toggle" role="group" aria-label="X-axis mode">
						<button
							class="axis-btn"
							class:axis-active={$xAxisMode === 'time'}
							onclick={() => xAxisMode.set('time')}
							aria-pressed={$xAxisMode === 'time'}
						>Time</button>
						<button
							class="axis-btn"
							class:axis-active={$xAxisMode === 'distance'}
							onclick={() => xAxisMode.set('distance')}
							aria-pressed={$xAxisMode === 'distance'}
							disabled={indoor.hasMixedIndoorOutdoor}
							title={indoor.hasMixedIndoorOutdoor ? 'Distance mode unavailable — indoor and outdoor files have incompatible distance axes' : undefined}
						>Distance</button>
					</div>
				</div>
			</CollapsiblePanel>

			<FilterPanel
				sport={primarySport}
				powerSource={primaryPowerSource}
				athleteProfile={$athleteProfile}
				{hasAltitude}
			/>

			{#if indoor.hasMixedIndoorOutdoor && !indoor.mixedWarningDismissed}
				<div class="location-warning" role="alert" aria-live="polite">
					<span class="warning-icon" aria-hidden="true">⚠</span>
					<span class="warning-text">Indoor and outdoor files loaded — distance axes are incompatible. Switch to Time mode for a meaningful comparison.</span>
					<button class="warning-dismiss" onclick={() => indoor.mixedWarningDismissed = true} aria-label="Dismiss mixed session warning">✕</button>
				</div>
			{/if}

			{#if indoor.allIndoor && !indoor.hasMixedIndoorOutdoor && !indoor.indoorInfoDismissed}
				<div class="indoor-info" role="status" aria-live="polite">
					<span class="warning-icon" aria-hidden="true">ℹ</span>
					<span class="warning-text">All files are indoor activities — distance values are device-estimated, not GPS-measured.</span>
					<button class="warning-dismiss" onclick={() => indoor.indoorInfoDismissed = true} aria-label="Dismiss indoor info">✕</button>
				</div>
			{/if}

			{#if locationMismatch && !locationWarningDismissed}
				<div class="location-warning" role="alert" aria-live="polite">
					<span class="warning-icon" aria-hidden="true">⚠</span>
					<span class="warning-text">GPS anchor points are more than 50m apart — these files may be from different locations.</span>
					<button class="warning-dismiss" onclick={() => locationWarningDismissed = true} aria-label="Dismiss location warning">✕</button>
				</div>
			{/if}

			<div class="charts-scroll">
				{#if $activeDeviceIndices.size === 0}
					<p class="empty">Toggle a device above to see its data.</p>
				{:else if activeChannels.length === 0}
					<p class="empty">No data available for the selected devices.</p>
				{:else}
					{#each activeChannels as channel, chartIdx (channel)}
						{@const seriesInputs = buildSeriesForChannel(channel)}
						{#if seriesInputs.length > 0}
							<div class="card">
								<TimeSeriesChart
									{channel}
									{seriesInputs}
									{lapMarkers}
									groupId="compare-charts"
									anomalies={groupAnomalyEvents($activities[0]?.anomalies.filter(a => a.channel === channel) ?? [])}
									onHoverDistance={chartIdx === 0 ? handleChartHoverDistance : undefined}
									externalHoverDistance={chartIdx === 0 ? mapHoveredDistance : undefined}
									athleteProfile={$athleteProfile}
									sport={$activities[0]?.sport ?? ''}
									activeRecordIndices={$activeFilterCount > 0 ? activeRecordIndices : undefined}
								/>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		</div>

		<!-- Map panel — always in DOM so Leaflet map survives tab switches -->
		<div class="map-panel" class:tab-hidden={activeTab !== 'map'}>
			<div class="map-wrap" class:map-wrap--has-strip={mapMetricChannel !== null}>
				<ActivityMap
					activities={$activities}
					colourMap={$activityColourMap}
					availableChannels={mapAvailableChannels}
					hoveredDistance={stripHoveredDistance ?? chartHoveredDistance}
					onHoverDistance={(d) => { handleMapStripHoverDistance(d); handleMapHoverDistance(d); }}
					onMetricChannelChange={(ch) => { mapMetricChannel = ch; }}
					athleteProfile={$athleteProfile}
				/>
			</div>
			{#if mapMetricChannel !== null && stripSeriesInputs.length > 0}
				<div class="strip-wrap">
					<CollapsiblePanel title="Metric Chart">
						<StripChart
							channel={mapMetricChannel}
							seriesInputs={stripSeriesInputs}
							{lapMarkers}
							onHoverDistance={handleStripHoverDistance}
							externalHoverDistance={mapStripHoveredDistance}
						/>
					</CollapsiblePanel>
				</div>
			{/if}
		</div>

		<!-- Other tabs — conditional rendering (no hover sync required) -->
		{#if activeTab === 'meanmax'}
			<div class="cards-scroll">
				<div class="card card--meanmax">
					<MeanMaxChart
					seriesInputs={meanMaxSeriesInputs}
					athleteProfile={$athleteProfile}
					sport={$activities[0]?.sport ?? ''}
				/>
				</div>
			</div>

		{:else if activeTab === 'summary'}
			<div class="summary-scroll">
				{#if activeCrossFileStreams.length === 0}
					<p class="empty">Toggle devices above to see their statistics.</p>
				{:else}
					{#if $activeFilterCount > 0}
						<div class="filter-indicator" role="status">
							<span class="filter-indicator-icon" aria-hidden="true">⧖</span>
							Filtered — statistics based on {$activeFilterCount} active filter{$activeFilterCount === 1 ? '' : 's'}
						</div>
					{/if}
					<table class="summary-table">
						<thead>
							<tr>
								<th class="col-channel"></th>
								{#each activeCrossFileStreams as cfs}
									{@const dotColour = FILE_COLOURS[($activityColourMap.get(cfs.activity.id) ?? 0) % FILE_COLOURS.length]}
									<th class="col-device">
										<span class="device-header">
											<span class="device-dot" style="background:{dotColour}"></span>
											<span class="device-header-text">
												<span class="device-name">{deriveDeviceLabel(cfs.stream.device, cfs.stream, cfs.activity)}</span>
												{#if multiFile}
													<span class="device-filename">{cfs.activity.filename}</span>
												{/if}
											</span>
										</span>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							<!-- Sub-header row: format guide -->
							<tr class="row-subheader">
								<td class="cell-label cell-label--subheader">Channel</td>
								{#each activeCrossFileStreams as _cfs}
									<td
										class="cell-stat cell-stat--subheader"
										title="Raw file statistics — time-weighted, unsmoothed. May differ from the chart stats row when smoothing or distance mode is active."
									>avg / max / min</td>
								{/each}
							</tr>
							{#each activeChannels as ch, rowIdx}
								<tr class:row-alt={rowIdx % 2 === 1}>
									<td class="cell-label">{CHANNEL_META[ch].label}</td>
									{#each activeCrossFileStreams as cfs}
										{@const recs = filteredRecords(cfs.activity.id, cfs.activity.records)}
										{@const s = summarise(extractChannel(recs, ch))}
										{@const ctx = s ? buildCellContext(ch, s.avg, cfs.activity.sport, $athleteProfile) : null}
										{@const powerS = ch === 'formPower' ? summarise(extractChannel(recs, 'power')) : null}
										{@const fpRatio = s && powerS && powerS.avg > 0 ? Math.round(s.avg / powerS.avg * 100) : null}
										<td class="cell-stat">
											{#if s}
												{s.avg.toFixed(1)} / {s.max.toFixed(1)} / {s.min.toFixed(1)}
												{#if ctx || fpRatio != null}
													<span class="cell-context">
														{#if ctx?.pctLabel}{ctx.pctLabel}{/if}
														{#if ctx?.pctLabel && ctx?.wkg}&ensp;·&ensp;{/if}
														{#if ctx?.wkg}{ctx.wkg} w/kg{/if}
														{#if ctx?.zone}<span class="zone-badge zone-badge--{ctx.zone}">Z{ctx.zone}</span>{/if}
														{#if fpRatio != null}{fpRatio}% of power{/if}
													</span>
												{/if}
											{:else}
												—
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
							{#if $athleteProfile.cp != null && activeCrossFileStreams.some(cfs => cfs.activity.sport === 'running')}
								<tr class:row-alt={activeChannels.length % 2 === 1}>
									<td class="cell-label" title="Running Stress Score — analogous to TSS for cycling">RSS</td>
									{#each activeCrossFileStreams as cfs}
										{@const rssRecs = filteredRecords(cfs.activity.id, cfs.activity.records)}
										{@const pStats = summarise(extractChannel(rssRecs, 'power'))}
										{@const rssVal = pStats && cfs.activity.sport === 'running' && $athleteProfile.cp
											? computeRSS(cfs.activity.totalElapsedTime, pStats.avg, $athleteProfile.cp)
											: null}
										<td class="cell-stat">
											{#if rssVal != null}
												{rssVal.toFixed(1)}
												<span class="cell-context">Running Stress</span>
											{:else}
												—
											{/if}
										</td>
									{/each}
								</tr>
							{/if}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}
	</div>
	{/if}
</div>

<style>
	@import '$lib/styles/zone-badge.css';

	.page {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.tab-bar {
		display: flex;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
		padding: 0 16px;
		gap: 4px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab-bar::-webkit-scrollbar {
		display: none;
	}

	.tab {
		padding: 10px 16px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--color-muted);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
		margin-bottom: -1px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.tab:hover {
		color: var(--color-text);
	}

	.tab.active {
		color: #3b82f6;
		border-bottom-color: #3b82f6;
	}

	.tab:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
		border-radius: 2px;
	}

	/* breakpoints: --bp-tablet (768px) / --bp-phone (480px) in layout.css */
	@media (max-width: 768px) { /* --bp-tablet */
		.tab {
			min-height: 44px;
		}
	}

	.tab-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.toolbar {
		padding: 12px 16px 8px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--color-border);
		display: flex;
		align-items: flex-start;
		gap: 12px;
		flex-wrap: wrap;
	}

	.toc-wrap {
		flex: 1;
		min-width: 0;
	}

	.axis-toggle {
		display: flex;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.axis-btn {
		padding: 4px 12px;
		background: none;
		border: none;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.axis-btn + .axis-btn {
		border-left: 1px solid var(--color-border);
	}

	.axis-btn:hover {
		color: var(--color-text);
	}

	.axis-btn.axis-active {
		background: #3b82f6;
		color: #fff;
	}

	/* ── Different-sessions gate panel ─────────────────────────────── */

	.gate-panel {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 32px 16px;
		overflow-y: auto;
	}

	.gate-card {
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 40px 36px;
		max-width: 480px;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 12px;
	}

	.gate-icon {
		font-size: 2.5rem;
		line-height: 1;
		color: #f59e0b;
	}

	.gate-heading {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		letter-spacing: -0.01em;
	}

	.gate-body {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.6;
		max-width: 360px;
	}

	.gate-cta {
		margin-top: 8px;
		padding: 8px 20px;
		background: #3b82f6;
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s;
	}

	.gate-cta:hover {
		background: #2563eb;
	}

	.gate-cta:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.gate-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-muted);
		opacity: 0.7;
	}

	/* ── Chart area ─────────────────────────────────────────────────── */

	.charts-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty {
		color: var(--color-muted);
		font-size: 0.875rem;
		text-align: center;
		margin-top: 48px;
	}

	.card {
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 16px;
	}

	/* ── Always-rendered panels (chart↔map hover sync) ─────────────────── */

	.charts-panel,
	.map-panel {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.tab-hidden {
		display: none !important;
	}

	.map-wrap {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* 70/30 flex split: map gets ~70%, strip gets ~30%.
	 * Defined here (scoped) so these rules beat the .map-wrap { flex: 1 }
	 * rule above — scoped selectors have higher specificity than the
	 * global map-panel.css rules that share the same class names. */
	.map-wrap--has-strip {
		flex: 7;
	}

	.strip-wrap {
		flex: 3;
	}

	.cards-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.card--meanmax {
		height: 400px;
	}

	@media (max-width: 480px) { /* --bp-phone */
		.card--meanmax {
			height: 280px;
		}
	}

	@media (max-height: 480px) { /* landscape phone */
		.card--meanmax {
			height: 220px;
		}
	}

	/* ── Filter indicator ───────────────────────────────────────────── */

	.filter-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		margin-bottom: 10px;
		font-size: 0.75rem;
		color: #38bdf8;
		background: rgba(56,189,248,0.08);
		border: 1px solid rgba(56,189,248,0.25);
		border-radius: 6px;
	}

	.filter-indicator-icon {
		font-style: normal;
	}

	/* ── Summary table ──────────────────────────────────────────────── */

	.summary-scroll {
		flex: 1;
		overflow: auto;
		padding: 16px;
	}

	.summary-table {
		width: max-content;
		min-width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.summary-table thead {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--color-card);
	}

	.summary-table th,
	.summary-table td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
		text-align: right;
	}

	.summary-table th:last-child,
	.summary-table td:last-child {
		border-right: none;
	}

	.col-channel {
		text-align: left;
		font-weight: 600;
		color: var(--color-muted);
		width: 140px;
	}

	.col-device {
		font-weight: 600;
		font-size: 0.75rem;
		max-width: 160px;
	}

	.device-header {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.device-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Two-line device header for multi-file mode */
	.device-header-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1px;
		overflow: hidden;
		min-width: 0;
	}

	.device-name {
		font-weight: 600;
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 130px;
		display: block;
	}

	.device-filename {
		font-weight: 400;
		font-size: 0.65rem;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 130px;
		display: block;
	}

	.cell-label {
		color: var(--color-muted);
		font-weight: 500;
		text-align: left;
	}

	.cell-stat {
		font-family: ui-monospace, 'Cascadia Code', monospace;
		color: var(--color-text);
		white-space: nowrap;
	}

	.cell-context {
		display: block;
		font-size: 0.68rem;
		color: var(--color-muted);
		margin-top: 2px;
		white-space: nowrap;
		font-family: inherit;
	}

	.row-alt {
		background: color-mix(in srgb, var(--color-border) 30%, transparent);
	}

	.row-subheader {
		background: color-mix(in srgb, var(--color-border) 15%, transparent);
	}

	.cell-label--subheader,
	.cell-stat--subheader {
		font-size: 0.65rem;
		color: var(--color-muted);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* ── Location mismatch warning banner ───────────────────────────── */

	.location-warning {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		background: rgba(245, 158, 11, 0.08);
		border-bottom: 1px solid rgba(245, 158, 11, 0.25);
		flex-shrink: 0;
	}

	.warning-icon {
		color: #f59e0b;
		font-size: 0.8rem;
		flex-shrink: 0;
	}

	.warning-text {
		font-size: 0.75rem;
		color: var(--color-muted);
		flex: 1;
	}

	.warning-dismiss {
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 0.7rem;
		cursor: pointer;
		padding: 2px 4px;
		flex-shrink: 0;
		line-height: 1;
		border-radius: 3px;
		transition: color 0.1s;
	}

	.warning-dismiss:hover { color: var(--color-text); }

	.warning-dismiss:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: 1px;
	}
</style>
