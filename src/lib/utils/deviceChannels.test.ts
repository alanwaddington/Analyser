import { describe, it, expect } from 'vitest';
import {
	deriveDeviceLabel,
	deviceKey,
	groupStreamsByChannel,
	isComparableGroup,
	getActiveStreamsForChannel,
} from './deviceChannels.ts';
import type { Activity, CrossFileStream, Device, DeviceStream } from '$lib/types';

function makeDevice(overrides: Partial<Device> = {}): Device {
	return { deviceIndex: 0, ...overrides };
}

function makeStream(device: Device, channels: DeviceStream['channels']): DeviceStream {
	return { device, channels };
}

function makeActivity(id: string): Activity {
	return {
		id,
		filename: `${id}.fit`,
		startTime: new Date(),
		totalDistance: 0,
		totalElapsedTime: 0,
		records: [],
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
	};
}

function makeCrossFileStream(
	activityId: string,
	device: Device,
	channels: DeviceStream['channels']
): CrossFileStream {
	const activity = makeActivity(activityId);
	const stream = makeStream(device, channels);
	return { stream, activity, key: deviceKey(activityId, device.deviceIndex) };
}

// ---- deriveDeviceLabel ----

describe('deriveDeviceLabel', () => {
	it('deriveDeviceLabel_userLabelSet_returnsUserLabel', () => {
		const device = makeDevice({ label: 'My Assioma', manufacturer: 'favero', product: 'Assioma DUO' });
		expect(deriveDeviceLabel(device)).toBe('My Assioma');
	});

	it('deriveDeviceLabel_noUserLabel_returnsManufacturerAndProduct', () => {
		const device = makeDevice({ manufacturer: 'garmin', product: 'Rally RS200' });
		expect(deriveDeviceLabel(device)).toBe('garmin Rally RS200');
	});

	it('deriveDeviceLabel_manufacturerOnly_returnsManufacturer', () => {
		const device = makeDevice({ manufacturer: 'polar' });
		expect(deriveDeviceLabel(device)).toBe('polar');
	});

	it('deriveDeviceLabel_productOnly_returnsProduct', () => {
		const device = makeDevice({ product: 'H10' });
		expect(deriveDeviceLabel(device)).toBe('H10');
	});

	it('deriveDeviceLabel_noLabel_returnsFallback', () => {
		const device = makeDevice({ deviceIndex: 3 });
		expect(deriveDeviceLabel(device)).toBe('Device 3');
	});

	it('deriveDeviceLabel_emptyStringsIgnored_returnsFallback', () => {
		const device = makeDevice({ manufacturer: '', product: '', deviceIndex: 1 });
		expect(deriveDeviceLabel(device)).toBe('Device 1');
	});
});

// ---- deviceKey ----

describe('deviceKey', () => {
	it('deviceKey_activityIdAndDeviceIndex_returnsCompositeKey', () => {
		expect(deviceKey('abc-123', 0)).toBe('abc-123:0');
	});

	it('deviceKey_differentActivityIds_produceDifferentKeys', () => {
		expect(deviceKey('activity-a', 0)).not.toBe(deviceKey('activity-b', 0));
	});

	it('deviceKey_sameActivityIdDifferentDeviceIndex_produceDifferentKeys', () => {
		expect(deviceKey('activity-a', 0)).not.toBe(deviceKey('activity-a', 1));
	});
});

// ---- groupStreamsByChannel ----

describe('groupStreamsByChannel', () => {
	it('groupStreamsByChannel_emptyStreams_returnsEmptyMap', () => {
		const result = groupStreamsByChannel([]);
		expect(result.size).toBe(0);
	});

	it('groupStreamsByChannel_singleDevice_groupsChannelsCorrectly', () => {
		const cfs = makeCrossFileStream('act1', makeDevice(), ['heartRate', 'speed']);
		const result = groupStreamsByChannel([cfs]);
		expect(result.get('heartRate')).toEqual([cfs]);
		expect(result.get('speed')).toEqual([cfs]);
	});

	it('groupStreamsByChannel_twoDevicesSameChannel_bothAppearInGroup', () => {
		const hrm = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['heartRate']);
		const watch = makeCrossFileStream('act1', makeDevice({ deviceIndex: 0 }), ['heartRate', 'speed']);
		const result = groupStreamsByChannel([hrm, watch]);
		const hrGroup = result.get('heartRate')!;
		expect(hrGroup).toHaveLength(2);
		expect(hrGroup).toContain(hrm);
		expect(hrGroup).toContain(watch);
	});

	it('groupStreamsByChannel_devicesAcrossFiles_groupedByChannel', () => {
		const fileA = makeCrossFileStream('act-a', makeDevice({ deviceIndex: 0 }), ['heartRate']);
		const fileB = makeCrossFileStream('act-b', makeDevice({ deviceIndex: 0 }), ['heartRate']);
		const result = groupStreamsByChannel([fileA, fileB]);
		const hrGroup = result.get('heartRate')!;
		expect(hrGroup).toHaveLength(2);
		expect(hrGroup[0]).toBe(fileA);
		expect(hrGroup[1]).toBe(fileB);
	});

	it('groupStreamsByChannel_preservesInsertionOrderPerGroup', () => {
		const s1 = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['power']);
		const s2 = makeCrossFileStream('act1', makeDevice({ deviceIndex: 2 }), ['power']);
		const result = groupStreamsByChannel([s1, s2]);
		expect(result.get('power')![0]).toBe(s1);
		expect(result.get('power')![1]).toBe(s2);
	});
});

// ---- isComparableGroup ----

describe('isComparableGroup', () => {
	it('isComparableGroup_twoOrMoreStreams_returnsTrue', () => {
		const s1 = makeCrossFileStream('act1', makeDevice(), ['heartRate']);
		const s2 = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['heartRate']);
		expect(isComparableGroup([s1, s2])).toBe(true);
	});

	it('isComparableGroup_oneStream_returnsFalse', () => {
		expect(isComparableGroup([makeCrossFileStream('act1', makeDevice(), ['heartRate'])])).toBe(false);
	});

	it('isComparableGroup_emptyArray_returnsFalse', () => {
		expect(isComparableGroup([])).toBe(false);
	});
});

// ---- getActiveStreamsForChannel ----

describe('getActiveStreamsForChannel', () => {
	it('getActiveStreamsForChannel_activeDevice_returnsStream', () => {
		const cfs = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['heartRate']);
		const result = getActiveStreamsForChannel([cfs], 'heartRate', new Set([cfs.key]));
		expect(result).toEqual([cfs]);
	});

	it('getActiveStreamsForChannel_inactiveDevice_returnsEmpty', () => {
		const cfs = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['heartRate']);
		const result = getActiveStreamsForChannel([cfs], 'heartRate', new Set());
		expect(result).toEqual([]);
	});

	it('getActiveStreamsForChannel_streamDoesNotIncludeChannel_excluded', () => {
		const cfs = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['speed']);
		const result = getActiveStreamsForChannel([cfs], 'heartRate', new Set([cfs.key]));
		expect(result).toEqual([]);
	});

	it('getActiveStreamsForChannel_mixedActiveInactive_returnsOnlyActive', () => {
		const s1 = makeCrossFileStream('act1', makeDevice({ deviceIndex: 1 }), ['power']);
		const s2 = makeCrossFileStream('act1', makeDevice({ deviceIndex: 2 }), ['power']);
		const result = getActiveStreamsForChannel([s1, s2], 'power', new Set([s1.key]));
		expect(result).toEqual([s1]);
	});

	it('getActiveStreamsForChannel_sameDeviceIndexAcrossFiles_filteredByKey', () => {
		// Two files both have deviceIndex 0, but different activity IDs
		const s1 = makeCrossFileStream('act-a', makeDevice({ deviceIndex: 0 }), ['heartRate']);
		const s2 = makeCrossFileStream('act-b', makeDevice({ deviceIndex: 0 }), ['heartRate']);
		// Only activate s1
		const result = getActiveStreamsForChannel([s1, s2], 'heartRate', new Set([s1.key]));
		expect(result).toEqual([s1]);
		expect(result).not.toContain(s2);
	});
});
