import type { Activity } from '$lib/types';
import { addToast } from './toast';

const STORAGE_KEY = 'analyser-custom-segments';

export interface CustomSegment {
	id: string;
	name: string;
	startDist: number; // metres
	endDist: number;   // metres
}

// In-memory cache; populated lazily on first access.
let _cache: Record<string, CustomSegment[]> | null = null;

// Callback hook set by sync.ts during initSync(). Called after every user-initiated
// write so the remote store stays in sync. Null until sync is initialised.
let _onSegmentChange: (() => void) | null = null;

/**
 * Derive a stable course identity key from an activity.
 * Format: `${sport}:${Math.round(totalDistance / 100)}`
 * Rounds distance to nearest 100m, tolerating GPS drift between runs of the same course.
 * A 5km parkrun recorded as 5.01km and 4.98km both produce `running:50`.
 */
export function courseKey(activity: Activity): string {
	const sport = activity.sport ?? 'unknown';
	const bucket = Math.round(activity.totalDistance / 100);
	return `${sport}:${bucket}`;
}

function getCache(): Record<string, CustomSegment[]> {
	if (_cache !== null) return _cache;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			_cache = {};
			return _cache;
		}
		const parsed = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			_cache = {};
			return _cache;
		}
		_cache = parsed as Record<string, CustomSegment[]>;
	} catch {
		_cache = {};
	}
	return _cache;
}

function saveCache(map: Record<string, CustomSegment[]>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch (e) {
		const msg = e instanceof DOMException && e.name === 'QuotaExceededError'
			? 'Custom segment could not be saved — storage full'
			: 'Custom segment could not be saved';
		console.warn('[customSegments] localStorage write failed:', e);
		addToast(msg, 'warning');
	}
}

/** Return all custom segments for a given course key. */
export function getSegments(key: string): CustomSegment[] {
	return [...(getCache()[key] ?? [])];
}

/** Add a new custom segment for a course. Generates a UUID for the segment. */
export function addSegment(key: string, name: string, startDist: number, endDist: number): void {
	const map = getCache();
	const list = map[key] ?? [];
	list.push({ id: crypto.randomUUID(), name, startDist, endDist });
	map[key] = list;
	saveCache(map);
	_onSegmentChange?.();
}

/** Rename an existing custom segment (no-op if id not found). */
export function renameSegment(key: string, id: string, newName: string): void {
	const map = getCache();
	const list = map[key];
	if (!list) return;
	const seg = list.find(s => s.id === id);
	if (!seg) return;
	seg.name = newName;
	saveCache(map);
	_onSegmentChange?.();
}

/** Resize an existing custom segment by updating its distance bounds (no-op if id not found). */
export function resizeSegment(key: string, id: string, startDist: number, endDist: number): void {
	const map = getCache();
	const list = map[key];
	if (!list) return;
	const seg = list.find(s => s.id === id);
	if (!seg) return;
	seg.startDist = startDist;
	seg.endDist = endDist;
	saveCache(map);
	_onSegmentChange?.();
}

/** Remove a custom segment by id (no-op if id not found). */
export function removeSegment(key: string, id: string): void {
	const map = getCache();
	const list = map[key];
	if (!list) return;
	const idx = list.findIndex(s => s.id === id);
	if (idx === -1) return;
	list.splice(idx, 1);
	saveCache(map);
	_onSegmentChange?.();
}

/** Returns the full segments map for sync serialisation. */
export function getAllSegments(): Record<string, CustomSegment[]> {
	return { ...getCache() };
}

/**
 * Bulk-overwrite the segments cache and localStorage.
 * Used by sync.ts when pulling segments from the remote store.
 * Does NOT fire the onChange hook — this is a system write, not a user action.
 */
export function replaceAllSegments(map: Record<string, CustomSegment[]>): void {
	_cache = { ...map };
	saveCache(_cache);
}

/**
 * Register a callback that fires after every user-initiated segment change.
 * Used by sync.ts to trigger a remote push on each change.
 * Pass null to deregister.
 */
export function setOnSegmentChange(callback: (() => void) | null): void {
	_onSegmentChange = callback;
}
