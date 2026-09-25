// Last-known copies of useful data (map reports, saved places, important
// places, config) for poor/no network. Every entry records when it was
// fetched so the UI can say "last updated at …" instead of pretending it's
// live. localStorage, best-effort — losing it only means no offline copy.
const PREFIX = "floodnow:cache:";

export interface CachedValue<T> {
  data: T;
  savedAt: string;
}

export function readCache<T>(key: string): CachedValue<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedValue<T>;
    return parsed && typeof parsed.savedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T, now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: now.toISOString() }));
  } catch {
    // Storage full or blocked: skip caching rather than fail the request.
  }
}
