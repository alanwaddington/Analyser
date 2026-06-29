import type { Device } from '$lib/types';
import { addToast } from './toast';
import { deviceKey } from '../utils/deviceKey';

const STORAGE_KEY = 'analyser-device-labels';

// In-memory cache; populated lazily on first access and kept in sync with
// every write so repeated reads within a session never hit localStorage again.
let _cache: Map<string, string> | null = null;

// Callback hook set by sync.ts during initSync(). Called fire-and-forget after
// every label write or delete so the remote store stays in sync automatically.
// Defaults to null (no-op) until sync is initialised.
let _onLabelChange: (() => void) | null = null;

/** Stable localStorage key for a device. Re-exported from utils/deviceKey for callers that import from this module. */
export { deviceKey as deviceStorageKey } from '../utils/deviceKey';

function getCache(): Map<string, string> {
	if (_cache !== null) return _cache;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			_cache = new Map();
			return _cache;
		}
		// Parse entries — keys may be numeric (old format) or string (current format).
		// Old format always used antDeviceNumber (an ANT+ protocol field) as a raw
		// numeric key; numeric entries are therefore safely re-keyed as `ant:{n}`.
		const entries = JSON.parse(raw) as [number | string, string][];
		let needsMigration = false;
		const migrated: [string, string][] = entries.map(([k, v]) => {
			if (typeof k === 'number') {
				needsMigration = true;
				return [`ant:${k}`, v];
			}
			return [k, v];
		});
		_cache = new Map(migrated);
		if (needsMigration) {
			// Save back in the new format so migration only happens once.
			saveLabels(_cache);
		}
	} catch {
		_cache = new Map();
	}
	return _cache;
}

function saveLabels(map: Map<string, string>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
	} catch (e) {
		const msg = e instanceof DOMException && e.name === 'QuotaExceededError'
			? 'Device label could not be saved — storage full'
			: 'Device label could not be saved';
		console.warn('[deviceLabels] localStorage write failed:', e);
		addToast(msg, 'warning');
	}
}

/** Get the stored label for a device by its storage key. */
export function getDeviceLabel(key: string): string | undefined {
	return getCache().get(key);
}

/**
 * Persist a user-assigned label for a device by its storage key.
 * Callers are responsible for trimming `label` before passing it here.
 */
export function setDeviceLabel(key: string, label: string): void {
	const map = getCache();
	map.set(key, label);
	saveLabels(map);
	_onLabelChange?.();
}

/** Remove a stored label for a device, reverting to manufacturer/product fallback. */
export function removeDeviceLabel(key: string): void {
	const map = getCache();
	map.delete(key);
	saveLabels(map);
	_onLabelChange?.();
}

/**
 * Register a callback that fires after every label write or delete.
 * Used by sync.ts to trigger a remote push on each label change.
 * The callback is called synchronously but should initiate async work internally.
 * Pass null to deregister (e.g. during component teardown).
 */
export function setOnLabelChange(callback: (() => void) | null): void {
	_onLabelChange = callback;
}

/** Returns all stored labels as a plain object for sync serialisation. */
export function getAllLabels(): Record<string, string> {
	return Object.fromEntries(getCache().entries());
}

/**
 * Replace the entire label cache and localStorage with the provided map.
 * Used by sync.ts when pulling labels from the remote store (bulk overwrite).
 * Does NOT trigger the onLabelChange hook — this is a system write, not a user action.
 */
export function replaceAllLabels(labels: Record<string, string>): void {
	_cache = new Map(Object.entries(labels));
	saveLabels(_cache);
}

/**
 * Returns the stored label for a device, or undefined if none exists.
 * Pure function — reads from cache without side effects.
 */
export function resolveLabel(device: Device): string | undefined {
	const key = deviceKey(device);
	if (key == null) return undefined;
	const stored = getCache().get(key);
	return stored || undefined;
}

/**
 * Returns a new array of Device objects with stored labels applied.
 * Devices with no stored label are returned as-is (same reference).
 * Does not mutate the input array or its elements.
 */
export function applyLabels(devices: Device[]): Device[] {
	return devices.map(d => {
		const label = resolveLabel(d);
		return label ? { ...d, label } : d;
	});
}
