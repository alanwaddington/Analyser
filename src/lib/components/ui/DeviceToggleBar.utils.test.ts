import { describe, it, expect } from 'vitest';
import { buildAnomalyCounts } from './DeviceToggleBar.utils';
import type { Activity, Anomaly } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
	return {
		channel: 'heartRate',
		recordIndex: 0,
		type: 'spike',
		value: 200,
		detectionStrategy: 'statistical',
		...overrides,
	};
}

describe('buildAnomalyCounts', () => {
	it('buildAnomalyCounts_emptyActivities_returnsEmptyMap', () => {
		const result = buildAnomalyCounts([]);
		expect(result.size).toBe(0);
	});

	it('buildAnomalyCounts_noAnomalies_returnsEmptyMap', () => {
		const activity = makeBaseActivity({ anomalies: [] });
		const result = buildAnomalyCounts([activity]);
		expect(result.size).toBe(0);
	});

	it('buildAnomalyCounts_singleSpike_returnsTotalOneSpikesOne', () => {
		const activity = makeBaseActivity({
			anomalies: [makeAnomaly({ channel: 'heartRate', type: 'spike' })],
		});
		const result = buildAnomalyCounts([activity]);
		expect(result.get('heartRate')).toEqual({ total: 1, spikes: 1, dropouts: 0, drifts: 0 });
	});

	it('buildAnomalyCounts_singleDropout_returnsTotalOneDropoutsOne', () => {
		const activity = makeBaseActivity({
			anomalies: [makeAnomaly({ channel: 'power', type: 'dropout' })],
		});
		const result = buildAnomalyCounts([activity]);
		expect(result.get('power')).toEqual({ total: 1, spikes: 0, dropouts: 1, drifts: 0 });
	});

	it('buildAnomalyCounts_gpsDrift_returnsDriftsOne', () => {
		const activity = makeBaseActivity({
			anomalies: [makeAnomaly({ channel: 'speed', type: 'gps-drift' })],
		});
		const result = buildAnomalyCounts([activity]);
		expect(result.get('speed')).toEqual({ total: 1, spikes: 0, dropouts: 0, drifts: 1 });
	});

	it('buildAnomalyCounts_multipleTypesOnChannel_sumsAllCounts', () => {
		const activity = makeBaseActivity({
			anomalies: [
				makeAnomaly({ channel: 'heartRate', type: 'spike' }),
				makeAnomaly({ channel: 'heartRate', type: 'spike' }),
				makeAnomaly({ channel: 'heartRate', type: 'dropout' }),
			],
		});
		const result = buildAnomalyCounts([activity]);
		expect(result.get('heartRate')).toEqual({ total: 3, spikes: 2, dropouts: 1, drifts: 0 });
	});

	it('buildAnomalyCounts_multipleChannels_separateEntriesPerChannel', () => {
		const activity = makeBaseActivity({
			anomalies: [
				makeAnomaly({ channel: 'heartRate', type: 'spike' }),
				makeAnomaly({ channel: 'power', type: 'dropout' }),
				makeAnomaly({ channel: 'cadence', type: 'spike' }),
			],
		});
		const result = buildAnomalyCounts([activity]);
		expect(result.size).toBe(3);
		expect(result.get('heartRate')?.total).toBe(1);
		expect(result.get('power')?.total).toBe(1);
		expect(result.get('cadence')?.total).toBe(1);
	});

	it('buildAnomalyCounts_multipleActivities_aggregatesAcrossAllActivities', () => {
		const a1 = makeBaseActivity({
			id: 'a1',
			anomalies: [makeAnomaly({ channel: 'heartRate', type: 'spike' })],
		});
		const a2 = makeBaseActivity({
			id: 'a2',
			anomalies: [makeAnomaly({ channel: 'heartRate', type: 'dropout' })],
		});
		const result = buildAnomalyCounts([a1, a2]);
		expect(result.get('heartRate')).toEqual({ total: 2, spikes: 1, dropouts: 1, drifts: 0 });
	});

	it('buildAnomalyCounts_channelWithNoAnomalies_notInMap', () => {
		const activity = makeBaseActivity({
			anomalies: [makeAnomaly({ channel: 'heartRate', type: 'spike' })],
		});
		const result = buildAnomalyCounts([activity]);
		expect(result.has('power')).toBe(false);
	});
});
