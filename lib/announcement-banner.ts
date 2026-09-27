// The official-announcement banner over the map can be minimized. It stays
// minimized only for the announcements that were showing when the user
// minimized it: a newly published one opens it again.

// Remembered per device (best-effort; a private window just starts expanded).
export const BANNER_COLLAPSED_KEY = "floodnow:announcement-banner-collapsed";
// Only ids that could still matter are kept, so the stored list stays small.
const MAX_REMEMBERED = 100;

export function isBannerCollapsed(currentIds: readonly string[], collapsedIds: readonly string[] | null): boolean {
  if (!collapsedIds) return false;
  const seen = new Set(collapsedIds);
  return currentIds.every((id) => seen.has(id));
}

// Ids to remember when minimizing: everything showing now, plus earlier ones
// (so panning back to an area doesn't reopen what was already dismissed).
export function collapsedIdsAfterMinimize(currentIds: readonly string[], collapsedIds: readonly string[] | null): string[] {
  const merged = [...currentIds];
  for (const id of collapsedIds ?? []) if (!merged.includes(id)) merged.push(id);
  return merged.slice(0, MAX_REMEMBERED);
}

export function readCollapsedIds(): string[] | null {
  try {
    const raw = window.localStorage.getItem(BANNER_COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return null;
  }
}

export function writeCollapsedIds(ids: string[] | null) {
  try {
    if (ids) window.localStorage.setItem(BANNER_COLLAPSED_KEY, JSON.stringify(ids));
    else window.localStorage.removeItem(BANNER_COLLAPSED_KEY);
  } catch {
    // best-effort only
  }
}
