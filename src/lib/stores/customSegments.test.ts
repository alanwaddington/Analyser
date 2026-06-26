import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Activity } from '$lib/types';
import { makeBaseActivity } from '$lib/test-utils';

// localStorage mock — same pattern as deviceLabels.test.ts
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string): string | null => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// crypto.randomUUID mock
Object.defineProperty(globalThis, 'crypto', {
	value: {
		randomUUID: vi.fn(() => 'test-uuid-1234'),
	},
	writable: true,
});

// Re-import module fresh before each test to clear module-level cache
let courseKey: (activity: Activity) => string;
let addSegment: (key: string, name: string, startDist: number, endDist: number) => void;
let renameSegment: (key: string, id: string, newName: string) => void;
let resizeSegment: (key: string, id: string, startDist: number, endDist: number) => void;
let removeSegment: (key: string, id: string) => void;
let getSegments: (key: string) => import('./customSegments').CustomSegment[];
let getAllSegments: () => Record<string, import('./customSegments').CustomSegment[]>;
let replaceAllSegments: (map: Record<string, import('./customSegments').CustomSegment[]>) => void;
let setOnSegmentChange: (callback: (() => void) | null) => void;

beforeEach(async () => {
	vi.resetModules();
	localStorageMock.clear();
	localStorageMock.getItem.mockClear();
	localStorageMock.setItem.mockClear();
	// Reset UUID mock counter
	let uuidCounter = 0;
	(globalThis.crypto.randomUUID as ReturnType<typeof vi.fn>).mockImplementation(
		() => `uuid-${++uuidCounter}`,
	);
	const mod = await import('./customSegments.ts');
	courseKey = mod.courseKey;
	addSegment = mod.addSegment;
	renameSegment = mod.renameSegment;
	resizeSegment = mod.resizeSegment;
	removeSegment = mod.removeSegment;
	getSegments = mod.getSegments;
	getAllSegments = mod.getAllSegments;
	replaceAllSegments = mod.replaceAllSegments;
	setOnSegmentChange = mod.setOnSegmentChange;
});

function makeActivity(sport: string, totalDistance: number): Activity {
	return makeBaseActivity({ sport, totalDistance });
}

// ---------------------------------------------------------------------------
// courseKey
// ---------------------------------------------------------------------------

describe('courseKey', () => {
	it('courseKey_runningActivity_returnsRunningKey', () => {
		const act = makeActivity('running', 5000);
		expect(courseKey(act)).toBe('running:50');
	});

	it('courseKey_cyclingActivity_returnsCyclingKey', () => {
		const act = makeActivity('cycling', 40000);
		expect(courseKey(act)).toBe('cycling:400');
	});

	it('courseKey_distanceRoundedTo100m', () => {
		// 5012m → round(5012/100) = round(50.12) = 50 → 50
		const act = makeActivity('running', 5012);
		expect(courseKey(act)).toBe('running:50');
	});

	it('courseKey_distanceRoundedUpAt50m', () => {
		// 5050m → round(5050/100) = round(50.5) = 51
		const act = makeActivity('running', 5050);
		expect(courseKey(act)).toBe('running:51');
	});

	it('courseKey_noSport_usesUnknown', () => {
		const act = makeBaseActivity({ totalDistance: 3000 });
		expect(courseKey(act)).toBe('unknown:30');
	});

	it('courseKey_differentDistances_produceDifferentKeys', () => {
		const act1 = makeActivity('running', 5000);
		const act2 = makeActivity('running', 10000);
		expect(courseKey(act1)).not.toBe(courseKey(act2));
	});

	it('courseKey_gpsDriftTolerance_sameKeyWithin100m', () => {
		// 5001m and 4999m should both produce 'running:50'
		const act1 = makeActivity('running', 5001);
		const act2 = makeActivity('running', 4999);
		expect(courseKey(act1)).toBe(courseKey(act2));
	});
});

// ---------------------------------------------------------------------------
// addSegment / getSegments
// ---------------------------------------------------------------------------

describe('addSegment', () => {
	it('addSegment_newCourse_createsSegmentList', () => {
		addSegment('running:50', 'The Hill', 1000, 2000);
		const segs = getSegments('running:50');
		expect(segs).toHaveLength(1);
		expect(segs[0].name).toBe('The Hill');
		expect(segs[0].startDist).toBe(1000);
		expect(segs[0].endDist).toBe(2000);
		expect(segs[0].id).toBeDefined();
	});

	it('addSegment_existingCourse_appendsToList', () => {
		addSegment('running:50', 'The Hill', 1000, 2000);
		addSegment('running:50', 'Finish Straight', 4500, 5000);
		const segs = getSegments('running:50');
		expect(segs).toHaveLength(2);
		expect(segs[1].name).toBe('Finish Straight');
	});

	it('addSegment_persistsToLocalStorage', () => {
		addSegment('running:50', 'Test', 0, 1000);
		expect(localStorageMock.setItem).toHaveBeenCalled();
	});

	it('addSegment_differentCourses_storedSeparately', () => {
		addSegment('running:50', 'Parkrun Hill', 1000, 2000);
		addSegment('cycling:400', 'Cat 3 Climb', 5000, 10000);
		expect(getSegments('running:50')).toHaveLength(1);
		expect(getSegments('cycling:400')).toHaveLength(1);
	});

	it('addSegment_persistsAcrossModuleReloads', async () => {
		addSegment('running:50', 'The Hill', 1000, 2000);
		// Reload module (simulating page reload via cache clear)
		vi.resetModules();
		const mod2 = await import('./customSegments.ts');
		const segs = mod2.getSegments('running:50');
		expect(segs).toHaveLength(1);
		expect(segs[0].name).toBe('The Hill');
	});
});

// ---------------------------------------------------------------------------
// renameSegment
// ---------------------------------------------------------------------------

describe('renameSegment', () => {
	it('renameSegment_existingSegment_updatesName', () => {
		addSegment('running:50', 'Old Name', 1000, 2000);
		const id = getSegments('running:50')[0].id;
		renameSegment('running:50', id, 'New Name');
		expect(getSegments('running:50')[0].name).toBe('New Name');
	});

	it('renameSegment_preservesOtherFields', () => {
		addSegment('running:50', 'Old Name', 1000, 2000);
		const seg = getSegments('running:50')[0];
		renameSegment('running:50', seg.id, 'New Name');
		const updated = getSegments('running:50')[0];
		expect(updated.startDist).toBe(1000);
		expect(updated.endDist).toBe(2000);
		expect(updated.id).toBe(seg.id);
	});

	it('renameSegment_nonExistentId_noChange', () => {
		addSegment('running:50', 'Test', 0, 1000);
		renameSegment('running:50', 'bad-id', 'New Name');
		expect(getSegments('running:50')[0].name).toBe('Test');
	});
});

// ---------------------------------------------------------------------------
// resizeSegment
// ---------------------------------------------------------------------------

describe('resizeSegment', () => {
	it('resizeSegment_existingSegment_updatesDistances', () => {
		addSegment('running:50', 'The Hill', 1000, 2000);
		const id = getSegments('running:50')[0].id;
		resizeSegment('running:50', id, 1200, 2500);
		const seg = getSegments('running:50')[0];
		expect(seg.startDist).toBe(1200);
		expect(seg.endDist).toBe(2500);
	});

	it('resizeSegment_preservesNameAndId', () => {
		addSegment('running:50', 'The Hill', 1000, 2000);
		const orig = getSegments('running:50')[0];
		resizeSegment('running:50', orig.id, 1200, 2500);
		const updated = getSegments('running:50')[0];
		expect(updated.name).toBe('The Hill');
		expect(updated.id).toBe(orig.id);
	});

	it('resizeSegment_nonExistentId_noChange', () => {
		addSegment('running:50', 'Test', 0, 1000);
		resizeSegment('running:50', 'bad-id', 500, 1500);
		const seg = getSegments('running:50')[0];
		expect(seg.startDist).toBe(0);
		expect(seg.endDist).toBe(1000);
	});
});

// ---------------------------------------------------------------------------
// removeSegment
// ---------------------------------------------------------------------------

describe('removeSegment', () => {
	it('removeSegment_existingSegment_removesIt', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		addSegment('running:50', 'Finish', 4000, 5000);
		const id = getSegments('running:50')[0].id;
		removeSegment('running:50', id);
		const segs = getSegments('running:50');
		expect(segs).toHaveLength(1);
		expect(segs[0].name).toBe('Finish');
	});

	it('removeSegment_lastSegment_leavesEmptyList', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		const id = getSegments('running:50')[0].id;
		removeSegment('running:50', id);
		expect(getSegments('running:50')).toHaveLength(0);
	});

	it('removeSegment_nonExistentId_noChange', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		removeSegment('running:50', 'bad-id');
		expect(getSegments('running:50')).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// getSegments
// ---------------------------------------------------------------------------

describe('getSegments', () => {
	it('getSegments_noSegments_returnsEmptyArray', () => {
		expect(getSegments('running:50')).toEqual([]);
	});

	it('getSegments_unknownCourse_returnsEmptyArray', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		expect(getSegments('running:99')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getAllSegments / replaceAllSegments
// ---------------------------------------------------------------------------

describe('getAllSegments', () => {
	it('getAllSegments_emptyStore_returnsEmptyObject', () => {
		expect(getAllSegments()).toEqual({});
	});

	it('getAllSegments_multipleCoursess_returnsAll', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		addSegment('cycling:400', 'Climb', 5000, 10000);
		const all = getAllSegments();
		expect(Object.keys(all)).toHaveLength(2);
		expect(all['running:50']).toHaveLength(1);
		expect(all['cycling:400']).toHaveLength(1);
	});
});

describe('replaceAllSegments', () => {
	it('replaceAllSegments_overwritesExisting', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		replaceAllSegments({
			'cycling:400': [{ id: 'x', name: 'Climb', startDist: 0, endDist: 5000 }],
		});
		expect(getSegments('running:50')).toHaveLength(0);
		expect(getSegments('cycling:400')).toHaveLength(1);
	});

	it('replaceAllSegments_emptyMap_clearsAll', () => {
		addSegment('running:50', 'Hill', 1000, 2000);
		replaceAllSegments({});
		expect(getAllSegments()).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// malformed localStorage
// ---------------------------------------------------------------------------

describe('malformed localStorage', () => {
	it('malformedJson_returnsEmptyAndDoesNotThrow', () => {
		localStorageMock.getItem.mockReturnValueOnce('not valid json {{{');
		expect(() => getSegments('running:50')).not.toThrow();
		expect(getSegments('running:50')).toEqual([]);
	});

	it('nonObjectJson_returnsEmpty', () => {
		localStorageMock.getItem.mockReturnValueOnce('"a string"');
		expect(getSegments('running:50')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// onChange hook
// ---------------------------------------------------------------------------

describe('setOnSegmentChange hook', () => {
	it('addSegment_firesHook', () => {
		const hook = vi.fn();
		setOnSegmentChange(hook);
		addSegment('running:50', 'Hill', 1000, 2000);
		expect(hook).toHaveBeenCalledOnce();
	});

	it('renameSegment_firesHook', () => {
		const hook = vi.fn();
		addSegment('running:50', 'Hill', 1000, 2000);
		setOnSegmentChange(hook);
		renameSegment('running:50', getSegments('running:50')[0].id, 'New');
		expect(hook).toHaveBeenCalledOnce();
	});

	it('resizeSegment_firesHook', () => {
		const hook = vi.fn();
		addSegment('running:50', 'Hill', 1000, 2000);
		setOnSegmentChange(hook);
		resizeSegment('running:50', getSegments('running:50')[0].id, 500, 1500);
		expect(hook).toHaveBeenCalledOnce();
	});

	it('removeSegment_firesHook', () => {
		const hook = vi.fn();
		addSegment('running:50', 'Hill', 1000, 2000);
		setOnSegmentChange(hook);
		removeSegment('running:50', getSegments('running:50')[0].id);
		expect(hook).toHaveBeenCalledOnce();
	});

	it('replaceAllSegments_doesNotFireHook', () => {
		const hook = vi.fn();
		setOnSegmentChange(hook);
		replaceAllSegments({ 'running:50': [{ id: 'x', name: 'Hill', startDist: 0, endDist: 1000 }] });
		expect(hook).not.toHaveBeenCalled();
	});

	it('nullHook_doesNotThrow', () => {
		setOnSegmentChange(null);
		expect(() => addSegment('running:50', 'Hill', 1000, 2000)).not.toThrow();
	});
});
