/**
 * Running Stress Score — analagous to Training Stress Score (TSS) for running power.
 * Formula: (durationS × avgPower × IF²) / (CP × 3600)
 * where IF (Intensity Factor) = avgPower / CP.
 */
export function computeRSS(durationS: number, avgPower: number, cp: number): number {
	if (durationS === 0 || avgPower === 0) return 0;
	const IF = avgPower / cp;
	return (durationS * avgPower * IF * IF) / (cp * 3600);
}
