<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Activity } from '$lib/types';
	import { FILE_COLOURS } from '$lib/types';
	import { positionFromPoints, extractGpsPoints } from './ActivityMap.utils.ts';

	let {
		activities,
		referenceIndex = undefined,
		hoveredDistance,
	}: {
		activities: Activity[];
		referenceIndex?: number;
		hoveredDistance: number | null;
	} = $props();

	const gpsCache = $derived(activities.map(a => extractGpsPoints(a)));

	let container: HTMLDivElement;
	let L = $state<typeof import('leaflet') | undefined>(undefined);
	let map = $state<import('leaflet').Map | undefined>(undefined);
	let polylines: import('leaflet').Polyline[] = [];
	let markers: (import('leaflet').CircleMarker | null)[] = [];
	let resizeObserver: ResizeObserver | undefined;

	onMount(async () => {
		L = await import('leaflet');
		await import('leaflet/dist/leaflet.css');

		map = L.map(container);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		}).addTo(map);

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

	$effect(() => {
		if (!map || !L) return;

		void activities;
		void referenceIndex;

		for (const p of polylines) p.remove();
		polylines = [];

		const allPoints: import('leaflet').LatLng[] = [];

		for (let i = 0; i < activities.length; i++) {
			const activity = activities[i];
			const colour = FILE_COLOURS[i % FILE_COLOURS.length];
			const gpsPoints = gpsCache[i];
			if (gpsPoints.length === 0) continue;

			const latLngs = gpsPoints.map(p => L!.latLng(p.lat, p.lon));
			allPoints.push(...latLngs);

			const isRef = referenceIndex !== undefined && i === referenceIndex;
			const polyline = L.polyline(latLngs, {
				color: colour,
				weight: 2.5,
				renderer: isRef ? L.svg() : undefined,
				className: isRef ? 'ref-polyline' : undefined,
			});

			polyline.bindTooltip(activity.filename, { sticky: true, opacity: 0.9 });
			polyline.addTo(map);
			polylines.push(polyline);
		}

		if (allPoints.length > 0) {
			map.fitBounds(L.latLngBounds(allPoints), { padding: [20, 20] });
		} else {
			map.setView([20, 0], 2);
		}

		markers = activities.map(() => null);
	});

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
</style>
