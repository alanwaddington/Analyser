export function smooth(values: (number | null)[], windowSize: number): (number | null)[] {
	if (windowSize <= 1) return values;
	const half = Math.floor(windowSize / 2);
	return values.map((_, i) => {
		const slice = values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1));
		const nums = slice.filter((v): v is number => v != null);
		return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
	});
}
