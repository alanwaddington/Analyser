import { writable } from 'svelte/store';
import type { ChannelKey } from '$lib/types';

export interface SessionLinkPayload {
	d?: string[];                    // active device storage keys (from deviceKey())
	c?: string[];                    // active channel keys
	s?: number;                      // smoothing window (seconds)
	x?: 'time' | 'distance';        // xAxisMode
	m?: 'compare' | 'event';        // mode
	t?: string;                      // active tab id
	zs?: boolean;                    // zone shading enabled (view flag — future)
	wkg?: boolean;                   // w/kg axis enabled (view flag — future)
	mc?: string;                     // map colour mode (view flag — future)
}

/** One-shot writable — set by layout on `?v=` decode, consumed once by page components. */
export const sessionLinkState = writable<SessionLinkPayload | null>(null);

/** Encode a session payload to a URL-safe base64 string. */
export function encodeSessionLink(payload: SessionLinkPayload): string {
	const json = JSON.stringify(payload);
	return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a URL-safe base64 string to a session payload, or null on any error. */
export function decodeSessionLink(encoded: string): SessionLinkPayload | null {
	if (!encoded) return null;
	try {
		const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
		const json = atob(base64);
		const parsed: unknown = JSON.parse(json);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
		return sanitisePayload(parsed as Record<string, unknown>);
	} catch {
		return null;
	}
}

function sanitisePayload(raw: Record<string, unknown>): SessionLinkPayload {
	const out: SessionLinkPayload = {};
	if (Array.isArray(raw.d) && raw.d.every((x): x is string => typeof x === 'string')) {
		out.d = raw.d;
	}
	if (Array.isArray(raw.c) && raw.c.every((x): x is string => typeof x === 'string')) {
		out.c = raw.c as ChannelKey[];
	}
	if (typeof raw.s === 'number' && isFinite(raw.s)) out.s = raw.s;
	if (raw.x === 'time' || raw.x === 'distance') out.x = raw.x;
	if (raw.m === 'compare' || raw.m === 'event') out.m = raw.m;
	if (typeof raw.t === 'string') out.t = raw.t;
	if (typeof raw.zs === 'boolean') out.zs = raw.zs;
	if (typeof raw.wkg === 'boolean') out.wkg = raw.wkg;
	if (typeof raw.mc === 'string') out.mc = raw.mc;
	return out;
}
