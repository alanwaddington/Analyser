<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { activities, activeChannels, xAxisMode, referenceIndex } from '$lib/stores/session';
	import { anchorsAreDistant } from '$lib/align';
	import { deriveAvailableChannels } from '$lib/utils/channels';
	import { buildLapMarkers } from '$lib/utils/lapMarkers';
	import { buildSegments } from '$lib/utils/segments';
	import { summarise } from '$lib/analytics/summary';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import type { SeriesInput } from '$lib/components/charts/TimeSeriesChart.utils';
	import type { DeltaSeriesInput } from '$lib/components/charts/DeltaChart.utils';
	import type { SegmentSeriesInput } from '$lib/components/charts/SegmentChart.utils';
	import DeltaChart from '$lib/components/charts/DeltaChart.svelte';
	import TimeSeriesChart from '$lib/components/charts/TimeSeriesChart.svelte';
	import SegmentChart from '$lib/components/charts/SegmentChart.svelte';
	import ActivityMap from '$lib/components/map/ActivityMap.svelte';
	import StripChart from '$lib/components/charts/StripChart.svelte';
	import ChannelToggleBar from '$lib/components/ui/ChannelToggleBar.svelte';
	import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';
	import type { ChannelKey } from '$lib/types';
	import { exportActivities } from '$lib/export/exportActivities';
	import { untrack } from 'svelte';
	import { createIndoorWarnings } from '$lib/utils/indoorWarnings.svelte';
	import '../map-panel.css';
	import '../export-btn.css';
	import '../indoor-warning.css';

	const TABS = [
		{ id: 'charts', label: 'Charts' },
		{ id: 'map', label: 'Map' },
		{ id: 'segments', label: 'Segments' },
		{ id: 'summary', label: 'Summary' },
	] as const;

	type TabId = (typeof TABS)[number]['id'];

	const activeTab = $derived<TabId>(
		(page.url.searchParams.get('tab') as TabId | null) ?? 'charts',
	);

	function setTab(id: TabId) {
		goto(`?tab=${id}`, { replaceState: true });
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

	const availableChannels = $derived(deriveAvailableChannels($activities));
	const seriesInputs: SeriesInput[] = $derived(
		$activities.map((a, i) => ({
			activity: a,
			colourIndex: i,
			distanceOffset: a.anchor.distanceMetres,
		})),
	);
	const lapMarkers = $derived(buildLapMarkers($activities[$referenceIndex], $xAxisMode));
	const segments = $derived(buildSegments($activities[$referenceIndex]));
	const summaryRows = $derived(
		$activities
			.map((activity, i) => ({ activity, isReference: i === $referenceIndex }))
			.sort((a, b) => (b.isReference ? 1 : 0) - (a.isReference ? 1 : 0)),
	);

	$effect(() => {
		if (availableChannels.length > 0 && $activeChannels.length === 0) {
			activeChannels.set(availableChannels);
		}
	});

	const locationMismatch = $derived($activities.length > 1 && anchorsAreDistant($activities));
	let locationWarningDismissed = $state(false);

	const indoor = createIndoorWarnings(() => $activities);

	$effect(() => { void $activities; locationWarningDismissed = false; });

	// Force Time mode when a mixed session is detected
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

	/** True while the Excel workbook is being generated/downloaded */
	let exporting = $state(false);

	async function handleExport() {
		if ($activities.length === 0 || exporting) return;
		exporting = true;
		try {
			await exportActivities($activities);
		} catch (err) {
			console.error('[Export] Failed to generate workbook:', err);
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

	/** Series inputs for the strip chart — one per activity */
	const stripSeriesInputs = $derived.by((): SeriesInput[] => {
		if (!mapMetricChannel) return [];
		const ch = mapMetricChannel;
		return $activities
			.flatMap((activity, i) => {
				const hasData = activity.records.some(r => r[ch] != null);
				if (!hasData) return [];
				return [{ activity, colourIndex: i, distanceOffset: activity.anchor.distanceMetres }];
			});
	});

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatDuration(totalSeconds: number): string {
		const h = Math.floor(totalSeconds / 3600);
		const m = Math.floor((totalSeconds % 3600) / 60);
		const s = Math.floor(totalSeconds % 60);
		const mm = String(m).padStart(2, '0');
		const ss = String(s).padStart(2, '0');
		return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
	}

	function formatPace(secPerKm: number): string {
		const m = Math.floor(secPerKm / 60);
		const s = Math.floor(secPerKm % 60);
		return `${m}:${String(s).padStart(2, '0')} /km`;
	}
</script>

<div class="page">
	<div class="tab-bar" role="tablist" aria-label="Event views">
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
		<button
			class="export-btn"
			onclick={handleExport}
			disabled={$activities.length === 0 || exporting}
			aria-label={exporting ? 'Exporting data, please wait' : 'Export activity data as Excel'}
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

	<div
		class="tab-content"
		id="panel-{activeTab}"
		role="tabpanel"
		aria-labelledby="tab-{activeTab}"
	>
		<!-- Charts panel — always in DOM so ECharts instances survive tab switches -->
		<div class="charts-panel" class:tab-hidden={activeTab !== 'charts'}>
			<CollapsiblePanel title="Channels & Options">
				<div class="toolbar">
					<ChannelToggleBar channels={availableChannels} />
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
					<span class="warning-text">GPS anchor points are more than 50m apart — these files may be from different locations. Distance comparison may not reflect a shared course.</span>
					<button class="warning-dismiss" onclick={() => locationWarningDismissed = true} aria-label="Dismiss location warning">✕</button>
				</div>
			{/if}

			<div class="charts-scroll">
				<div class="card">
					<DeltaChart
						seriesInputs={seriesInputs as DeltaSeriesInput[]}
						referenceIndex={$referenceIndex}
						groupId="event-charts"
					/>
				</div>
				{#if $activeChannels.length === 0}
					<p class="empty">No channels selected.</p>
				{:else}
					{#each $activeChannels as channel, chartIdx (channel)}
						<div class="card">
							<TimeSeriesChart
								{channel}
								{seriesInputs}
								{lapMarkers}
								referenceIndex={$referenceIndex}
								groupId="event-charts"
								onHoverDistance={chartIdx === 0 ? handleChartHoverDistance : undefined}
								externalHoverDistance={chartIdx === 0 ? mapHoveredDistance : undefined}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		<!-- Map panel — always in DOM so Leaflet map survives tab switches -->
		<div class="map-panel" class:tab-hidden={activeTab !== 'map'}>
			<div class="map-wrap" class:map-wrap--has-strip={mapMetricChannel !== null}>
				<ActivityMap
					activities={$activities}
					referenceIndex={$referenceIndex}
					availableChannels={availableChannels}
					hoveredDistance={stripHoveredDistance ?? chartHoveredDistance}
					onHoverDistance={(d) => { handleMapStripHoverDistance(d); handleMapHoverDistance(d); }}
					onMetricChannelChange={(ch) => { mapMetricChannel = ch; }}
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
		{#if activeTab === 'segments'}
			<div class="cards-scroll">
				{#if $activities.length < 2}
					<p class="empty">Load at least 2 activities to see segment comparison.</p>
				{:else}
					<div class="card card--segment">
						<SegmentChart
							seriesInputs={seriesInputs as SegmentSeriesInput[]}
							referenceIndex={$referenceIndex}
							{segments}
						/>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'summary'}
			<div class="summary-scroll">
				<table class="summary-table">
					<thead>
						<tr>
							<th class="col-activity">Activity</th>
							<th class="col-stat">Date</th>
							<th class="col-stat">Total Time</th>
							<th class="col-stat">Distance</th>
							<th class="col-stat">Avg HR</th>
							<th class="col-stat">Max HR</th>
							<th class="col-stat">Avg Pace</th>
							<th class="col-stat">Avg Power</th>
						</tr>
					</thead>
					<tbody>
						{#each summaryRows as { activity, isReference }, rowIdx}
							{@const hrStats = summarise(extractChannel(activity.records, 'heartRate'))}
							{@const powerStats = summarise(extractChannel(activity.records, 'power'))}
							{@const paceSecPerKm = activity.totalDistance > 0 ? activity.totalElapsedTime / activity.totalDistance * 1000 : null}
							<tr class:row-alt={rowIdx % 2 === 1} class:row-reference={isReference}>
								<td class="cell-activity">{activity.filename}</td>
								<td class="cell-stat">{formatDate(activity.startTime)}</td>
								<td class="cell-stat">{formatDuration(activity.totalElapsedTime)}</td>
								<td class="cell-stat">{(activity.totalDistance / 1000).toFixed(2)} km</td>
								<td class="cell-stat">{hrStats ? hrStats.avg.toFixed(0) + ' bpm' : '—'}</td>
								<td class="cell-stat">{hrStats ? hrStats.max.toFixed(0) + ' bpm' : '—'}</td>
								<td class="cell-stat">{paceSecPerKm ? formatPace(paceSecPerKm) : '—'}</td>
								<td class="cell-stat">{powerStats ? powerStats.avg.toFixed(0) + ' W' : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
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
		color: #22c55e;
		border-bottom-color: #22c55e;
	}

	.tab:focus-visible {
		outline: 2px solid #22c55e;
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
		background: #22c55e;
		color: #fff;
	}



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
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card--segment {
		height: 400px;
	}

	@media (max-width: 480px) { /* --bp-phone */
		.card--segment {
			height: 260px;
		}
	}

	@media (max-height: 480px) { /* landscape phone */
		.card--segment {
			height: 200px;
		}
	}

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

	.summary-table th {
		font-weight: 600;
		color: var(--color-muted);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.col-activity {
		text-align: left;
		width: 200px;
	}

	.col-stat {
		min-width: 80px;
	}

	.cell-activity {
		color: var(--color-text);
		font-weight: 500;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
	}

	.cell-stat {
		font-family: ui-monospace, 'Cascadia Code', monospace;
		color: var(--color-text);
		white-space: nowrap;
	}

	.row-alt {
		background: color-mix(in srgb, var(--color-border) 30%, transparent);
	}

	.row-reference td:first-child {
		border-left: 3px solid #f59e0b;
		padding-left: 9px;
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
		outline: 2px solid #22c55e;
		outline-offset: 1px;
	}
</style>
