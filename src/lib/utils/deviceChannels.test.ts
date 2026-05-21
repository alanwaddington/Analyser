import { describe, it, expect } from 'vitest';
import {
	deriveDeviceLabel,
	groupStreamsByChannel,
	isComparableGroup,
	getActiveStreamsForChannel,
} from './deviceChannels.ts';
import type { Device, DeviceStream } from '$lib/types';

function makeDevice(overrides: Partial<Device> = {}): Device {
	return { deviceIndex: 0, ...overrides };
}

function makeStream(device: Device, channels: DeviceStream['channels']): DeviceStream {
	return { device, channels };
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

// ---- groupStreamsByChannel ----

describe('groupStreamsByChannel', () => {
	it('groupStreamsByChannel_emptyStreams_returnsEmptyMap', () => {
		const result = groupStreamsByChannel([]);
		expect(result.size).toBe(0);
	});

	it('groupStreamsByChannel_singleDevice_groupsChannelsCorrectly', () => {
		const stream = makeStream(makeDevice(), ['heartRate', 'speed']);
		const result = groupStreamsByChannel([stream]);
		expect(result.get('heartRate')).toEqual([stream]);
		expect(result.get('speed')).toEqual([stream]);
	});

	it('groupStreamsByChannel_twoDevicesSameChannel_bothAppearInGroup', () => {
		const hrm = makeStream(makeDevice({ deviceIndex: 1 }), ['heartRate']);
		const watch = makeStream(makeDevice({ deviceIndex: 0 }), ['heartRate', 'speed']);
		const result = groupStreamsByChannel([hrm, watch]);
		const hrGroup = result.get('heartRate')!;
		expect(hrGroup).toHaveLength(2);
		expect(hrGroup).toContain(hrm);
		expect(hrGroup).toContain(watch);
	});

	it('groupStreamsByChannel_preservesInsertionOrderPerGroup', () => {
		const s1 = makeStream(makeDevice({ deviceIndex: 1 }), ['power']);
		const s2 = makeStream(makeDevice({ deviceIndex: 2 }), ['power']);
		const result = groupStreamsByChannel([s1, s2]);
		expect(result.get('power')![0]).toBe(s1);
		expect(result.get('power')![1]).toBe(s2);
	});
});

// ---- isComparableGroup ----

describe('isComparableGroup', () => {
	it('isComparableGroup_twoOrMoreStreams_returnsTrue', () => {
		expect(isComparableGroup([makeStream(makeDevice(), ['heartRate']), makeStream(makeDevice({ deviceIndex: 1 }), ['heartRate'])])).toBe(true);
	});

	it('isComparableGroup_oneStream_returnsFalse', () => {
		expect(isComparableGroup([makeStream(makeDevice(), ['heartRate'])])).toBe(false);
	});

	it('isComparableGroup_emptyArray_returnsFalse', () => {
		expect(isComparableGroup([])).toBe(false);
	});
});

// ---- getActiveStreamsForChannel ----

describe('getActiveStreamsForChannel', () => {
	it('getActiveStreamsForChannel_activeDevice_returnsStream', () => {
		const stream = makeStream(makeDevice({ deviceIndex: 1 }), ['heartRate']);
		const result = getActiveStreamsForChannel([stream], 'heartRate', new Set([1]));
		expect(result).toEqual([stream]);
	});

	it('getActiveStreamsForChannel_inactiveDevice_returnsEmpty', () => {
		const stream = makeStream(makeDevice({ deviceIndex: 1 }), ['heartRate']);
		const result = getActiveStreamsForChannel([stream], 'heartRate', new Set());
		expect(result).toEqual([]);
	});

	it('getActiveStreamsForChannel_streamDoesNotIncludeChannel_excluded', () => {
		const stream = makeStream(makeDevice({ deviceIndex: 1 }), ['speed']);
		const result = getActiveStreamsForChannel([stream], 'heartRate', new Set([1]));
		expect(result).toEqual([]);
	});

	it('getActiveStreamsForChannel_mixedActiveInactive_returnsOnlyActive', () => {
		const s1 = makeStream(makeDevice({ deviceIndex: 1 }), ['power']);
		const s2 = makeStream(makeDevice({ deviceIndex: 2 }), ['power']);
		const result = getActiveStreamsForChannel([s1, s2], 'power', new Set([1]));
		expect(result).toEqual([s1]);
	});
});
