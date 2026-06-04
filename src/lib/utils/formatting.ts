/** Convert a decimal min/km pace value to an "M:SS" string (e.g. 5.5 → "5:30"). */
export function formatPace(decimalMinutes: number): string {
	const totalSeconds = Math.round(decimalMinutes * 60);
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}
