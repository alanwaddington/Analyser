import type { SeriesInput } from './TimeSeriesChart.utils';

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
