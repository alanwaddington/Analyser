export interface GpsPoint {
	lat: number;
	lon: number;
}

export interface ActivityRecord {
	timestamp: Date;
	elapsedSeconds: number;
	distance: number; // metres
	speed?: number; // km/h
	pace?: number;  // min/km
	heartRate?: number; // bpm
	power?: number; // watts
	formPower?: number; // watts — Stryd Form Power (energy wasted to form, not propulsion)
	powerLeft?: number;
	powerRight?: number;
	cadence?: number; // rpm (cycling) or spm (running, already doubled by parser)
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
	antDeviceType?: number;  // ANT+ device type from device_info message
	sourceType?: string;     // 'antplus' | 'bluetooth_low_energy' | 'local' | etc.
	label?: string;          // user-assigned
}

export const ANT_DEVICE_TYPE = {
	HEART_RATE: 120,
	BIKE_POWER: 11,
	BIKE_SPEED_CADENCE: 121,
	BIKE_CADENCE: 122,
	BIKE_SPEED: 123,
	STRIDE_SPEED_DISTANCE: 3,
	RUNNING_DYNAMICS: 36,
} as const;

export interface DeviceStream {
	device: Device;
	channels: ChannelKey[]; // channels this device contributes to the merged record stream
}

/**
 * A DeviceStream tagged with its source Activity for cross-file device comparison.
 * key = `${activity.id}:${stream.device.deviceIndex}` — globally unique per session.
 */
export interface CrossFileStream {
	stream: DeviceStream;
	activity: Activity;
	key: string;
}

export type AnchorSource = 'timer' | 'gpsMovement' | 'gpsFix' | 'fileStart' | 'workoutStep' | 'indoorMovement';

export interface AlignmentAnchor {
	recordIndex: number;
	distanceMetres: number;
	elapsedSeconds: number;
	timestamp: Date;
	source: AnchorSource;
}

export interface Activity {
	id: string; // derived from filename + timestamp
	filename: string;
	sport?: string;
	subSport?: string;
	powerSource?: 'stryd' | 'native' | 'cycling';
	isIndoor: boolean;
	startTime: Date;
	totalDistance: number; // metres
	totalElapsedTime: number; // seconds
	records: ActivityRecord[];
	laps: Lap[];
	devices: Device[];
	deviceStreams: DeviceStream[]; // per-device channel attribution (always populated)
	firstGpsFixIndex: number | null;
	firstGpsMovementIndex: number | null;
	firstIndoorMovementIndex: number | null;
	firstWorkoutStepTime: Date | null;
	timerStartTime: Date | null;
	anchor: AlignmentAnchor; // best alignment anchor for this activity, computed at parse time
	availableChannels: Set<ChannelKey>;
	anomalies: Anomaly[];
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
	| 'formPower'
	| 'powerLeft'
	| 'powerRight'
	| 'cadence'
	| 'speed'
	| 'pace'
	| 'altitude'
	| 'temperature'
	| 'coreTemperature'
	| 'skinTemperature'
	| 'verticalOscillation'
	| 'groundContactTime'
	| 'strideLength'
	| 'position';

export const CHANNEL_META: Record<ChannelKey, { label: string; unit: string }> = {
	heartRate:           { label: 'Heart Rate',        unit: 'bpm' },
	power:               { label: 'Power',             unit: 'W'   },
	formPower:           { label: 'Form Power',        unit: 'W'   },
	powerLeft:           { label: 'Power Left',        unit: 'W'   },
	powerRight:          { label: 'Power Right',       unit: 'W'   },
	cadence:             { label: 'Cadence',           unit: 'rpm'     },
	speed:               { label: 'Speed',             unit: 'km/h'    },
	pace:                { label: 'Pace',              unit: 'min/km'  },
	altitude:            { label: 'Altitude',          unit: 'm'       },
	temperature:         { label: 'Temperature',       unit: '°C'  },
	coreTemperature:     { label: 'Core Temp',         unit: '°C'  },
	skinTemperature:     { label: 'Skin Temp',         unit: '°C'  },
	verticalOscillation: { label: 'Vert. Oscillation', unit: 'mm'  },
	groundContactTime:   { label: 'Ground Contact',    unit: 'ms'  },
	strideLength:        { label: 'Stride Length',     unit: 'mm'  },
	position:            { label: 'GPS',               unit: ''    },
};

export const FILE_COLOURS = [
	'#f97316', // Coral
	'#38bdf8', // Sky
	'#f43f5e', // Rose
	'#8b5cf6', // Violet
	'#14b8a6', // Teal
	'#84cc16', // Lime
] as const;

// Distinct colour palette for device comparison series
export const DEVICE_COLOURS = [
	'#f97316', // Orange
	'#38bdf8', // Sky
	'#f43f5e', // Rose
	'#8b5cf6', // Violet
	'#14b8a6', // Teal
	'#84cc16', // Lime
	'#ec4899', // Pink
	'#06b6d4', // Cyan
] as const;

export const MAX_FILES = 6;

export type AnomalyType = 'spike' | 'dropout' | 'gps-drift';
export type DetectionStrategy = 'threshold-relative' | 'statistical';

export interface Anomaly {
	channel: ChannelKey;
	recordIndex: number;
	type: AnomalyType;
	value: number;
	detectionStrategy: DetectionStrategy;
}

export interface AthleteProfile {
	weight?: number;        // kg — used for w/kg across all sports
	ftp?: number;           // watts — cycling Functional Threshold Power
	maxHrCycling?: number;  // bpm — max HR for cycling activities
	cp?: number;            // watts — running Critical Power (Stryd; also usable with native watch)
	maxHrRunning?: number;  // bpm — max HR for running activities
	lthr?: number;          // bpm — Lactate Threshold Heart Rate (HR zone fallback)
}

export interface AnomalyDetectionOptions {
	powerSource?: 'stryd' | 'native';
	athleteProfile?: AthleteProfile;
}

export interface GpsPointWithDistance {
	lat: number;
	lon: number;
	distance: number;
	/** Index of the source record in activity.records[]. Preserved through downsampling for O(1) metric lookup. */
	recordIndex: number;
}

/** GPS point with distance and an optional smoothed metric value. */
export interface GpsPointWithMetric extends GpsPointWithDistance {
	metricValue: number | null;
}
