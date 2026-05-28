import FitParser from 'fit-file-parser';
import type { Activity, ActivityRecord, Device, DeviceStream, Lap } from '../types';
import { ANT_DEVICE_TYPE } from '../types';
import type { ChannelKey } from '../types';
import { applyLabels } from '../stores/deviceLabels';

export function parseFitFile(buffer: ArrayBuffer, filename: string): Promise<Activity> {
	return new Promise((resolve, reject) => {
		const parser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		parser.parse(buffer, (error: any, data: any) => {
			if (error) return reject(new Error(String(error)));
			try {
				resolve(normalise(data as FitData, filename));
			} catch (e) {
				reject(e);
			}
		});
	});
}

// ---- raw FIT types (minimal, extend as needed) ----

interface FitSport {
	sport?: string;
	sub_sport?: string;
}

interface FitData {
	sessions?: FitSession[];
	sports?: FitSport[];
	records?: FitRecord[];
	laps?: FitLap[];
	device_infos?: FitDeviceInfo[];
}

interface FitSession {
	sport?: string;
	start_time?: Date;
	total_distance?: number;
	total_elapsed_time?: number;
}

interface FitRecord {
	timestamp?: Date;
	elapsed_time?: number;
	distance?: number;
	speed?: number;
	enhanced_speed?: number;
	heart_rate?: number;
	power?: number;
	'Power'?: number;          // Stryd developer field (running power)
	left_right_balance?: number;
	cadence?: number;
	altitude?: number;
	enhanced_altitude?: number;
	temperature?: number;
	core_temperature?: number;
	skin_temperature?: number;
	vertical_oscillation?: number;
	ground_contact_time?: number;
	stance_time?: number;        // Garmin/Stryd: ground contact time (synonym for ground_contact_time)
	step_length?: number;        // Garmin/Stryd: stride length in mm
	position_lat?: number;
	position_long?: number;
}

interface FitLap {
	start_distance?: number;
	total_distance?: number;
	total_elapsed_time?: number;
}

interface FitDeviceInfo {
	device_index?: number;
	manufacturer?: string;
	product_name?: string;
	serial_number?: number;
	ant_device_number?: number;
	// fit-file-parser outputs device_type as a string for known ANT+ types
	// (e.g. "heart_rate", "bike_power") and as a number for unknown types.
	device_type?: number | string;
	source_type?: string;    // 'antplus' | 'bluetooth_low_energy' | 'local'
}

// fit-file-parser outputs known ANT+ device types as lowercase snake_case strings.
// Map those back to the numeric ANT+ device type constants so DEVICE_TYPE_CHANNELS
// can look them up.  Garmin-internal components (barometer, gps, whr, …) are
// intentionally absent — they fall through to Pass 2 (watch) and are silently
// excluded from device pills if they contribute no channels.
const STRING_DEVICE_TYPE: Record<string, number> = {
	'heart_rate':            ANT_DEVICE_TYPE.HEART_RATE,
	'bike_power':            ANT_DEVICE_TYPE.BIKE_POWER,
	'bike_speed_cadence':    ANT_DEVICE_TYPE.BIKE_SPEED_CADENCE,
	'bike_cadence':          ANT_DEVICE_TYPE.BIKE_CADENCE,
	'bike_speed':            ANT_DEVICE_TYPE.BIKE_SPEED,
	'stride_speed_distance': ANT_DEVICE_TYPE.STRIDE_SPEED_DISTANCE,
	'running_dynamics':      ANT_DEVICE_TYPE.RUNNING_DYNAMICS,
};

// ---- normalisation ----

export function normaliseDeviceInfo(d: FitDeviceInfo): Device {
	const rawType = d.device_type;
	const antDeviceType =
		typeof rawType === 'string' ? STRING_DEVICE_TYPE[rawType]   // undefined for unknown strings
		: rawType;                                                    // numeric or undefined as-is
	return {
		deviceIndex: d.device_index ?? 0,
		manufacturer: d.manufacturer,
		product: d.product_name,
		serialNumber: d.serial_number,
		antDeviceNumber: d.ant_device_number,
		antDeviceType,
		sourceType: d.source_type,
	};
}

export function normaliseRecord(r: FitRecord): ActivityRecord {
	const speed = r.enhanced_speed ?? r.speed;
	return {
		timestamp: r.timestamp ?? new Date(0),
		elapsedSeconds: r.elapsed_time ?? 0,
		distance: r.distance ?? 0,
		speed,
		pace: speed && speed > 0 ? 60 / speed : undefined,
		heartRate: r.heart_rate,
		power: r.power ?? r['Power'],
		cadence: r.cadence,
		altitude: r.enhanced_altitude ?? r.altitude,
		temperature: r.temperature,
		coreTemperature: r.core_temperature,
		skinTemperature: r.skin_temperature,
		verticalOscillation: r.vertical_oscillation,
		groundContactTime: r.ground_contact_time ?? r.stance_time,
		strideLength: r.step_length,
		position:
			r.position_lat != null && r.position_long != null
				? { lat: r.position_lat, lon: r.position_long }
				: undefined,
	};
}

// ANT+ device type → channels it primarily contributes
const DEVICE_TYPE_CHANNELS: Record<number, ChannelKey[]> = {
	[ANT_DEVICE_TYPE.HEART_RATE]:          ['heartRate'],
	[ANT_DEVICE_TYPE.BIKE_POWER]:          ['power', 'powerLeft', 'powerRight'],
	[ANT_DEVICE_TYPE.BIKE_SPEED_CADENCE]:  ['speed', 'cadence'],
	[ANT_DEVICE_TYPE.BIKE_CADENCE]:        ['cadence'],
	[ANT_DEVICE_TYPE.BIKE_SPEED]:          ['speed'],
	[ANT_DEVICE_TYPE.STRIDE_SPEED_DISTANCE]: ['speed', 'cadence', 'strideLength'],
	[ANT_DEVICE_TYPE.RUNNING_DYNAMICS]:    ['verticalOscillation', 'groundContactTime', 'strideLength'],
};

// All channels that can appear in records
const ALL_RECORD_CHANNELS: ChannelKey[] = [
	'heartRate', 'power', 'powerLeft', 'powerRight', 'cadence',
	'speed', 'pace', 'altitude', 'temperature',
	'coreTemperature', 'skinTemperature',
	'verticalOscillation', 'groundContactTime', 'strideLength',
];

/** Returns only channels where at least one record has a non-null value */
function channelsPresentInRecords(records: ActivityRecord[]): Set<ChannelKey> {
	const present = new Set<ChannelKey>();
	for (const r of records) {
		for (const ch of ALL_RECORD_CHANNELS) {
			if ((r[ch] as number | undefined) != null) present.add(ch);
		}
	}
	return present;
}

/**
 * Map devices to the channels they contribute to the merged record stream.
 * External sensors claim channels by ANT+ device type; the watch/creator gets
 * all remaining channels it actually has data for. Devices with no matching
 * channels are excluded.
 */
export function buildDeviceStreams(
	devices: Device[],
	records: ActivityRecord[]
): DeviceStream[] {
	if (records.length === 0) return [];

	// Files with no device_info messages get a single synthetic fallback device
	// so the compare view always has at least one stream to display.
	if (devices.length === 0) {
		const present = channelsPresentInRecords(records);
		const channels = ALL_RECORD_CHANNELS.filter(ch => present.has(ch));
		return [{ device: { deviceIndex: 0 }, channels }];
	}

	const present = channelsPresentInRecords(records);
	// Track which channels have been claimed by external sensors
	const claimed = new Set<ChannelKey>();
	const streams: DeviceStream[] = [];

	// Pass 1: external sensors (those with a known antDeviceType).
	// Devices that matched no recorded channels are still included with an empty
	// channels array so the UI can show "connected but no data" pills.
	for (const device of devices) {
		const { antDeviceType } = device;
		if (antDeviceType == null) continue;
		const candidates = DEVICE_TYPE_CHANNELS[antDeviceType] ?? [];
		const channels = candidates.filter(ch => present.has(ch));
		channels.forEach(ch => claimed.add(ch));
		streams.push({ device, channels });
	}

	// Pass 2: watch/local device(s) get unclaimed channels
	const watchDevices = devices.filter(d => d.antDeviceType == null);
	for (const device of watchDevices) {
		const channels = ALL_RECORD_CHANNELS.filter(ch => present.has(ch) && !claimed.has(ch));
		channels.forEach(ch => claimed.add(ch)); // mark as claimed so safety net skips them
		if (channels.length === 0) continue;
		streams.push({ device, channels });
	}

	// Safety net: any present channels still unclaimed after both passes (e.g. all
	// device_info entries had antDeviceType set, or only external sensors were
	// recognised by ANT+ type) are merged into the first device's existing stream.
	// We merge (not push) to avoid duplicate device entries which would cause
	// duplicate keys in DeviceToggleBar's keyed {#each}.
	// This fires even when other streams already have channels — a typical Garmin +
	// HRM file has heartRate claimed by the HRM but speed/pace/altitude unclaimed.
	const unclaimed = ALL_RECORD_CHANNELS.filter(ch => present.has(ch) && !claimed.has(ch));
	if (unclaimed.length > 0) {
		const primary = streams[0]?.device ?? { deviceIndex: 0 };
		const existingStream = streams.find(s => s.device === primary);
		if (existingStream) {
			existingStream.channels.push(...unclaimed);
		} else {
			streams.push({ device: primary, channels: unclaimed });
		}
	}

	return streams;
}

// Running cadence in FIT files is single-leg (one foot per minute).
// Double it so the displayed value matches the conventional spm (steps per minute).
// Cycling cadence is full revolutions — no adjustment needed.
export function applyRunningCadenceDoubling(records: ActivityRecord[]): void {
	for (const r of records) {
		if (r.cadence != null) r.cadence = r.cadence * 2;
	}
}

// Pace (min/km) is only meaningful for running. Clear it from all non-running
// activities so the pace channel is excluded from device streams and charts.
export function removeCyclingPace(records: ActivityRecord[]): void {
	for (const r of records) r.pace = undefined;
}

function normalise(data: FitData, filename: string): Activity {
	const session = data.sessions?.[0] ?? {};
	// fit-file-parser puts sport on data.sports[0], not data.sessions[0].
	// Fall back to session.sport for files that do populate it.
	const sport = data.sports?.[0]?.sport ?? session.sport;
	const rawRecords = data.records ?? [];

	const records: ActivityRecord[] = rawRecords.map(normaliseRecord);

	if (sport === 'running') {
		applyRunningCadenceDoubling(records);
	}
	if (sport !== 'running') {
		removeCyclingPace(records);
	}

	const laps: Lap[] = buildLaps(data.laps ?? [], records);

	// Deduplicate device_infos: some FIT files include the same device_index
	// multiple times (e.g. once at activity start and once at end).  Keep only
	// the first occurrence of each device_index so downstream code never sees
	// duplicate keys in crossFileStreams.
	const seenDeviceIndices = new Set<number>();
	const uniqueDeviceInfos = (data.device_infos ?? []).filter(d => {
		const idx = d.device_index ?? 0;
		if (seenDeviceIndices.has(idx)) return false;
		seenDeviceIndices.add(idx);
		return true;
	});
	const devices: Device[] = uniqueDeviceInfos.map(normaliseDeviceInfo);
	applyLabels(devices); // restore any user-assigned labels from localStorage
	const deviceStreams = buildDeviceStreams(devices, records);

	return {
		id: crypto.randomUUID(),
		filename,
		sport,
		startTime: session.start_time ?? records[0]?.timestamp ?? new Date(0),
		totalDistance: session.total_distance ?? records.at(-1)?.distance ?? 0,
		totalElapsedTime: session.total_elapsed_time ?? records.at(-1)?.elapsedSeconds ?? 0,
		records,
		laps,
		devices,
		deviceStreams,
	};
}

function buildLaps(fitLaps: FitLap[], records: ActivityRecord[]): Lap[] {
	let cursor = 0;
	return fitLaps.map((l) => {
		const startDist = l.start_distance ?? 0;
		const endDist = startDist + (l.total_distance ?? 0);
		const startIndex = cursor;
		while (cursor < records.length && records[cursor].distance < endDist) cursor++;
		return {
			startDistance: startDist,
			endDistance: endDist,
			elapsedSeconds: l.total_elapsed_time ?? 0,
			startIndex,
			endIndex: cursor - 1
		};
	});
}
