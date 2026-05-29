import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	activities,
	smoothing,
	xAxisMode,
	referenceIndex,
	clearing,
	lastMode,
	activeChannels,
	activeDeviceIndices,
	timeOffsets,
	addActivity,
	removeActivity,
	clearActivities,
} from './session.ts';
import type { Activity } from '$lib/types';

function makeActivity(id: string): Activity {
	return {
		id,
		filename: `${id}.fit`,
		startTime: new Date(),
		totalDistance: 5000,
		totalElapsedTime: 1800,
		records: [],
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
	};
}

beforeEach(() => {
	activities.set([]);
	referenceIndex.set(0);
	activeChannels.set([]);
	activeDeviceIndices.set(new Set());
	timeOffsets.set(new Map());
	smoothing.set(10);
	xAxisMode.set('time');
	clearing.set(false);
	lastMode.set('compare');
});

describe('store defaults', () => {
	it('activities_onInit_isEmpty', () => {
		expect(get(activities)).toEqual([]);
	});
	it('smoothing_onInit_isTen', () => {
		expect(get(smoothing)).toBe(10);
	});
	it('xAxisMode_onInit_isTime', () => {
		expect(get(xAxisMode)).toBe('time');
	});
	it('referenceIndex_onInit_isZero', () => {
		expect(get(referenceIndex)).toBe(0);
	});
	it('clearing_onInit_isFalse', () => {
		expect(get(clearing)).toBe(false);
	});
	it('lastMode_onInit_isCompare', () => {
		expect(get(lastMode)).toBe('compare');
	});
	it('activeChannels_onInit_isEmpty', () => {
		expect(get(activeChannels)).toEqual([]);
	});
});

describe('addActivity', () => {
	it('addActivity_singleActivity_appendsToList', () => {
		const a = makeActivity('a');
		addActivity(a);
		expect(get(activities)).toHaveLength(1);
		expect(get(activities)[0].id).toBe('a');
	});

	it('addActivity_multipleActivities_appendsInOrder', () => {
		addActivity(makeActivity('a'));
		addActivity(makeActivity('b'));
		expect(get(activities).map(x => x.id)).toEqual(['a', 'b']);
	});
});

describe('removeActivity', () => {
	it('removeActivity_nonExistentId_isNoOp', () => {
		addActivity(makeActivity('a'));
		referenceIndex.set(0);
		removeActivity('not-found');
		expect(get(activities)).toHaveLength(1);
		expect(get(referenceIndex)).toBe(0);
	});

	it('removeActivity_indexAboveReference_doesNotChangeRef', () => {
		addActivity(makeActivity('a'));
		addActivity(makeActivity('b'));
		addActivity(makeActivity('c'));
		referenceIndex.set(0);
		removeActivity('c'); // index 2 > ref 0
		expect(get(activities).map(x => x.id)).toEqual(['a', 'b']);
		expect(get(referenceIndex)).toBe(0);
	});

	it('removeActivity_indexBelowReference_decrementsRef', () => {
		addActivity(makeActivity('a'));
		addActivity(makeActivity('b'));
		addActivity(makeActivity('c'));
		referenceIndex.set(2);
		removeActivity('a'); // index 0 < ref 2
		expect(get(activities).map(x => x.id)).toEqual(['b', 'c']);
		expect(get(referenceIndex)).toBe(1);
	});

	it('removeActivity_indexEqualsReference_resetsRefToZero', () => {
		addActivity(makeActivity('a'));
		addActivity(makeActivity('b'));
		addActivity(makeActivity('c'));
		referenceIndex.set(1);
		removeActivity('b'); // index 1 === ref 1
		expect(get(activities).map(x => x.id)).toEqual(['a', 'c']);
		expect(get(referenceIndex)).toBe(0);
	});

	it('removeActivity_onlyActivity_leavesEmptyListAndRefZero', () => {
		addActivity(makeActivity('a'));
		referenceIndex.set(0);
		removeActivity('a');
		expect(get(activities)).toHaveLength(0);
		expect(get(referenceIndex)).toBe(0);
	});
});

describe('clearActivities', () => {
	it('clearActivities_withData_resetsAllFields', () => {
		addActivity(makeActivity('a'));
		addActivity(makeActivity('b'));
		referenceIndex.set(1);
		activeChannels.set(['heartRate', 'power']);
		clearActivities();
		expect(get(activities)).toEqual([]);
		expect(get(referenceIndex)).toBe(0);
		expect(get(activeChannels)).toEqual([]);
	});

	it('clearActivities_whenAlreadyEmpty_remainsEmpty', () => {
		clearActivities();
		expect(get(activities)).toEqual([]);
		expect(get(referenceIndex)).toBe(0);
		expect(get(activeChannels)).toEqual([]);
	});

	it('clearActivities_withActiveDevices_resetsActiveDeviceIndices', () => {
		activeDeviceIndices.set(new Set(['act-a:1', 'act-b:2']));
		clearActivities();
		expect(get(activeDeviceIndices).size).toBe(0);
	});

	it('clearActivities_withTimeOffsets_resetsTimeOffsets', () => {
		timeOffsets.set(new Map([['act-a', 0], ['act-b', 5]]));
		clearActivities();
		expect(get(timeOffsets).size).toBe(0);
	});
});

describe('activeDeviceIndices', () => {
	it('activeDeviceIndices_onInit_isEmpty', () => {
		expect(get(activeDeviceIndices).size).toBe(0);
	});

	it('activeDeviceIndices_canAddAndRemoveStringKeys', () => {
		activeDeviceIndices.update(s => { s.add('act-a:1'); s.add('act-b:2'); return s; });
		expect(get(activeDeviceIndices).has('act-a:1')).toBe(true);
		expect(get(activeDeviceIndices).has('act-b:2')).toBe(true);
		activeDeviceIndices.update(s => { s.delete('act-a:1'); return s; });
		expect(get(activeDeviceIndices).has('act-a:1')).toBe(false);
	});

	it('activeDeviceIndices_sameDeviceIndexDifferentFiles_treatedAsSeparate', () => {
		activeDeviceIndices.update(s => { s.add('act-a:0'); s.add('act-b:0'); return s; });
		expect(get(activeDeviceIndices).size).toBe(2);
	});
});

describe('timeOffsets', () => {
	it('timeOffsets_onInit_isEmpty', () => {
		expect(get(timeOffsets).size).toBe(0);
	});

	it('timeOffsets_canSetAndGetOffsets', () => {
		timeOffsets.set(new Map([['act-a', 0], ['act-b', 12.5]]));
		expect(get(timeOffsets).get('act-a')).toBe(0);
		expect(get(timeOffsets).get('act-b')).toBe(12.5);
	});
});
