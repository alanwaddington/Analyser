import { describe, it, expect } from 'vitest';
import { normaliseRecord, normaliseDeviceInfo } from './parser.ts';

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
