<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';
	import type { ECharts, EChartsOption } from 'echarts';
	import { FILE_COLOURS } from '$lib/types';
	import { xAxisMode } from '$lib/stores/session';
	import { isDark } from '$lib/stores/theme';
	import { getClipDistance, buildZeroLine, buildDeltaData } from './DeltaChart.utils.ts';
	import type { DeltaSeriesInput } from './DeltaChart.utils.ts';
	import { downloadPng } from '$lib/export/download';
	import './png-btn.css';

	let {
		seriesInputs,
		referenceIndex = 0,
		groupId,
	}: {
		seriesInputs: DeltaSeriesInput[];
		referenceIndex?: number;
		groupId: string;
	} = $props();

	let container: HTMLDivElement;
	let chart: ECharts | undefined;
	let hiddenSeries = $state(new Set<number>());

	let resizeObserver: ResizeObserver | undefined;

	const textColour = () => $isDark ? '#94a3b8' : '#64748b';
	const gridColour = () => $isDark ? '#1e293b' : '#e2e8f0';
	const tooltipBg  = () => $isDark ? '#0f172a' : '#ffffff';
	const tooltipText = () => $isDark ? '#e2e8f0' : '#0f172a';

	function buildOption(): EChartsOption {
		const tc = textColour();
		const gc = gridColour();
		const allActivities = seriesInputs.map(s => s.activity);
		const maxDist = allActivities.length > 0 ? getClipDistance(allActivities) : 0;
		const ref = seriesInputs[referenceIndex]?.activity;

		const candidateSeries = seriesInputs
			.map((s, i) => {
				if (i === referenceIndex) return null;
				const colour = FILE_COLOURS[s.colourIndex % FILE_COLOURS.length];
				const data = hiddenSeries.has(i) ? [] : buildDeltaData(ref, s.activity, maxDist, $xAxisMode);
				return {
					type: 'line' as const,
					name: s.activity.filename,
					data,
					lineStyle: { color: colour, type: 'solid' as const, width: 1.5 },
					itemStyle: { color: colour },
					symbol: 'none',
					showSymbol: false,
					areaStyle: {
						color: colour,
						opacity: 0.08,
					},
				};
			})
			.filter((s): s is NonNullable<typeof s> => s !== null);

		const zeroLine = {
			type: 'line' as const,
			name: '__zero__',
			data: maxDist > 0 ? buildZeroLine(maxDist, $xAxisMode) : [],
			lineStyle: { color: gc, type: 'dashed' as const, width: 1 },
			itemStyle: { color: gc },
			symbol: 'none',
			showSymbol: false,
			silent: true,
			legendHoverLink: false,
		};

		const xAxisName = $xAxisMode === 'distance' ? 'km' : 'm';

		return {
			grid: { top: 20, right: 16, bottom: 30, left: 55 },
			xAxis: {
				type: 'value',
				name: xAxisName,
				nameTextStyle: { color: tc, fontSize: 10 },
				axisLabel: { color: tc, fontSize: 11 },
				axisLine: { lineStyle: { color: gc } },
				splitLine: { lineStyle: { color: gc } },
			},
			yAxis: {
				type: 'value',
				name: 's',
				nameTextStyle: { color: tc },
				axisLabel: { color: tc, fontSize: 11 },
				splitLine: { lineStyle: { color: gc } },
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'cross', lineStyle: { color: '#64748b' } },
				backgroundColor: tooltipBg(),
				borderColor: gc,
				textStyle: { color: tooltipText(), fontSize: 12 },
				formatter: (params: unknown) => {
					const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
					const items = params as { seriesName: string; value: [number, number] }[];
					const visible = items.filter(p => p.seriesName !== '__zero__');
					if (visible.length === 0) return '';
					const x = visible[0].value[0];
					const xLabel = $xAxisMode === 'distance' ? `${x.toFixed(2)} km` : `${x.toFixed(0)} m`;
					const lines = visible.map(p => {
						const delta = p.value[1];
						const sign = delta >= 0 ? '+' : '';
						return `<div>${esc(p.seriesName)}: <b>${sign}${delta.toFixed(1)}s</b></div>`;
					});
					return `<div style="font-size:12px"><div style="margin-bottom:4px">${xLabel}</div>${lines.join('')}</div>`;
				},
			},
			dataZoom: [{ type: 'inside' }],
			series: [...candidateSeries, zeroLine],
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

	onMount(() => {
		chart = echarts.init(container, undefined, { renderer: 'canvas' });
		chart.group = groupId;
		echarts.connect(groupId);

		resizeObserver = new ResizeObserver(() => chart?.resize());
		resizeObserver.observe(container);
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
		const date = new Date().toISOString().slice(0, 10);
		downloadPng(url, `time-delta-${date}.png`);
	}

	$effect(() => {
		void $isDark;
		void $xAxisMode;
		void seriesInputs;
		void referenceIndex;
		chart?.setOption(buildOption(), { notMerge: true });
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<span class="chart-header-left">
			<span class="chart-title">Time Delta vs Reference</span>
			{#if seriesInputs[referenceIndex]}
				<span class="chart-subtitle">{seriesInputs[referenceIndex].activity.filename}</span>
			{/if}
		</span>
		<button
			class="png-btn"
			onclick={handlePngDownload}
			aria-label="Download time delta chart as PNG"
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

	<div bind:this={container} class="chart-canvas"></div>

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
					<svg width="24" height="10" aria-hidden="true" focusable="false">
						<line x1="0" y1="5" x2="24" y2="5" stroke={colour} stroke-width="2" />
					</svg>
					<span class="legend-label">{s.activity.filename}</span>
				</button>
			{/if}
		{/each}
	</div>
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

	.chart-header-left {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	.chart-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #22c55e;
	}

	.chart-subtitle {
		font-size: 0.75rem;
		color: var(--color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chart-canvas {
		height: 160px;
		width: 100%;
		display: block;
	}

	/* breakpoints: --bp-phone (480px) in layout.css */
	@media (max-width: 480px) { /* --bp-phone */
		.chart-canvas {
			height: 120px;
		}
	}

	@media (max-height: 480px) { /* landscape phone */
		.chart-canvas {
			height: 90px;
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
</style>
