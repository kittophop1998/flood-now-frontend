// Tracks which reaction (if any) this device set on a report, purely for UI
// state (highlighting the pressed chip across visits). The API upserts one
// reaction per device anyway (see docs/api-spec.md), so this is client-only
// and best-effort — it's fine if it's lost. Mirrors lib/confirmed-reports.ts.
import type { ReactionType } from "@/types/report";

const STORAGE_KEY = "floodnow_report_reactions";

type Stored = Record<string, ReactionType>;

function readMap(): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getMyReaction(reportId: string): ReactionType | null {
  return readMap()[reportId] ?? null;
}

export function setMyReaction(reportId: string, type: ReactionType) {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    map[reportId] = type;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort only
  }
}

export function clearMyReaction(reportId: string) {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    delete map[reportId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
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
