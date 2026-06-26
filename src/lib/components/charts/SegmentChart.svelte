<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';
	import { loadECharts, type EChartsModule } from './echarts-loader';
	import { FILE_COLOURS } from '$lib/types';
	import type { AthleteProfile } from '$lib/types';
	import { computeSegmentDeltas } from './SegmentChart.utils.ts';
	import { isDark } from '$lib/stores/theme';
	import type { SegmentSeriesInput, Segment } from './SegmentChart.utils.ts';
	import { downloadPng, localDateString } from '$lib/export/download';
	import { computeSegmentStats } from '$lib/analytics/segmentStats';
	import './png-btn.css';
	import './chart-skeleton.css';

	let {
		seriesInputs,
		referenceIndex,
		segments,
		athleteProfile = {} as AthleteProfile,
		sport = '',
	}: {
		seriesInputs: SegmentSeriesInput[];
		referenceIndex: number;
		segments: Segment[];
		athleteProfile?: AthleteProfile;
		sport?: string;
	} = $props();

	let container: HTMLDivElement;
	let ec: EChartsModule | undefined;
	let chart: ECharts | undefined;
	let ready = $state(false);
	let hiddenSeries = $state(new Set<number>());

	const refActivity = $derived(seriesInputs[referenceIndex]?.activity);

	const seriesDeltas = $derived(
		seriesInputs.map((s, i) => {
			if (i === referenceIndex || !refActivity) return null;
			return computeSegmentDeltas(refActivity, s.activity, segments);
		}),
	);

	const segmentStats = $derived(
		segments.map(seg => refActivity
			? computeSegmentStats(refActivity, seg, athleteProfile)
			: null,
		),
	);

	let resizeObserver: ResizeObserver | undefined;

	const textColour = () => ($isDark ? '#94a3b8' : '#64748b');
	const gridColour = () => ($isDark ? '#1e293b' : '#e2e8f0');
	const tooltipBg = () => ($isDark ? '#0f172a' : '#ffffff');
	const tooltipText = () => ($isDark ? '#e2e8f0' : '#0f172a');
	const fasterColour = () => ($isDark ? '#166534' : '#bbf7d0');
	const slowerColour = () => ($isDark ? '#991b1b' : '#fecaca');

	function fmtPace(minPerKm: number | null): string {
		if (minPerKm === null) return '—';
		const totalSec = minPerKm * 60;
		const m = Math.floor(totalSec / 60);
		const s = Math.round(totalSec % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function fmtTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.round(seconds % 60);
		return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
	}

	function buildOption(): EChartsOption {
		const tc = textColour();
		const gc = gridColour();
		const tb = tooltipBg();
		const tt = tooltipText();
		const labels = segments.map(s => s.label);
		const rotate = segments.length > 6 ? 30 : 0;

		const series = seriesInputs
			.map((s, i) => {
				if (i === referenceIndex) return null;
				const deltas = seriesDeltas[i];
				if (!deltas) return null;
				return {
					type: 'bar' as const,
					name: s.activity.filename,
					data: hiddenSeries.has(i)
						? []
						: deltas.map((d, segIdx) => ({
								value: d.delta,
								itemStyle: {
									color: d.delta >= 0 ? fasterColour() : slowerColour(),
									// custom segments get a dashed purple border
									...(segments[segIdx]?.custom
										? { borderColor: '#8b5cf6', borderWidth: 2, borderType: 'dashed' as const }
										: {}),
								},
							})),
					itemStyle: { color: FILE_COLOURS[s.colourIndex % FILE_COLOURS.length] },
				};
			})
			.filter((s): s is NonNullable<typeof s> => s !== null);

		return {
			grid: { top: 20, right: 16, bottom: rotate > 0 ? 60 : 36, left: 55 },
			xAxis: {
				type: 'category',
				data: labels,
				axisLabel: {
					color: tc,
					fontSize: 11,
					rotate,
					interval: 0,
				},
				axisLine: { lineStyle: { color: gc } },
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				name: 'Δ (s)',
				nameTextStyle: { color: tc },
				axisLabel: { color: tc, fontSize: 11 },
				splitLine: { lineStyle: { color: gc } },
				axisLine: { lineStyle: { color: gc } },
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				backgroundColor: tb,
				borderColor: gc,
				textStyle: { color: tt, fontSize: 12 },
				formatter: (params: unknown) => {
					const esc = (str: string) =>
						str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
					const items = params as { seriesName: string; value: number; name: string; dataIndex: number }[];
					if (items.length === 0) return '';
					const segIdx = items[0].dataIndex;
					const segLabel = items[0].name;
					const isCustom = segments[segIdx]?.custom;
					const stats = segmentStats[segIdx];

					const deltaLines = items.map(p => {
						const sign = p.value >= 0 ? '+' : '';
						return `<div>${esc(p.seriesName)}: <b>${sign}${p.value.toFixed(1)}s</b></div>`;
					});

					let statsHtml = '';
					if (stats) {
						const parts: string[] = [];
						if (stats.time > 0) parts.push(`Time: ${fmtTime(stats.time)}`);
						if (stats.avgPace !== null) parts.push(`Pace: ${fmtPace(stats.avgPace)}/km`);
						if (stats.avgPower !== null) parts.push(`${stats.powerLabel}: ${Math.round(stats.avgPower)}W avg / ${stats.maxPower}W max`);
						if (stats.powerPct !== null) parts.push(`${stats.powerPct}% threshold`);
						if (stats.avgHR !== null) parts.push(`Avg HR: ${Math.round(stats.avgHR)} bpm`);
						if (parts.length > 0) {
							statsHtml = `<div style="margin-top:5px;padding-top:5px;border-top:1px solid ${gc};font-size:11px;color:${tc}">${parts.map(p => `<div>${p}</div>`).join('')}</div>`;
						}
					}

					const customBadge = isCustom ? `<span style="margin-left:4px;font-size:10px;color:#8b5cf6">✦ custom</span>` : '';
					return `<div style="font-size:12px"><div style="margin-bottom:4px">${esc(segLabel)}${customBadge}</div>${deltaLines.join('')}${statsHtml}</div>`;
				},
			},
			series,
		};
	}

	function toggleSeries(i: number) {
		hiddenSeries = new Set(hiddenSeries);
		if (hiddenSeries.has(i)) {
			hiddenSeries.delete(i);
		} else {
			hiddenSeries.add(i);
		}
		chart?.setOption(buildOption(), { notMerge: true });
	}

	onMount(async () => {
		ec = await loadECharts();
		chart = ec.init(container, undefined, { renderer: 'canvas' });
		chart.setOption(buildOption(), { notMerge: true });

		resizeObserver = new ResizeObserver(() => chart?.resize());
		resizeObserver.observe(container);
		ready = true;
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		chart?.dispose();
	});

	/** Exposed for parent access via bind:this; also used by the inline PNG button. */
	export function getChartDataURL(): string | null {
		return chart?.getDataURL({
			type: 'png',
			pixelRatio: 2,
			backgroundColor: $isDark ? '#0f172a' : '#ffffff',
		}) ?? null;
	}

	function handlePngDownload() {
		const url = getChartDataURL();
		if (!url) return;
		const date = localDateString();
		downloadPng(url, `segments-${date}.png`);
	}

	$effect(() => {
		void $isDark;
		void seriesInputs;
		void referenceIndex;
		void segments;
		void athleteProfile;
		chart?.setOption(buildOption(), { notMerge: true });
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<span class="chart-title">Segment Times</span>
		<button
			class="png-btn"
			onclick={handlePngDownload}
			aria-label="Download segments chart as PNG"
			title="Download as PNG"
			type="button"
		>
			<svg width="11" height="11" viewBox="0 0 11 11" fill="none"
				aria-hidden="true" focusable="false">
				<path d="M5.5 1v6M2.5 4.5l3 3 3-3M1 9.5h9"
					stroke="currentColor" stroke-width="1.4"
					stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<span class="png-btn-label">PNG</span>
		</button>
	</div>

	{#if !ready}
		<div class="chart-canvas chart-skeleton" aria-hidden="true"></div>
	{/if}
	<div bind:this={container} class="chart-canvas" style:visibility={ready ? 'visible' : 'hidden'}></div>

	<div class="chart-legend" role="group" aria-label="Series visibility toggles">
		{#each seriesInputs as s, i}
			{#if i !== referenceIndex}
				{@const colour = FILE_COLOURS[s.colourIndex % FILE_COLOURS.length]}
				<button
					class="legend-btn"
					class:series-hidden={hiddenSeries.has(i)}
					onclick={() => toggleSeries(i)}
					aria-pressed={!hiddenSeries.has(i)}
					aria-label="{hiddenSeries.has(i) ? 'Show' : 'Hide'} {s.activity.filename}"
				>
					<svg width="16" height="10" aria-hidden="true" focusable="false">
						<rect width="16" height="10" rx="2" fill={colour} />
					</svg>
					<span class="legend-label">{s.activity.filename}</span>
				</button>
			{/if}
		{/each}
	</div>

	{#if refActivity && segments.length > 0}
		<div class="seg-stats-table-wrap">
			<table class="seg-stats-table" aria-label="Per-segment reference stats">
				<thead>
					<tr>
						<th class="col-seg">Segment</th>
						<th class="col-num">Time</th>
						<th class="col-num">Pace</th>
						{#if segmentStats.some(s => s?.avgPower != null)}
							<th class="col-num">Power (avg / max)</th>
						{/if}
						{#if segmentStats.some(s => s?.avgHR != null)}
							<th class="col-num">Avg HR</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each segments as seg, i}
						{@const st = segmentStats[i]}
						<tr class:seg-custom={seg.custom}>
							<td class="cell-seg">
								{seg.label}
								{#if seg.custom}<span class="custom-badge">✦</span>{/if}
							</td>
							<td class="cell-num">{st && st.time > 0 ? fmtTime(st.time) : '—'}</td>
							<td class="cell-num">{st ? fmtPace(st.avgPace) + (st.avgPace !== null ? '/km' : '') : '—'}</td>
							{#if segmentStats.some(s => s?.avgPower != null)}
								<td class="cell-num">
									{#if st?.avgPower != null}
										{Math.round(st.avgPower)}W / {st.maxPower}W
										{#if st.powerPct !== null}<span class="cell-sub">{st.powerPct}%</span>{/if}
									{:else}
										—
									{/if}
								</td>
							{/if}
							{#if segmentStats.some(s => s?.avgHR != null)}
								<td class="cell-num">
									{st?.avgHR != null ? Math.round(st.avgHR) + ' bpm' : '—'}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.chart-card {
		background: var(--color-card);
		border: 1px solid rgba(34, 197, 94, 0.27);
		border-radius: 8px;
		overflow: hidden;
	}

	.chart-header {
		padding: 10px 16px 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.chart-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #22c55e;
	}

	.chart-canvas {
		height: 260px;
		width: 100%;
		display: block;
	}



	/* breakpoints: --bp-phone (480px) in layout.css */
	@media (max-width: 480px) { /* --bp-phone */
		.chart-canvas {
			height: 180px;
		}
	}

	@media (max-height: 480px) { /* landscape phone */
		.chart-canvas {
			height: 140px;
		}
	}

	.chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 8px 16px 10px;
		border-top: 1px solid var(--color-border);
	}

	.legend-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 8px 3px 6px;
		background: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: opacity 0.15s, background-color 0.15s;
		opacity: 1;
	}

	.legend-btn:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	:global([data-theme="light"]) .legend-btn:hover {
		background: rgba(0, 0, 0, 0.04);
	}

	.legend-btn:focus-visible {
		outline: 2px solid #22c55e;
		outline-offset: 2px;
	}

	.legend-btn.series-hidden {
		opacity: 0.4;
	}

	.legend-label {
		font-size: 0.75rem;
		color: var(--color-muted);
		white-space: nowrap;
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Per-segment stats table */
	.seg-stats-table-wrap {
		overflow-x: auto;
		border-top: 1px solid var(--color-border);
		padding: 0;
	}

	.seg-stats-table {
		width: max-content;
		min-width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.seg-stats-table th {
		padding: 5px 10px;
		text-align: right;
		font-weight: 600;
		font-size: 0.68rem;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
		background: var(--color-card);
	}

	.seg-stats-table td {
		padding: 4px 10px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
	}

	.col-seg { text-align: left; }
	.col-num { text-align: right; min-width: 80px; }
	.cell-seg {
		text-align: left;
		color: var(--color-text);
		white-space: nowrap;
		font-weight: 500;
	}
	.cell-num {
		text-align: right;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		font-family: ui-monospace, 'Cascadia Code', monospace;
	}
	.cell-sub {
		display: block;
		font-size: 0.65rem;
		color: var(--color-muted);
	}

	.seg-custom .cell-seg {
		color: #8b5cf6;
	}

	.custom-badge {
		font-size: 0.6rem;
		color: #8b5cf6;
		margin-left: 3px;
		vertical-align: middle;
	}
</style>
