import { describe, it, expect } from 'vitest';
import { normaliseRecord, normaliseDeviceInfo, buildDeviceStreams, applyRunningCadenceDoubling, removeCyclingPace, findFirstGpsFixIndex, findFirstGpsMovementIndex, extractTimerStartTime, findFirstIndoorMovementIndex, extractFirstWorkoutStepTime, classifyIndoor, buildLaps } from './parser.ts';
import type { Device, ActivityRecord } from '$lib/types';
import { ANT_DEVICE_TYPE } from '$lib/types';

describe('normaliseRecord — running dynamics field mapping', () => {
	it('normaliseRecord_stanceTime_mapsToGroundContactTime', () => {
		// Garmin and Stryd devices output stance_time rather than ground_contact_time
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, stance_time: 286 } as any);
		expect(record.groundContactTime).toBe(286);
	});

	it('normaliseRecord_groundContactTime_mapsToGroundContactTime', () => {
		// Standard FIT field also accepted
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, ground_contact_time: 250 } as any);
		expect(record.groundContactTime).toBe(250);
	});

	it('normaliseRecord_groundContactTimeTakesPrecedenceOverStanceTime', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, ground_contact_time: 250, stance_time: 286 } as any);
		expect(record.groundContactTime).toBe(250);
	});

	it('normaliseRecord_stepLength_mapsToStrideLength', () => {
		// Garmin/Stryd output step_length (mm) which maps to strideLength
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10, step_length: 961 } as any);
		expect(record.strideLength).toBe(961);
	});

	it('normaliseRecord_noRunningDynamics_fieldsAreUndefined', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const record = normaliseRecord({ timestamp: new Date(), elapsed_time: 1, distance: 10 } as any);
		expect(record.groundContactTime).toBeUndefined();
		expect(record.strideLength).toBeUndefined();
	});
});

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

	it('normaliseDeviceInfo_stringDeviceTypeHeartRate_mapsToNumericConstant', () => {
		// fit-file-parser outputs known ANT+ types as strings like "heart_rate"
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = normaliseDeviceInfo({ device_index: 1, device_type: 'heart_rate' as any });
		expect(result.antDeviceType).toBe(120); // ANT_DEVICE_TYPE.HEART_RATE
	});

	it('normaliseDeviceInfo_stringDeviceTypeBikePower_mapsToNumericConstant', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = normaliseDeviceInfo({ device_index: 2, device_type: 'bike_power' as any });
		expect(result.antDeviceType).toBe(11); // ANT_DEVICE_TYPE.BIKE_POWER
	});

	it('normaliseDeviceInfo_stringDeviceTypeStrideSpeedDistance_mapsToNumericConstant', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = normaliseDeviceInfo({ device_index: 3, device_type: 'stride_speed_distance' as any });
		expect(result.antDeviceType).toBe(3); // ANT_DEVICE_TYPE.STRIDE_SPEED_DISTANCE
	});

	it('normaliseDeviceInfo_unknownStringDeviceType_yieldsUndefined', () => {
		// Internal Garmin components ("barometer", "gps", etc.) are not in the
		// ANT+ mapping — they should resolve to undefined so they go through
		// Pass 2 (watch) and are silently excluded if they have no channel data.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = normaliseDeviceInfo({ device_index: 4, device_type: 'barometer' as any });
		expect(result.antDeviceType).toBeUndefined();
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
	it('buildDeviceStreams_noDevices_createsFallbackStreamWithPresentChannels', () => {
		const records = [makeRecord({ heartRate: 120, speed: 10 })];
		const result = buildDeviceStreams([], records);
		expect(result).toHaveLength(1);
		expect(result[0].device.deviceIndex).toBe(0);
		expect(result[0].channels).toContain('heartRate');
		expect(result[0].channels).toContain('speed');
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
		// speed is unclaimed by the HRM and must be allocated to the watch
		expect(watchStream?.channels).toContain('speed');
	});

	it('buildDeviceStreams_externalHRMWithNoWatchDevice_unclaimedChannelsAllocatedViaFallback', () => {
		// Garmin FIT files often report the watch itself with device_type=0, meaning
		// Pass 2 finds no watch devices.  When an HRM has claimed heartRate, the
		// remaining channels (speed, pace, altitude, etc.) must still be allocated via
		// the safety-net fallback — NOT silently dropped.
		const watchWithType = makeDevice({ deviceIndex: 0, antDeviceType: 0 });
		const hrm = makeDevice({ deviceIndex: 1, antDeviceType: ANT_DEVICE_TYPE.HEART_RATE });
		const records = [makeRecord({ heartRate: 140, speed: 12 })];
		const streams = buildDeviceStreams([watchWithType, hrm], records);
		const hrmStream = streams.find(s => s.device === hrm);
		// Find the stream(s) containing speed — must exist even though HRM already has heartRate
		const speedStream = streams.find(s => s.channels.includes('speed'));
		expect(hrmStream?.channels).toContain('heartRate');
		expect(speedStream).toBeDefined();
		expect(speedStream?.channels).toContain('speed');
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

	it('buildDeviceStreams_allDevicesHaveAntDeviceType_unclaimedChannelsAllocatedToFirstDevice', () => {
		// Some FIT files report the primary device with device_type set (e.g. 0),
		// which means Pass 2 finds no watch devices and channels go unallocated.
		// The safety net should allocate remaining channels to the first device.
		const primaryWithType = makeDevice({ deviceIndex: 0, antDeviceType: 0 });
		const records = [makeRecord({ heartRate: 140, speed: 12 })];
		const streams = buildDeviceStreams([primaryWithType], records);
		const channelStream = streams.find(s => s.channels.length > 0);
		expect(channelStream).toBeDefined();
		expect(channelStream?.channels).toContain('heartRate');
		expect(channelStream?.channels).toContain('speed');
	});
});

describe('applyRunningCadenceDoubling', () => {
	function makeRecord(cadence?: number): ActivityRecord {
		return { timestamp: new Date(), elapsedSeconds: 0, distance: 0, cadence } as ActivityRecord;
	}

	it('applyRunningCadenceDoubling_withCadence_doublesValue', () => {
		const records = [makeRecord(85), makeRecord(90)];
		applyRunningCadenceDoubling(records);
		expect(records[0].cadence).toBe(170);
		expect(records[1].cadence).toBe(180);
	});

	it('applyRunningCadenceDoubling_nullCadence_leavesUndefined', () => {
		const records = [makeRecord(undefined)];
		applyRunningCadenceDoubling(records);
		expect(records[0].cadence).toBeUndefined();
	});

	it('applyRunningCadenceDoubling_mixedRecords_onlyDoublesNonNull', () => {
		const records = [makeRecord(85), makeRecord(undefined), makeRecord(90)];
		applyRunningCadenceDoubling(records);
		expect(records[0].cadence).toBe(170);
		expect(records[1].cadence).toBeUndefined();
		expect(records[2].cadence).toBe(180);
	});
});

describe('removeCyclingPace', () => {
	function makeRecord(pace?: number): ActivityRecord {
		return { timestamp: new Date(), elapsedSeconds: 0, distance: 0, pace } as ActivityRecord;
	}

	it('removeCyclingPace_withPace_clearsPaceToUndefined', () => {
		const records = [makeRecord(2.5), makeRecord(3.1)];
		removeCyclingPace(records);
		expect(records[0].pace).toBeUndefined();
		expect(records[1].pace).toBeUndefined();
	});

	it('removeCyclingPace_noPace_remainsUndefined', () => {
		const records = [makeRecord(undefined)];
		removeCyclingPace(records);
		expect(records[0].pace).toBeUndefined();
	});

	it('removeCyclingPace_mixedRecords_clearsAll', () => {
		const records = [makeRecord(2.5), makeRecord(undefined), makeRecord(3.1)];
		removeCyclingPace(records);
		expect(records[0].pace).toBeUndefined();
		expect(records[1].pace).toBeUndefined();
		expect(records[2].pace).toBeUndefined();
	});
});

// ---- GPS anchor detection helpers ----

function makeGpsRecord(lat: number | null, lon: number | null, speed = 0, dist = 0): import('$lib/types').ActivityRecord {
	return {
		timestamp: new Date(),
		elapsedSeconds: 0,
		distance: dist,
		speed,
		position: lat != null && lon != null ? { lat, lon } : undefined,
	};
}

describe('findFirstGpsFixIndex', () => {
	it('findFirstGpsFixIndex_allNullGps_returnsNull', () => {
		const records = [makeGpsRecord(null, null), makeGpsRecord(null, null)];
		expect(findFirstGpsFixIndex(records)).toBeNull();
	});

	it('findFirstGpsFixIndex_emptyRecords_returnsNull', () => {
		expect(findFirstGpsFixIndex([])).toBeNull();
	});

	it('findFirstGpsFixIndex_firstRecordHasGps_returnsZero', () => {
		const records = [makeGpsRecord(51.5, -0.1), makeGpsRecord(51.6, -0.2)];
		expect(findFirstGpsFixIndex(records)).toBe(0);
	});

	it('findFirstGpsFixIndex_gpsStartsAtThirdRecord_returnsTwo', () => {
		const records = [
			makeGpsRecord(null, null),
			makeGpsRecord(null, null),
			makeGpsRecord(51.5, -0.1),
			makeGpsRecord(51.6, -0.2),
		];
		expect(findFirstGpsFixIndex(records)).toBe(2);
	});
});

describe('findFirstGpsMovementIndex', () => {
	it('findFirstGpsMovementIndex_allNullGps_returnsNull', () => {
		const records = [makeGpsRecord(null, null, 5), makeGpsRecord(null, null, 10)];
		expect(findFirstGpsMovementIndex(records)).toBeNull();
	});

	it('findFirstGpsMovementIndex_emptyRecords_returnsNull', () => {
		expect(findFirstGpsMovementIndex([])).toBeNull();
	});

	it('findFirstGpsMovementIndex_gpsWithZeroSpeed_returnsNull', () => {
		// AC4: GPS acquired while stationary — should not be the movement anchor
		const records = [makeGpsRecord(51.5, -0.1, 0), makeGpsRecord(51.5, -0.1, 0)];
		expect(findFirstGpsMovementIndex(records)).toBeNull();
	});

	it('findFirstGpsMovementIndex_gpsAcquiredThenMovement_returnsMovementIndex', () => {
		// AC4: fix at index 1 (speed=0), movement at index 3 — movement index returned
		const records = [
			makeGpsRecord(null, null, 0),
			makeGpsRecord(51.5, -0.1, 0),  // fix but not moving
			makeGpsRecord(51.5, -0.1, 0),  // still not moving
			makeGpsRecord(51.5, -0.1, 5),  // first movement
		];
		expect(findFirstGpsMovementIndex(records)).toBe(3);
	});

	it('findFirstGpsMovementIndex_gpsAndMovementFromFirstRecord_returnsZero', () => {
		const records = [makeGpsRecord(51.5, -0.1, 3)];
		expect(findFirstGpsMovementIndex(records)).toBe(0);
	});
});

describe('extractTimerStartTime', () => {
	it('extractTimerStartTime_noEvents_returnsNull', () => {
		expect(extractTimerStartTime([])).toBeNull();
	});

	it('extractTimerStartTime_timerStartEvent_returnsTimestamp', () => {
		const t = new Date('2025-01-01T10:00:00Z');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const events: any[] = [{ event: 'timer', event_type: 'start', timestamp: t }];
		expect(extractTimerStartTime(events)).toEqual(t);
	});

	it('extractTimerStartTime_timerStopEvent_returnsNull', () => {
		const t = new Date('2025-01-01T10:00:00Z');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const events: any[] = [{ event: 'timer', event_type: 'stop', timestamp: t }];
		expect(extractTimerStartTime(events)).toBeNull();
	});

	it('extractTimerStartTime_multipleEvents_returnsFirstTimerStart', () => {
		const t1 = new Date('2025-01-01T09:50:00Z');
		const t2 = new Date('2025-01-01T10:00:00Z');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const events: any[] = [
			{ event: 'session', event_type: 'start', timestamp: t1 },
			{ event: 'timer', event_type: 'start', timestamp: t2 },
		];
		expect(extractTimerStartTime(events)).toEqual(t2);
	});

	it('extractTimerStartTime_noTimerStartAmongEvents_returnsNull', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const events: any[] = [
			{ event: 'session', event_type: 'start', timestamp: new Date() },
			{ event: 'workout', event_type: 'start', timestamp: new Date() },
		];
		expect(extractTimerStartTime(events)).toBeNull();
	});
});

describe('findFirstIndoorMovementIndex', () => {
	function makeRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
		return { timestamp: new Date(), elapsedSeconds: 0, distance: 0, ...overrides };
	}

	it('findFirstIndoorMovementIndex_speedAboveZero_returnsIndex', () => {
		const records = [makeRecord({ speed: 0 }), makeRecord({ speed: 5 })];
		expect(findFirstIndoorMovementIndex(records)).toBe(1);
	});

	it('findFirstIndoorMovementIndex_powerAboveZero_returnsIndex', () => {
		const records = [makeRecord({ power: 0 }), makeRecord({ power: 150 })];
		expect(findFirstIndoorMovementIndex(records)).toBe(1);
	});

	it('findFirstIndoorMovementIndex_cadenceAboveZero_returnsIndex', () => {
		const records = [makeRecord({ cadence: 0 }), makeRecord({ cadence: 90 })];
		expect(findFirstIndoorMovementIndex(records)).toBe(1);
	});

	it('findFirstIndoorMovementIndex_allZero_returnsNull', () => {
		const records = [makeRecord({ speed: 0, power: 0, cadence: 0 }), makeRecord({})];
		expect(findFirstIndoorMovementIndex(records)).toBeNull();
	});

	it('findFirstIndoorMovementIndex_emptyArray_returnsNull', () => {
		expect(findFirstIndoorMovementIndex([])).toBeNull();
	});

	it('findFirstIndoorMovementIndex_firstRecordHasMovement_returnsZero', () => {
		const records = [makeRecord({ power: 200 }), makeRecord({ power: 210 })];
		expect(findFirstIndoorMovementIndex(records)).toBe(0);
	});
});

describe('extractFirstWorkoutStepTime', () => {
	it('extractFirstWorkoutStepTime_workoutStepPresent_returnsTimestamp', () => {
		const t = new Date('2025-01-01T10:05:00Z');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const steps: any[] = [{ timestamp: t, duration_value: 60 }];
		expect(extractFirstWorkoutStepTime(steps)).toEqual(t);
	});

	it('extractFirstWorkoutStepTime_noSteps_returnsNull', () => {
		expect(extractFirstWorkoutStepTime([])).toBeNull();
	});

	it('extractFirstWorkoutStepTime_stepWithoutTimestamp_returnsNull', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const steps: any[] = [{ duration_value: 60 }];
		expect(extractFirstWorkoutStepTime(steps)).toBeNull();
	});

	it('extractFirstWorkoutStepTime_multipleSteps_returnsFirst', () => {
		const t1 = new Date('2025-01-01T10:05:00Z');
		const t2 = new Date('2025-01-01T10:10:00Z');
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const steps: any[] = [{ timestamp: t1 }, { timestamp: t2 }];
		expect(extractFirstWorkoutStepTime(steps)).toEqual(t1);
	});
});

describe('classifyIndoor', () => {
	function makeRecord(hasGps: boolean): ActivityRecord {
		return {
			timestamp: new Date(), elapsedSeconds: 0, distance: 0,
			...(hasGps ? { position: { lat: 51.5, lon: -0.1 } } : {}),
		};
	}

	it('classifyIndoor_indoorCycling_returnsTrue', () => {
		expect(classifyIndoor('indoor_cycling', [])).toBe(true);
	});

	it('classifyIndoor_virtualActivity_returnsTrue', () => {
		expect(classifyIndoor('virtual_activity', [])).toBe(true);
	});

	it('classifyIndoor_treadmill_returnsTrue', () => {
		expect(classifyIndoor('treadmill', [])).toBe(true);
	});

	it('classifyIndoor_spin_returnsTrue', () => {
		expect(classifyIndoor('spin', [])).toBe(true);
	});

	it('classifyIndoor_stationaryBike_returnsTrue', () => {
		expect(classifyIndoor('stationary_bike', [])).toBe(true);
	});

	it('classifyIndoor_indoorRowing_returnsTrue', () => {
		expect(classifyIndoor('indoor_rowing', [])).toBe(true);
	});

	it('classifyIndoor_indoorRunning_returnsTrue', () => {
		expect(classifyIndoor('indoor_running', [])).toBe(true);
	});

	it('classifyIndoor_indoorWalking_returnsTrue', () => {
		expect(classifyIndoor('indoor_walking', [])).toBe(true);
	});

	it('classifyIndoor_virtualRide_returnsTrue', () => {
		expect(classifyIndoor('virtual_ride', [])).toBe(true);
	});

	it('classifyIndoor_virtualRun_returnsTrue', () => {
		expect(classifyIndoor('virtual_run', [])).toBe(true);
	});

	it('classifyIndoor_outdoorCycling_returnsFalse', () => {
		expect(classifyIndoor('road', [makeRecord(true)])).toBe(false);
	});

	it('classifyIndoor_unknownSubSport_withGps_returnsFalse', () => {
		expect(classifyIndoor('generic', [makeRecord(true)])).toBe(false);
	});

	it('classifyIndoor_noSubSport_allRecordsHaveNoGps_returnsTrue', () => {
		const records = [makeRecord(false), makeRecord(false)];
		expect(classifyIndoor(undefined, records)).toBe(true);
	});

	it('classifyIndoor_noSubSport_someRecordsHaveGps_returnsFalse', () => {
		const records = [makeRecord(false), makeRecord(true)];
		expect(classifyIndoor(undefined, records)).toBe(false);
	});

	it('classifyIndoor_noSubSport_emptyRecords_returnsFalse', () => {
		expect(classifyIndoor(undefined, [])).toBe(false);
	});

	it('classifyIndoor_unknownSubSport_noGps_returnsFalse', () => {
		// Known sub_sport takes precedence — GPS-absence fallback only runs when sub_sport is undefined
		const records = [makeRecord(false)];
		expect(classifyIndoor('generic', records)).toBe(false);
	});
});

// ---- buildLaps ----

describe('buildLaps', () => {
	function makeRecord(distance: number, elapsed: number): ActivityRecord {
		return { timestamp: new Date(), elapsedSeconds: elapsed, distance };
	}

	// Build a records array with evenly-spaced distance samples
	function makeRecords(totalMetres: number, step = 10): ActivityRecord[] {
		const records: ActivityRecord[] = [];
		for (let d = 0; d <= totalMetres; d += step) {
			records.push(makeRecord(d, d / 10)); // 10 m/s → 1 s per 10 m
		}
		return records;
	}

	it('buildLaps_allZeroStartDistance_producesMonotonicallyIncreasingStartDistances', () => {
		// Reproduces the Garmin bug: every lap has start_distance = 0
		const records = makeRecords(5000);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = [
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
		];
		const laps = buildLaps(fitLaps, records);
		expect(laps).toHaveLength(5);
		expect(laps[0].startDistance).toBe(0);
		expect(laps[1].startDistance).toBeGreaterThan(laps[0].startDistance);
		expect(laps[2].startDistance).toBeGreaterThan(laps[1].startDistance);
		expect(laps[3].startDistance).toBeGreaterThan(laps[2].startDistance);
		expect(laps[4].startDistance).toBeGreaterThan(laps[3].startDistance);
	});

	it('buildLaps_allZeroStartDistance_eachLapHasNonZeroSpan', () => {
		const records = makeRecords(5000);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = Array.from({ length: 5 }, () => ({
			start_distance: 0, total_distance: 1000, total_elapsed_time: 100,
		}));
		const laps = buildLaps(fitLaps, records);
		for (const lap of laps) {
			expect(lap.startIndex).toBeLessThanOrEqual(lap.endIndex);
		}
	});

	it('buildLaps_cumulativeStartDistance_producesCorrectSpans', () => {
		// Files that already write cumulative start_distance should produce same output
		const records = makeRecords(3000);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = [
			{ start_distance: 0,    total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 1000, total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 2000, total_distance: 1000, total_elapsed_time: 100 },
		];
		const laps = buildLaps(fitLaps, records);
		expect(laps).toHaveLength(3);
		expect(laps[0].startDistance).toBe(0);
		expect(laps[1].startDistance).toBeCloseTo(1000, -1);
		expect(laps[2].startDistance).toBeCloseTo(2000, -1);
	});

	it('buildLaps_emptyFitLaps_returnsEmptyArray', () => {
		const records = makeRecords(1000);
		expect(buildLaps([], records)).toHaveLength(0);
	});

	it('buildLaps_emptyRecords_returnsLapsWithFallbackDistances', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = [{ start_distance: 0, total_distance: 500, total_elapsed_time: 50 }];
		const laps = buildLaps(fitLaps, []);
		expect(laps).toHaveLength(1);
		// No crash — startDistance falls back to 0
		expect(laps[0].startDistance).toBe(0);
	});

	it('buildLaps_singleLap_coversFullActivity', () => {
		const records = makeRecords(1000);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = [{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 }];
		const laps = buildLaps(fitLaps, records);
		expect(laps).toHaveLength(1);
		expect(laps[0].startIndex).toBe(0);
		expect(laps[0].endIndex).toBe(records.length - 1);
	});

	it('buildLaps_lapEndDistanceEqualsNextLapStartDistance', () => {
		const records = makeRecords(2000);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = [
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
			{ start_distance: 0, total_distance: 1000, total_elapsed_time: 100 },
		];
		const laps = buildLaps(fitLaps, records);
		// Lap 1's end should be close to Lap 2's start
		expect(laps[0].endDistance).toBeCloseTo(laps[1].startDistance, -1);
	});

	it('buildLaps_elapsedTimePreservedFromFitLap', () => {
		const records = makeRecords(1000);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fitLaps: any[] = [{ start_distance: 0, total_distance: 1000, total_elapsed_time: 327 }];
		const laps = buildLaps(fitLaps, records);
		expect(laps[0].elapsedSeconds).toBe(327);
	});
});
