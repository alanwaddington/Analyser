import type { AthleteProfile, ChannelKey } from '$lib/types';
import { ftpPct, cpPct, wPerKg, hrZone } from '$lib/analytics/zones';

export type CellContext = { pctLabel?: string; wkg?: string; zone?: number } | null;

/**
 * Derive contextual display data for a summary table cell.
 * Returns threshold-relative labels (% FTP, % CP), w/kg, and HR zone when
 * the relevant fields are configured in the athlete profile. Returns null
 * when no profile data applies to this channel.
 */
export function buildCellContext(
	ch: ChannelKey,
	avg: number,
	sport: string | undefined,
	profile: AthleteProfile
): CellContext {
	if (ch === 'power') {
		const isCycling = sport !== 'running';
		const pctLabel = isCycling && profile.ftp
			? `${ftpPct(avg, profile.ftp)}% FTP`
			: !isCycling && profile.cp
				? `${cpPct(avg, profile.cp)}% CP`
				: undefined;
		const wkg = profile.weight ? wPerKg(avg, profile.weight).toFixed(1) : undefined;
		return (pctLabel || wkg) ? { pctLabel, wkg } : null;
	}
	if (ch === 'heartRate') {
		const zone = hrZone(avg, profile, sport ?? 'cycling');
		return zone != null ? { zone } : null;
	}
	return null;
}
