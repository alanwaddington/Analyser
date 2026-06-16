import { writable } from 'svelte/store';
import type { AthleteProfile } from '$lib/types';
import { addToast } from './toast';

const STORAGE_KEY = 'analyser-athlete-profile';

export const athleteProfile = writable<AthleteProfile>({});

export function setProfileField<K extends keyof AthleteProfile>(
	key: K,
	value: AthleteProfile[K] | undefined,
): void {
	athleteProfile.update(current => {
		const next = { ...current };
		if (value == null || (typeof value === 'number' && isNaN(value))) {
			delete next[key];
		} else {
			next[key] = value;
		}
		_persist(next);
		return next;
	});
}

export function initAthleteProfile(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			athleteProfile.set(JSON.parse(raw) as AthleteProfile);
		}
	} catch {
		// Malformed JSON — leave store at default empty state
	}
}

function _persist(profile: AthleteProfile): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
	} catch (e) {
		const msg =
			e instanceof DOMException && e.name === 'QuotaExceededError'
				? 'Athlete profile could not be saved — storage full'
				: 'Athlete profile could not be saved';
		console.warn('[athleteProfile] localStorage write failed:', e);
		addToast(msg, 'warning');
	}
}
