<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { activities, activeDeviceIndices, xAxisMode, timeOffsets } from '$lib/stores/session';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import type { ChannelKey, CrossFileStream } from '$lib/types';
	import { buildLapMarkers } from '$lib/utils/lapMarkers';
	import { summarise } from '$lib/analytics/summary';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import type { SeriesInput } from '$lib/components/charts/TimeSeriesChart.utils';
	import TimeSeriesChart from '$lib/components/charts/TimeSeriesChart.svelte';
	import MeanMaxChart from '$lib/components/charts/MeanMaxChart.svelte';
	import ActivityMap from '$lib/components/map/ActivityMap.svelte';
	import DeviceToggleBar from '$lib/components/ui/DeviceToggleBar.svelte';
	import TimeOffsetControl from '$lib/components/ui/TimeOffsetControl.svelte';
	import { getActiveStreamsForChannel, deriveDeviceLabel, deviceKey } from '$lib/utils/deviceChannels';
	import { computeTimeOffsets, activitiesOverlap } from '$lib/align';
	import { deriveAvailableChannels } from '$lib/utils/channels';
	import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';

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
		goto(`?tab=${id}`, { replaceState: true });
	}

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

	// Auto-computed time offsets (used as defaults and for reset in TimeOffsetControl)
	const autoOffsets = $derived(computeTimeOffsets($activities));

	// Initialise the timeOffsets store whenever activities change.
	// The store may then be overridden by TimeOffsetControl for manual fine-tuning.
	$effect(() => {
		timeOffsets.set(computeTimeOffsets($activities));
	});

	// Auto-select all streams with data whenever the file set changes, so charts
	// display immediately on load without requiring manual pill clicks.
	$effect(() => {
		const selectableKeys = crossFileStreams
			.filter(cfs => cfs.stream.channels.length > 0)
			.map(cfs => cfs.key);
		activeDeviceIndices.set(new Set(selectableKeys));
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
			const actIndex = $activities.indexOf(cfs.activity);
			return {
				activity: cfs.activity,
				colourIndex: actIndex,
				colour: FILE_COLOURS[actIndex % FILE_COLOURS.length],
				label: deriveDeviceLabel(cfs.stream.device),
				timeOffset: $timeOffsets.get(cfs.activity.id) ?? 0,
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
				const actIndex = $activities.indexOf(a);
				return {
					activity: a,
					colourIndex: actIndex,
					colour: FILE_COLOURS[actIndex % FILE_COLOURS.length],
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
					<DeviceToggleBar streams={crossFileStreams} {multiFile} />
					{#if multiFile && $xAxisMode === 'time'}
						<div class="toc-wrap">
							<TimeOffsetControl activities={$activities} {autoOffsets} />
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
						>Distance</button>
					</div>
				</div>
			</CollapsiblePanel>

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
									onHoverDistance={chartIdx === 0 ? handleChartHoverDistance : undefined}
									externalHoverDistance={chartIdx === 0 ? mapHoveredDistance : undefined}
								/>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		</div>

		<!-- Map panel — always in DOM so Leaflet map survives tab switches -->
		<div class="map-panel" class:tab-hidden={activeTab !== 'map'}>
			<div class="map-wrap">
				<ActivityMap
					activities={$activities}
					availableChannels={mapAvailableChannels}
					hoveredDistance={chartHoveredDistance}
					onHoverDistance={handleMapHoverDistance}
				/>
			</div>
		</div>

		<!-- Other tabs — conditional rendering (no hover sync required) -->
		{#if activeTab === 'meanmax'}
			<div class="cards-scroll">
				<div class="card card--meanmax">
					<MeanMaxChart seriesInputs={meanMaxSeriesInputs} />
				</div>
			</div>

		{:else if activeTab === 'summary'}
			<div class="summary-scroll">
				{#if activeCrossFileStreams.length === 0}
					<p class="empty">Toggle devices above to see their statistics.</p>
				{:else}
					<table class="summary-table">
						<thead>
							<tr>
								<th class="col-channel"></th>
								{#each activeCrossFileStreams as cfs}
									{@const actIndex = $activities.indexOf(cfs.activity)}
									{@const dotColour = FILE_COLOURS[actIndex % FILE_COLOURS.length]}
									<th class="col-device">
										<span class="device-header">
											<span class="device-dot" style="background:{dotColour}"></span>
											<span class="device-header-text">
												<span class="device-name">{deriveDeviceLabel(cfs.stream.device)}</span>
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
									<td class="cell-stat cell-stat--subheader">avg / max / min</td>
								{/each}
							</tr>
							{#each activeChannels as ch, rowIdx}
								<tr class:row-alt={rowIdx % 2 === 1}>
									<td class="cell-label">{CHANNEL_META[ch].label}</td>
									{#each activeCrossFileStreams as cfs}
										{@const s = summarise(extractChannel(cfs.activity.records, ch))}
										<td class="cell-stat">
											{#if s}
												{s.avg.toFixed(1)} / {s.max.toFixed(1)} / {s.min.toFixed(1)}
											{:else}
												—
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/if}
	</div>
	{/if}
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
		color: #3b82f6;
		border-bottom-color: #3b82f6;
	}

	.tab:focus-visible {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
		border-radius: 2px;
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
		overflow: hidden;
	}

	.cards-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.card--meanmax {
		height: 400px;
	}

	@media (max-width: 480px) {
		.card--meanmax {
			height: 280px;
		}
	}

	@media (max-height: 480px) {
		.card--meanmax {
			height: 220px;
		}
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
</style>
