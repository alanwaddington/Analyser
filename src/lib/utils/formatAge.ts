/** Convert an ISO timestamp to a human-readable relative time string. */
export function formatAge(ts: string | null): string {
	if (!ts) return '';
	const diff = Date.now() - new Date(ts).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins} min ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return new Date(ts).toLocaleDateString();
}
