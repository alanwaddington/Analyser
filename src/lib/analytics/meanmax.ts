// Mean-max curve: best average value over every window duration (in samples)
export function meanMaxCurve(values: (number | null)[]): { duration: number; mean: number }[] {
	const nums = values.filter((v): v is number => v != null);
	if (nums.length === 0) return [];

	const result: { duration: number; mean: number }[] = [];
	// Sparse durations: every second up to 60, then every 10s, then every 60s
	const durations = buildDurations(nums.length);

	for (const dur of durations) {
		let best = -Infinity;
		let sum = nums.slice(0, dur).reduce((a, b) => a + b, 0);
		best = sum / dur;

		for (let i = dur; i < nums.length; i++) {
			sum += nums[i] - nums[i - dur];
			const avg = sum / dur;
			if (avg > best) best = avg;
		}
		if (best > -Infinity) result.push({ duration: dur, mean: best });
	}

	return result;
}

function buildDurations(max: number): number[] {
	const d = new Set<number>();
	for (let i = 1; i <= Math.min(max, 60); i++) d.add(i);
	for (let i = 70; i <= Math.min(max, 600); i += 10) d.add(i);
	for (let i = 660; i <= Math.min(max, 3600); i += 60) d.add(i);
	for (let i = 3900; i <= max; i += 300) d.add(i);
	d.add(max);
	return [...d].sort((a, b) => a - b);
}
