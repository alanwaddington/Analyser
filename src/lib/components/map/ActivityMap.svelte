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

	onMount(async () => {
		L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');

		map = L.map(container);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		}).addTo(map);

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

	// ── Update legend content when metricChannel or data changes ────────────
	$effect(() => {
		if (!legendControlEl || !legendLabelEl || !legendMinEl || !legendMaxEl) return;

		if (!metricChannel) {
			legendControlEl.classList.add('hidden');
			return;
		}

		const channel = metricChannel;
		const meta = CHANNEL_META[channel];
		const isPace = channel === 'pace';

		const allSmoothedPoints = activities.map(activity => {
			const raw = extractChannel(activity.records, channel);
			const smoothedVals = smooth(raw, $smoothing);
			return extractGpsPointsWithMetric(activity, channel, smoothedVals);
		});

		const range = computeMetricRange(allSmoothedPoints);

		if (!range) {
			legendControlEl.classList.add('hidden');
			return;
		}

		legendControlEl.classList.remove('hidden');
		legendLabelEl.textContent = `${meta.label} · ${meta.unit}`;

		// For pace: lower value = faster = blue (left), so display min on left (fast) and max on right (slow)
		// The gradient bar always shows blue→red left-to-right, matching the inverted mapping
		legendMinEl.textContent = formatMetricValue(isPace ? range.min : range.min, channel);
		legendMaxEl.textContent = formatMetricValue(isPace ? range.max : range.max, channel);
	});

	// ── Polyline rendering ───────────────────────────────────────────────────
	$effect(() => {
		if (!map || !L) return;

		void activities;
		void referenceIndex;
		void metricChannel;
		void $smoothing;

		// Remove all existing layers
		for (const layer of layers) layer.remove();
		layers = [];

		const allPoints: import('leaflet').LatLng[] = [];

		// Precompute metric data for all activities if a channel is selected
		const channel = metricChannel;
		let metricDataPerActivity: ((number | null)[] | null)[] = [];
		let globalRange: { min: number; max: number } | null = null;

		if (channel) {
			metricDataPerActivity = activities.map(activity => {
				const raw = extractChannel(activity.records, channel);
				const smoothedVals = smooth(raw, $smoothing);
				const hasData = smoothedVals.some(v => v !== null);
				return hasData ? smoothedVals : null;
			});

			const allMetricPoints = activities.map((activity, i) => {
				const smoothed = metricDataPerActivity[i];
				if (!smoothed) return [];
				return extractGpsPointsWithMetric(activity, channel, smoothed);
			});

			globalRange = computeMetricRange(allMetricPoints);
		}

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
			const smoothedValues = channel ? metricDataPerActivity[i] : null;
			const useMetric = channel && smoothedValues && globalRange;

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
				const isPace = channel === 'pace';
				const metricGpsPoints = extractGpsPointsWithMetric(activity, channel, smoothedValues);
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

					const segColour = valueToColour(val, globalRange.min, globalRange.max, isPace);

					L.polyline([L.latLng(ptA.lat, ptA.lon), L.latLng(ptB.lat, ptB.lon)], {
						color: segColour,
						weight: 3,
						renderer: canvasRenderer ?? undefined,
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

				// Reference dashed overlay (transparent SVG polyline on top of canvas segments)
				// Preserves the dashed indicator without colouring it
				if (isRef) {
					const dashOverlay = L.polyline(latLngs, {
						color: 'transparent',
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
	 * Used for tooltip content when metric colouring is active.
	 */
	function nearestMetricValue(points: GpsPointWithMetric[], targetDist: number): number | null {
		if (points.length === 0) return null;

		let nearestValue: number | null = null;
		let minDelta = Infinity;

		for (const p of points) {
			const delta = Math.abs(p.distance - targetDist);
			if (delta < minDelta) {
				minDelta = delta;
				nearestValue = p.metricValue;
			}
		}

		return nearestValue;
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
</style>
