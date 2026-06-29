import { writable, derived } from 'svelte/store';

export interface ChannelRange {
	min?: number;
	max?: number;
}

export interface RecordFilter {
	speed?: ChannelRange;
	power?: ChannelRange;
	heartRate?: ChannelRange;
	cadence?: ChannelRange;
	gradient?: ChannelRange;
	inverted?: boolean;
}

export const recordFilter = writable<RecordFilter>({});

export function clearAllFilters(): void {
	recordFilter.set({});
}

export const activeFilterCount = derived(recordFilter, ($f) => {
	let count = 0;
	if ($f.speed?.min != null || $f.speed?.max != null) count++;
	if ($f.power?.min != null || $f.power?.max != null) count++;
	if ($f.heartRate?.min != null || $f.heartRate?.max != null) count++;
	if ($f.cadence?.min != null || $f.cadence?.max != null) count++;
	if ($f.gradient?.min != null || $f.gradient?.max != null) count++;
	return count;
});
