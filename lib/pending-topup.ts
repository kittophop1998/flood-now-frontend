// Remembers (on this device) which PromptPay top-up's QR is on screen, so
// its result can still be shown after the app was left or reloaded while
// the person paid in their banking app — common on phones. Only the id is
// kept (never payment or session data), and the server stays the only
// source of truth for its status. Best-effort: storage may be unavailable.
const KEY = "floodnow:pending-topup";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function rememberTopup(id: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() }));
  } catch {
    // best-effort only
  }
}

export function forgetTopup() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // best-effort only
  }
}

// The remembered top-up id, if it was remembered within maxAgeMs.
export function recalledTopup(maxAgeMs = MAX_AGE_MS): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { id?: unknown; at?: unknown };
    if (typeof v.id !== "string" || typeof v.at !== "number" || Date.now() - v.at > maxAgeMs) return null;
    return v.id;
  } catch {
    return null;
  }
}
