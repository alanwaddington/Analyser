export interface GpsPoint {
	lat: number;
	lon: number;
}

export interface Record {
	timestamp: Date;
	elapsedSeconds: number;
	distance: number; // metres
	speed?: number; // m/s
	heartRate?: number; // bpm
	power?: number; // watts
	powerLeft?: number;
	powerRight?: number;
	cadence?: number; // rpm
	altitude?: number; // metres
	temperature?: number; // °C
	coreTemperature?: number; // °C
	skinTemperature?: number; // °C
	verticalOscillation?: number; // mm
	groundContactTime?: number; // ms
	strideLength?: number; // mm
	position?: GpsPoint;
}

export interface Lap {
	startDistance: number;
	endDistance: number;
	elapsedSeconds: number;
	startIndex: number;
	endIndex: number;
}

export interface Device {
	deviceIndex: number;
	manufacturer?: string;
	product?: string;
	serialNumber?: number;
	antDeviceNumber?: number;
	label?: string; // user-assigned
}

export interface Activity {
	id: string; // derived from filename + timestamp
	filename: string;
	sport?: string;
	startTime: Date;
	totalDistance: number; // metres
	totalElapsedTime: number; // seconds
	records: Record[];
	laps: Lap[];
	devices: Device[];
}

export interface AlignedSeries {
	axis: number[]; // shared distance (m) or time (s) axis
	activities: {
		activity: Activity;
		values: (number | null)[]; // interpolated to axis length
	}[];
}

export interface TimeDelta {
	distance: number; // metres
	cumulativeDeltaSeconds: number; // positive = ahead of reference
}

export type ChannelKey =
	| 'heartRate'
	| 'power'
	| 'powerLeft'
	| 'powerRight'
	| 'cadence'
	| 'speed'
	| 'altitude'
	| 'temperature'
	| 'coreTemperature'
	| 'skinTemperature'
	| 'verticalOscillation'
	| 'groundContactTime'
	| 'strideLength';

export const CHANNEL_META: { [K in ChannelKey]: { label: string; unit: string } } = {
	heartRate:           { label: 'Heart Rate',        unit: 'bpm' },
	power:               { label: 'Power',             unit: 'W'   },
	powerLeft:           { label: 'Power Left',        unit: 'W'   },
	powerRight:          { label: 'Power Right',       unit: 'W'   },
	cadence:             { label: 'Cadence',           unit: 'rpm' },
	speed:               { label: 'Speed',             unit: 'm/s' },
	altitude:            { label: 'Altitude',          unit: 'm'   },
	temperature:         { label: 'Temperature',       unit: '°C'  },
	coreTemperature:     { label: 'Core Temp',         unit: '°C'  },
	skinTemperature:     { label: 'Skin Temp',         unit: '°C'  },
	verticalOscillation: { label: 'Vert. Oscillation', unit: 'mm'  },
	groundContactTime:   { label: 'Ground Contact',    unit: 'ms'  },
	strideLength:        { label: 'Stride Length',     unit: 'mm'  },
};

export const FILE_COLOURS = [
	'#f97316', // Coral
	'#38bdf8', // Sky
	'#f43f5e', // Rose
	'#8b5cf6', // Violet
	'#14b8a6', // Teal
	'#84cc16', // Lime
] as const;

export const MAX_FILES = 6;
