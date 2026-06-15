import { channelsPresentInRecords } from '$lib/fit/parser';
import type { Activity } from '$lib/types';

export function makeBaseActivity(overrides: Partial<Activity> = {}): Activity {
	const records = overrides.records ?? [];
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(0),
		totalDistance: 0,
		totalElapsedTime: 0,
		records,
		laps: [],
		devices: [],
		deviceStreams: [],
		firstGpsFixIndex: null,
		firstGpsMovementIndex: null,
		timerStartTime: null,
		firstIndoorMovementIndex: null,
		firstWorkoutStepTime: null,
		subSport: undefined,
		isIndoor: false,
		anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(0), source: 'fileStart' as const },
		availableChannels: channelsPresentInRecords(records),
		anomalies: [],
		...overrides,
	};
}
