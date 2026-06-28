import type { Activity, ActivityRecord, AthleteProfile } from '$lib/types';
import type { Segment } from '$lib/components/charts/SegmentChart.utils';
import { timeAtDistance } from '$lib/compare/delta';
import { hrZone, cpPct, ftpPct } from '$lib/analytics/zones';
import { hrZoneFromMaxHR, hrZoneFromLTHR } from '$lib/analytics/zones';

export interface SegmentStats {
	time: number;              // seconds
	avgPace: number | null;    // min/km
	avgPower: number | null;   // watts
	maxPower: number | null;   // watts
	powerPct: number | null;   // % of CP or FTP (null when no profile threshold)
	powerLabel: string;        // 'Stryd' | 'Running Power' | 'Power' | etc.
	avgHR: number | null;      // bpm
	hrZones: number[] | null;  // [z1%, z2%, z3%, z4%, z5%] or null
}

function derivePowerLabel(activity: Activity): string {
	switch (activity.powerSource) {
		case 'stryd':  return 'Stryd';
		case 'native': return 'Running Power';
		default:       return 'Power';
	}
}

function recordsInSegment(activity: Activity, segment: Segment): ActivityRecord[] {
	return activity.records.filter(
		r => r.distance >= segment.startDist && r.distance <= segment.endDist,
	);
}

/**
 * Compute per-segment statistics for one activity.
 * Profile is optional — when absent, all profile-derived fields are null.
 */
export function computeSegmentStats(
	activity: Activity,
	segment: Segment,
	profile?: AthleteProfile,
): SegmentStats {
	const empty: SegmentStats = {
		time: 0,
		avgPace: null,
		avgPower: null,
		maxPower: null,
		powerPct: null,
		powerLabel: derivePowerLabel(activity),
		avgHR: null,
		hrZones: null,
	};

	if (activity.records.length === 0) return empty;

	// Compute time using interpolated distance → elapsed-time lookup
	const lastDist = activity.records[activity.records.length - 1].distance;
	if (segment.endDist > lastDist) return empty;

	const startTime = timeAtDistance(activity, segment.startDist);
	const endTime = timeAtDistance(activity, segment.endDist);
	if (startTime == null || endTime == null) return empty;

	const time = endTime - startTime;
	if (time <= 0) return empty;

	// Segment records for metric averages
	const recs = recordsInSegment(activity, segment);

	// Pace: time (s) for distance (m) → min/km
	const distKm = (segment.endDist - segment.startDist) / 1000;
	const avgPace = distKm > 0 ? time / 60 / distKm : null;

	// Power
	const powerRecs = recs.filter(r => r.power != null);
	let avgPower: number | null = null;
	let maxPower: number | null = null;
	if (powerRecs.length > 0) {
		const powers = powerRecs.map(r => r.power!);
		avgPower = Math.round(powers.reduce((a, b) => a + b, 0) / powers.length);
		maxPower = Math.max(...powers);
	}

	// Power % of CP or FTP
	let powerPct: number | null = null;
	if (avgPower != null && profile) {
		const isRunning = activity.sport === 'running';
		if (isRunning && profile.cp != null && profile.cp > 0) {
			powerPct = cpPct(avgPower, profile.cp);
		} else if (!isRunning && profile.ftp != null && profile.ftp > 0) {
			powerPct = ftpPct(avgPower, profile.ftp);
		}
	}

	// HR
	const hrRecs = recs.filter(r => r.heartRate != null);
	let avgHR: number | null = null;
	if (hrRecs.length > 0) {
		avgHR = Math.round(hrRecs.reduce((a, r) => a + r.heartRate!, 0) / hrRecs.length);
	}

	// HR zone distribution (5 zones: [z1%, z2%, z3%, z4%, z5%])
	let hrZones: number[] | null = null;
	if (hrRecs.length > 0 && profile) {
		const sport = activity.sport ?? 'running';
		const hasThreshold =
			profile.maxHrRunning != null ||
			profile.maxHrCycling != null ||
			profile.lthr != null;

		if (hasThreshold) {
			const counts = [0, 0, 0, 0, 0];
			for (const r of hrRecs) {
				const zone = hrZone(r.heartRate!, profile, sport);
				if (zone != null) counts[zone - 1]++;
			}
			const total = counts.reduce((a, b) => a + b, 0);
			hrZones = total > 0
				? counts.map(c => Math.round((c / total) * 100))
				: [0, 0, 0, 0, 0];
		}
	}

	return {
		time,
		avgPace,
		avgPower,
		maxPower,
		powerPct,
		powerLabel: derivePowerLabel(activity),
		avgHR,
		hrZones,
	};
}
