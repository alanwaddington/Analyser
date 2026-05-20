<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';
	import type { ECharts, EChartsOption } from 'echarts';
	import { FILE_COLOURS } from '$lib/types';
	import { buildMeanMaxData, formatDuration } from './MeanMaxChart.utils.ts';
	import type { MeanMaxSeriesInput } from './MeanMaxChart.utils.ts';

	let {
		seriesInputs,
	}: {
		seriesInputs: MeanMaxSeriesInput[];
	} = $props();

	let container: HTMLDivElement;
	let chart = $state<ECharts | undefined>(undefined);
	let isDark = $state(false);
	let hiddenSeries = $state(new Set<number>());

	let seriesData = $derived(seriesInputs.map(s => buildMeanMaxData(s.activity.records)));

	let mq: MediaQueryList | undefined;
	let themeHandler: ((e: MediaQueryListEvent) => void) | undefined;
	let resizeObserver: ResizeObserver | undefined;

	const textColour = () => isDark ? '#94a3b8' : '#64748b';
	const gridColour = () => isDark ? '#1e293b' : '#e2e8f0';
	const tooltipBg  = () => isDark ? '#0f172a' : '#ffffff';
	const tooltipText = () => isDark ? '#e2e8f0' : '#0f172a';

	function buildOption(): EChartsOption {
		const tc = textColour();
		const gc = gridColour();

		return {
			grid: { top: 20, right: 16, bottom: 30, left: 55 },
			xAxis: {
				type: 'log',
				name: 's',
				nameTextStyle: { color: tc, fontSize: 10 },
				axisLabel: {
					color: tc,
					fontSize: 11,
					formatter: (val: number) => formatDuration(val),
				},
				axisLine: { lineStyle: { color: gc } },
				splitLine: { lineStyle: { color: gc } },
			},
			yAxis: {
				type: 'value',
				name: 'W',
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
					if (items.length === 0) return '';
					const dur = formatDuration(Math.round(items[0].value[0]));
					const lines = items.map(p =>
						`<div>${esc(p.seriesName)}: <b>${p.value[1].toFixed(0)} W</b></div>`,
					);
					return `<div style="font-size:12px"><div style="margin-bottom:4px">${dur}</div>${lines.join('')}</div>`;
				},
			},
			dataZoom: [{ type: 'inside' }],
			series: seriesInputs.map((s, i) => {
				const colour = FILE_COLOURS[s.colourIndex % FILE_COLOURS.length];
				return {
					type: 'line' as const,
					name: s.activity.filename,
					data: hiddenSeries.has(i) ? [] : seriesData[i],
					lineStyle: { color: colour, type: 'solid' as const, width: 1.5 },
					itemStyle: { color: colour },
					symbol: 'none',
					showSymbol: false,
				};
			}),
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
		isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

		chart = echarts.init(container, undefined, { renderer: 'canvas' });

		mq = window.matchMedia('(prefers-color-scheme: dark)');
		themeHandler = (e: MediaQueryListEvent) => {
			isDark = e.matches;
			chart?.setOption(buildOption(), { notMerge: true });
		};
		mq.addEventListener('change', themeHandler);

		resizeObserver = new ResizeObserver(() => chart?.resize());
		resizeObserver.observe(container);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		if (mq && themeHandler) mq.removeEventListener('change', themeHandler);
		chart?.dispose();
	});

	$effect(() => {
		void seriesInputs;
		chart?.setOption(buildOption(), { notMerge: true });
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<span class="chart-title">Mean/Max Power</span>
	</div>

	<div bind:this={container} class="chart-canvas"></div>

	<div class="chart-legend" role="group" aria-label="Series visibility toggles">
		{#each seriesInputs as s, i}
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
		{/each}
	</div>
</div>

<style>
	.chart-card {
		background: var(--color-card);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.chart-header {
		padding: 10px 16px 0;
	}

	.chart-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.chart-canvas {
		height: 280px;
		width: 100%;
		display: block;
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

	@media (prefers-color-scheme: light) {
		.legend-btn:hover {
			background: rgba(0, 0, 0, 0.04);
		}
	}

	.legend-btn:focus-visible {
		outline: 2px solid #3b82f6;
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
