import type { AthleteProfile, ChannelKey } from '$lib/types';
import { formatPace } from '$lib/utils/formatting';
import {
	hrZoneBoundaries,
	cpZoneBoundaries,
	ftpZoneBoundaries,
	lthrToEstimatedMaxHR,
} from '$lib/analytics/zones';
import type { ZoneBand } from '$lib/analytics/zones';

/**
 * 4-stop gradient: blue → green → yellow → red
 * Each stop is [R, G, B].
 */
export const GRADIENT_STOPS: [number, number, number][] = [
	[0, 100, 255],   // blue
	[0, 200, 100],   // green
	[255, 220, 0],   // yellow
	[255, 50, 0],    // red
];

/**
 * Map a value in [min, max] to a hex colour using the blue→green→yellow→red gradient.
 * Out-of-range values are clamped.
 * When min === max, returns the middle of the gradient.
 * If `invert` is true, the gradient is reversed (red at min, blue at max).
 */
export function valueToColour(
	value: number,
	min: number,
	max: number,
	invert = false,
): string {
	// Normalise to [0, 1]; handle degenerate range
	let t: number;
	if (max === min) {
		t = 0.5;
	} else {
		t = Math.max(0, Math.min(1, (value - min) / (max - min)));
	}

	if (invert) t = 1 - t;

	// Map t across the 4 gradient stops (3 segments)
	const numSegments = GRADIENT_STOPS.length - 1;
	const scaledT = t * numSegments;
	const stopIndex = Math.min(Math.floor(scaledT), numSegments - 1);
	const segmentT = scaledT - stopIndex;

	const [r1, g1, b1] = GRADIENT_STOPS[stopIndex];
	const [r2, g2, b2] = GRADIENT_STOPS[stopIndex + 1];

	const r = Math.round(r1 + segmentT * (r2 - r1));
	const g = Math.round(g1 + segmentT * (g2 - g1));
	const b = Math.round(b1 + segmentT * (b2 - b1));

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
	return value.toString(16).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Zone colour palette
// ---------------------------------------------------------------------------

/**
 * Base RGB values for the 7 training zones (Z1–Z7).
 * Index 0 = Z1 (grey/slate), index 6 = Z7 (pink).
 * Shared between map (opaque) and chart band (semi-transparent) renderers.
 */
export const ZONE_BASE_RGB: [number, number, number][] = [
	[148, 163, 184], // Z1 — slate (recovery)
	[ 96, 165, 250], // Z2 — blue (endurance)
	[ 74, 222, 128], // Z3 — green (tempo)
	[251, 191,  36], // Z4 — amber (threshold)
	[248, 113, 113], // Z5 — red (VO2 max)
	[192, 132, 252], // Z6 — purple (anaerobic)
	[244, 114, 182], // Z7 — pink (neuromuscular)
];

// Dark/light alpha values per zone (match TimeSeriesChart.svelte ZONE_COLOURS exactly)
const ZONE_ALPHA_DARK  = [0.12, 0.18, 0.18, 0.20, 0.22, 0.22, 0.22];
const ZONE_ALPHA_LIGHT = [0.20, 0.28, 0.28, 0.32, 0.35, 0.35, 0.35];

/** Clamp a zone number to [1, 7] for safe array indexing. */
function clampZone(zone: number): number {
	return Math.max(1, Math.min(7, Math.round(zone)));
}

/**
 * Returns an opaque hex colour for map polyline segments.
 * Zone numbers outside [1, 7] are clamped.
 */
export function zoneToColour(zone: number): string {
	const [r, g, b] = ZONE_BASE_RGB[clampZone(zone) - 1];
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Returns a semi-transparent rgba colour for ECharts zone band markAreas.
 * Produces the same values as the inline ZONE_COLOURS in TimeSeriesChart.svelte.
 */
export function zoneChartColour(zone: number, isDark: boolean): string {
	const idx = clampZone(zone) - 1;
	const [r, g, b] = ZONE_BASE_RGB[idx];
	const alpha = isDark ? ZONE_ALPHA_DARK[idx] : ZONE_ALPHA_LIGHT[idx];
	return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Zone boundary utilities
// ---------------------------------------------------------------------------

const MANUFACTURER_DISPLAY: Record<string, string> = {
	garmin: 'Garmin',
	suunto: 'Suunto',
	coros: 'COROS',
	polar: 'Polar',
	wahoo: 'Wahoo',
	wahoo_fitness: 'Wahoo',
};

/**
 * Returns the display label for the power channel in the map metric selector,
 * based on the activity's power source and the device manufacturer (lowercase).
 */
export function powerSourceLabel(
	powerSource: 'stryd' | 'native' | 'cycling' | undefined,
	manufacturer: string | undefined,
): string {
	if (powerSource === 'stryd') return 'Stryd Power';
	if (powerSource === 'native') {
		const mfr = manufacturer ? (MANUFACTURER_DISPLAY[manufacturer.toLowerCase()] ?? undefined) : undefined;
		return mfr ? `${mfr} Running Power` : 'Running Power';
	}
	return 'Power';
}

/**
 * Returns the zone band boundaries for the given channel, sport and athlete profile.
 * HR: 5-zone model (maxHR or LTHR-derived maxHR), sport-aware.
 * Power (running): 5-zone CP model.
 * Power (cycling/other): 7-zone FTP model.
 * Returns null when no matching threshold is set in the profile.
 */
export function getZoneBoundaries(
	channel: ChannelKey,
	sport: string,
	profile: AthleteProfile,
): ZoneBand[] | null {
	if (channel === 'heartRate') {
		const primaryMaxHR  = sport === 'cycling' ? profile.maxHrCycling : profile.maxHrRunning;
		const fallbackMaxHR = sport === 'cycling' ? profile.maxHrRunning  : profile.maxHrCycling;
		const maxHR = primaryMaxHR ?? fallbackMaxHR;
		if (maxHR != null) return hrZoneBoundaries(maxHR);
		if (profile.lthr != null) return hrZoneBoundaries(lthrToEstimatedMaxHR(profile.lthr));
		return null;
	}
	if (channel === 'power') {
		if (sport === 'running') {
			return profile.cp != null ? cpZoneBoundaries(profile.cp) : null;
		}
		return profile.ftp != null ? ftpZoneBoundaries(profile.ftp) : null;
	}
	return null;
}

/**
 * Returns the zone number (1–7) for a given metric value, or null when zones
 * are not configured for this channel/sport/profile combination.
 */
export function valueToZone(
	value: number,
	channel: ChannelKey,
	sport: string,
	profile: AthleteProfile,
): number | null {
	const bands = getZoneBoundaries(channel, sport, profile);
	if (!bands) return null;
	for (const band of bands) {
		if (value >= band.min && value < band.max) return band.zone;
	}
	return bands[bands.length - 1].zone;
}

/**
 * Formats a zone band as a human-readable boundary string.
 * Examples: "Z1: <108 bpm", "Z2: 108–126 bpm", "Z5: >162 bpm"
 */
export function formatZoneBoundary(band: ZoneBand, channel: ChannelKey): string {
	const unit = channel === 'heartRate' ? 'bpm' : 'W';
	const z = `Z${band.zone}`;
	if (band.min === 0) return `${z}: <${Math.round(band.max)} ${unit}`;
	if (!isFinite(band.max)) return `${z}: >${Math.round(band.min)} ${unit}`;
	return `${z}: ${Math.round(band.min)}–${Math.round(band.max)} ${unit}`;
}

// ---------------------------------------------------------------------------

/**
 * Format a metric value for tooltip/legend display.
 * - pace: M:SS (min/km)
 * - heartRate, power, cadence: integer (rounds to nearest)
 * - all others: 1 decimal place
 */
export function formatMetricValue(value: number, channel: ChannelKey): string {
	switch (channel) {
		case 'pace':
			return formatPace(value);
		case 'heartRate':
		case 'power':
		case 'powerLeft':
		case 'powerRight':
		case 'cadence':
			return Math.round(value).toString();
		default:
			return value.toFixed(1);
	}
}
