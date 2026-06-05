import { writable } from 'svelte/store';
import type { Readable } from 'svelte/store';
import { FILE_COLOURS } from '$lib/types';
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

// ---------------------------------------------------------------------------
// Colour assignment — stable per activity.id across add/remove/reorder
// ---------------------------------------------------------------------------

let _colourAssignments = new Map<string, number>();
let _colourCounter = 0;
let _freedColours: number[] = [];

const _activityColourMapStore = writable(new Map<string, number>());

/** Reactive map of activityId → colourIndex. Stable across removals and reordering. */
export const activityColourMap: Readable<Map<string, number>> = _activityColourMapStore;

function _assignColour(activityId: string): void {
	if (_colourAssignments.has(activityId)) return;
	let colourIdx: number;
	if (_colourCounter < FILE_COLOURS.length) {
		colourIdx = _colourCounter++;
	} else if (_freedColours.length > 0) {
		colourIdx = _freedColours.shift()!;
	} else {
		colourIdx = _colourCounter++ % FILE_COLOURS.length;
	}
	_colourAssignments.set(activityId, colourIdx);
	_activityColourMapStore.set(new Map(_colourAssignments));
}

function _releaseColour(activityId: string): void {
	const idx = _colourAssignments.get(activityId);
	if (idx === undefined) return;
	_colourAssignments.delete(activityId);
	_freedColours.push(idx);
	_activityColourMapStore.set(new Map(_colourAssignments));
}

/** Returns the FILE_COLOURS string for the given activity id. Falls back to index 0. */
export function getActivityColour(activityId: string): string {
	const idx = _colourAssignments.get(activityId) ?? 0;
	return FILE_COLOURS[idx % FILE_COLOURS.length];
}

export function addActivity(activity: Activity): void {
	activities.update(list => [...list, activity]);
	_assignColour(activity.id);
}

export function removeActivity(id: string): void {
	let removedIdx = -1;
	activities.update(list => {
		removedIdx = list.findIndex(a => a.id === id);
		if (removedIdx === -1) return list;
		return list.filter(a => a.id !== id);
	});
	if (removedIdx === -1) return;
	_releaseColour(id);
	referenceIndex.update(ref => {
		if (removedIdx < ref) return ref - 1;
		if (removedIdx === ref) return 0;
		return ref;
	});
}

export function clearActivities(): void {
	_colourAssignments = new Map();
	_colourCounter = 0;
	_freedColours = [];
	_activityColourMapStore.set(new Map());
	activities.set([]);
	referenceIndex.set(0);
	activeChannels.set([]);
	activeDeviceIndices.set(new Set());
	timeOffsets.set(new Map());
}
