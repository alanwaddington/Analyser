import type { Activity, ChannelKey } from '$lib/types';

const ALL_CHANNELS: ChannelKey[] = [
	'heartRate',
	'power',
	'powerLeft',
	'powerRight',
	'cadence',
	'speed',
	'pace',
	'altitude',
	'temperature',
	'coreTemperature',
	'skinTemperature',
	'verticalOscillation',
	'groundContactTime',
	'strideLength',
];

export function deriveAvailableChannels(activities: Activity[]): ChannelKey[] {
	const union = new Set<ChannelKey>();
	for (const a of activities) {
		for (const ch of a.availableChannels) union.add(ch);
	}
	return ALL_CHANNELS.filter(ch => union.has(ch));
}
