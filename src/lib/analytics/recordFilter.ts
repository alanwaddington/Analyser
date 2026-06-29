import type { ActivityRecord } from '$lib/types';
import type { RecordFilter } from '$lib/stores/filterStore.ts';

function passesRange(value: number | undefined, min: number | undefined, max: number | undefined): boolean {
	if (value == null) return true; // missing value passes by default
	if (min != null && value < min) return false;
	if (max != null && value > max) return false;
	return true;
}

/** Returns the set of record indices that PASS all active filter rules. */
export function applyRecordFilter(
	records: ActivityRecord[],
	filter: RecordFilter,
	gradients?: (number | null)[],
): Set<number> {
	const passing = new Set<number>();

	for (let i = 0; i < records.length; i++) {
		const r = records[i];
		let passes = true;

		if (filter.speed?.min != null || filter.speed?.max != null) {
			if (!passesRange(r.speed, filter.speed.min, filter.speed.max)) { passes = false; }
		}
		if (passes && (filter.power?.min != null || filter.power?.max != null)) {
			if (!passesRange(r.power, filter.power.min, filter.power.max)) { passes = false; }
		}
		if (passes && (filter.heartRate?.min != null || filter.heartRate?.max != null)) {
			if (!passesRange(r.heartRate, filter.heartRate.min, filter.heartRate.max)) { passes = false; }
		}
		if (passes && (filter.cadence?.min != null || filter.cadence?.max != null)) {
			if (!passesRange(r.cadence, filter.cadence.min, filter.cadence.max)) { passes = false; }
		}
		if (passes && (filter.gradient?.min != null || filter.gradient?.max != null)) {
			const grade = gradients ? (gradients[i] ?? null) : null;
			if (grade === null) {
				// missing gradient passes by default (AC-30)
			} else if (!passesRange(grade, filter.gradient.min, filter.gradient.max)) {
				passes = false;
			}
		}

		if (filter.inverted ? !passes : passes) {
			passing.add(i);
		}
	}

	return passing;
}

/** Derive gradient (% grade) for each record from altitude + distance. */
export function deriveGradients(records: ActivityRecord[]): (number | null)[] {
	const result: (number | null)[] = new Array(records.length).fill(null);
	for (let i = 0; i < records.length - 1; i++) {
		const curr = records[i];
		const next = records[i + 1];
		if (curr.altitude == null || next.altitude == null) continue;
		const distDelta = next.distance - curr.distance;
		if (distDelta === 0) continue;
		result[i] = ((next.altitude - curr.altitude) / distDelta) * 100;
	}
	return result;
}

/** Return only records whose index is in the passing set. */
export function filterRecords(
	records: ActivityRecord[],
	passingIndices: Set<number>,
): ActivityRecord[] {
	return records.filter((_, i) => passingIndices.has(i));
}
