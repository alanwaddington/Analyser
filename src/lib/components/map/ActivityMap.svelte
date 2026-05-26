<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity, ChannelKey } from '$lib/types';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import { xAxisMode, smoothing } from '$lib/stores/session';
	import {
		positionFromPoints,
		extractGpsPoints,
		distanceAtPoint,
		extractGpsPointsWithMetric,
		computeMetricRange,
		TILE_PROVIDERS,
	} from './ActivityMap.utils.ts';
	import type { GpsPointWithMetric } from './ActivityMap.utils.ts';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import { smooth } from '$lib/analytics/smooth';
	import { valueToColour, formatMetricValue } from './colourScale.ts';

	let {
		activities,
		referenceIndex = undefined,
		hoveredDistance,
		onHoverDistance = undefined,
		availableChannels = [],
		onMetricChannelChange = undefined,
	}: {
		activities: Activity[];
		referenceIndex?: number;
		hoveredDistance: number | null;
		/** Emits distance in metres when hovering a polyline (map→chart sync), or null on leave */
		onHoverDistance?: (distanceMetres: number | null) => void;
		/** Channels with data in at least one loaded activity, for the metric selector */
		availableChannels?: ChannelKey[];
		/** Emits the selected metric channel whenever it changes (or null when deselected) */
		onMetricChannelChange?: (channel: ChannelKey | null) => void;
	} = $props();

	const gpsCache = $derived(activities.map(a => extractGpsPoints(a)));

	let container: HTMLDivElement;
	let L = $state<typeof import('leaflet') | undefined>(undefined);
	let map = $state<import('leaflet').Map | undefined>(undefined);
	// All rendered layers — cleared and rebuilt on each polyline effect run
	let layers: import('leaflet').Layer[] = [];
	let markers: (import('leaflet').CircleMarker | null)[] = [];
	let resizeObserver: ResizeObserver | undefined;

	// Metric colouring state
	let metricChannel = $state<ChannelKey | null>(null);

	// Colour-by picker — rendered as a position:fixed Svelte overlay so it is
	// never clipped by any overflow:hidden ancestor in the page layout.
	let pickerOpen    = $state(false);
	let pickerVisible = $state(false);   // false when map tab is hidden (display:none)
	let pickerTop     = $state(10);      // viewport px, updated by updatePickerPosition()
	let pickerRight   = $state(10);      // viewport px (distance from right edge)
	let pickerEl = $state<HTMLDivElement | undefined>(undefined);

	function updatePickerPosition() {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) { pickerVisible = false; return; }
		pickerTop   = rect.top + 10;
		pickerRight = window.innerWidth - rect.right + 10;
		pickerVisible = true;
	}

	// DOM refs for the Leaflet legend control (still Leaflet-managed)
	let legendControlEl: HTMLDivElement | undefined;
	let legendLabelEl: HTMLDivElement | undefined;
	let legendMinEl: HTMLSpanElement | undefined;
	let legendMaxEl: HTMLSpanElement | undefined;

	// ── Shared metric computation ────────────────────────────────────────────
	// Computed once and consumed by both the legend and polyline effects,
	// avoiding duplicate smooth() + extractGpsPointsWithMetric() work.
	interface ActivityMetricData {
		smoothedValues: (number | null)[] | null; // null = activity has no data for this channel
		metricGpsPoints: GpsPointWithMetric[];    // empty when smoothedValues is null
	}
	interface MetricComputation {
		channel: ChannelKey;
		perActivity: ActivityMetricData[];
		globalRange: { min: number; max: number } | null;
	}

	const metricComputation = $derived.by<MetricComputation | null>(() => {
		if (!metricChannel) return null;
		const ch = metricChannel;

		const perActivity: ActivityMetricData[] = activities.map(activity => {
			const raw = extractChannel(activity.records, ch);
			const smoothedVals = smooth(raw, $smoothing);
			if (!smoothedVals.some(v => v !== null)) {
				return { smoothedValues: null, metricGpsPoints: [] };
			}
			return {
				smoothedValues: smoothedVals,
				metricGpsPoints: extractGpsPointsWithMetric(activity, smoothedVals),
			};
		});

		const globalRange = computeMetricRange(perActivity.map(d => d.metricGpsPoints));

		return { channel: ch, perActivity, globalRange };
	});

	onMount(async () => {
		L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');

		map = L.map(container);

		// ── Tile layer switcher ──────────────────────────────────────────────
		// Build a base layers record from TILE_PROVIDERS and register via
		// L.control.layers. The first provider is added to the map as default.
		const baseLayers: Record<string, import('leaflet').TileLayer> = {};
		for (const provider of TILE_PROVIDERS) {
			baseLayers[provider.name] = L.tileLayer(provider.url, {
				attribution: provider.attribution,
				maxNativeZoom: provider.maxNativeZoom,
				// No maxZoom restriction — layer stays selectable at any zoom level.
				// Tiles are upscaled by Leaflet beyond maxNativeZoom rather than
				// the layer being disabled in the control.
			});
		}
		// Add default (first) layer to map
		baseLayers[TILE_PROVIDERS[0].name].addTo(map);
		// Register all layers in the native Leaflet control at topleft.
		// collapsed: false keeps the panel permanently open so all layer names are
		// always visible — no hover required for discoverability.
		L.control.layers(baseLayers, {}, { position: 'topleft', collapsed: false }).addTo(map);

		// ── Colour scale legend control (bottom-right) ───────────────────────
		const LegendControl = L.Control.extend({
			onAdd() {
				const div = L!.DomUtil.create('div', 'metric-legend-control hidden') as HTMLDivElement;
				L!.DomEvent.disableClickPropagation(div);
				legendControlEl = div;

				const labelEl = L!.DomUtil.create('div', 'metric-legend-label', div) as HTMLDivElement;
				legendLabelEl = labelEl;

				L!.DomUtil.create('div', 'metric-legend-bar', div);

				const valuesEl = L!.DomUtil.create('div', 'metric-legend-values', div);
				const minEl = L!.DomUtil.create('span', 'metric-legend-min', valuesEl) as HTMLSpanElement;
				const maxEl = L!.DomUtil.create('span', 'metric-legend-max', valuesEl) as HTMLSpanElement;
				legendMinEl = minEl;
				legendMaxEl = maxEl;

				return div;
			},
		});

		new LegendControl({ position: 'bottomright' }).addTo(map);

		// Invalidate Leaflet's size whenever the container changes dimensions.
		// This handles tab switches where the container goes from display:none
		// to display:flex — without this, the map renders grey tiles.
		// Also reposition the colour-by picker overlay on every resize / tab reveal.
		resizeObserver = new ResizeObserver(() => {
			map?.invalidateSize();
			updatePickerPosition();
		});
		resizeObserver.observe(container);
		updatePickerPosition(); // set initial position after Leaflet init
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		map?.remove();
	});

	// ── Reset metricChannel if the chosen channel disappears (e.g. different file loaded)
	$effect(() => {
		if (metricChannel && !availableChannels.includes(metricChannel)) {
			metricChannel = null;
		}
	});

	// ── Emit metricChannel to parent whenever it changes ────────────────────
	$effect(() => {
		onMetricChannelChange?.(metricChannel);
	});

	// ── Close picker on pointerdown outside it (only wired while open) ───────
	$effect(() => {
		if (!pickerOpen) return;
		const handleOutside = (e: PointerEvent) => {
			if (pickerEl && !pickerEl.contains(e.target as Node)) {
				pickerOpen = false;
			}
		};
		document.addEventListener('pointerdown', handleOutside, { capture: true });
		return () => document.removeEventListener('pointerdown', handleOutside, { capture: true });
	});

	// ── Update legend content from shared metricComputation ─────────────────
	$effect(() => {
		if (!legendControlEl || !legendLabelEl || !legendMinEl || !legendMaxEl) return;

		if (!metricComputation?.globalRange) {
			legendControlEl.classList.add('hidden');
			return;
		}

		const { channel, globalRange } = metricComputation;
		const meta = CHANNEL_META[channel];

		legendControlEl.classList.remove('hidden');
		legendLabelEl.textContent = `${meta.label} · ${meta.unit}`;
		legendMinEl.textContent = formatMetricValue(globalRange.min, channel);
		legendMaxEl.textContent = formatMetricValue(globalRange.max, channel);
	});

	// ── Polyline rendering ───────────────────────────────────────────────────
	$effect(() => {
		if (!map || !L) return;

		void activities;       // re-render when activities change (even when metricChannel is null)
		void referenceIndex;   // re-render when reference activity changes
		void metricComputation; // re-render when channel, smoothing, or activity data changes

		// Remove all existing layers
		for (const layer of layers) layer.remove();
		layers = [];

		const allPoints: import('leaflet').LatLng[] = [];

		const channel = metricComputation?.channel ?? null;
		const globalRange = metricComputation?.globalRange ?? null;

		// Shared Canvas renderer for all metric-coloured segments
		// Canvas batches all segments into one <canvas> element — critical for performance
		const canvasRenderer = channel && globalRange ? L.canvas({ padding: 0.5 }) : null;

		for (let i = 0; i < activities.length; i++) {
			const activity = activities[i];
			const colour = FILE_COLOURS[i % FILE_COLOURS.length];
			const gpsPoints = gpsCache[i];
			if (gpsPoints.length === 0) continue;

			const latLngs = gpsPoints.map(p => L!.latLng(p.lat, p.lon));
			allPoints.push(...latLngs);

			const isRef = referenceIndex !== undefined && i === referenceIndex;
			const actData = metricComputation?.perActivity[i] ?? null;
			const useMetric = channel && actData?.smoothedValues && globalRange;

			if (!useMetric) {
				// ── Flat colour polyline (default / fallback) ────────────────────
				const polyline = L.polyline(latLngs, {
					color: colour,
					weight: 2.5,
					renderer: isRef ? L.svg() : undefined,
					className: isRef ? 'ref-polyline' : undefined,
				});

				polyline.bindTooltip(activity.filename, { sticky: true, opacity: 0.9 });

				polyline.on('mousemove', (e: import('leaflet').LeafletMouseEvent) => {
					if ($xAxisMode !== 'distance') return;
					const dist = distanceAtPoint(gpsPoints, e.latlng.lat, e.latlng.lng);
					if (dist !== null) {
						onHoverDistance?.(dist);
						polyline.setTooltipContent(
							`${activity.filename} · ${(dist / 1000).toFixed(2)} km`,
						);
					}
				});

				polyline.on('mouseout', () => {
					onHoverDistance?.(null);
					polyline.setTooltipContent(activity.filename);
				});

				polyline.addTo(map);
				layers.push(polyline);
			} else {
				// ── Metric-coloured segmented polylines ──────────────────────────
				// Pre-computed in metricComputation — no duplicate extraction here
				const metricGpsPoints = actData!.metricGpsPoints;
				const group = L.featureGroup();

				for (let j = 0; j + 1 < metricGpsPoints.length; j++) {
					const ptA = metricGpsPoints[j];
					const ptB = metricGpsPoints[j + 1];

					const valA = ptA.metricValue;
					const valB = ptB.metricValue;

					// Skip segments where both endpoints have no data
					if (valA === null && valB === null) continue;

					// Use the average of the two endpoint values for a smooth colour transition
					const val =
						valA !== null && valB !== null
							? (valA + valB) / 2
							: (valA ?? valB)!;

					// No invert needed: the default gradient (blue at min, red at max) already
					// maps fast pace (low min/km) → blue and slow pace (high min/km) → red,
					// which is the correct behaviour for all effort-based channels including pace.
					const segColour = valueToColour(val, globalRange.min, globalRange.max);

					L.polyline([L.latLng(ptA.lat, ptA.lon), L.latLng(ptB.lat, ptB.lon)], {
						color: segColour,
						weight: 3,
						renderer: canvasRenderer!,
						interactive: true,
					}).addTo(group);
				}

				group.bindTooltip(activity.filename, { sticky: true, opacity: 0.9 });

				group.on('mousemove', (e: import('leaflet').LeafletMouseEvent) => {
					if ($xAxisMode !== 'distance') return;
					const dist = distanceAtPoint(gpsPoints, e.latlng.lat, e.latlng.lng);
					if (dist !== null) {
						onHoverDistance?.(dist);
						const metricVal = nearestMetricValue(metricGpsPoints, dist);
						const distStr = `${(dist / 1000).toFixed(2)} km`;
						const metricStr =
							metricVal !== null
								? ` · ${formatMetricValue(metricVal, channel)} ${CHANNEL_META[channel].unit}`
								: '';
						group.setTooltipContent(`${activity.filename} · ${distStr}${metricStr}`);
					}
				});

				group.on('mouseout', () => {
					onHoverDistance?.(null);
					group.setTooltipContent(activity.filename);
				});

				group.addTo(map);
				layers.push(group);

				// Reference dashed overlay (SVG polyline on top of canvas segments).
				// Uses the activity's flat file colour so the dashes are visible over the heatmap,
				// matching how the reference is styled in the flat-colour path.
				if (isRef) {
					const dashOverlay = L.polyline(latLngs, {
						color: colour,
						weight: 3,
						renderer: L.svg(),
						className: 'ref-polyline',
						interactive: false,
					});
					dashOverlay.addTo(map);
					layers.push(dashOverlay);
				}
			}
		}

		if (allPoints.length > 0) {
			map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20] });
		} else {
			map.setView([20, 0], 2);
		}

		markers = activities.map(() => null);
	});

	// ── Chart→map hover sync: render circle markers ──────────────────────────
	$effect(() => {
		if (!map || !L) return;

		if (hoveredDistance === null) {
			for (const m of markers) m?.remove();
			markers = activities.map(() => null);
			return;
		}

		for (let i = 0; i < activities.length; i++) {
			const pos = positionFromPoints(gpsCache[i], hoveredDistance);
			const colour = FILE_COLOURS[i % FILE_COLOURS.length];

			if (pos === null) {
				markers[i]?.remove();
				markers[i] = null;
				continue;
			}

			const latlng = L.latLng(pos.lat, pos.lon);
			if (markers[i]) {
				markers[i]!.setLatLng(latlng);
			} else {
				const m = L.circleMarker(latlng, {
					radius: 5,
					fillColor: colour,
					fillOpacity: 0.9,
					color: '#ffffff',
					weight: 1.5,
					interactive: false,
					className: 'map-marker-animated',
				});
				m.addTo(map);
				markers[i] = m;
			}
		}
	});

	/**
	 * Returns the metric value at the GPS point nearest to `targetDist`.
	 * Uses binary search (O(log n)) since metricGpsPoints is sorted by distance.
	 * Used for tooltip content when metric colouring is active.
	 */
	function nearestMetricValue(points: GpsPointWithMetric[], targetDist: number): number | null {
		if (points.length === 0) return null;

		// Binary search for first point with distance >= targetDist
		let lo = 0;
		let hi = points.length - 1;

		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (points[mid].distance < targetDist) lo = mid + 1;
			else hi = mid;
		}

		// All points are before targetDist → nearest is the last point
		if (points[lo].distance < targetDist) return points[lo].metricValue;

		// lo is first point >= targetDist; compare with predecessor if one exists
		if (lo > 0) {
			const distToLo   = points[lo].distance - targetDist;      // >= 0
			const distToPrev = targetDist - points[lo - 1].distance;  // >= 0
			if (distToPrev <= distToLo) return points[lo - 1].metricValue;
		}

		return points[lo].metricValue;
	}
</script>

<div
	bind:this={container}
	class="map-container"
	role="img"
	aria-label="GPS route map"
></div>

<!-- Colour-by picker — position:fixed overlay so it is never clipped by
     any overflow:hidden ancestor (map-wrap, map-panel, tab-content, etc.).
     Coordinates are kept in sync with the map container via ResizeObserver. -->
{#if availableChannels.length > 0 && pickerVisible}
<div
	class="colour-picker"
	bind:this={pickerEl}
	style:top="{pickerTop}px"
	style:right="{pickerRight}px"
>
	<span class="picker-label">Colour by</span>
	<div class="picker-wrapper">
		<button
			class="picker-trigger"
			type="button"
			onclick={() => pickerOpen = !pickerOpen}
		>
			<span class="picker-value">
				{metricChannel ? CHANNEL_META[metricChannel].label : 'None'}
			</span>
			<!-- chevron arrow -->
			<svg class="picker-arrow" xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
				<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		</button>
		{#if pickerOpen}
		<ul class="picker-list" role="listbox">
			<li
				role="option"
				tabindex="0"
				aria-selected={metricChannel === null}
				class:selected={metricChannel === null}
				onclick={() => { metricChannel = null; pickerOpen = false; }}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { metricChannel = null; pickerOpen = false; } }}
			>None</li>
			{#each availableChannels as ch}
			<li
				role="option"
				tabindex="0"
				aria-selected={metricChannel === ch}
				class:selected={metricChannel === ch}
				onclick={() => { metricChannel = ch; pickerOpen = false; }}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { metricChannel = ch; pickerOpen = false; } }}
			>{CHANNEL_META[ch].label}</li>
			{/each}
		</ul>
		{/if}
	</div>
</div>
{/if}

<style>
	.map-container {
		height: 100%;
		width: 100%;
		min-height: 300px;
	}

	:global(.ref-polyline path) {
		stroke-dasharray: 8 6;
	}

	:global(.map-marker-animated circle) {
		transition: cx 0.08s ease-out, cy 0.08s ease-out;
	}

	/* ── Colour-by picker overlay (position:fixed Svelte element) ──────── */

	/* The picker floats above the map as a fixed-position element whose
	   top/right are set inline by updatePickerPosition(). It is never a
	   child of the Leaflet container and is unaffected by overflow:hidden
	   on any ancestor in the page layout. */
	.colour-picker {
		position: fixed;
		z-index: 1001;          /* above Leaflet controls (1000) */
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 7px 10px;
		background: color-mix(in srgb, var(--color-card, #1e1e2e) 88%, transparent);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		font-family: inherit;
		pointer-events: auto;
		white-space: nowrap;
	}

	.picker-label {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-muted, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		user-select: none;
		cursor: default;
	}

	.picker-wrapper {
		position: relative;
	}

	.picker-trigger {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.775rem;
		font-weight: 500;
		font-family: inherit;
		color: var(--color-text, #f1f5f9);
		background-color: color-mix(in srgb, var(--color-card, #1e1e2e) 60%, transparent);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
		border-radius: 4px;
		padding: 3px 8px 3px 7px;
		height: 26px;
		min-width: 110px;
		cursor: pointer;
		outline: none;
		white-space: nowrap;
		transition: border-color 0.15s;
	}

	.picker-trigger:hover {
		border-color: var(--color-text, #f1f5f9);
	}

	.picker-trigger:focus-visible {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
	}

	.picker-value {
		flex: 1;
		text-align: left;
	}

	.picker-arrow {
		flex-shrink: 0;
		opacity: 0.7;
		color: var(--color-muted, #9ca3af);
	}

	/* Dropdown list — position:absolute relative to .picker-wrapper.
	   Since .colour-picker is position:fixed, the list is also effectively
	   viewport-positioned and will never be clipped by overflow:hidden. */
	.picker-list {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		min-width: 160px;
		z-index: 1;
		list-style: none;
		margin: 0;
		padding: 3px 0;
		max-height: 260px;
		overflow-y: auto;
		background: color-mix(in srgb, var(--color-card, #1e1e2e) 97%, transparent);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.18));
		border-radius: 5px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
	}

	.picker-list li {
		padding: 5px 12px;
		font-size: 0.775rem;
		font-weight: 500;
		color: var(--color-text, #f1f5f9);
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 0.1s;
	}

	.picker-list li:hover {
		background-color: rgba(255, 255, 255, 0.08);
	}

	.picker-list li.selected {
		color: #3b82f6;
		background-color: rgba(59, 130, 246, 0.1);
	}

	/* ── Colour scale legend (still a Leaflet control) ───────────────── */
	:global(.metric-legend-control) {
		width: 160px;
	}

	:global(.metric-legend-control.hidden) {
		display: none;
	}

	:global(.metric-legend-label) {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-muted, #9ca3af);
		margin-bottom: 5px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.metric-legend-bar) {
		height: 9px;
		border-radius: 5px;
		background: linear-gradient(to right, #0064ff, #00c864, #ffdc00, #ff3200);
		margin-bottom: 4px;
	}

	:global(.metric-legend-values) {
		display: flex;
		justify-content: space-between;
		font-size: 0.7rem;
		font-family: ui-monospace, 'Cascadia Code', monospace;
		color: var(--color-text, #f1f5f9);
	}

	:global(.metric-legend-min),
	:global(.metric-legend-max) {
		line-height: 1.3;
	}

	/* ── Leaflet layers control — always-expanded panel ────────────────── */
	/* collapsed: false is set in JS, so the toggle button never renders.   */
	:global(.leaflet-control-layers) {
		background: color-mix(in srgb, var(--color-card, #1e1e2e) 88%, transparent);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12)) !important;
		border-radius: 6px !important;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
		font-family: inherit;
	}

	:global(.leaflet-control-layers-expanded) {
		padding: 7px 10px !important;
		min-width: 130px;
	}

	:global(.leaflet-control-layers-expanded)::before {
		content: 'Map Layer';
		display: block;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-muted, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 6px;
		user-select: none;
	}

	/* ── Layer list ─────────────────────────────────────────────────────── */
	:global(.leaflet-control-layers-list) {
		margin: 0;
	}

	:global(.leaflet-control-layers-base label) {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 0;
		cursor: pointer;
		border-radius: 3px;
		transition: opacity 0.12s;
	}

	:global(.leaflet-control-layers-base label:hover) {
		opacity: 0.75;
	}

	:global(.leaflet-control-layers-base label span) {
		font-size: 0.775rem;
		font-weight: 500;
		color: var(--color-text, #f1f5f9);
		user-select: none;
	}

	:global(.leaflet-control-layers-base input[type='radio']) {
		accent-color: #3b82f6;
		width: 13px;
		height: 13px;
		cursor: pointer;
		flex-shrink: 0;
	}

	/* No overlay layers used — hide the separator */
	:global(.leaflet-control-layers-separator) {
		display: none;
	}
</style>
