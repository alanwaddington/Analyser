import type { Activity, ChannelKey } from '$lib/types';
import { groupAnomalyEvents } from '$lib/analytics/anomalies';

export interface AnomalyCount {
	total: number;
	spikes: number;
	dropouts: number;
	drifts: number;
}

export function buildAnomalyCounts(activities: Activity[]): Map<ChannelKey, AnomalyCount> {
	const map = new Map<ChannelKey, AnomalyCount>();
	for (const activity of activities) {
		for (const anomaly of groupAnomalyEvents(activity.anomalies)) {
			const existing = map.get(anomaly.channel) ?? { total: 0, spikes: 0, dropouts: 0, drifts: 0 };
			map.set(anomaly.channel, {
				total: existing.total + 1,
				spikes: existing.spikes + (anomaly.type === 'spike' ? 1 : 0),
				dropouts: existing.dropouts + (anomaly.type === 'dropout' ? 1 : 0),
				drifts: existing.drifts + (anomaly.type === 'gps-drift' ? 1 : 0),
			});
		}
	}
	return map;
}
