import { describe, it, expect } from 'vitest';
import { interpolateToDistanceAxis } from './distance.ts';
import type { Activity, ActivityRecord } from '$lib/types';

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
