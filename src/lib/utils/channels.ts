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
	return ALL_CHANNELS.filter(ch =>
		activities.some(a => a.records.some(r => (r[ch] as number | undefined) != null))
	);
}
