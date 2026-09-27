// "What's happening around me?" — the home screen's nearby summary. Pure and
// deterministic (no scoring model): incidents are ordered by fixed tiers so
// the same reports always produce the same headline.
import { isRecentlyUpdated } from "@/lib/map-filters";
import { CATEGORY_META, impactsTravel, severityRank } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import type { Report } from "@/types/report";

export const SITUATION_RADIUS_M = 5000;
// "Very near": close enough to matter even when minor.
export const VERY_NEAR_M = 1000;

// Tier order, most important first:
//  0. still active before "may be outdated" — old news never leads
//  1. severe/critical (critical first)
//  2. very near (< 1 km)
//  3. updated recently (the map's 2 h "recent" window)
//  4. affects travel (road incidents, traffic signals)
//  then nearest, then id so ties are stable.
export function compareSituation(now: Date) {
  const key = (r: Report) => {
    const rank = severityRank(r.severity);
    const distance = r.distance_m ?? Number.POSITIVE_INFINITY;
    return [
      currentStatus(r, now) === "active" ? 0 : 1,
      rank >= 3 ? 4 - rank : 2,
      distance < VERY_NEAR_M ? 0 : 1,
      isRecentlyUpdated(r, now) ? 0 : 1,
      impactsTravel(r.type) ? 0 : 1,
      distance,
    ];
  };
  return (a: Report, b: Report): number => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}

export interface Situation {
  // Open incidents (never shelters/aid points), most important first.
  incidents: Report[];
  top: Report | null;
}

export function summarizeSituation(reports: Report[], now: Date = new Date()): Situation {
  const incidents = reports
    .filter((r) => !CATEGORY_META[r.type].facility)
    .filter((r) => {
      const s = currentStatus(r, now);
      return s === "active" || s === "possibly_stale";
    })
    .sort(compareSituation(now));
  return { incidents, top: incidents[0] ?? null };
}
