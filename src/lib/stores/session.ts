import { writable } from 'svelte/store';
import type { Activity, ChannelKey } from '$lib/types';

export const activities = writable<Activity[]>([]);
export const smoothing = writable<number>(10);
export const xAxisMode = writable<'time' | 'distance'>('distance');
export const referenceIndex = writable<number>(0);
export const clearing = writable<boolean>(false);
export const lastMode = writable<'compare' | 'event'>('compare');
export const activeChannels = writable<ChannelKey[]>([]);
// Tracks which cross-file device keys are toggled on in device comparison mode
// Key format: `${activity.id}:${device.deviceIndex}` (see CrossFileStream.key)
export const activeDeviceIndices = writable<Set<string>>(new Set());
// Per-file time offsets (seconds) relative to the first loaded file in device comparison mode
// Key: activity.id, Value: offset in seconds
export const timeOffsets = writable<Map<string, number>>(new Map());

export function addActivity(activity: Activity): void {
	activities.update(list => [...list, activity]);
}

export function removeActivity(id: string): void {
	let removedIdx = -1;
	activities.update(list => {
		removedIdx = list.findIndex(a => a.id === id);
		if (removedIdx === -1) return list;
		return list.filter(a => a.id !== id);
	});
	if (removedIdx === -1) return;
	referenceIndex.update(ref => {
		if (removedIdx < ref) return ref - 1;
		if (removedIdx === ref) return 0;
		return ref;
	});
}

export function clearActivities(): void {
	activities.set([]);
	referenceIndex.set(0);
	activeChannels.set([]);
	activeDeviceIndices.set(new Set());
	timeOffsets.set(new Map());
}
