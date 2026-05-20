<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';
	import type { ECharts, EChartsOption } from 'echarts';
	import type { Activity, ChannelKey } from '$lib/types';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import { smoothing, xAxisMode } from '$lib/stores/session';
	import { smooth } from '$lib/analytics/smooth';
	import { extractChannel, buildXValues, isDashed, paceFormat } from './TimeSeriesChart.utils.ts';
	import type { SeriesInput } from './TimeSeriesChart.utils.ts';
	import { interpolateToDistanceAxis } from '$lib/align/distance';

	let {
		channel,
		seriesInputs,
		lapMarkers = [],
		referenceIndex = undefined,
		groupId,
	}: {
		channel: ChannelKey;
		seriesInputs: SeriesInput[];
		lapMarkers?: { value: number; label: string }[];
		referenceIndex?: number;
		groupId: string;
	} = $props();

	let container: HTMLDivElement;
	let chart: ECharts | undefined;
	let isDark = $state(false);
	let hiddenSeries = $state(new Set<number>());

	let mq: MediaQueryList | undefined;
	let themeHandler: ((e: MediaQueryListEvent) => void) | undefined;
	let resizeObserver: ResizeObserver | undefined;

	// Theme colour helpers
	const textColour = () => isDark ? '#94a3b8' : '#64748b';
	const gridColour = () => isDark ? '#1e293b' : '#e2e8f0';
	const tooltipBg  = () => isDark ? '#0f172a' : '#ffffff';
	const tooltipText = () => isDark ? '#e2e8f0' : '#0f172a';

	function buildData(activity: Activity): [number, number | null][] {
		if ($xAxisMode === 'distance') {
			const aligned = interpolateToDistanceAxis(activity);
			const channelData = aligned.channels.get(channel) ?? [];
			const smoothed = smooth(channelData, $smoothing);
			return aligned.axis.map((d, i) => [d / 1000, smoothed[i]]);
		}
		const raw = extractChannel(activity.records, channel);
		const smoothed = smooth(raw, $smoothing);
		const xValues = buildXValues(activity.records, $xAxisMode);
		return xValues.map((x, i) => [x, smoothed[i]]);
	}

	function buildOption(): EChartsOption {
		const meta = CHANNEL_META[channel];
		const tc = textColour();
		const gc = gridColour();

		return {
			grid: { top: 20, right: 16, bottom: 30, left: 55 },
			xAxis: {
				type: 'value',
				name: $xAxisMode === 'time' ? 's' : 'km',
				nameTextStyle: { color: tc, fontSize: 10 },
				axisLabel: { color: tc, fontSize: 11 },
				axisLine: { lineStyle: { color: gc } },
				splitLine: { lineStyle: { color: gc } },
			},
			yAxis: {
				type: 'value',
				inverse: channel === 'pace',
				name: meta.unit,
				nameTextStyle: { color: tc },
				axisLabel: {
					color: tc,
					fontSize: 11,
					...(channel === 'pace' ? { formatter: (v: number) => paceFormat(v) } : {}),
				},
				splitLine: { lineStyle: { color: gc } },
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'cross', lineStyle: { color: '#64748b' } },
				backgroundColor: tooltipBg(),
				borderColor: gc,
				textStyle: { color: tooltipText(), fontSize: 12 },
				...(channel === 'pace' ? { valueFormatter: (v: unknown) => typeof v === 'number' ? paceFormat(v) + ' /km' : '—' } : {}),
			},
			dataZoom: [{ type: 'inside' }],
			series: seriesInputs.map((s, i) => {
				const colour = FILE_COLOURS[s.colourIndex % FILE_COLOURS.length];
				const dashed = isDashed(i, referenceIndex);
				return {
					type: 'line' as const,
					name: s.activity.filename,
					data: hiddenSeries.has(i) ? [] : buildData(s.activity),
					lineStyle: {
						color: colour,
						type: dashed ? ([6, 3] as unknown as 'dashed') : 'solid',
						width: 1.5,
					},
					itemStyle: { color: colour },
					symbol: 'none',
					showSymbol: false,
					...(i === 0 && lapMarkers.length > 0 ? {
						markLine: {
							silent: true,
							symbol: ['none', 'none'],
							data: lapMarkers.map(m => ({
								xAxis: m.value,
								label: { formatter: m.label, fontSize: 10, color: tc },
							})),
							lineStyle: { type: 'dashed' as const, color: gc, width: 1 },
						},
					} : {}),
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
		chart.group = groupId;
		echarts.connect(groupId);

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
		void $smoothing;
		void $xAxisMode;
		void seriesInputs;
		void referenceIndex;
		chart?.setOption(buildOption(), { notMerge: true });
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<span class="chart-title">
			{CHANNEL_META[channel].label}
			<span class="chart-unit">({CHANNEL_META[channel].unit})</span>
		</span>
	</div>

	<div bind:this={container} class="chart-canvas"></div>

	<div class="chart-legend" role="group" aria-label="Series visibility toggles">
		{#each seriesInputs as s, i}
			{@const colour = FILE_COLOURS[s.colourIndex % FILE_COLOURS.length]}
			{@const dashed = isDashed(i, referenceIndex)}
			<button
				class="legend-btn"
				class:series-hidden={hiddenSeries.has(i)}
				onclick={() => toggleSeries(i)}
				aria-pressed={!hiddenSeries.has(i)}
				aria-label="{hiddenSeries.has(i) ? 'Show' : 'Hide'} {s.activity.filename}"
			>
				<svg width="24" height="10" aria-hidden="true" focusable="false">
					{#if dashed}
						<line x1="0" y1="5" x2="24" y2="5"
							stroke={colour} stroke-width="2" stroke-dasharray="6 3" />
					{:else}
						<line x1="0" y1="5" x2="24" y2="5"
							stroke={colour} stroke-width="2" />
					{/if}
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

	.chart-unit {
		font-weight: 400;
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.chart-canvas {
		height: 180px;
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
