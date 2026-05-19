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
