<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';
	import { loadECharts, type EChartsModule } from './echarts-loader';
	import { FILE_COLOURS } from '$lib/types';
	import type { AthleteProfile } from '$lib/types';
	import { buildMeanMaxData, formatDuration } from './MeanMaxChart.utils.ts';
	import { isDark } from '$lib/stores/theme';
	import type { MeanMaxSeriesInput } from './MeanMaxChart.utils.ts';
	import { downloadPng, localDateString } from '$lib/export/download';
	import './png-btn.css';
	import './chart-skeleton.css';

	let {
		seriesInputs,
		athleteProfile = {},
		sport = '',
	}: {
		seriesInputs: MeanMaxSeriesInput[];
		athleteProfile?: AthleteProfile;
		sport?: string;
	} = $props();

	let container: HTMLDivElement;
	let ec: EChartsModule | undefined;
	let chart = $state<ECharts | undefined>(undefined);
	let ready = $state(false);
	let hiddenSeries = $state(new Set<number>());

	let seriesData = $derived(seriesInputs.map(s => buildMeanMaxData(s.activity.records)));

	let resizeObserver: ResizeObserver | undefined;

	const textColour = () => $isDark ? '#94a3b8' : '#64748b';
	const gridColour = () => $isDark ? '#1e293b' : '#e2e8f0';
	const tooltipBg  = () => $isDark ? '#0f172a' : '#ffffff';
	const tooltipText = () => $isDark ? '#e2e8f0' : '#0f172a';

	function buildOption(): EChartsOption {
		const tc = textColour();
		const gc = gridColour();
		const refColour = $isDark ? '#64748b' : '#94a3b8';

		const showWkg = athleteProfile.weight != null && athleteProfile.weight > 0;
		const weight = athleteProfile.weight ?? 1;

		// Reference line: FTP for cycling, CP for running
		const isCycling = sport !== 'running';
		const refValue = isCycling ? athleteProfile.ftp : athleteProfile.cp;
		const refLabel = isCycling ? 'FTP' : 'CP';

		// Find first visible series index for markLine attachment
		const firstVisible = seriesInputs.findIndex((_, i) => !hiddenSeries.has(i));

		const yAxes: EChartsOption['yAxis'] = [
			{
				type: 'value',
				name: 'W',
				nameTextStyle: { color: tc },
				axisLabel: { color: tc, fontSize: 11 },
				splitLine: { lineStyle: { color: gc } },
			},
		];

		if (showWkg) {
			(yAxes as object[]).push({
				type: 'value',
				position: 'right',
				name: 'w/kg',
				nameTextStyle: { fontSize: 9, color: refColour },
				nameLocation: 'end',
				axisLabel: {
					color: refColour,
					fontSize: 10,
					formatter: (v: number) => (v / weight).toFixed(1),
				},
				axisLine: { show: false },
				splitLine: { show: false },
				axisTick: { show: false },
			});
		}

		return {
			grid: { top: 20, right: showWkg ? 52 : 16, bottom: 30, left: 55 },
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
			yAxis: yAxes,
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
				const colour = s.colour ?? FILE_COLOURS[s.colourIndex % FILE_COLOURS.length];
				const name = s.label ?? s.activity.filename;

				const markLine = (i === firstVisible && refValue != null)
					? {
						silent: true,
						symbol: ['none', 'none'],
						lineStyle: { type: 'dashed' as const, color: refColour, width: 1, opacity: 0.7 },
						label: {
							position: 'insideEndTop' as const,
							formatter: refLabel,
							fontSize: 10,
							color: refColour,
							distance: 4,
						},
						data: [{ yAxis: refValue }],
					}
					: undefined;

				return {
					type: 'line' as const,
					name,
					data: hiddenSeries.has(i) ? [] : seriesData[i],
					lineStyle: { color: colour, type: 'solid' as const, width: 1.5 },
					itemStyle: { color: colour },
					symbol: 'none',
					showSymbol: false,
					...(markLine ? { markLine } : {}),
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
		downloadPng(url, `mean-max-${date}.png`);
	}

	$effect(() => {
		void $isDark;
		void seriesInputs;
		void athleteProfile;
		void sport;
		chart?.setOption(buildOption(), { notMerge: true });
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<span class="chart-title">Mean/Max Power</span>
		<button
			class="png-btn"
			onclick={handlePngDownload}
			aria-label="Download mean/max chart as PNG"
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
			{@const colour = s.colour ?? FILE_COLOURS[s.colourIndex % FILE_COLOURS.length]}
			{@const name = s.label ?? s.activity.filename}
			<button
				class="legend-btn"
				class:series-hidden={hiddenSeries.has(i)}
				onclick={() => toggleSeries(i)}
				aria-pressed={!hiddenSeries.has(i)}
				aria-label="{hiddenSeries.has(i) ? 'Show' : 'Hide'} {name}"
			>
				<svg width="24" height="10" aria-hidden="true" focusable="false">
					<line x1="0" y1="5" x2="24" y2="5" stroke={colour} stroke-width="2" />
				</svg>
				<span class="legend-label">{name}</span>
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
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



	/* breakpoints: --bp-phone (480px) in layout.css */
	@media (max-width: 480px) { /* --bp-phone */
		.chart-canvas {
			height: 200px;
		}
	}

	@media (max-height: 480px) { /* landscape phone */
		.chart-canvas {
			height: 150px;
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
