import { writable } from 'svelte/store';
import { getAllLabels, replaceAllLabels, setOnLabelChange } from '$lib/stores/deviceLabels';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const SYNC_ID_KEY   = 'analyser-sync-id';
const SYNC_CODE_KEY = 'analyser-sync-code';
const SYNC_TS_KEY   = 'analyser-sync-ts';

// ---------------------------------------------------------------------------
// Status type and in-memory state
// ---------------------------------------------------------------------------

export type SyncStatus = {
	uuid: string | null;
	shortCode: string | null;
	lastSynced: string | null; // ISO timestamp of last successful sync
	error: string | null;
};

let _status: SyncStatus = {
	uuid: null,
	shortCode: null,
	lastSynced: null,
	error: null,
};

/** Reactive store — subscribe in Svelte components to update the UI. */
export const syncStatus = writable<SyncStatus>(_status);

function updateStatus(partial: Partial<SyncStatus>): void {
	_status = { ..._status, ...partial };
	syncStatus.set(_status);
}

// ---------------------------------------------------------------------------
// Short code derivation
// ---------------------------------------------------------------------------

/**
 * Derives an 8-character alphanumeric short code from a UUID.
 * Format: XXX-XXXXX (3 chars, dash, 5 chars).
 *
 * The code is the most-significant 8 base-36 characters of the UUID's numeric value,
 * giving a namespace of 36^8 ≈ 2.8 trillion — effectively collision-free in practice.
 * The code is a human-readable convenience alias only; the full UUID is stored in KV.
 */
export function deriveShortCode(uuid: string): string {
	const hex = uuid.replace(/-/g, '');
	const n = BigInt('0x' + hex);
	const raw = n.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
	return `${raw.slice(0, 3)}-${raw.slice(3)}`;
}

// ---------------------------------------------------------------------------
// Core sync operations
// ---------------------------------------------------------------------------

/**
 * Push the full local label map to the remote store.
 * Fires after initSync is called; subsequently triggered automatically
 * by the onLabelChange hook after every setDeviceLabel / removeDeviceLabel.
 *
 * Errors are caught and surfaced in syncStatus.error — they do NOT propagate.
 */
export async function pushLabels(uuid: string, shortCode: string): Promise<void> {
	try {
		const labels = getAllLabels();
		const response = await fetch(`/api/labels/${uuid}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ labels, shortCode }),
		});
		if (!response.ok) {
			throw new Error(`Push failed: ${response.status}`);
		}
		const ts = new Date().toISOString();
		localStorage.setItem(SYNC_TS_KEY, ts);
		updateStatus({ lastSynced: ts, error: null });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Sync push failed';
		console.warn('[sync] pushLabels error:', msg);
		updateStatus({ error: msg });
	}
}

/**
 * Pull the label map from the remote store and overwrite localStorage.
 * KV is treated as the source of truth after initial seeding.
 * A 404 response is silently ignored (remote has no data yet — that's fine).
 *
 * Errors are caught and surfaced in syncStatus.error — they do NOT propagate.
 */
export async function pullLabels(uuid: string): Promise<void> {
	try {
		const response = await fetch(`/api/labels/${uuid}`);
		if (response.status === 404) {
			// No remote data yet — continue with local labels
			return;
		}
		if (!response.ok) {
			throw new Error(`Pull failed: ${response.status}`);
		}
		const data = await response.json() as { labels: Record<string, string> };
		replaceAllLabels(data.labels);
		const ts = new Date().toISOString();
		localStorage.setItem(SYNC_TS_KEY, ts);
		updateStatus({ lastSynced: ts, error: null });
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Sync pull failed';
		console.warn('[sync] pullLabels error:', msg);
		updateStatus({ error: msg });
	}
}

/**
 * Resolve a short sync code to its full UUID via the API.
 * Throws `Error('Code not found')` on 404 (invalid or expired code).
 * Other errors also throw — the caller (SyncPanel) handles the UI.
 */
export async function resolveCode(code: string): Promise<string> {
	const response = await fetch(`/api/labels/resolve/${code}`);
	if (response.status === 404) {
		throw new Error('Code not found');
	}
	if (!response.ok) {
		throw new Error(`Resolve failed: ${response.status}`);
	}
	const data = await response.json() as { uuid: string };
	return data.uuid;
}

// ---------------------------------------------------------------------------
// Identity management
// ---------------------------------------------------------------------------

/**
 * Adopt a sync identity from an external source (QR scan, pasted link, or typed code).
 * Stores the UUID and derived short code in localStorage, then pulls remote labels.
 */
export async function adoptSyncIdentity(uuid: string): Promise<void> {
	const shortCode = deriveShortCode(uuid);
	localStorage.setItem(SYNC_ID_KEY, uuid);
	localStorage.setItem(SYNC_CODE_KEY, shortCode);
	updateStatus({ uuid, shortCode, error: null });
	await pullLabels(uuid);
}

/**
 * Generate a new sync identity, abandoning the current sync ring.
 * Pushes current labels under the new identity so no data is lost.
 */
export async function resetSyncIdentity(): Promise<void> {
	const newUuid = crypto.randomUUID();
	const newShortCode = deriveShortCode(newUuid);
	localStorage.setItem(SYNC_ID_KEY, newUuid);
	localStorage.setItem(SYNC_CODE_KEY, newShortCode);
	localStorage.removeItem(SYNC_TS_KEY);
	updateStatus({ uuid: newUuid, shortCode: newShortCode, lastSynced: null, error: null });
	await pushLabels(newUuid, newShortCode);
}

/** Returns the current sync status snapshot. */
export function getSyncStatus(): SyncStatus {
	return _status;
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Initialise sync on app mount. Call once from +layout.svelte onMount.
 * - First visit: generates UUID, derives short code, seeds remote with local labels.
 * - Returning visit: pulls latest labels from remote (KV is source of truth).
 * In both cases: registers the onLabelChange hook for future automatic pushes.
 * SSR-safe (no-op when window is undefined).
 */
export async function initSync(): Promise<void> {
	if (typeof localStorage === 'undefined') return;

	let uuid = localStorage.getItem(SYNC_ID_KEY);
	let shortCode = localStorage.getItem(SYNC_CODE_KEY);

	if (!uuid) {
		// First visit: generate new identity and seed the remote store
		uuid = crypto.randomUUID();
		shortCode = deriveShortCode(uuid);
		localStorage.setItem(SYNC_ID_KEY, uuid);
		localStorage.setItem(SYNC_CODE_KEY, shortCode);
		updateStatus({ uuid, shortCode, error: null });
		await pushLabels(uuid, shortCode);
	} else {
		// Returning visit: ensure short code is derived and pull latest from remote
		if (!shortCode) {
			shortCode = deriveShortCode(uuid);
			localStorage.setItem(SYNC_CODE_KEY, shortCode);
		}
		updateStatus({
			uuid,
			shortCode,
			lastSynced: localStorage.getItem(SYNC_TS_KEY),
			error: null,
		});
		await pullLabels(uuid);
	}

	// Register the hook so all subsequent label changes trigger an automatic push.
	// The captured uuid/shortCode references are refreshed from localStorage each time
	// so they stay current even after adoptSyncIdentity or resetSyncIdentity.
	setOnLabelChange(() => {
		const currentUuid = localStorage.getItem(SYNC_ID_KEY);
		const currentCode = localStorage.getItem(SYNC_CODE_KEY);
		if (currentUuid && currentCode) {
			// Fire and forget — errors are surfaced in syncStatus
			pushLabels(currentUuid, currentCode).catch(() => {});
		}
	});
}
