<script lang="ts">
	import type { ChannelKey } from '$lib/types';
	import { CHANNEL_META } from '$lib/types';
	import TimeSeriesChart from './TimeSeriesChart.svelte';
	import StripToggle from './StripToggle.svelte';
	import type { SeriesInput } from './TimeSeriesChart.utils';
	import { shouldShowGradient, GRADIENT_COLOUR_TOKEN } from './StripChart.utils';

	let {
		channel,
		seriesInputs,
		lapMarkers = [],
		onHoverDistance = undefined,
		externalHoverDistance = undefined,
	}: {
		/** The metric channel to display */
		channel: ChannelKey;
		/** Pre-built series inputs from the parent page (one per file/device) */
		seriesInputs: SeriesInput[];
		lapMarkers?: { value: number; label: string }[];
		/** Emits distance in metres when hovering the chart, or null on leave */
		onHoverDistance?: (distanceMetres: number | null) => void;
		/** When set, drives the chart crosshair to this distance in metres */
		externalHoverDistance?: number | null;
	} = $props();

	/** Whether the gradient style toggle is active (line is default) */
	let gradientMode = $state(false);

	/** True when gradient should actually be applied (only for single series) */
	const showGradient = $derived(shouldShowGradient(gradientMode, seriesInputs));

	/**
	 * Build the effective series inputs — when gradient mode is active (single series),
	 * we pass a special colour token that StripChart handles via ECharts visualMap.
	 * For multi-file (gradient disabled) this is a pass-through.
	 */
	const effectiveSeriesInputs = $derived(
		showGradient
			? seriesInputs.map(s => ({ ...s, colour: GRADIENT_COLOUR_TOKEN }))
			: seriesInputs,
	);

	const channelLabel = $derived(CHANNEL_META[channel]?.label ?? channel);
</script>

<div class="strip-chart" aria-label="Metric strip chart: {channelLabel}">
	<div class="strip-header">
		<span class="strip-title">{channelLabel}</span>
		<StripToggle
			{gradientMode}
			disabled={seriesInputs.length > 1}
			onToggle={() => { gradientMode = !gradientMode; }}
		/>
	</div>
	<TimeSeriesChart
		{channel}
		seriesInputs={effectiveSeriesInputs}
		{lapMarkers}
		groupId="map-strip"
		forceDistanceAxis={true}
		{onHoverDistance}
		{externalHoverDistance}
	/>
</div>

<style>
	.strip-chart {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.strip-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 12px 2px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-card);
	}

	.strip-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text);
	}

	/* Override chart-card styling inside strip — fill the container using flex */
	.strip-chart :global(.chart-card) {
		border: none;
		border-radius: 0;
		background: var(--color-card);
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Canvas fills the remaining space, height is controlled by the container */
	.strip-chart :global(.chart-canvas) {
		flex: 1;
		height: 100% !important;
		min-height: 60px;
	}

	/* Title is shown in strip-header instead */
	.strip-chart :global(.chart-header) {
		display: none;
	}

	/* Keep legend compact */
	.strip-chart :global(.chart-legend) {
		padding: 2px 12px;
		flex-shrink: 0;
	}
</style>
