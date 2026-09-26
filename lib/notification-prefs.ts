// Per-device notification preferences and "last read" cursor. Kept in
// localStorage like lib/device-id.ts and lib/confirmed-reports.ts: they only
// shape the in-app feed on this device. When push delivery is added, these
// toggles move server-side next to the follows (see docs/api-spec.md).
import { NOTIFICATION_KINDS, type NotificationKind } from "@/types/report";

const PREFS_KEY = "floodnow:notification-prefs";
const LAST_READ_KEY = "floodnow:notifications-last-read";

export type NotificationPrefs = Record<NotificationKind, boolean>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  severe_nearby: true,
  resolved: true,
  reopened: true,
  updated: true,
  confirmed: false,
};

export function readNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    const out = { ...DEFAULT_NOTIFICATION_PREFS };
    for (const kind of NOTIFICATION_KINDS) {
      if (typeof parsed[kind] === "boolean") out[kind] = parsed[kind];
    }
    return out;
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function writeNotificationPrefs(prefs: NotificationPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort only
  }
}

export function readLastRead(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_READ_KEY);
  } catch {
    return null;
  }
}

export function writeLastRead(iso: string): void {
  try {
    window.localStorage.setItem(LAST_READ_KEY, iso);
  } catch {
    // best-effort only
  }
}
