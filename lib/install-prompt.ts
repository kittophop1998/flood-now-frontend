// First-visit "install FloodNow on your phone" hint. Shown once per browser:
// the flag is kept in localStorage like the other per-device preferences.
const STORAGE_KEY = "floodnow:install-prompt-seen";

export type InstallMode =
  | "native" // the browser fired beforeinstallprompt: we can open its install dialog
  | "ios" // iPhone/iPad: only "Share → Add to Home Screen" exists
  | "manual"; // other mobile browsers: install from the browser menu

export function hasSeenInstallPrompt(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    // No storage (private mode): don't nag on every visit.
    return true;
  }
}

export function markInstallPromptSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // best-effort
  }
}

// iPadOS reports itself as a Mac; a touch screen gives it away.
export function isIOS(userAgent: string, maxTouchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

export function isMobile(userAgent: string, maxTouchPoints: number): boolean {
  return isIOS(userAgent, maxTouchPoints) || /android|mobile/i.test(userAgent);
}

// Which hint to show, or null when none should be shown (desktop, already
// installed, or already seen).
export function installModeFor(opts: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  seen: boolean;
  nativePromptAvailable: boolean;
}): InstallMode | null {
  if (opts.seen || opts.standalone || !isMobile(opts.userAgent, opts.maxTouchPoints)) return null;
  if (opts.nativePromptAvailable) return "native";
  return isIOS(opts.userAgent, opts.maxTouchPoints) ? "ios" : "manual";
}
