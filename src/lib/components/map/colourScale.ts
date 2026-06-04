import type { ChannelKey } from '$lib/types';
import { formatPace } from '$lib/utils/formatting';

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
