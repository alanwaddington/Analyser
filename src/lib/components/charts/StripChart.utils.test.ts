import { describe, it, expect } from 'vitest';
import { shouldShowGradient } from './StripChart.utils.ts';
import type { SeriesInput } from './TimeSeriesChart.utils.ts';
import type { Activity } from '$lib/types';

function makeSeriesInput(overrides: Partial<SeriesInput> = {}): SeriesInput {
	return {
		activity: {} as Activity,
		colourIndex: 0,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// shouldShowGradient
// ---------------------------------------------------------------------------
describe('shouldShowGradient', () => {
	it('shouldShowGradient_gradientOnSingleSeries_returnsTrue', () => {
		expect(shouldShowGradient(true, [makeSeriesInput()])).toBe(true);
	});

	it('shouldShowGradient_gradientOnMultipleSeries_returnsFalse', () => {
		expect(shouldShowGradient(true, [makeSeriesInput(), makeSeriesInput({ colourIndex: 1 })])).toBe(false);
	});

	it('shouldShowGradient_gradientOffSingleSeries_returnsFalse', () => {
		expect(shouldShowGradient(false, [makeSeriesInput()])).toBe(false);
	});

	it('shouldShowGradient_gradientOffMultipleSeries_returnsFalse', () => {
		expect(shouldShowGradient(false, [makeSeriesInput(), makeSeriesInput({ colourIndex: 1 })])).toBe(false);
	});

	it('shouldShowGradient_gradientOnEmptySeries_returnsFalse', () => {
		expect(shouldShowGradient(true, [])).toBe(false);
	});
});
