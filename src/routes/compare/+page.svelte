<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { activities, activeDeviceIndices, xAxisMode } from '$lib/stores/session';
	import { CHANNEL_META, DEVICE_COLOURS } from '$lib/types';
	import type { ChannelKey } from '$lib/types';
	import { buildLapMarkers } from '$lib/utils/lapMarkers';
	import { summarise } from '$lib/analytics/summary';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import type { SeriesInput } from '$lib/components/charts/TimeSeriesChart.utils';
	import TimeSeriesChart from '$lib/components/charts/TimeSeriesChart.svelte';
	import MeanMaxChart from '$lib/components/charts/MeanMaxChart.svelte';
	import ActivityMap from '$lib/components/map/ActivityMap.svelte';
	import DeviceToggleBar from '$lib/components/ui/DeviceToggleBar.svelte';
	import { getActiveStreamsForChannel } from '$lib/utils/deviceChannels';
	import { deriveDeviceLabel } from '$lib/utils/deviceChannels';

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

	// The single loaded activity (device comparison is single-file)
	const activity = $derived($activities[0]);
	const deviceStreams = $derived(activity?.deviceStreams ?? []);
	const lapMarkers = $derived(buildLapMarkers(activity, $xAxisMode));

	// Derive which channels have at least one active device
	const activeChannels = $derived<ChannelKey[]>(() => {
		if (!activity || $activeDeviceIndices.size === 0) return [];
		const channels = new Set<ChannelKey>();
		for (const stream of deviceStreams) {
			if ($activeDeviceIndices.has(stream.device.deviceIndex)) {
				stream.channels.forEach(ch => channels.add(ch));
			}
		}
		return Array.from(channels);
	});

	// Build series inputs for a given channel: one per active device that claims it
	function buildSeriesForChannel(channel: ChannelKey): SeriesInput[] {
		if (!activity) return [];
		const activeStreams = getActiveStreamsForChannel(
			deviceStreams,
			channel,
			$activeDeviceIndices
		);
		return activeStreams.map((stream, i) => ({
			activity,
			colourIndex: i,
			label: deriveDeviceLabel(stream.device),
		}));
	}

	// Series inputs for mean/max (all active device streams, de-duped to the activity)
	const meanMaxSeriesInputs: SeriesInput[] = $derived(
		activity ? [{ activity, colourIndex: 0 }] : []
	);

	// Summary: devices that have at least one active channel
	const summaryDevices = $derived(
		deviceStreams.filter(s => $activeDeviceIndices.has(s.device.deviceIndex))
	);

	$effect(() => {
		if ($activities.length === 0) goto('/');
	});
</script>

<div class="page">
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
		{#if activeTab === 'charts'}
			<div class="toolbar">
				<DeviceToggleBar {deviceStreams} />
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
			<div class="charts-scroll">
				{#if $activeDeviceIndices.size === 0}
					<p class="empty">Toggle a device above to see its data.</p>
				{:else if activeChannels().length === 0}
					<p class="empty">No data available for the selected devices.</p>
				{:else}
					{#each activeChannels() as channel (channel)}
						{@const seriesInputs = buildSeriesForChannel(channel)}
						{#if seriesInputs.length > 0}
							<div class="card">
								<TimeSeriesChart
									{channel}
									{seriesInputs}
									{lapMarkers}
									groupId="compare-charts"
								/>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		{:else if activeTab === 'map'}
			<div class="map-wrap">
				<ActivityMap activities={$activities} hoveredDistance={null} />
			</div>
		{:else if activeTab === 'meanmax'}
			<div class="cards-scroll">
				<div class="card card--meanmax">
					<MeanMaxChart seriesInputs={meanMaxSeriesInputs} />
				</div>
			</div>
		{:else if activeTab === 'summary'}
			<div class="summary-scroll">
				{#if summaryDevices.length === 0}
					<p class="empty">Toggle devices above to see their statistics.</p>
				{:else}
					<table class="summary-table">
						<thead>
							<tr>
								<th class="col-channel"></th>
								{#each summaryDevices as stream, i}
									<th class="col-device">
										<span class="device-dot" style="background:{DEVICE_COLOURS[i % DEVICE_COLOURS.length]}"></span>
										{deriveDeviceLabel(stream.device)}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each activeChannels() as ch, rowIdx}
								<tr class:row-alt={rowIdx % 2 === 1}>
									<td class="cell-label">{CHANNEL_META[ch].label}</td>
									{#each summaryDevices as stream}
										{@const s = summarise(extractChannel(activity.records, ch))}
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

	.summary-scroll {
		flex: 1;
		overflow: auto;
		padding: 16px;
	}

	.summary-table {
		width: 100%;
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.device-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
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
</style>
