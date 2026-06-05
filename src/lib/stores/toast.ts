import { writable } from 'svelte/store';
import type { Readable } from 'svelte/store';

export type ToastLevel = 'info' | 'warning' | 'error';

export interface Toast {
	id: number;
	message: string;
	level: ToastLevel;
}

let nextId = 0;
const _timers = new Map<number, ReturnType<typeof setTimeout>>();

const _toasts = writable<Toast[]>([]);
export const toasts: Readable<Toast[]> = _toasts;

export function removeToast(id: number): void {
	const timer = _timers.get(id);
	if (timer !== undefined) {
		clearTimeout(timer);
		_timers.delete(id);
	}
	_toasts.update(ts => ts.filter(t => t.id !== id));
}

export function addToast(message: string, level: ToastLevel = 'warning', duration = 5000): void {
	const id = nextId++;
	_toasts.update(ts => [...ts, { id, message, level }]);
	_timers.set(id, setTimeout(() => removeToast(id), duration));
}
