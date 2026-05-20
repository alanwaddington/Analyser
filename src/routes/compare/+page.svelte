<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { activities, activeChannels, xAxisMode } from '$lib/stores/session';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import { deriveAvailableChannels } from '$lib/utils/channels';
	import { buildLapMarkers } from '$lib/utils/lapMarkers';
	import { summarise } from '$lib/analytics/summary';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import type { SeriesInput } from '$lib/components/charts/TimeSeriesChart.utils';
	import TimeSeriesChart from '$lib/components/charts/TimeSeriesChart.svelte';
	import MeanMaxChart from '$lib/components/charts/MeanMaxChart.svelte';
	import ActivityMap from '$lib/components/map/ActivityMap.svelte';
	import ChannelToggleBar from '$lib/components/ui/ChannelToggleBar.svelte';

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

	const availableChannels = $derived(deriveAvailableChannels($activities));
	const seriesInputs: SeriesInput[] = $derived(
		$activities.map((a, i) => ({ activity: a, colourIndex: i })),
	);
	const lapMarkers = $derived(buildLapMarkers($activities[0], $xAxisMode));

	$effect(() => {
		if (availableChannels.length > 0 && $activeChannels.length === 0) {
			activeChannels.set(availableChannels);
		}
	});

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
				<ChannelToggleBar channels={availableChannels} />
			</div>
			<div class="charts-scroll">
				{#if $activeChannels.length === 0}
					<p class="empty">No channels selected.</p>
				{:else}
					{#each $activeChannels as channel (channel)}
						<div class="card">
							<TimeSeriesChart
								{channel}
								{seriesInputs}
								{lapMarkers}
								groupId="compare-charts"
							/>
						</div>
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
					<MeanMaxChart {seriesInputs} />
				</div>
			</div>
		{:else if activeTab === 'summary'}
			<div class="summary-scroll">
				<table class="summary-table">
					<thead>
						<tr>
							<th class="col-channel"></th>
							{#each $activities as activity, i}
								<th class="col-file" style="color: {FILE_COLOURS[i % FILE_COLOURS.length]}">
									{activity.filename}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each availableChannels as ch, rowIdx}
							<tr class:row-alt={rowIdx % 2 === 1}>
								<td class="cell-label">{CHANNEL_META[ch].label}</td>
								{#each $activities as activity}
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

	.col-file {
		font-weight: 600;
		font-size: 0.75rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
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
