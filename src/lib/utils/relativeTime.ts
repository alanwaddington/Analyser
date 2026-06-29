const SEC = 1000;
const MIN = 60 * SEC;
const HR = 60 * MIN;
const DAY = 24 * HR;

/**
 * Returns a human-readable relative time string.
 * @param ts  - the timestamp in ms to describe
 * @param now - the reference "now" in ms (defaults to Date.now())
 */
export function relativeTime(ts: number, now = Date.now()): string {
	const diff = Math.max(0, now - ts);
	if (diff < MIN)  return 'just now';
	if (diff < HR)   return `${Math.floor(diff / MIN)} min ago`;
	if (diff < DAY)  {
		const hrs = Math.floor(diff / HR);
		return hrs === 1 ? '1 hr ago' : `${hrs} hrs ago`;
	}
	if (diff < 2 * DAY) return 'yesterday';
	return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
