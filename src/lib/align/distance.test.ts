import { describe, it, expect } from 'vitest';
import { interpolateToDistanceAxis } from './distance.ts';
import type { Activity, ActivityRecord } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

function makeActivity(records: Partial<ActivityRecord>[]): Activity {
	const full: ActivityRecord[] = records.map((r, i) => ({
		timestamp: new Date(i * 1000),
		elapsedSeconds: i,
		distance: 0,
		...r,
	}));
	return {
		id: 'test',
		filename: 'test.fit',
		startTime: new Date(0),
		totalDistance: full.at(-1)?.distance ?? 0,
		totalElapsedTime: full.length,
		records: full,
		laps: [],
		devices: [],
		deviceStreams: [],
		firstGpsFixIndex: null,
		firstGpsMovementIndex: null,
		timerStartTime: null,
		firstIndoorMovementIndex: null,
		firstWorkoutStepTime: null,
		subSport: undefined,
		isIndoor: false,
		anchor: { recordIndex: 0, distanceMetres: 0, elapsedSeconds: 0, timestamp: new Date(0), source: 'fileStart' as const },
		availableChannels: new Set(),
	};
}

describe('interpolateToDistanceAxis — duplicate distance values', () => {
	it('lerp_trailingDuplicateDistancesWithSameValue_doesNotProduceNaN', () => {
		// Indoor trainer files (Zwift etc.) end with several records at the same
		// distance (rider stopped). The step axis overshoots maxDist by up to one
		// step, causing lerp to ask for a point beyond all records. When the two
		// bracketing records share the same distance, t = Δx/0 = Infinity, and
		// Infinity × (bVal - aVal) = Infinity × 0 = NaN.
		const activity = makeActivity([
			{ distance: 0, cadence: 82 },
			{ distance: 10, cadence: 85 },
			{ distance: 13, cadence: 0 }, // last active record
			{ distance: 13, cadence: 0 }, // stopped — same distance
			{ distance: 13, cadence: 0 }, // stopped — same distance
		]);
		const aligned = interpolateToDistanceAxis(activity, 10);
		const cadence = aligned.channels.get('cadence');
		expect(cadence).toBeDefined();
		const hasNaN = cadence!.some(v => v !== null && isNaN(v));
		expect(hasNaN).toBe(false);
	});

	it('lerp_trailingDuplicatesWithDifferentValues_doesNotProduceNaN', () => {
		// A more dangerous case: bVal !== aVal when both share the same distance.
		// t = Infinity, and Infinity × nonZero = Infinity (not NaN), but the
		// guard must prevent this too.
		const activity = makeActivity([
			{ distance: 0, cadence: 80 },
			{ distance: 13, cadence: 85 },
			{ distance: 13, cadence: 90 }, // different cadence, same distance
		]);
		const aligned = interpolateToDistanceAxis(activity, 10);
		const cadence = aligned.channels.get('cadence');
		const hasNaN = cadence!.some(v => v !== null && isNaN(v));
		expect(hasNaN).toBe(false);
		const hasInfinity = cadence!.some(v => v !== null && !isFinite(v as number));
		expect(hasInfinity).toBe(false);
	});

	it('lerp_normalRecords_interpolatesCorrectly', () => {
		const activity = makeActivity([
			{ distance: 0, cadence: 80 },
			{ distance: 20, cadence: 100 },
		]);
		const aligned = interpolateToDistanceAxis(activity, 10);
		const cadence = aligned.channels.get('cadence');
		// At 10m (halfway) cadence should be 90
		expect(cadence?.[1]).toBe(90);
	});
});

// ---- distance axis re-zeroing (distanceOffset) ----

describe('interpolateToDistanceAxis — distanceOffset re-zeroing', () => {
	it('distanceOffset_zero_identicalToDefault', () => {
		// AC: zero offset produces identical output to calling without offset
		const activity = makeActivity([
			{ distance: 0, cadence: 80 },
			{ distance: 20, cadence: 100 },
		]);
		const withoutOffset = interpolateToDistanceAxis(activity, 10);
		const withZeroOffset = interpolateToDistanceAxis(activity, 10, 0);
		expect(withZeroOffset.axis).toEqual(withoutOffset.axis);
		expect(withZeroOffset.channels.get('cadence')).toEqual(withoutOffset.channels.get('cadence'));
	});

	it('distanceOffset_200m_axisStartsAtZeroWhichWas200m', () => {
		// Activity records from 0–400m; offset 200m → axis should go 0–200m
		const activity = makeActivity([
			{ distance: 0,   cadence: 60 },
			{ distance: 100, cadence: 70 },
			{ distance: 200, cadence: 80 },
			{ distance: 300, cadence: 90 },
			{ distance: 400, cadence: 100 },
		]);
		const aligned = interpolateToDistanceAxis(activity, 100, 200);
		// Axis should start at 0m (previously 200m) and end at 200m (previously 400m)
		expect(aligned.axis[0]).toBe(0);
		expect(aligned.axis.at(-1)).toBe(200);
	});

	it('distanceOffset_200m_cadenceAtOriginMatchesValueAt200mInOriginal', () => {
		// The value at the new 0m mark should equal the original value at 200m
		const activity = makeActivity([
			{ distance: 0,   cadence: 60 },
			{ distance: 200, cadence: 80 },
			{ distance: 400, cadence: 100 },
		]);
		const aligned = interpolateToDistanceAxis(activity, 100, 200);
		const cadence = aligned.channels.get('cadence')!;
		// New axis[0] = 0m = original 200m → cadence should be 80
		expect(cadence[0]).toBe(80);
	});

	it('distanceOffset_preAnchorRecordsExcluded_axisDoesNotContainNegativeValues', () => {
		// Records before the anchor (negative in adjusted space) must not appear
		const activity = makeActivity([
			{ distance: 0,   cadence: 60 },
			{ distance: 50,  cadence: 70 },
			{ distance: 150, cadence: 80 },
		]);
		const aligned = interpolateToDistanceAxis(activity, 10, 50);
		expect(aligned.axis.every(d => d >= 0)).toBe(true);
	});

	it('distanceOffset_offsetLargerThanMaxDist_returnsEmpty', () => {
		const activity = makeActivity([
			{ distance: 0, cadence: 80 },
			{ distance: 50, cadence: 90 },
		]);
		const aligned = interpolateToDistanceAxis(activity, 10, 100);
		expect(aligned.axis).toHaveLength(0);
	});
});

// ---- computeTimeDelta with distance offsets ----

import { computeTimeDelta } from '../compare/delta.ts';

describe('computeTimeDelta — distanceOffset', () => {
	it('computeTimeDelta_noOffsets_sameAsCurrent', () => {
		// Reference: 0–1000m in 100s; candidate: 0–1000m in 90s (10s faster)
		const ref = makeActivity([
			{ distance: 0, elapsedSeconds: 0 },
			{ distance: 1000, elapsedSeconds: 100 },
		]);
		const cand = makeActivity([
			{ distance: 0, elapsedSeconds: 0 },
			{ distance: 1000, elapsedSeconds: 90 },
		]);
		const deltas = computeTimeDelta(ref, cand);
		expect(deltas.length).toBeGreaterThan(0);
		const last = deltas.at(-1)!;
		// cumulativeDelta at ~1000m: refTime - candTime = 100 - 90 = 10 (cand ahead)
		expect(last.cumulativeDeltaSeconds).toBeCloseTo(10, 0);
	});

	it('computeTimeDelta_withDistanceOffsets_alignsOnSharedDistanceAxis', () => {
		// Ref: starts at 0m; Cand: starts at 100m (offset = 100)
		// Both cover the same course after the anchor point
		const ref = makeActivity([
			{ distance: 0, elapsedSeconds: 0 },
			{ distance: 500, elapsedSeconds: 50 },
			{ distance: 1000, elapsedSeconds: 100 },
		]);
		const cand = makeActivity([
			{ distance: 100, elapsedSeconds: 0 },
			{ distance: 600, elapsedSeconds: 50 },
			{ distance: 1100, elapsedSeconds: 100 },
		]);
		// With offset of 100m for cand, adjusted distances are 0–1000m for both
		const deltas = computeTimeDelta(ref, cand, 10, 0, 100);
		expect(deltas.length).toBeGreaterThan(0);
		// At the same adjusted distance, times should match closely (same pace)
		const mid = deltas[Math.floor(deltas.length / 2)];
		expect(Math.abs(mid.cumulativeDeltaSeconds)).toBeLessThan(1);
	});
});
