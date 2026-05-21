import type { Device } from '$lib/types';

const STORAGE_KEY = 'analyser-device-labels';

function loadLabels(): Map<number, string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Map();
		const entries = JSON.parse(raw) as [number, string][];
		return new Map(entries);
	} catch {
		return new Map();
	}
}

function saveLabels(map: Map<number, string>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
	} catch {
		// localStorage may be unavailable in some environments (SSR, private browsing)
	}
}

/** Get the stored label for a device by its ANT+ device number. */
export function getDeviceLabel(antDeviceNumber: number): string | undefined {
	return loadLabels().get(antDeviceNumber);
}

/** Persist a user-assigned label for a device by its ANT+ device number. */
export function setDeviceLabel(antDeviceNumber: number, label: string): void {
	const map = loadLabels();
	map.set(antDeviceNumber, label.trim());
	saveLabels(map);
}

/** Remove a stored label for a device, reverting to manufacturer/product fallback. */
export function removeDeviceLabel(antDeviceNumber: number): void {
	const map = loadLabels();
	map.delete(antDeviceNumber);
	saveLabels(map);
}

/**
 * Apply stored labels to an array of devices in-place.
 * Only devices with a known antDeviceNumber are checked.
 */
export function applyLabels(devices: Device[]): void {
	const map = loadLabels();
	for (const device of devices) {
		if (device.antDeviceNumber != null) {
			const stored = map.get(device.antDeviceNumber);
			if (stored) device.label = stored;
		}
	}
}
