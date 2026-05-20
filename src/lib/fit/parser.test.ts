import { describe, it, expect } from 'vitest';
import { normaliseRecord } from './parser.ts';

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
