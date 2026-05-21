import { describe, it, expect } from 'vitest';
import { normaliseRecord, normaliseDeviceInfo, buildDeviceStreams } from './parser.ts';
import type { Device, ActivityRecord } from '$lib/types';
import { ANT_DEVICE_TYPE } from '$lib/types';

describe('normaliseRecord — power field mapping', () => {
	it('normaliseRecord_strydDeveloperPower_mapsToActivityRecordPower', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, 'Power': 221 } as any);
		expect(record.power).toBe(221);
	});

	it('normaliseRecord_standardPower_mapsToActivityRecordPower', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, power: 300 } as any);
		expect(record.power).toBe(300);
	});

	it('normaliseRecord_standardPowerAndDeveloperPower_standardPowerTakesPrecedence', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, power: 300, 'Power': 221 } as any);
		expect(record.power).toBe(300);
	});

	it('normaliseRecord_noPower_powerIsUndefined', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10 } as any);
		expect(record.power).toBeUndefined();
	});
});

describe('normaliseDeviceInfo', () => {
	it('normaliseDeviceInfo_withAllFields_mapsCorrectly', () => {
		const result = normaliseDeviceInfo({
			device_index: 2,
			manufacturer: 'garmin',
			product_name: 'Rally RS200',
			serial_number: 12345678,
			ant_device_number: 9876,
			device_type: 11,
			source_type: 'antplus',
		});
		expect(result.deviceIndex).toBe(2);
		expect(result.manufacturer).toBe('garmin');
		expect(result.product).toBe('Rally RS200');
		expect(result.serialNumber).toBe(12345678);
		expect(result.antDeviceNumber).toBe(9876);
		expect(result.antDeviceType).toBe(11);
		expect(result.sourceType).toBe('antplus');
	});

	it('normaliseDeviceInfo_minimalFields_populatesDefaults', () => {
		const result = normaliseDeviceInfo({ device_index: 0 });
		expect(result.deviceIndex).toBe(0);
		expect(result.manufacturer).toBeUndefined();
		expect(result.antDeviceType).toBeUndefined();
		expect(result.sourceType).toBeUndefined();
	});

	it('normaliseDeviceInfo_missingDeviceIndex_defaultsToZero', () => {
		const result = normaliseDeviceInfo({});
		expect(result.deviceIndex).toBe(0);
	});
});

// ---- helpers for buildDeviceStreams tests ----
const ts = new Date();
function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return { timestamp: ts, elapsedSeconds: 0, distance: 0, ...overrides };
}
function makeDevice(overrides: Partial<Device> = {}): Device {
	return { deviceIndex: 0, ...overrides };
}

describe('buildDeviceStreams', () => {
	it('buildDeviceStreams_noDevices_returnsEmptyArray', () => {
		const result = buildDeviceStreams([], [makeRecord({ heartRate: 120 })]);
		expect(result).toHaveLength(0);
	});

	it('buildDeviceStreams_watchOnly_attributesAllPresentChannelsToWatch', () => {
		const watch = makeDevice({ deviceIndex: 0, sourceType: 'local' });
		const records = [makeRecord({ heartRate: 120, speed: 10, altitude: 50 })];
		const streams = buildDeviceStreams([watch], records);
		expect(streams).toHaveLength(1);
		expect(streams[0].device).toBe(watch);
		expect(streams[0].channels).toContain('heartRate');
		expect(streams[0].channels).toContain('speed');
		expect(streams[0].channels).toContain('altitude');
	});

	it('buildDeviceStreams_externalHRM_attributesHeartRateToHRM', () => {
		const watch = makeDevice({ deviceIndex: 0, sourceType: 'local' });
		const hrm = makeDevice({ deviceIndex: 1, antDeviceType: ANT_DEVICE_TYPE.HEART_RATE });
		const records = [makeRecord({ heartRate: 140, speed: 12 })];
		const streams = buildDeviceStreams([watch, hrm], records);
		const hrmStream = streams.find(s => s.device === hrm);
		const watchStream = streams.find(s => s.device === watch);
		expect(hrmStream?.channels).toContain('heartRate');
		expect(watchStream?.channels).not.toContain('heartRate');
	});

	it('buildDeviceStreams_powerMeter_attributesPowerChannelsToPowerMeter', () => {
		const watch = makeDevice({ deviceIndex: 0, sourceType: 'local' });
		const powerMeter = makeDevice({ deviceIndex: 2, antDeviceType: ANT_DEVICE_TYPE.BIKE_POWER });
		const records = [makeRecord({ power: 250, cadence: 90 })];
		const streams = buildDeviceStreams([watch, powerMeter], records);
		const pmStream = streams.find(s => s.device === powerMeter);
		expect(pmStream?.channels).toContain('power');
	});

	it('buildDeviceStreams_channelWithAllNullValues_excludedFromStream', () => {
		const watch = makeDevice({ deviceIndex: 0, sourceType: 'local' });
		const records = [makeRecord({ heartRate: undefined, speed: 10 })];
		const streams = buildDeviceStreams([watch], records);
		expect(streams[0].channels).not.toContain('heartRate');
		expect(streams[0].channels).toContain('speed');
	});

	it('buildDeviceStreams_externalSensorWithNoMatchingChannels_includedWithEmptyChannels', () => {
		const watch = makeDevice({ deviceIndex: 0, sourceType: 'local' });
		const sensor = makeDevice({ deviceIndex: 1, antDeviceType: ANT_DEVICE_TYPE.HEART_RATE });
		// No heartRate in records → sensor is still included so the UI can show a "no data" pill
		const records = [makeRecord({ speed: 10 })];
		const streams = buildDeviceStreams([watch, sensor], records);
		const sensorStream = streams.find(s => s.device === sensor);
		expect(sensorStream).toBeDefined();
		expect(sensorStream?.channels).toHaveLength(0);
	});

	it('buildDeviceStreams_runningDynamicsPod_attributesRunningDynamicsChannels', () => {
		const watch = makeDevice({ deviceIndex: 0, sourceType: 'local' });
		const pod = makeDevice({ deviceIndex: 3, antDeviceType: ANT_DEVICE_TYPE.RUNNING_DYNAMICS });
		const records = [makeRecord({ verticalOscillation: 85, groundContactTime: 220, strideLength: 1200 })];
		const streams = buildDeviceStreams([watch, pod], records);
		const podStream = streams.find(s => s.device === pod);
		expect(podStream?.channels).toContain('verticalOscillation');
		expect(podStream?.channels).toContain('groundContactTime');
		expect(podStream?.channels).toContain('strideLength');
	});

	it('buildDeviceStreams_emptyRecords_returnsEmptyArray', () => {
		const watch = makeDevice({ deviceIndex: 0 });
		const result = buildDeviceStreams([watch], []);
		expect(result).toHaveLength(0);
	});
});
