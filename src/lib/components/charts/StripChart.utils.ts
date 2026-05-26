import type { SeriesInput } from './TimeSeriesChart.utils';

/**
 * Sentinel colour token passed to TimeSeriesChart when gradient mode is active.
 * TimeSeriesChart detects this value and applies ECharts visualMap spectral
 * colouring in place of the standard FILE_COLOURS palette entry.
 *
 * Exporting as a named constant prevents the magic string from being scattered
 * across multiple files — update here and every consumer picks up the change.
 */
export const GRADIENT_COLOUR_TOKEN = '__gradient__';

/**
 * Returns true only when gradient colouring should be applied.
 * Gradient mode is only meaningful for a single series — multi-file views
 * fall back to standard FILE_COLOURS lines so every series remains distinguishable.
 */
export function shouldShowGradient(
	gradientMode: boolean,
	seriesInputs: SeriesInput[],
): boolean {
	return gradientMode && seriesInputs.length === 1;
}
