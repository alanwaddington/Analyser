<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as echarts from 'echarts';
	import type { ECharts, EChartsOption } from 'echarts';
	import type { Activity, ChannelKey } from '$lib/types';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import { smoothing, xAxisMode } from '$lib/stores/session';
	import { isDark } from '$lib/stores/theme';
	import { smooth } from '$lib/analytics/smooth';
	import { extractChannel, buildXValues, isDashed, paceFormat, effectiveAxisMode } from './TimeSeriesChart.utils.ts';
	import type { SeriesInput } from './TimeSeriesChart.utils.ts';
	import { interpolateToDistanceAxis } from '$lib/align/distance';

	let {
		channel,
		seriesInputs,
		lapMarkers = [],
		referenceIndex = undefined,
		groupId,
		onHoverDistance = undefined,
		externalHoverDistance = undefined,
		forceDistanceAxis = false,
	}: {
		channel: ChannelKey;
		seriesInputs: SeriesInput[];
		lapMarkers?: { value: number; label: string }[];
		referenceIndex?: number;
		groupId: string;
		/** Emits the hovered x-axis distance in metres, or null when the cursor leaves */
		onHoverDistance?: (distanceMetres: number | null) => void;
		/** When set, drives the chart crosshair to this distance in metres (map→chart sync) */
		externalHoverDistance?: number | null;
		/** When true, always uses distance mode for x-axis regardless of the global xAxisMode store */
		forceDistanceAxis?: boolean;
	} = $props();

	let container: HTMLDivElement;
	let chart: ECharts | undefined;
	let hiddenSeries = $state(new Set<number>());

	let resizeObserver: ResizeObserver | undefined;

	// Theme colour helpers — reactive via isDark store
	const textColour = () => $isDark ? '#94a3b8' : '#64748b';
	const gridColour = () => $isDark ? '#1e293b' : '#e2e8f0';
	const tooltipBg  = () => $isDark ? '#0f172a' : '#ffffff';
	const tooltipText = () => $isDark ? '#e2e8f0' : '#0f172a';

	function buildAltitudeData(activity: Activity, timeOffset = 0): [number, number | null][] {
		const axisMode = effectiveAxisMode($xAxisMode, forceDistanceAxis);
		if (axisMode === 'distance') {
			const aligned = interpolateToDistanceAxis(activity);
			const altData = aligned.channels.get('altitude') ?? [];
			return aligned.axis.map((d, i) => [d / 1000, altData[i]]);
		}
		const raw = extractChannel(activity.records, 'altitude');
		const xValues = buildXValues(activity.records, axisMode);
		return xValues.map((x, i) => [x + timeOffset, raw[i]]);
	}

	function buildData(activity: Activity, timeOffset = 0): [number, number | null][] {
		const axisMode = effectiveAxisMode($xAxisMode, forceDistanceAxis);
		if (axisMode === 'distance') {
			const aligned = interpolateToDistanceAxis(activity);
			const channelData = aligned.channels.get(channel) ?? [];
			const smoothed = smooth(channelData, $smoothing);
			return aligned.axis.map((d, i) => [d / 1000, smoothed[i]]);
		}
		const raw = extractChannel(activity.records, channel);
		const smoothed = smooth(raw, $smoothing);
		const xValues = buildXValues(activity.records, axisMode);
		return xValues.map((x, i) => [x + timeOffset, smoothed[i]]);
	}

	function buildOption(): EChartsOption {
		const meta = CHANNEL_META[channel];
		const tc = textColour();
		const gc = gridColour();

		const showAltBackdrop = channel !== 'altitude' && seriesInputs.length > 0;
		const altData = showAltBackdrop
			? buildAltitudeData(seriesInputs[0].activity, seriesInputs[0].timeOffset ?? 0)
			: [];
		const hasAlt = altData.some(([, v]) => v != null);

		const altFill = $isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.2)';
		const altLine = $isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.35)';

		return {
			grid: { top: 20, right: 16, bottom: 30, left: 55 },
			xAxis: {
				type: 'value',
				name: effectiveAxisMode($xAxisMode, forceDistanceAxis) === 'time' ? 's' : 'km',
				nameTextStyle: { color: tc, fontSize: 10 },
				axisLabel: { color: tc, fontSize: 11 },
				axisLine: { lineStyle: { color: gc } },
				splitLine: { lineStyle: { color: gc } },
			},
			yAxis: [
				{
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
				{
					type: 'value',
					show: false,
					// Push altitude to bottom ~25% of chart height by inflating the max
					min: (v: { min: number; max: number }) => Math.floor(v.min - (v.max - v.min) * 0.1),
					max: (v: { min: number; max: number }) => Math.ceil(v.max + (v.max - v.min) * 3),
				},
			],
			tooltip: {
				trigger: 'axis',
				axisPointer: { type: 'line', lineStyle: { color: '#64748b' } },
				backgroundColor: tooltipBg(),
				borderColor: gc,
				textStyle: { color: tooltipText(), fontSize: 12 },
				formatter: (params) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const items = params as any as Array<{ seriesName: string; value: [number, number | null]; color: string }>;
					const x = items[0]?.value[0];
					const xLabel = effectiveAxisMode($xAxisMode, forceDistanceAxis) === 'time'
						? `${Math.round(x ?? 0)}s`
						: `${(x ?? 0).toFixed(2)} km`;
					const rows = items
						.filter(p => p.seriesName !== '__alt__' && p.value[1] != null)
						.map(p => {
							const v = p.value[1] as number;
							const formatted = channel === 'pace' ? paceFormat(v) + ' /km' : v.toFixed(1);
							return `<div style="display:flex;align-items:center;gap:8px">` +
								`<span style="display:inline-block;width:12px;height:2px;background:${p.color};flex-shrink:0"></span>` +
								`<span style="color:${tc}">${p.seriesName}</span>` +
								`<b style="margin-left:auto;padding-left:12px">${formatted}</b>` +
								`</div>`;
						})
						.join('');
					return `<div style="font-size:12px;min-width:140px">` +
						`<div style="color:${tc};margin-bottom:4px;font-weight:500">${meta.label} · ${xLabel}</div>` +
						rows +
						`</div>`;
				},
			},
			dataZoom: [{ type: 'inside' }],
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			series: ([
				...(showAltBackdrop && hasAlt ? [{
					type: 'line' as const,
					name: '__alt__',
					yAxisIndex: 1,
					data: altData,
					areaStyle: { color: altFill, origin: 'start' as const },
					lineStyle: { width: 0.5, color: altLine },
					symbol: 'none',
					showSymbol: false,
					silent: true,
					z: 0,
				}] : []),
				...seriesInputs.map((s, i) => {
					const colour = s.colour ?? FILE_COLOURS[s.colourIndex % FILE_COLOURS.length];
					const dashed = isDashed(i, referenceIndex);
					return {
						type: 'line' as const,
						name: s.label ?? s.activity.filename,
						yAxisIndex: 0,
						data: hiddenSeries.has(i) ? [] : buildData(s.activity, s.timeOffset ?? 0),
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
			]) as unknown as EChartsOption['series'],
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

		// Chart → map sync: emit distance (metres) when crosshair moves in distance mode.
		// updateAxisPointer fires for all connected charts; we only wire onHoverDistance
		// on charts that explicitly request it to avoid duplicate emissions.
		if (onHoverDistance) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			chart.on('updateAxisPointer', (event: any) => {
				// Only emit in distance mode — in time mode axisInfo.value is seconds,
				// not km, so converting it would produce meaningless distance values.
				if (effectiveAxisMode($xAxisMode, forceDistanceAxis) !== 'distance') return;
				const axisInfo = event?.axesInfo?.[0];
				if (axisInfo != null) {
					// x-axis value is in km (distance mode) — convert to metres
					onHoverDistance!(axisInfo.value * 1000);
				}
			});

			chart.getZr().on('globalout', () => {
				onHoverDistance!(null);
			});
		}

		resizeObserver = new ResizeObserver(() => chart?.resize());
		resizeObserver.observe(container);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		chart?.dispose();
	});

	$effect(() => {
		void $isDark;
		void $smoothing;
		void $xAxisMode;
		void forceDistanceAxis;
		void seriesInputs;
		void referenceIndex;
		chart?.setOption(buildOption(), { notMerge: true });
	});

	// Map → chart sync: drive crosshair programmatically when externalHoverDistance changes.
	// Uses dispatchAction which propagates to all connected charts via echarts.connect().
	$effect(() => {
		if (!chart) return;
		if (externalHoverDistance == null) {
			chart.dispatchAction({ type: 'hideTip' });
			return;
		}
		const distKm = externalHoverDistance / 1000;
		// Convert distance value to pixel position on the x-axis
		const pixelX = chart.convertToPixel({ xAxisIndex: 0 }, distKm);
		if (pixelX == null) return;
		// Use the vertical centre of the chart plot area for the y position
		const layout = chart.getOption() as { grid?: Array<{ top?: number; bottom?: number }> };
		const grid = layout?.grid?.[0];
		const containerHeight = container?.clientHeight ?? 200;
		const top = typeof grid?.top === 'number' ? grid.top : 20;
		const bottom = typeof grid?.bottom === 'number' ? grid.bottom : 30;
		const pixelY = top + (containerHeight - top - bottom) / 2;
		chart.dispatchAction({ type: 'showTip', x: pixelX, y: pixelY });
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
				aria-label="{hiddenSeries.has(i) ? 'Show' : 'Hide'} {s.label ?? s.activity.filename}"
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
				<span class="legend-label">{s.label ?? s.activity.filename}</span>
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

	/* breakpoints: --bp-phone (480px) in layout.css */
	@media (max-width: 480px) { /* --bp-phone */
		.chart-canvas {
			height: 140px;
		}
	}

	@media (max-height: 480px) { /* landscape phone */
		.chart-canvas {
			height: 110px;
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
