import { describe, it, expect } from 'vitest';
import { anomalyXValue } from './TimeSeriesChart.utils';
import type { SeriesInput } from './TimeSeriesChart.utils';
import type { Anomaly } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeSeriesInput(overrides: Partial<SeriesInput> = {}): SeriesInput {
	const activity = makeBaseActivity({
		records: [
			{ timestamp: new Date(0), elapsedSeconds: 10, distance: 500 },
			{ timestamp: new Date(1000), elapsedSeconds: 70, distance: 2000 },
			{ timestamp: new Date(2000), elapsedSeconds: 130, distance: 4500 },
		],
		...overrides.activity,
	});
	return { activity, colourIndex: 0, ...overrides };
}

function makeAnomaly(recordIndex: number): Anomaly {
	return {
		channel: 'heartRate',
		recordIndex,
		type: 'spike',
		value: 200,
		detectionStrategy: 'statistical',
	};
}

describe('anomalyXValue', () => {
	it('anomalyXValue_timeMode_noOffset_returnsElapsedSeconds', () => {
		const s = makeSeriesInput();
		const anomaly = makeAnomaly(1);
		const result = anomalyXValue(anomaly, s, 'time');
		expect(result).toBe(70); // record[1].elapsedSeconds
	});

	it('anomalyXValue_timeMode_withOffset_addsOffset', () => {
		const s = makeSeriesInput({ timeOffset: 30 });
		const anomaly = makeAnomaly(1);
		const result = anomalyXValue(anomaly, s, 'time');
		expect(result).toBe(100); // 70 + 30
	});

	it('anomalyXValue_distanceMode_noOffset_returnsDistanceKm', () => {
		const s = makeSeriesInput();
		const anomaly = makeAnomaly(2);
		const result = anomalyXValue(anomaly, s, 'distance');
		expect(result).toBeCloseTo(4.5); // 4500m / 1000
	});

	it('anomalyXValue_distanceMode_withOffset_addsOffsetKm', () => {
		const s = makeSeriesInput({ distanceOffset: 1000 });
		const anomaly = makeAnomaly(0);
		const result = anomalyXValue(anomaly, s, 'distance');
		expect(result).toBeCloseTo(1.5); // (500 + 1000) / 1000
	});

	it('anomalyXValue_invalidRecordIndex_returnsZero', () => {
		const s = makeSeriesInput();
		const anomaly = makeAnomaly(999); // out of bounds
		const result = anomalyXValue(anomaly, s, 'time');
		expect(result).toBe(0);
	});

	it('anomalyXValue_firstRecord_returnsCorrectValue', () => {
		const s = makeSeriesInput();
		const anomaly = makeAnomaly(0);
		expect(anomalyXValue(anomaly, s, 'time')).toBe(10);
		expect(anomalyXValue(anomaly, s, 'distance')).toBeCloseTo(0.5);
	});
});
