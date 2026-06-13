import { describe, it, expect } from 'vitest';
import { deriveAvailableChannels } from './channels.ts';
import type { Activity, ActivityRecord, ChannelKey } from '$lib/types';
import { channelsPresentInRecords } from '$lib/fit/parser';

function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds: 0,
		distance: 0,
		...overrides,
	};
}

function makeActivity(records: ActivityRecord[], availableChannels?: Set<ChannelKey>): Activity {
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(),
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
		availableChannels: availableChannels ?? channelsPresentInRecords(records),
	};
}

describe('deriveAvailableChannels', () => {
	it('deriveAvailableChannels_noActivities_returnsEmpty', () => {
		expect(deriveAvailableChannels([])).toEqual([]);
	});

	it('deriveAvailableChannels_noData_returnsEmpty', () => {
		const activity = makeActivity([makeRecord(), makeRecord()]);
		expect(deriveAvailableChannels([activity])).toEqual([]);
	});

	it('deriveAvailableChannels_singleActivityWithHR_returnsHeartRate', () => {
		const activity = makeActivity([
			makeRecord({ heartRate: 140 }),
			makeRecord({ heartRate: 145 }),
		]);
		const result = deriveAvailableChannels([activity]);
		expect(result).toContain('heartRate');
		expect(result).not.toContain('power');
	});

	it('deriveAvailableChannels_multipleActivities_returnsUnion', () => {
		const a1 = makeActivity([makeRecord({ heartRate: 140 })]);
		const a2 = makeActivity([makeRecord({ power: 250 })]);
		const result = deriveAvailableChannels([a1, a2]);
		expect(result).toContain('heartRate');
		expect(result).toContain('power');
	});

	it('deriveAvailableChannels_preservesCanonicalOrder', () => {
		const activity = makeActivity([
			makeRecord({ power: 250, heartRate: 140, cadence: 90 }),
		]);
		const result = deriveAvailableChannels([activity]);
		const hrIdx = result.indexOf('heartRate');
		const pwrIdx = result.indexOf('power');
		const cadIdx = result.indexOf('cadence');
		expect(hrIdx).toBeLessThan(pwrIdx);
		expect(pwrIdx).toBeLessThan(cadIdx);
	});

	it('deriveAvailableChannels_channelPresentInOnlyOneRecord_included', () => {
		const activity = makeActivity([
			makeRecord({ heartRate: 140 }),
			makeRecord(), // no HR
		]);
		const result = deriveAvailableChannels([activity]);
		expect(result).toContain('heartRate');
	});

	it('deriveAvailableChannels_emptyRecords_returnsEmpty', () => {
		const activity = makeActivity([]);
		expect(deriveAvailableChannels([activity])).toEqual([]);
	});
});
