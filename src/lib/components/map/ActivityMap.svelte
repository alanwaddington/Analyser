<script lang="ts">
	import { onMount, onDestroy, untrack } from 'svelte';
	import type { Activity, AthleteProfile, ChannelKey } from '$lib/types';
	import { CHANNEL_META, FILE_COLOURS } from '$lib/types';
	import { xAxisMode, smoothing } from '$lib/stores/session';
	import {
		positionFromPoints,
		extractGpsPoints,
		distanceAtPoint,
		metricValuesForGpsPoints,
		computeMetricRange,
		TILE_PROVIDERS,
	} from './ActivityMap.utils.ts';
	import { downsampleGps, GPS_MAX_POINTS } from '$lib/analytics/downsample';
	import type { GpsPointWithMetric } from '$lib/types';
	import { extractChannel } from '$lib/components/charts/TimeSeriesChart.utils';
	import { smooth } from '$lib/analytics/smooth';
	import {
		valueToColour,
		formatMetricValue,
		getZoneBoundaries,
		valueToZone,
		zoneToColour,
		formatZoneBoundary,
		powerSourceLabel,
	} from './colourScale.ts';
	import type { ZoneBand } from '$lib/analytics/zones';

	let {
		activities,
		colourMap = new Map<string, number>(),
		referenceIndex = undefined,
		hoveredDistance,
		onHoverDistance = undefined,
		availableChannels = [],
		onMetricChannelChange = undefined,
		athleteProfile = undefined,
	}: {
		activities: Activity[];
		colourMap?: Map<string, number>;
		referenceIndex?: number;
		hoveredDistance: number | null;
		/** Emits distance in metres when hovering a polyline (map→chart sync), or null on leave */
		onHoverDistance?: (distanceMetres: number | null) => void;
		/** Channels with data in at least one loaded activity, for the metric selector */
		availableChannels?: ChannelKey[];
		/** Emits the first activity's selected channel whenever it changes (or null) */
		onMetricChannelChange?: (channel: ChannelKey | null) => void;
		/** Athlete profile for zone-based colouring */
		athleteProfile?: AthleteProfile;
	} = $props();

	// ── Per-file metric configuration ─────────────────────────────────────────
	interface PerFileMetricConfig {
		channel: ChannelKey | null;
		zoneMode: boolean;
	}

	// Plain object keyed by activityId — object property mutations are more
	// reliably tracked by Svelte 5's proxy than Map.set() in jsdom.
	let perFileConfig = $state<Record<string, PerFileMetricConfig>>({});

	// Sync perFileConfig when activities change: remove stale, add new with defaults
	$effect(() => {
		const currentIds = new Set(activities.map(a => a.id));
		untrack(() => {
			for (const id of Object.keys(perFileConfig)) {
				if (!currentIds.has(id)) delete perFileConfig[id];
			}
			for (const a of activities) {
				if (!(a.id in perFileConfig)) {
					perFileConfig[a.id] = { channel: null, zoneMode: false };
				}
			}
		});
	});

	function configFor(id: string): PerFileMetricConfig {
		return perFileConfig[id] ?? { channel: null, zoneMode: false };
	}

	/**
	 * In single-file mode the `availableChannels` prop is authoritative (parent derives the
	 * union, which equals the single file's channels). In multi-file mode we filter to each
	 * activity's own channels so files only show channels they actually have data for.
	 */
	function fileChannels(activity: Activity): ChannelKey[] {
		if (activities.length <= 1) return availableChannels;
		return availableChannels.filter(ch => (activity.availableChannels as Set<ChannelKey>).has(ch));
	}

	/** Display label for a channel in the picker list */
	function channelPickerLabel(ch: ChannelKey, activity: Activity): string {
		if (ch === 'power') {
			return powerSourceLabel(activity.powerSource, getPowerManufacturer(activity));
		}
		return CHANNEL_META[ch].label;
	}

	/** Find the manufacturer of the power-contributing device for source label */
	function getPowerManufacturer(activity: Activity): string | undefined {
		const stream = activity.deviceStreams.find(s => s.channels.includes('power'));
		return typeof stream?.device.manufacturer === 'string' ? stream.device.manufacturer : undefined;
	}

	/** Returns true when zone boundaries exist for this activity's channel and profile */
	function canUseZones(activityId: string): boolean {
		const config = perFileConfig[activityId];
		const activity = activities.find(a => a.id === activityId);
		if (!config?.channel || !activity || !athleteProfile) return false;
		return getZoneBoundaries(config.channel, activity.sport ?? '', athleteProfile) !== null;
	}

	function disabledZoneTitle(activityId: string): string {
		const config = perFileConfig[activityId];
		if (!athleteProfile) return 'Set athlete profile thresholds to enable zone colours';
		if (config?.channel === 'heartRate') return 'Set maxHR or LTHR in Athlete Profile to enable zone colours';
		if (config?.channel === 'power') {
			const activity = activities.find(a => a.id === activityId);
			return activity?.sport === 'running'
				? 'Set Critical Power (CP) in Athlete Profile to enable zone colours'
				: 'Set FTP in Athlete Profile to enable zone colours';
		}
		return 'Set athlete profile thresholds to enable zone colours';
	}

	function selectChannel(activityId: string, ch: ChannelKey | null) {
		perFileConfig[activityId] = { channel: ch, zoneMode: false };
	}

	function setZoneMode(activityId: string, zoneMode: boolean) {
		const config = perFileConfig[activityId];
		if (!config) return;
		// Flash opacity on picker container (mode-switching animation)
		if (pickerEl) {
			pickerEl.classList.add('mode-switching');
			setTimeout(() => pickerEl?.classList.remove('mode-switching'), 150);
		}
		perFileConfig[activityId] = { ...config, zoneMode };
	}

	// ── GPS cache ─────────────────────────────────────────────────────────────
	const gpsCache = $derived(activities.map(a => downsampleGps(extractGpsPoints(a), GPS_MAX_POINTS)));

	// ── Per-file metric computation ───────────────────────────────────────────
	interface ActivityMetricResult {
		channel: ChannelKey;
		zoneMode: boolean;
		smoothedValues: (number | null)[];
		metricGpsPoints: GpsPointWithMetric[];
		globalRange: { min: number; max: number } | null;
		zoneBands: ZoneBand[] | null;
	}

	const perFileComputation = $derived.by(() => {
		const result: Record<string, ActivityMetricResult> = {};
		for (let i = 0; i < activities.length; i++) {
			const activity = activities[i];
			const config = perFileConfig[activity.id];
			if (!config?.channel) continue;
			const ch = config.channel;
			const raw = extractChannel(activity.records, ch);
			const smoothed = smooth(raw, $smoothing);
			if (!smoothed.some(v => v !== null)) continue;
			const metricGpsPoints = metricValuesForGpsPoints(gpsCache[i], smoothed);
			const globalRange = computeMetricRange([metricGpsPoints]);
			const zoneBands = (config.zoneMode && athleteProfile)
				? getZoneBoundaries(ch, activity.sport ?? '', athleteProfile)
				: null;
			result[activity.id] = {
				channel: ch,
				zoneMode: config.zoneMode && zoneBands !== null,
				smoothedValues: smoothed,
				metricGpsPoints,
				globalRange,
				zoneBands,
			};
		}
		return result;
	});

	// Emit first activity's channel to parent (for strip chart below map).
	// Read perFileConfig directly (not via $derived) so $effect tracks it correctly.
	$effect(() => {
		const ch = activities.length > 0 ? (perFileConfig[activities[0].id]?.channel ?? null) : null;
		onMetricChannelChange?.(ch);
	});

	// Reset channels that disappear when a file is removed or availableChannels change
	$effect(() => {
		const channels = new Set(availableChannels);
		untrack(() => {
			for (const [id, config] of Object.entries(perFileConfig)) {
				if (config.channel && !channels.has(config.channel)) {
					perFileConfig[id] = { channel: null, zoneMode: false };
				}
			}
		});
	});

	// ── Picker state ──────────────────────────────────────────────────────────
	let openPickerFor = $state<string | null>(null);
	let pickerVisible = $state(false);
	let pickerTop     = $state(10);
	let pickerRight   = $state(10);
	let pickerEl = $state<HTMLDivElement | undefined>(undefined);

	// ── Leaflet state ─────────────────────────────────────────────────────────
	let container: HTMLDivElement;
	let L = $state<typeof import('leaflet') | undefined>(undefined);
	let map = $state<import('leaflet').Map | undefined>(undefined);
	let layers: import('leaflet').Layer[] = [];
	let markers: (import('leaflet').CircleMarker | null)[] = [];
	let driftMarkers: import('leaflet').CircleMarker[] = [];
	let resizeObserver: ResizeObserver | undefined;
	let mapInitialised = false;
	let legendContainerEl: HTMLDivElement | undefined;

	function updatePickerPosition() {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) { pickerVisible = false; return; }
		pickerTop   = rect.top + 10;
		pickerRight = window.innerWidth - rect.right + 10;
		pickerVisible = true;
	}

	function initLeafletMap() {
		if (mapInitialised || !L || !container) return;
		mapInitialised = true;

		map = L.map(container);

		// ── Tile layer switcher ──────────────────────────────────────────────
		const baseLayers: Record<string, import('leaflet').TileLayer> = {};
		for (const provider of TILE_PROVIDERS) {
			baseLayers[provider.name] = L.tileLayer(provider.url, {
				attribution: provider.attribution,
				maxNativeZoom: provider.maxNativeZoom,
			});
		}
		baseLayers[TILE_PROVIDERS[0].name].addTo(map);
		L.control.layers(baseLayers, {}, { position: 'topleft', collapsed: false }).addTo(map);

		// ── Legend control (bottom-right) ────────────────────────────────────
		const LegendControl = L.Control.extend({
			onAdd() {
				const div = L!.DomUtil.create('div', 'metric-legend-control hidden') as HTMLDivElement;
				L!.DomEvent.disableClickPropagation(div);
				legendContainerEl = div;
				return div;
			},
		});
		new LegendControl({ position: 'bottomright' }).addTo(map);

		updatePickerPosition();
	}

	onMount(async () => {
		L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');
		if (!container) return;

		resizeObserver = new ResizeObserver(() => {
			if (!container) return;
			const r = container.getBoundingClientRect();
			if (!mapInitialised && r.width > 0 && r.height > 0) initLeafletMap();
			map?.invalidateSize();
			updatePickerPosition();
		});
		resizeObserver.observe(container);

		const initRect = container.getBoundingClientRect();
		if (initRect.width > 0 && initRect.height > 0) initLeafletMap();
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		map?.remove();
	});

	// ── Close picker on pointerdown outside ──────────────────────────────────
	$effect(() => {
		if (!openPickerFor) return;
		const handleOutside = (e: PointerEvent) => {
			if (pickerEl && !pickerEl.contains(e.target as Node)) {
				openPickerFor = null;
			}
		};
		document.addEventListener('pointerdown', handleOutside, { capture: true });
		return () => document.removeEventListener('pointerdown', handleOutside, { capture: true });
	});

	// ── Legend update (reads perFileComputation) ──────────────────────────────
	$effect(() => {
		if (!legendContainerEl) return;

		// Collect active legends (activities with a channel and data range)
		const activeLegends = activities
			.map(a => ({ activity: a, result: perFileComputation[a.id] }))
			.filter(({ result }) => result?.globalRange != null);

		if (activeLegends.length === 0) {
			legendContainerEl.classList.add('hidden');
			return;
		}

		legendContainerEl.classList.remove('hidden');
		legendContainerEl.innerHTML = '';

		const multiFile = activities.length > 1;

		for (const { activity, result } of activeLegends) {
			const entryEl = document.createElement('div');
			entryEl.className = 'metric-legend-entry';

			// Label
			const labelEl = document.createElement('div');
			labelEl.className = 'metric-legend-label';
			const meta = CHANNEL_META[result!.channel];
			const prefix = multiFile ? `${activity.filename} · ` : '';
			labelEl.textContent = `${prefix}${meta.label} · ${meta.unit}`;
			entryEl.appendChild(labelEl);

			if (result!.zoneMode && result!.zoneBands) {
				// Zone legend: coloured swatches with boundary labels
				const zonesEl = document.createElement('div');
				zonesEl.className = 'metric-legend-zones';
				for (const band of result!.zoneBands) {
					const rowEl = document.createElement('div');
					rowEl.className = 'metric-legend-zone-row';
					const swatchEl = document.createElement('span');
					swatchEl.className = 'metric-legend-zone-swatch';
					swatchEl.style.backgroundColor = zoneToColour(band.zone);
					const textEl = document.createElement('span');
					textEl.className = 'metric-legend-zone-text';
					textEl.textContent = formatZoneBoundary(band, result!.channel);
					rowEl.appendChild(swatchEl);
					rowEl.appendChild(textEl);
					zonesEl.appendChild(rowEl);
				}
				entryEl.appendChild(zonesEl);
			} else {
				// Gradient legend: colour bar + min/max values
				const barEl = document.createElement('div');
				barEl.className = 'metric-legend-bar';
				entryEl.appendChild(barEl);
				const valuesEl = document.createElement('div');
				valuesEl.className = 'metric-legend-values';
				const minEl = document.createElement('span');
				minEl.textContent = formatMetricValue(result!.globalRange!.min, result!.channel);
				const maxEl = document.createElement('span');
				maxEl.textContent = formatMetricValue(result!.globalRange!.max, result!.channel);
				valuesEl.appendChild(minEl);
				valuesEl.appendChild(maxEl);
				entryEl.appendChild(valuesEl);
			}

			legendContainerEl.appendChild(entryEl);
		}
	});

	// ── Polyline rendering ───────────────────────────────────────────────────
	$effect(() => {
		if (!map || !L) return;

		void activities;
		void referenceIndex;
		void perFileComputation;

		for (const layer of layers) layer.remove();
		layers = [];
		for (const dm of driftMarkers) dm.remove();
		driftMarkers = [];

		const allPoints: import('leaflet').LatLng[] = [];

		for (let i = 0; i < activities.length; i++) {
			const activity = activities[i];
			const colour = FILE_COLOURS[(colourMap.get(activity.id) ?? i) % FILE_COLOURS.length];
			const gpsPoints = gpsCache[i];
			if (gpsPoints.length === 0) continue;

			const latLngs = gpsPoints.map(p => L!.latLng(p.lat, p.lon));
			allPoints.push(...latLngs);

			const isRef = referenceIndex !== undefined && i === referenceIndex;
			const actResult = perFileComputation[activity.id];

			if (!actResult || !actResult.globalRange) {
				// ── Flat colour polyline ─────────────────────────────────────────
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
						polyline.setTooltipContent(`${activity.filename} · ${(dist / 1000).toFixed(2)} km`);
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
				const canvasRenderer = L.canvas({ padding: 0.5 });
				const group = L.featureGroup();

				for (let j = 0; j + 1 < actResult.metricGpsPoints.length; j++) {
					const ptA = actResult.metricGpsPoints[j];
					const ptB = actResult.metricGpsPoints[j + 1];
					const valA = ptA.metricValue;
					const valB = ptB.metricValue;
					if (valA === null && valB === null) continue;

					const val = valA !== null && valB !== null ? (valA + valB) / 2 : (valA ?? valB)!;

					let segColour: string;
					if (actResult.zoneMode && athleteProfile) {
						const zone = valueToZone(val, actResult.channel, activity.sport ?? '', athleteProfile);
						segColour = zone !== null ? zoneToColour(zone) : colour;
					} else {
						segColour = valueToColour(val, actResult.globalRange.min, actResult.globalRange.max);
					}

					L.polyline([L.latLng(ptA.lat, ptA.lon), L.latLng(ptB.lat, ptB.lon)], {
						color: segColour,
						weight: 3,
						renderer: canvasRenderer,
						interactive: true,
					}).addTo(group);
				}

				group.bindTooltip(activity.filename, { sticky: true, opacity: 0.9 });

				group.on('mousemove', (e: import('leaflet').LeafletMouseEvent) => {
					if ($xAxisMode !== 'distance') return;
					const dist = distanceAtPoint(gpsPoints, e.latlng.lat, e.latlng.lng);
					if (dist !== null) {
						onHoverDistance?.(dist);
						const metricVal = nearestMetricValue(actResult.metricGpsPoints, dist);
						const distStr = `${(dist / 1000).toFixed(2)} km`;
						let metricStr = '';
						if (metricVal !== null) {
							const valStr = formatMetricValue(metricVal, actResult.channel);
							const unit = CHANNEL_META[actResult.channel].unit;
							if (actResult.zoneMode && athleteProfile) {
								const zone = valueToZone(metricVal, actResult.channel, activity.sport ?? '', athleteProfile);
								metricStr = zone !== null
									? ` · ${valStr} ${unit} Z${zone}`
									: ` · ${valStr} ${unit}`;
							} else {
								metricStr = ` · ${valStr} ${unit}`;
							}
						}
						group.setTooltipContent(`${activity.filename} · ${distStr}${metricStr}`);
					}
				});

				group.on('mouseout', () => {
					onHoverDistance?.(null);
					group.setTooltipContent(activity.filename);
				});

				group.addTo(map);
				layers.push(group);

				// Reference dashed overlay on top of zone/gradient canvas segments
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

		// GPS drift anomaly markers
		for (let i = 0; i < activities.length; i++) {
			const activity = activities[i];
			const driftAnomalies = activity.anomalies.filter(a => a.type === 'gps-drift');
			for (const anomaly of driftAnomalies) {
				const record = activity.records[anomaly.recordIndex];
				if (!record?.position) continue;
				const dm = L.circleMarker(L.latLng(record.position.lat, record.position.lon), {
					radius: 5,
					color: '#ef4444',
					fillColor: '#ef4444',
					fillOpacity: 0.8,
					weight: 1.5,
					interactive: true,
				});
				dm.bindTooltip('GPS drift detected', { sticky: false, opacity: 0.9 });
				dm.addTo(map);
				driftMarkers.push(dm);
			}
		}

		if (allPoints.length > 0) {
			map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20] });
		} else {
			map.setView([20, 0], 2);
		}

		markers = activities.map(() => null);
	});

	// ── Chart→map hover sync ──────────────────────────────────────────────────
	$effect(() => {
		if (!map || !L) return;

		if (hoveredDistance === null) {
			for (const m of markers) m?.remove();
			markers = activities.map(() => null);
			return;
		}

		for (let i = 0; i < activities.length; i++) {
			const pos = positionFromPoints(gpsCache[i], hoveredDistance);
			const colour = FILE_COLOURS[(colourMap.get(activities[i].id) ?? i) % FILE_COLOURS.length];

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

	/** Returns the metric value at the GPS point nearest to targetDist (binary search). */
	function nearestMetricValue(points: GpsPointWithMetric[], targetDist: number): number | null {
		if (points.length === 0) return null;
		let lo = 0;
		let hi = points.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (points[mid].distance < targetDist) lo = mid + 1;
			else hi = mid;
		}
		if (points[lo].distance < targetDist) return points[lo].metricValue;
		if (lo > 0) {
			const distToLo   = points[lo].distance - targetDist;
			const distToPrev = targetDist - points[lo - 1].distance;
			if (distToPrev <= distToLo) return points[lo - 1].metricValue;
		}
		return points[lo].metricValue;
	}

	// Chevron SVG shared between picker triggers
	const CHEVRON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
</script>

<div
	bind:this={container}
	class="map-container"
	role="img"
	aria-label="GPS route map"
></div>

<!-- Colour-by picker — position:fixed overlay, never clipped by overflow:hidden ancestors -->
{#if availableChannels.length > 0 && pickerVisible}
<div
	class="colour-picker"
	class:colour-picker--multi={activities.length > 1}
	bind:this={pickerEl}
	style:top="{pickerTop}px"
	style:right="{pickerRight}px"
>
	{#if activities.length <= 1}
		<!-- ── Single-file mode ──────────────────────────────────────────── -->
		{@const activity = activities[0]}
		{@const actId = activity?.id ?? ''}
		{@const config = configFor(actId)}
		{@const canZone = canUseZones(actId)}
		<span class="picker-label">Colour by</span>
		<div class="picker-wrapper">
			<button
				class="picker-trigger"
				type="button"
				onclick={() => openPickerFor = openPickerFor === actId ? null : actId}
			>
				<span class="picker-value">
					{config.channel ? channelPickerLabel(config.channel, activity) : 'None'}
				</span>
				<svg class="picker-arrow" xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
					<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			</button>
			{#if openPickerFor === actId}
			<ul class="picker-list" role="listbox">
				<li
					role="option"
					tabindex="0"
					aria-selected={config.channel === null}
					class:selected={config.channel === null}
					onclick={() => { selectChannel(actId, null); openPickerFor = null; }}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectChannel(actId, null); openPickerFor = null; } }}
				>None</li>
				{#each fileChannels(activity) as ch}
				<li
					role="option"
					tabindex="0"
					aria-selected={config.channel === ch}
					class:selected={config.channel === ch}
					onclick={() => { selectChannel(actId, ch); openPickerFor = null; }}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectChannel(actId, ch); openPickerFor = null; } }}
				>{channelPickerLabel(ch, activity)}</li>
				{/each}
			</ul>
			{/if}
		</div>
		{#if config.channel === 'heartRate' || config.channel === 'power'}
		<div
			class="zone-toggle"
			class:zone-toggle--disabled={!canZone}
			title={!canZone ? disabledZoneTitle(actId) : undefined}
			role="group"
			aria-label="Colour scale mode"
		>
			<button
				class="zone-toggle__seg"
				type="button"
				aria-pressed={!config.zoneMode}
				onclick={() => setZoneMode(actId, false)}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoneMode(actId, false); }}
				disabled={!canZone}
			>Gradient</button>
			<button
				class="zone-toggle__seg"
				type="button"
				aria-pressed={config.zoneMode}
				onclick={() => setZoneMode(actId, true)}
				onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoneMode(actId, true); }}
				disabled={!canZone}
			>Zones</button>
		</div>
		{/if}
	{:else}
		<!-- ── Multi-file mode ───────────────────────────────────────────── -->
		<div class="picker-header">Colour by</div>
		{#each activities as activity, i}
		{@const actId = activity.id}
		{@const config = configFor(actId)}
		{@const canZone = canUseZones(actId)}
		{@const fileColour = FILE_COLOURS[(colourMap.get(actId) ?? i) % FILE_COLOURS.length]}
		<div class="file-row">
			<span
				class="file-dot"
				style="background-color: {fileColour}; --dot-colour: {fileColour}"
				aria-hidden="true"
			></span>
			<span class="file-name" title={activity.filename}>{activity.filename}</span>
			<div class="picker-wrapper">
				<button
					class="picker-trigger"
					type="button"
					onclick={() => openPickerFor = openPickerFor === actId ? null : actId}
				>
					<span class="picker-value">
						{config.channel ? channelPickerLabel(config.channel, activity) : 'None'}
					</span>
					<svg class="picker-arrow" xmlns="http://www.w3.org/2000/svg" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
						<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
				{#if openPickerFor === actId}
				<ul class="picker-list" role="listbox">
					<li
						role="option"
						tabindex="0"
						aria-selected={config.channel === null}
						class:selected={config.channel === null}
						onclick={() => { selectChannel(actId, null); openPickerFor = null; }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectChannel(actId, null); openPickerFor = null; } }}
					>None</li>
					{#each fileChannels(activity) as ch}
					<li
						role="option"
						tabindex="0"
						aria-selected={config.channel === ch}
						class:selected={config.channel === ch}
						onclick={() => { selectChannel(actId, ch); openPickerFor = null; }}
						onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectChannel(actId, ch); openPickerFor = null; } }}
					>{channelPickerLabel(ch, activity)}</li>
					{/each}
				</ul>
				{/if}
			</div>
			{#if config.channel === 'heartRate' || config.channel === 'power'}
			<div
				class="zone-toggle"
				class:zone-toggle--disabled={!canZone}
				title={!canZone ? disabledZoneTitle(actId) : undefined}
				role="group"
				aria-label="Colour scale mode"
			>
				<button
					class="zone-toggle__seg"
					type="button"
					aria-pressed={!config.zoneMode}
					onclick={() => setZoneMode(actId, false)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoneMode(actId, false); }}
					disabled={!canZone}
				>Gradient</button>
				<button
					class="zone-toggle__seg"
					type="button"
					aria-pressed={config.zoneMode}
					onclick={() => setZoneMode(actId, true)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoneMode(actId, true); }}
					disabled={!canZone}
				>Zones</button>
			</div>
			{/if}
		</div>
		{/each}
	{/if}
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
	.colour-picker {
		position: fixed;
		z-index: 1001;
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
		max-width: 340px;
		transition: opacity 0.15s ease;
	}

	/* Applied via classList.add() in JS — needs :global to suppress Svelte's unused-selector warning */
	:global(.colour-picker.mode-switching) {
		opacity: 0.7;
	}

	@media (prefers-reduced-motion: reduce) {
		.colour-picker { transition: none; }
		:global(.colour-picker.mode-switching) {
			transition: none;
			opacity: 1;
		}
	}

	/* Multi-file: flex-column to stack file rows */
	.colour-picker--multi {
		flex-direction: column;
		align-items: stretch;
		gap: 5px;
		padding: 8px 10px;
	}

	/* ── Picker header (multi-file "Colour by" label) ────────────────────── */
	.picker-header {
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-muted, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		user-select: none;
		cursor: default;
		padding-bottom: 5px;
		border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
		margin-bottom: 1px;
	}

	/* ── File rows (multi-file) ──────────────────────────────────────────── */
	.file-row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 26px;
	}

	/* Colour dot — 8px circle with subtle glow */
	.file-dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		box-shadow: 0 0 4px 0 var(--dot-colour, currentColor);
	}

	/* Filename — truncated */
	.file-name {
		flex-shrink: 0;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--color-text, #f1f5f9);
		font-family: ui-monospace, 'Cascadia Code', 'SF Mono', monospace;
		letter-spacing: -0.01em;
	}

	/* Dropdown wrapper grows to fill row space */
	.file-row .picker-wrapper {
		flex: 1;
		min-width: 0;
	}

	.file-row .picker-trigger {
		width: 100%;
		min-width: 90px;
	}

	/* ── Single-file: original picker-label ─────────────────────────────── */
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

	/* ── Zone toggle (pill with two segments) ────────────────────────────── */
	.zone-toggle {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		height: 26px;
		border-radius: 5px;
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
		background: color-mix(in srgb, var(--color-card, #1e1e2e) 60%, transparent);
		overflow: hidden;
		outline: none;
	}

	.zone-toggle__seg {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8px;
		height: 100%;
		font-size: 0.72rem;
		font-weight: 500;
		font-family: inherit;
		cursor: pointer;
		border: none;
		background: transparent;
		color: var(--color-muted, #9ca3af);
		white-space: nowrap;
		line-height: 1;
		outline: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	/* Hairline separator between the two segments */
	.zone-toggle__seg:first-child {
		border-right: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
	}

	.zone-toggle__seg:not(:disabled):hover {
		color: var(--color-text, #f1f5f9);
		background: rgba(255, 255, 255, 0.06);
	}

	/* Active segment */
	.zone-toggle__seg[aria-pressed="true"]:not(:disabled) {
		background: #3b82f6;
		color: #ffffff;
	}

	/* Active first segment: give right-hand segment its separator back */
	.zone-toggle__seg[aria-pressed="true"]:not(:disabled):first-child {
		border-right-color: rgba(255, 255, 255, 0.15);
	}

	/* Focus-visible ring */
	.zone-toggle__seg:focus-visible {
		box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.6);
	}

	/* Disabled state */
	.zone-toggle--disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.zone-toggle--disabled .zone-toggle__seg {
		cursor: not-allowed;
		pointer-events: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.zone-toggle__seg {
			transition: none;
		}
	}

	/* ── Colour scale legend (Leaflet control, bottom-right) ─────────────── */
	:global(.metric-legend-control) {
		min-width: 160px;
	}

	:global(.metric-legend-control.hidden) {
		display: none;
	}

	/* Multi-file: stack entries with gap */
	:global(.metric-legend-entry + .metric-legend-entry) {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.08);
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

	/* Gradient legend */
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

	/* Zone legend */
	:global(.metric-legend-zones) {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	:global(.metric-legend-zone-row) {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	:global(.metric-legend-zone-swatch) {
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	:global(.metric-legend-zone-text) {
		font-size: 0.68rem;
		font-family: ui-monospace, 'Cascadia Code', monospace;
		color: var(--color-text, #f1f5f9);
		white-space: nowrap;
	}

	/* ── Leaflet layers control — always-expanded panel ────────────────── */
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

	:global(.leaflet-control-layers-separator) {
		display: none;
	}
</style>
