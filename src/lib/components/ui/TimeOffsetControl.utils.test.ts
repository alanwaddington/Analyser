import { describe, it, expect } from 'vitest';
import {
	clamp,
	nudgeOffset,
	parseOffset,
	MIN_OFFSET_SECONDS,
	MAX_OFFSET_SECONDS,
	ANCHOR_LABELS,
	ANCHOR_TITLES,
} from './TimeOffsetControl.utils.ts';

// ---- clamp ----

describe('clamp', () => {
	it('clamp_withinRange_returnsValue', () => {
		expect(clamp(5, 0, 10)).toBe(5);
	});

	it('clamp_belowMin_returnsMin', () => {
		expect(clamp(-5, 0, 10)).toBe(0);
	});

	it('clamp_aboveMax_returnsMax', () => {
		expect(clamp(15, 0, 10)).toBe(10);
	});

	it('clamp_exactlyMin_returnsMin', () => {
		expect(clamp(0, 0, 10)).toBe(0);
	});

	it('clamp_exactlyMax_returnsMax', () => {
		expect(clamp(10, 0, 10)).toBe(10);
	});

	it('clamp_negativeRange_worksCorrectly', () => {
		expect(clamp(-500, -3600, 3600)).toBe(-500);
	});
});

// ---- nudgeOffset ----

describe('nudgeOffset', () => {
	it('nudgeOffset_positiveNudge_addsToCurrentOffset', () => {
		expect(nudgeOffset(0, 1)).toBe(1);
	});

	it('nudgeOffset_negativeNudge_subtractsFromCurrentOffset', () => {
		expect(nudgeOffset(10, -1)).toBe(9);
	});

	it('nudgeOffset_nudgeTenSeconds_addsCorrectly', () => {
		expect(nudgeOffset(5, 10)).toBe(15);
	});

	it('nudgeOffset_wouldExceedMax_clampsToMax', () => {
		expect(nudgeOffset(MAX_OFFSET_SECONDS - 5, 10)).toBe(MAX_OFFSET_SECONDS);
	});

	it('nudgeOffset_wouldGoBelowMin_clampsToMin', () => {
		expect(nudgeOffset(MIN_OFFSET_SECONDS + 5, -10)).toBe(MIN_OFFSET_SECONDS);
	});

	it('nudgeOffset_atExactMax_noPositiveNudge', () => {
		expect(nudgeOffset(MAX_OFFSET_SECONDS, 1)).toBe(MAX_OFFSET_SECONDS);
	});

	it('nudgeOffset_atExactMin_noNegativeNudge', () => {
		expect(nudgeOffset(MIN_OFFSET_SECONDS, -1)).toBe(MIN_OFFSET_SECONDS);
	});

	it('nudgeOffset_fromZero_negativeNudge', () => {
		expect(nudgeOffset(0, -10)).toBe(-10);
	});
});

// ---- parseOffset ----

describe('parseOffset', () => {
	it('parseOffset_validInteger_returnsRounded', () => {
		expect(parseOffset(5)).toBe(5);
	});

	it('parseOffset_decimalInput_roundsToNearestSecond', () => {
		expect(parseOffset(5.7)).toBe(6);
	});

	it('parseOffset_decimalInputRoundsDown_roundsToFloor', () => {
		expect(parseOffset(5.3)).toBe(5);
	});

	it('parseOffset_nan_returnsNull', () => {
		expect(parseOffset(NaN)).toBeNull();
	});

	it('parseOffset_valueAboveMax_clampsToMax', () => {
		expect(parseOffset(9999)).toBe(MAX_OFFSET_SECONDS);
	});

	it('parseOffset_valueBelowMin_clampsToMin', () => {
		expect(parseOffset(-9999)).toBe(MIN_OFFSET_SECONDS);
	});

	it('parseOffset_exactlyAtMax_returnsMax', () => {
		expect(parseOffset(MAX_OFFSET_SECONDS)).toBe(MAX_OFFSET_SECONDS);
	});

	it('parseOffset_exactlyAtMin_returnsMin', () => {
		expect(parseOffset(MIN_OFFSET_SECONDS)).toBe(MIN_OFFSET_SECONDS);
	});

	it('parseOffset_zero_returnsZero', () => {
		expect(parseOffset(0)).toBe(0);
	});

	it('parseOffset_negativeValue_returnsNegative', () => {
		expect(parseOffset(-30)).toBe(-30);
	});
});

// ---- ANCHOR_LABELS ----

describe('ANCHOR_LABELS', () => {
	it('ANCHOR_LABELS_timer_isTimer', () => {
		expect(ANCHOR_LABELS.timer).toBe('Timer');
	});

	it('ANCHOR_LABELS_gpsMovement_isGpsMove', () => {
		expect(ANCHOR_LABELS.gpsMovement).toBe('GPS move');
	});

	it('ANCHOR_LABELS_gpsFix_isGpsFix', () => {
		expect(ANCHOR_LABELS.gpsFix).toBe('GPS fix');
	});

	it('ANCHOR_LABELS_fileStart_isFileStart', () => {
		expect(ANCHOR_LABELS.fileStart).toBe('File start');
	});

	it('ANCHOR_LABELS_workoutStep_isWorkout', () => {
		expect(ANCHOR_LABELS.workoutStep).toBe('Workout');
	});

	it('ANCHOR_LABELS_indoorMovement_isIndoor', () => {
		expect(ANCHOR_LABELS.indoorMovement).toBe('Indoor');
	});

	it('ANCHOR_LABELS_allValuesFitBadgePill', () => {
		// All labels must be ≤10 characters to fit the narrow TOC row
		for (const [source, label] of Object.entries(ANCHOR_LABELS)) {
			expect(label.length, `${source} label "${label}" exceeds 10 chars`).toBeLessThanOrEqual(10);
		}
	});
});

// ---- ANCHOR_TITLES ----

describe('ANCHOR_TITLES', () => {
	it('ANCHOR_TITLES_workoutStep_describesWorkoutStep', () => {
		expect(ANCHOR_TITLES.workoutStep).toBe('Aligned by first workout step');
	});

	it('ANCHOR_TITLES_indoorMovement_describesIndoorMovement', () => {
		expect(ANCHOR_TITLES.indoorMovement).toBe('Aligned by first indoor movement (speed/power/cadence)');
	});

	it('ANCHOR_TITLES_allSourcesCovered', () => {
		const sources = ['timer', 'gpsMovement', 'gpsFix', 'fileStart', 'workoutStep', 'indoorMovement'];
		for (const source of sources) {
			expect(ANCHOR_TITLES).toHaveProperty(source);
			expect(typeof ANCHOR_TITLES[source as keyof typeof ANCHOR_TITLES]).toBe('string');
		}
	});
});
