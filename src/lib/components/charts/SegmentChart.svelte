<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';
	import type { ECharts, EChartsOption } from 'echarts';
	import { FILE_COLOURS } from '$lib/types';
	import { computeSegmentDeltas } from './SegmentChart.utils.ts';
	import type { SegmentSeriesInput, Segment } from './SegmentChart.utils.ts';

	let {
		seriesInputs,
		referenceIndex,
		segments,
	}: {
		seriesInputs: SegmentSeriesInput[];
		referenceIndex: number;
		segments: Segment[];
	} = $props();

	let container: HTMLDivElement;
	let chart: ECharts | undefined;
	let isDark = $state(false);
	let hiddenSeries = $state(new Set<number>());

	const refActivity = $derived(seriesInputs[referenceIndex]?.activity);

	const seriesDeltas = $derived(
		seriesInputs.map((s, i) => {
			if (i === referenceIndex || !refActivity) return null;
			return computeSegmentDeltas(refActivity, s.activity, segments);
		}),
	);

	let mq: MediaQueryList | undefined;
	let themeHandler: ((e: MediaQueryListEvent) => void) | undefined;
	let resizeObserver: ResizeObserver | undefined;

	const textColour = () => (isDark ? '#94a3b8' : '#64748b');
	const gridColour = () => (isDark ? '#1e293b' : '#e2e8f0');
	const tooltipBg = () => (isDark ? '#0f172a' : '#ffffff');
	const tooltipText = () => (isDark ? '#e2e8f0' : '#0f172a');
	const fasterColour = () => (isDark ? '#166534' : '#bbf7d0');
	const slowerColour = () => (isDark ? '#991b1b' : '#fecaca');

	function buildOption(): EChartsOption {
		const tc = textColour();
		const gc = gridColour();
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
						: deltas.map(d => ({
								value: d.delta,
								itemStyle: {
									color: d.delta >= 0 ? fasterColour() : slowerColour(),
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
				name: 's',
				nameTextStyle: { color: tc },
				axisLabel: { color: tc, fontSize: 11 },
				splitLine: { lineStyle: { color: gc } },
				axisLine: { lineStyle: { color: gc } },
			},
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'shadow' },
				backgroundColor: tooltipBg(),
				borderColor: gc,
				textStyle: { color: tooltipText(), fontSize: 12 },
				formatter: (params: unknown) => {
					const esc = (str: string) =>
						str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
					const items = params as { seriesName: string; value: number; name: string }[];
					if (items.length === 0) return '';
					const segLabel = items[0].name;
					const lines = items.map(p => {
						const sign = p.value >= 0 ? '+' : '';
						return `<div>${esc(p.seriesName)}: <b>${sign}${p.value.toFixed(1)}s</b></div>`;
					});
					return `<div style="font-size:12px"><div style="margin-bottom:4px">${esc(segLabel)}</div>${lines.join('')}</div>`;
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
		void referenceIndex;
		void segments;
		chart?.setOption(buildOption(), { notMerge: true });
	});
</script>

<div class="chart-card">
	<div class="chart-header">
		<span class="chart-title">Segment Times</span>
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
					<svg width="16" height="10" aria-hidden="true" focusable="false">
						<rect width="16" height="10" rx="2" fill={colour} />
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
