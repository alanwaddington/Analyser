<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';
	import { loadECharts, type EChartsModule } from './echarts-loader';
	import type { Activity, ChannelKey, Anomaly, AthleteProfile } from '$lib/types';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import { hrZoneBoundaries, cpZoneBoundaries, ftpZoneBoundaries, lthrToEstimatedMaxHR } from '$lib/analytics/zones';
	import { smoothing, xAxisMode } from '$lib/stores/session';
	import { isDark } from '$lib/stores/theme';
	import { smooth } from '$lib/analytics/smooth';
	import { extractChannel, buildXValues, isDashed, paceFormat, effectiveAxisMode, computeSeriesStats, anomalyXValue } from './TimeSeriesChart.utils.ts';
	import type { SeriesInput, SeriesStats } from './TimeSeriesChart.utils.ts';
	import { interpolateToDistanceAxis, distanceStep } from '$lib/align/distance';
	import { downloadPng, localDateString } from '$lib/export/download';
	import './png-btn.css';
	import './chart-skeleton.css';

	const DOWNSAMPLE_THRESHOLD = 2000;

	let {
		channel,
		seriesInputs,
		lapMarkers = [],
		referenceIndex = undefined,
		groupId,
		onHoverDistance = undefined,
		externalHoverDistance = undefined,
		forceDistanceAxis = false,
		anomalies = undefined,
		athleteProfile = {} as AthleteProfile,
		sport = '',
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
		/** Anomalies for this channel (from the first activity). Rendered as red diamond markPoints. */
		anomalies?: Anomaly[];
		/** Athlete profile for threshold reference lines and zone shading. */
		athleteProfile?: AthleteProfile;
		/** Sport of the primary activity — used to pick the right HR threshold. */
		sport?: string;
	} = $props();

	let container: HTMLDivElement;
	let ec: EChartsModule | undefined;
	let chart: ECharts | undefined;
	let ready = $state(false);
	let hiddenSeries = $state(new Set<number>());
	let zoomRange = $state<{ min: number; max: number } | undefined>(undefined);

	let resizeObserver: ResizeObserver | undefined;

	const seriesStats = $derived.by<SeriesStats[]>(() => {
		void $smoothing; void $xAxisMode; void forceDistanceAxis; void zoomRange;
		return seriesInputs
			.filter((_, i) => !hiddenSeries.has(i))
			.map((s) => {
				const data = buildData(s.activity, s.timeOffset ?? 0, s.distanceOffset ?? 0);
				const colour = s.colour ?? FILE_COLOURS[s.colourIndex % FILE_COLOURS.length];
				const label = s.label ?? s.activity.filename;
				return computeSeriesStats(data, channel, label, colour, zoomRange);
			})
			.filter((s): s is SeriesStats => s !== null);
	});

	// Theme colour helpers — reactive via isDark store
	const textColour = () => $isDark ? '#94a3b8' : '#64748b';
	const gridColour = () => $isDark ? '#1e293b' : '#e2e8f0';
	const tooltipBg  = () => $isDark ? '#0f172a' : '#ffffff';
	const tooltipText = () => $isDark ? '#e2e8f0' : '#0f172a';

	function buildAltitudeData(activity: Activity, timeOffset = 0, distanceOffset = 0): [number, number | null][] {
		const axisMode = effectiveAxisMode($xAxisMode, forceDistanceAxis);
		if (axisMode === 'distance') {
			const aligned = interpolateToDistanceAxis(activity, distanceStep(activity.totalDistance), distanceOffset);
			const altData = aligned.channels.get('altitude') ?? [];
			return aligned.axis.map((d, i) => [d / 1000, altData[i]]);
		}
		const raw = extractChannel(activity.records, 'altitude');
		const xValues = buildXValues(activity.records, axisMode);
		return xValues.map((x, i) => [x + timeOffset, raw[i]]);
	}

	function buildData(activity: Activity, timeOffset = 0, distanceOffset = 0): [number, number | null][] {
		if (channel === 'position') return []; // GPS-only channel — no numeric series
		const axisMode = effectiveAxisMode($xAxisMode, forceDistanceAxis);
		if (axisMode === 'distance') {
			const aligned = interpolateToDistanceAxis(activity, distanceStep(activity.totalDistance), distanceOffset);
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
			? buildAltitudeData(seriesInputs[0].activity, seriesInputs[0].timeOffset ?? 0, seriesInputs[0].distanceOffset ?? 0)
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
			series: (() => {
				const firstVisibleIdx = seriesInputs.findIndex((_, i) => !hiddenSeries.has(i));

				// Zone band colours — low-opacity, readable on dark and light backgrounds
				const ZONE_COLOURS: Record<number, string> = {
					1: 'rgba(148,163,184,0.07)',
					2: 'rgba(96,165,250,0.07)',
					3: 'rgba(74,222,128,0.07)',
					4: 'rgba(251,191,36,0.09)',
					5: 'rgba(248,113,113,0.11)',
				};

				// Determine zone bands for this channel/sport combination
				const activeSport = sport ?? 'cycling';
				let zoneBands: { min: number; max: number; zone: number }[] | null = null;
				if (channel === 'heartRate') {
					const maxHR = activeSport === 'cycling'
						? (athleteProfile?.maxHrCycling ?? athleteProfile?.maxHrRunning)
						: (athleteProfile?.maxHrRunning ?? athleteProfile?.maxHrCycling);
					if (maxHR != null) {
						zoneBands = hrZoneBoundaries(maxHR);
					} else if (athleteProfile?.lthr != null) {
						zoneBands = hrZoneBoundaries(lthrToEstimatedMaxHR(athleteProfile.lthr));
					}
				} else if (channel === 'power' && activeSport === 'running' && athleteProfile?.cp != null) {
					zoneBands = cpZoneBoundaries(athleteProfile.cp);
				} else if (channel === 'power' && activeSport !== 'running' && athleteProfile?.ftp != null) {
					zoneBands = ftpZoneBoundaries(athleteProfile.ftp);
				}

				const markAreaData = zoneBands
					? zoneBands.map(b => [
						{ yAxis: b.min, itemStyle: { color: ZONE_COLOURS[b.zone] } },
						{ yAxis: b.max === Infinity ? Infinity : b.max },
					  ])
					: null;

				return ([
					...(showAltBackdrop && hasAlt ? [{
						type: 'line' as const,
						name: '__alt__',
						yAxisIndex: 1,
						data: altData,
						sampling: 'lttb' as const,
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
						const seriesData = hiddenSeries.has(i) ? [] : buildData(s.activity, s.timeOffset ?? 0, s.distanceOffset ?? 0);
						if (seriesData.length > DOWNSAMPLE_THRESHOLD) {
							console.warn(`[TimeSeriesChart] ${channel}: ${seriesData.length} points — ECharts LTTB sampling active`);
						}
						return {
							type: 'line' as const,
							name: s.label ?? s.activity.filename,
							yAxisIndex: 0,
							data: seriesData,
							sampling: 'lttb' as const,
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
							...(i === firstVisibleIdx && anomalies && anomalies.length > 0 ? {
								markPoint: {
									silent: false,
									animation: false,
									data: anomalies.map(a => {
										const record = s.activity.records[a.recordIndex];
										const raw = record ? (record as unknown as Record<string, number | undefined>)[channel] : undefined;
										return {
											coord: [anomalyXValue(a, s, effectiveAxisMode($xAxisMode, forceDistanceAxis)), raw ?? 0],
											symbol: 'diamond',
											symbolSize: 8,
											itemStyle: { color: '#ef4444' },
											label: { show: false },
										};
									}),
								},
							} : {}),
							...(i === firstVisibleIdx && markAreaData ? {
								markArea: {
									silent: true,
									data: markAreaData,
								},
							} : {}),
						};
					}),
				]) as unknown as EChartsOption['series'];
			})(),
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
		chart.group = groupId;
		ec.connect(groupId);

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

		// Zoom → stats sync: capture the visible x-axis extent after any dataZoom event.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		chart.on('dataZoom', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const xAxisModel = (chart as any).getModel().getComponent('xAxis', 0);
			const extent: [number, number] | undefined = xAxisModel?.axis?.scale?.getExtent?.();
			if (extent && extent[1] - extent[0] > 0) {
				zoomRange = { min: extent[0], max: extent[1] };
			} else {
				zoomRange = undefined;
			}
		});

		// markPoint click → zoom to ±15s (time) or ±0.05km (distance) around the anomaly
		chart.on('click', { componentType: 'markPoint' }, (params: unknown) => {
			const coord = (params as { data?: { coord?: [number, number] } }).data?.coord;
			if (!coord) return;
			const xVal = coord[0];
			const axisMode = effectiveAxisMode($xAxisMode, forceDistanceAxis);
			const halfWindow = axisMode === 'time' ? 15 : 0.05;
			chart?.dispatchAction({
				type: 'dataZoom',
				startValue: xVal - halfWindow,
				endValue: xVal + halfWindow,
			});
		});

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
		const slug = channel.replace(/([A-Z])/g, '-$1').toLowerCase();
		const date = localDateString();
		downloadPng(url, `${slug}-${date}.png`);
	}

	$effect(() => {
		void $isDark;
		void $smoothing;
		void $xAxisMode;
		void forceDistanceAxis;
		void seriesInputs;
		void referenceIndex;
		void athleteProfile;
		void sport;
		zoomRange = undefined;
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
		<button
			class="png-btn"
			onclick={handlePngDownload}
			aria-label="Download {CHANNEL_META[channel].label} chart as PNG"
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

	{#if seriesStats.length > 0}
		<div class="chart-stats" title="Chart view statistics — reflects current smoothing and axis mode. May differ from the Summary tab.">
			{#each seriesStats as stat}
				<span
					class="stat-entry"
					title="{stat.count.toLocaleString()} samples · {stat.xMin.toFixed(1)}–{stat.xMax.toFixed(1)} {effectiveAxisMode($xAxisMode, forceDistanceAxis) === 'time' ? 's' : 'km'}"
				>
					<span class="stat-dot" style="background:{stat.colour}"></span>
					<span class="stat-label">{stat.label}</span>
					<span class="stat-values">{#if channel === 'pace'}max {stat.max} / avg {stat.avg} / min {stat.min}{:else}min {stat.min} / avg {stat.avg} / max {stat.max}{/if} <span class="stat-unit">{stat.unit}</span></span>
				</span>
			{/each}
		</div>
	{/if}
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

	.chart-stats {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 6px 16px 8px;
		border-top: 1px solid var(--color-border);
	}

	.stat-entry {
		display: flex;
		align-items: center;
		gap: 5px;
		cursor: default;
		min-width: 0;
	}

	.stat-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.stat-label {
		font-size: 0.6875rem;
		color: var(--color-muted);
		max-width: 90px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.stat-values {
		font-size: 0.6875rem;
		font-family: ui-monospace, 'Cascadia Code', monospace;
		color: var(--color-text);
		white-space: nowrap;
	}

	.stat-unit {
		font-size: 0.625rem;
		color: var(--color-muted);
	}
</style>
