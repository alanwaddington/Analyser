import type { ActivityRecord, Anomaly, AnomalyType, AnomalyDetectionOptions, ChannelKey } from '$lib/types';
import { mean, stdDev } from './stats';

const SPIKE_MAX_DURATION_S = 3;
const DROPOUT_MIN_DURATION_S = 10;
const WARMUP_COOLDOWN_S = 30;
const GPS_DRIFT_SPEED_FACTOR = 3;

/** Haversine distance between two GPS points, in kilometres. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
		Math.cos((lat2 * Math.PI) / 180) *
		Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type SpikeChannel = 'heartRate' | 'power' | 'cadence';

function detectSpikes(
	records: ActivityRecord[],
	channel: SpikeChannel,
	options?: AnomalyDetectionOptions,
): Anomaly[] {
	const values = records.map(r => r[channel] ?? null);
	const avg = mean(values);
	const sd = stdDev(values);
	if (avg === null) return [];

	// Determine threshold and strategy
	let threshold: number;
	let strategy: Anomaly['detectionStrategy'] = 'statistical';

	if (channel === 'heartRate' && options?.athleteProfile?.maxHR != null) {
		threshold = options.athleteProfile.maxHR + 10;
		strategy = 'threshold-relative';
	} else if (
		channel === 'power' &&
		options?.powerSource === 'stryd' &&
		options?.athleteProfile?.cp != null
	) {
		threshold = options.athleteProfile.cp * 1.5;
		strategy = 'threshold-relative';
	} else {
		if (sd === null) return [];
		threshold = avg + 4 * sd;
	}

	// Find contiguous runs above threshold
	const anomalies: Anomaly[] = [];
	let runStart = -1;

	for (let i = 0; i <= records.length; i++) {
		const val = i < records.length ? (records[i][channel] ?? null) : null;
		const aboveThreshold = val != null && val > threshold;

		if (aboveThreshold && runStart === -1) {
			runStart = i;
		} else if (!aboveThreshold && runStart !== -1) {
			const runEnd = i - 1;
			const durationS = records[runEnd].elapsedSeconds - records[runStart].elapsedSeconds;
			if (durationS <= SPIKE_MAX_DURATION_S) {
				for (let j = runStart; j <= runEnd; j++) {
					anomalies.push({
						channel,
						recordIndex: j,
						type: 'spike',
						value: records[j][channel] as number,
						detectionStrategy: strategy,
					});
				}
			}
			runStart = -1;
		}
	}

	return anomalies;
}

type DropoutChannel = 'heartRate' | 'power' | 'cadence';

function detectDropouts(records: ActivityRecord[], channel: DropoutChannel): Anomaly[] {
	if (records.length === 0) return [];

	const activityStart = records[0].elapsedSeconds;
	const activityEnd = records[records.length - 1].elapsedSeconds;
	const warmupEnd = activityStart + WARMUP_COOLDOWN_S;
	const cooldownStart = activityEnd - WARMUP_COOLDOWN_S;

	const anomalies: Anomaly[] = [];
	let runStart = -1;

	for (let i = 0; i <= records.length; i++) {
		const r = i < records.length ? records[i] : null;
		const val = r ? (r[channel] ?? null) : null;
		const isDropout = val === null || val === 0;
		const inExclusion = r ? (r.elapsedSeconds <= warmupEnd || r.elapsedSeconds >= cooldownStart) : false;

		if (isDropout && !inExclusion && runStart === -1) {
			runStart = i;
		} else if ((!isDropout || inExclusion) && runStart !== -1) {
			const runEnd = i - 1;
			const durationS = records[runEnd].elapsedSeconds - records[runStart].elapsedSeconds;
			if (durationS > DROPOUT_MIN_DURATION_S) {
				for (let j = runStart; j <= runEnd; j++) {
					anomalies.push({
						channel,
						recordIndex: j,
						type: 'dropout',
						value: records[j][channel] as number ?? 0,
						detectionStrategy: 'statistical',
					});
				}
			}
			runStart = -1;
		}
	}

	return anomalies;
}

function detectGpsDrift(records: ActivityRecord[]): Anomaly[] {
	const anomalies: Anomaly[] = [];

	for (let i = 1; i < records.length; i++) {
		const prev = records[i - 1];
		const curr = records[i];
		if (!prev.position || !curr.position) continue;
		if (!curr.speed || curr.speed <= 0) continue;

		const dtHours = (curr.elapsedSeconds - prev.elapsedSeconds) / 3600;
		if (dtHours <= 0) continue;

		const distKm = haversineKm(
			prev.position.lat, prev.position.lon,
			curr.position.lat, curr.position.lon,
		);
		const impliedSpeedKmh = distKm / dtHours;

		if (impliedSpeedKmh > GPS_DRIFT_SPEED_FACTOR * curr.speed) {
			anomalies.push({
				channel: 'speed',
				recordIndex: i,
				type: 'gps-drift',
				value: impliedSpeedKmh,
				detectionStrategy: 'statistical',
			});
		}
	}

	return anomalies;
}

export function detectAnomalies(records: ActivityRecord[], options?: AnomalyDetectionOptions): Anomaly[] {
	if (records.length === 0) return [];

	const all: Anomaly[] = [
		...detectSpikes(records, 'heartRate', options),
		...detectSpikes(records, 'power', options),
		...detectSpikes(records, 'cadence', options),
		...detectDropouts(records, 'heartRate'),
		...detectDropouts(records, 'power'),
		...detectDropouts(records, 'cadence'),
		...detectGpsDrift(records),
	];

	return all.sort((a, b) => a.recordIndex - b.recordIndex);
}

export function groupAnomaliesByChannel(anomalies: Anomaly[]): Map<ChannelKey, Anomaly[]> {
	const map = new Map<ChannelKey, Anomaly[]>();
	for (const a of anomalies) {
		const existing = map.get(a.channel) ?? [];
		existing.push(a);
		map.set(a.channel, existing);
	}
	return map;
}
