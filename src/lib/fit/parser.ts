import FitParser from 'fit-file-parser';
import type { Activity, ActivityRecord, Device, DeviceStream, Lap, ParseStage, ToastMessage } from '../types';
import { ANT_DEVICE_TYPE } from '../types';
import type { ChannelKey } from '../types';
import { findAnchor } from '../align/anchor';
import { detectAnomalies } from '../analytics/anomalies';
import { deviceKey } from '../utils/deviceKey';

export const DISTANCE_EPSILON_M = 0.5;

// ---- raw FIT types (minimal, extend as needed) ----

interface FitSport {
	sport?: string;
	sub_sport?: string;
}

interface FitEvent {
	event?: string;
	event_type?: string;
	timestamp?: Date;
}

interface FitWorkoutStep {
	timestamp?: Date;
	duration_value?: number;
}

interface FitData {
	sessions?: FitSession[];
	sports?: FitSport[];
	records?: FitRecord[];
	laps?: FitLap[];
	device_infos?: FitDeviceInfo[];
	events?: FitEvent[];
	workout_steps?: FitWorkoutStep[];
}

interface FitSession {
	sport?: string;
	sub_sport?: string;
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
	'Form Power'?: number;     // Stryd developer field (form power — energy lost to form inefficiency)
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

/**
 * Determine the authoritative power source for an activity.
 * Stryd (developer field) takes priority over native watch power.
 * Running native power is labelled 'native'; all other power (cycling, unknown sport) is 'cycling'.
 * Returns undefined when no power data is present.
 */
export function detectPowerSource(
	hasStrydPower: boolean,
	hasPower: boolean,
	sport: string | undefined
): 'stryd' | 'native' | 'cycling' | undefined {
	if (!hasPower && !hasStrydPower) return undefined;
	if (hasStrydPower) return 'stryd';
	if (sport === 'running') return 'native';
	return 'cycling';
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
		// Stryd developer field ('Power', capital P) takes priority over native watch power.
		// When both are present (e.g. Garmin + Stryd paired), Stryd is more accurate.
		power: r['Power'] ?? r.power,
		formPower: r['Form Power'],
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
export const ALL_RECORD_CHANNELS: ChannelKey[] = [
	'heartRate', 'power', 'formPower', 'powerLeft', 'powerRight', 'cadence',
	'speed', 'pace', 'altitude', 'temperature',
	'coreTemperature', 'skinTemperature',
	'verticalOscillation', 'groundContactTime', 'strideLength',
];

/** Returns only channels where at least one record has a non-null value */
export function channelsPresentInRecords(records: ActivityRecord[]): Set<ChannelKey> {
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

/** Returns the index of the first record with a valid GPS position, or null. */
export function findFirstGpsFixIndex(records: ActivityRecord[]): number | null {
	for (let i = 0; i < records.length; i++) {
		if (records[i].position != null) return i;
	}
	return null;
}

/** Returns the index of the first record with a valid GPS position AND speed > 0, or null. */
export function findFirstGpsMovementIndex(records: ActivityRecord[]): number | null {
	for (let i = 0; i < records.length; i++) {
		const r = records[i];
		if (r.position != null && (r.speed ?? 0) > 0) return i;
	}
	return null;
}

/** Returns the timestamp of the first FIT timer start event, or null. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTimerStartTime(events: any[]): Date | null {
	for (const e of events) {
		if (e.event === 'timer' && e.event_type === 'start' && e.timestamp != null) {
			return e.timestamp as Date;
		}
	}
	return null;
}

/** Returns the index of the first record where speed > 0, power > 0, or cadence > 0, or null. */
export function findFirstIndoorMovementIndex(records: ActivityRecord[]): number | null {
	for (let i = 0; i < records.length; i++) {
		const r = records[i];
		if ((r.speed ?? 0) > 0 || (r.power ?? 0) > 0 || (r.cadence ?? 0) > 0) return i;
	}
	return null;
}

/** Returns the timestamp of the first workout_step message, or null. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFirstWorkoutStepTime(steps: any[]): Date | null {
	const first = steps[0];
	if (first?.timestamp != null) return first.timestamp as Date;
	return null;
}

const INDOOR_SUB_SPORTS = new Set([
	'indoor_cycling', 'virtual_activity', 'spin', 'stationary_bike',
	'treadmill', 'indoor_rowing', 'indoor_running', 'indoor_walking',
	'virtual_ride', 'virtual_run',
]);

/**
 * Returns true when the activity should be treated as indoor.
 * Uses sub_sport as the primary signal; falls back to GPS-absence only when
 * sub_sport is entirely absent (undefined), covering older devices that omit it.
 */
export function classifyIndoor(subSport: string | undefined, records: ActivityRecord[]): boolean {
	if (subSport !== undefined) return INDOOR_SUB_SPORTS.has(subSport);
	// GPS-absence fallback: only fires when sub_sport is missing AND there are records.
	if (records.length === 0) return false;
	return records.every(r => r.position == null);
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

// Remove records with negative elapsedSeconds — these occur in some FIT files
// when the timer is paused or the device clock is reset mid-activity.
export function filterNegativeElapsed(records: ActivityRecord[]): ActivityRecord[] {
	return records.filter(r => r.elapsedSeconds >= 0);
}

// Sort records in-place by elapsedSeconds if out of order. Returns true when
// sorting was required so the caller can emit a warning.
export function ensureSortedByElapsed(records: ActivityRecord[]): boolean {
	if (records.length < 2) return false;
	let outOfOrder = false;
	for (let i = 1; i < records.length; i++) {
		if (records[i].elapsedSeconds < records[i - 1].elapsedSeconds) {
			outOfOrder = true;
			break;
		}
	}
	if (!outOfOrder) return false;
	records.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);
	return true;
}

/**
 * Normalise raw FIT data into an Activity. Worker-safe: no store imports.
 * @param labels  Device label snapshot from getAllLabels() — applied inline.
 * @param onStage Optional callback called as parsing progresses through stages.
 * @returns       The normalised Activity and any warning toasts to dispatch.
 */
export function normalise(
	data: FitData,
	filename: string,
	labels: Record<string, string>,
	onStage?: (stage: ParseStage) => void,
): { activity: Activity; toasts: ToastMessage[] } {
	onStage?.('normalising');

	const toasts: ToastMessage[] = [];
	const session = data.sessions?.[0] ?? {};
	// fit-file-parser puts sport on data.sports[0], not data.sessions[0].
	// Fall back to session.sport for files that do populate it.
	const sport = data.sports?.[0]?.sport ?? session.sport;
	const subSport = data.sports?.[0]?.sub_sport ?? session.sub_sport;
	const rawRecords = data.records ?? [];

	// Detect Stryd power before normalisation: any record with a capital-P 'Power'
	// developer field indicates a Stryd footpod was present and contributing data.
	const hasStrydPower = rawRecords.some(r => r['Power'] != null);

	let records: ActivityRecord[] = rawRecords.map(normaliseRecord);
	records = filterNegativeElapsed(records);
	if (records.length < rawRecords.length) {
		const count = rawRecords.length - records.length;
		console.warn(`[parser] "${filename}": ${count} record(s) with negative elapsed time removed`);
		toasts.push({ message: `"${filename}": ${count} record(s) with negative elapsed time were removed.`, level: 'warning' });
	}
	if (ensureSortedByElapsed(records)) {
		console.warn(`[parser] "${filename}": records were out of order — sorted by elapsedSeconds`);
		toasts.push({ message: `"${filename}": records were out of order and have been sorted automatically.`, level: 'warning' });
	}

	if (sport === 'running') {
		applyRunningCadenceDoubling(records);
	}
	if (sport !== 'running') {
		removeCyclingPace(records);
	}

	onStage?.('detecting_anomalies');
	const anomalies = detectAnomalies(records);

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
	// Apply labels inline using the passed snapshot — no localStorage access needed.
	const devices: Device[] = uniqueDeviceInfos.map(normaliseDeviceInfo).map(d => {
		const key = deviceKey(d);
		const label = key != null ? labels[key] : undefined;
		return label ? { ...d, label } : d;
	});

	onStage?.('building_streams');
	const availableChannels = channelsPresentInRecords(records);
	const deviceStreams = buildDeviceStreams(devices, records);
	const hasPower = records.some(r => r.power != null);
	const powerSource = detectPowerSource(hasStrydPower, hasPower, sport);

	const startTime = session.start_time ?? records[0]?.timestamp ?? new Date(0);
	const firstGpsFixIndex = findFirstGpsFixIndex(records);
	const firstGpsMovementIndex = findFirstGpsMovementIndex(records);
	const firstIndoorMovementIndex = findFirstIndoorMovementIndex(records);
	const timerStartTime = extractTimerStartTime(data.events ?? []);
	const firstWorkoutStepTime = extractFirstWorkoutStepTime(data.workout_steps ?? []);
	const isIndoor = classifyIndoor(subSport, records);

	// findAnchor reads these fields from the Activity; safe to cast the partial object.
	const anchor = findAnchor({
		records, firstGpsFixIndex, firstGpsMovementIndex, firstIndoorMovementIndex,
		timerStartTime, firstWorkoutStepTime, startTime, isIndoor,
	} as Activity);

	const activity: Activity = {
		id: crypto.randomUUID(),
		filename,
		sport,
		subSport,
		powerSource,
		isIndoor,
		startTime,
		totalDistance: session.total_distance ?? records.at(-1)?.distance ?? 0,
		totalElapsedTime: session.total_elapsed_time ?? records.at(-1)?.elapsedSeconds ?? 0,
		records,
		laps,
		devices,
		deviceStreams,
		firstGpsFixIndex,
		firstGpsMovementIndex,
		firstIndoorMovementIndex,
		firstWorkoutStepTime,
		timerStartTime,
		anchor,
		availableChannels,
		anomalies,
	};

	return { activity, toasts };
}

export function buildLaps(fitLaps: FitLap[], records: ActivityRecord[]): Lap[] {
	let cursor = 0;
	let prevEndDist = 0;
	return fitLaps.map((l) => {
		const startIndex = cursor;
		const startDist = prevEndDist;
		const lapDistance = l.total_distance ?? 0;
		if (lapDistance === 0) {
			return {
				startDistance: startDist,
				endDistance: startDist,
				elapsedSeconds: l.total_elapsed_time ?? 0,
				startIndex,
				endIndex: startIndex,
			};
		}
		const targetDist = startDist + lapDistance;
		while (cursor < records.length && records[cursor].distance <= targetDist + DISTANCE_EPSILON_M) cursor++;
		const endIndex = Math.max(startIndex, cursor - 1);
		const endDist = records[endIndex]?.distance ?? targetDist;
		prevEndDist = endDist;
		return {
			startDistance: startDist,
			endDistance: endDist,
			elapsedSeconds: l.total_elapsed_time ?? 0,
			startIndex,
			endIndex,
		};
	});
}
