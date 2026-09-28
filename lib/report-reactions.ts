// Remembers which reaction (if any) the signed-in user set on a report, purely
// for UI state (highlighting the pressed chip before the API says so). The
// API keeps one reaction per user and returns it as `my_reaction` where it
// knows the caller (see docs/api-spec.md), so this is a best-effort cache,
// kept per account so another person signing in on this phone never sees it.
// Mirrors lib/confirmed-reports.ts.
import type { ReactionType } from "@/types/report";

const STORAGE_PREFIX = "floodnow_report_reactions:";

type Stored = Record<string, ReactionType>;

function readMap(userId: string): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getMyReaction(userId: string, reportId: string): ReactionType | null {
  return readMap(userId)[reportId] ?? null;
}

// Stores (or, with null, forgets) the user's reaction to a report.
export function rememberMyReaction(userId: string, reportId: string, type: ReactionType | null) {
  if (typeof window === "undefined") return;
  try {
    const map = readMap(userId);
    if (type) map[reportId] = type;
    else delete map[reportId];
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(map));
  } catch {
    // best-effort only
  }
}

// Tapping the already-selected reaction clears it; tapping the other one
// switches to it. The pure state transition, kept separate so it's testable
// without touching localStorage or the network.
export function nextReaction(current: ReactionType | null, tapped: ReactionType): ReactionType | null {
  return current === tapped ? null : tapped;
}
