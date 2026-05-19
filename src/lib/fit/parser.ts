import FitParser from 'fit-file-parser';
import type { Activity, Device, Lap, Record } from '../types';

export function parseFitFile(buffer: ArrayBuffer, filename: string): Promise<Activity> {
	return new Promise((resolve, reject) => {
		const parser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm', temperatureUnit: 'celsius', elapsedRecordField: true });

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

interface FitData {
	sessions?: FitSession[];
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
	heart_rate?: number;
	power?: number;
	left_right_balance?: number;
	cadence?: number;
	altitude?: number;
	temperature?: number;
	core_temperature?: number;
	skin_temperature?: number;
	vertical_oscillation?: number;
	ground_contact_time?: number;
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
}

// ---- normalisation ----

function normalise(data: FitData, filename: string): Activity {
	const session = data.sessions?.[0] ?? {};
	const rawRecords = data.records ?? [];

	const records: Record[] = rawRecords.map((r) => ({
		timestamp: r.timestamp ?? new Date(0),
		elapsedSeconds: r.elapsed_time ?? 0,
		distance: r.distance ?? 0,
		speed: r.speed,
		heartRate: r.heart_rate,
		power: r.power,
		cadence: r.cadence,
		altitude: r.altitude,
		temperature: r.temperature,
		coreTemperature: r.core_temperature,
		skinTemperature: r.skin_temperature,
		verticalOscillation: r.vertical_oscillation,
		groundContactTime: r.ground_contact_time,
		position:
			r.position_lat != null && r.position_long != null
				? { lat: r.position_lat, lon: r.position_long }
				: undefined
	}));

	const laps: Lap[] = buildLaps(data.laps ?? [], records);
	const devices: Device[] = (data.device_infos ?? []).map((d) => ({
		deviceIndex: d.device_index ?? 0,
		manufacturer: d.manufacturer,
		product: d.product_name,
		serialNumber: d.serial_number,
		antDeviceNumber: d.ant_device_number
	}));

	return {
		id: crypto.randomUUID(),
		filename,
		sport: session.sport,
		startTime: session.start_time ?? records[0]?.timestamp ?? new Date(0),
		totalDistance: session.total_distance ?? records.at(-1)?.distance ?? 0,
		totalElapsedTime: session.total_elapsed_time ?? records.at(-1)?.elapsedSeconds ?? 0,
		records,
		laps,
		devices
	};
}

function buildLaps(fitLaps: FitLap[], records: Record[]): Lap[] {
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
