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
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils.ts';
	import { smooth } from '$lib/analytics/smooth.ts';
	import { valueToColour, formatMetricValue } from './colourScale.ts';

	let {
		activities,
		referenceIndex = undefined,
		hoveredDistance,
		onHoverDistance = undefined,
		availableChannels = [],
	}: {
		activities: Activity[];
		referenceIndex?: number;
		hoveredDistance: number | null;
		/** Emits distance in metres when hovering a polyline (map→chart sync), or null on leave */
		onHoverDistance?: (distanceMetres: number | null) => void;
		/** Channels with data in at least one loaded activity, for the metric selector */
		availableChannels?: ChannelKey[];
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

	// DOM refs held to update Leaflet control content without recreating controls
	let selectorSelectEl: HTMLSelectElement | undefined;
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
				maxZoom: provider.maxZoom,
			});
		}
		// Add default (first) layer to map
		baseLayers[TILE_PROVIDERS[0].name].addTo(map);
		// Register all layers in the native Leaflet control at topleft
		L.control.layers(baseLayers, {}, { position: 'topleft' }).addTo(map);

		// ── Metric selector control (top-right) ─────────────────────────────
		const SelectorControl = L.Control.extend({
			onAdd() {
				const div = L.DomUtil.create('div', 'metric-selector-control');
				L.DomEvent.disableClickPropagation(div);
				L.DomEvent.disableScrollPropagation(div);

				const label = L.DomUtil.create('label', 'metric-selector-label', div);
				label.setAttribute('for', 'metric-selector-select');
				label.textContent = 'Colour by';

				const select = L.DomUtil.create(
					'select',
					'metric-selector-select',
					div,
				) as HTMLSelectElement;
				select.id = 'metric-selector-select';
				selectorSelectEl = select;

				select.addEventListener('change', () => {
					metricChannel = (select.value as ChannelKey) || null;
				});

				return div;
			},
		});

		new SelectorControl({ position: 'topright' }).addTo(map);

		// ── Colour scale legend control (bottom-right) ───────────────────────
		const LegendControl = L.Control.extend({
			onAdd() {
				const div = L.DomUtil.create('div', 'metric-legend-control hidden') as HTMLDivElement;
				L.DomEvent.disableClickPropagation(div);
				legendControlEl = div;

				const labelEl = L.DomUtil.create('div', 'metric-legend-label', div) as HTMLDivElement;
				legendLabelEl = labelEl;

				L.DomUtil.create('div', 'metric-legend-bar', div);

				const valuesEl = L.DomUtil.create('div', 'metric-legend-values', div);
				const minEl = L.DomUtil.create('span', 'metric-legend-min', valuesEl) as HTMLSpanElement;
				const maxEl = L.DomUtil.create('span', 'metric-legend-max', valuesEl) as HTMLSpanElement;
				legendMinEl = minEl;
				legendMaxEl = maxEl;

				return div;
			},
		});

		new LegendControl({ position: 'bottomright' }).addTo(map);

		// Invalidate Leaflet's size whenever the container changes dimensions.
		// This handles tab switches where the container goes from display:none
		// to display:flex — without this, the map renders grey tiles.
		resizeObserver = new ResizeObserver(() => {
			map?.invalidateSize();
		});
		resizeObserver.observe(container);
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		map?.remove();
	});

	// ── Rebuild selector <option> list when availableChannels changes ────────
	$effect(() => {
		if (!selectorSelectEl) return;

		const currentValue = metricChannel ?? '';

		selectorSelectEl.innerHTML = '';
		const noneOpt = document.createElement('option');
		noneOpt.value = '';
		noneOpt.textContent = 'None';
		selectorSelectEl.appendChild(noneOpt);

		for (const ch of availableChannels) {
			const opt = document.createElement('option');
			opt.value = ch;
			opt.textContent = CHANNEL_META[ch].label;
			selectorSelectEl.appendChild(opt);
		}

		// Restore the previous selection if it's still available
		if (currentValue && availableChannels.includes(currentValue as ChannelKey)) {
			selectorSelectEl.value = currentValue;
		} else {
			selectorSelectEl.value = '';
			// Reset metricChannel if the previously-selected channel is no longer available
			if (metricChannel && !availableChannels.includes(metricChannel)) {
				metricChannel = null;
			}
		}
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

	/* ── Shared control shell ────────────────────────────────────────────── */
	:global(.metric-selector-control),
	:global(.metric-legend-control) {
		background: color-mix(in srgb, var(--color-card, #1e1e2e) 88%, transparent);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		padding: 7px 10px;
		font-family: inherit;
		pointer-events: auto;
	}

	/* ── Metric selector ─────────────────────────────────────────────────── */
	:global(.metric-selector-control) {
		display: flex;
		align-items: center;
		gap: 7px;
		white-space: nowrap;
	}

	:global(.metric-selector-label) {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-muted, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		user-select: none;
		cursor: default;
	}

	:global(.metric-selector-select) {
		font-size: 0.775rem;
		font-weight: 500;
		color: var(--color-text, #f1f5f9);
		background-color: color-mix(in srgb, var(--color-card, #1e1e2e) 60%, transparent);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
		border-radius: 4px;
		padding: 3px 22px 3px 7px;
		height: 26px;
		cursor: pointer;
		outline: none;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 6px center;
		min-width: 110px;
		transition: border-color 0.15s;
	}

	:global(.metric-selector-select:hover) {
		border-color: var(--color-text, #f1f5f9);
	}

	:global(.metric-selector-select:focus-visible) {
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
	}

	/* ── Colour scale legend ─────────────────────────────────────────────── */
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

	/* ── Leaflet layers control — base container ────────────────────────── */
	:global(.leaflet-control-layers) {
		background: color-mix(in srgb, var(--color-card, #1e1e2e) 88%, transparent);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12)) !important;
		border-radius: 6px !important;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
		font-family: inherit;
	}

	/* ── Collapsed toggle button ────────────────────────────────────────── */
	:global(.leaflet-control-layers-toggle) {
		width: 32px !important;
		height: 32px !important;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'/%3E%3Cpolyline points='2 17 12 22 22 17'/%3E%3Cpolyline points='2 12 12 17 22 12'/%3E%3C/svg%3E") !important;
		background-repeat: no-repeat !important;
		background-position: center !important;
		background-size: 18px 18px !important;
		background-color: transparent !important;
		border-radius: 5px;
	}

	:global(.leaflet-control-layers-toggle:hover) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23f1f5f9' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolygon points='12 2 2 7 12 12 22 7 12 2'/%3E%3Cpolyline points='2 17 12 22 22 17'/%3E%3Cpolyline points='2 12 12 17 22 12'/%3E%3C/svg%3E") !important;
	}

	/* ── Expanded panel ─────────────────────────────────────────────────── */
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
