// Tracks which reports this device has already confirmed, with what status
// and when, purely for UI state (highlighting the pressed button and
// blocking accidental repeat taps). The API upserts one vote per device
// anyway, so this is client-only and best-effort — it's fine if it's lost.
import type { ConfirmationStatus } from "@/types/report";

const STORAGE_KEY = "floodnow_confirmed_reports";

// Re-sending the same vote within this window is treated as an accidental
// double tap. After it, "still happening" may be confirmed again, which
// refreshes the report's freshness.
export const RECONFIRM_COOLDOWN_MS = 10 * 60_000;

export interface DeviceConfirmation {
  status: ConfirmationStatus;
  at: number;
}

type Stored = Record<string, DeviceConfirmation | ConfirmationStatus>;

function readMap(): Stored {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getConfirmation(reportId: string): DeviceConfirmation | null {
  const value = readMap()[reportId];
  if (!value) return null;
  // Entries written before timestamps were tracked.
  if (typeof value === "string") return { status: value, at: 0 };
  return value;
}

export function setConfirmation(reportId: string, status: ConfirmationStatus): DeviceConfirmation {
  const entry = { status, at: Date.now() };
  if (typeof window === "undefined") return entry;
  try {
    const map = readMap();
    map[reportId] = entry;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort only
  }
  return entry;
}

export function isInCooldown(entry: DeviceConfirmation | null, status: ConfirmationStatus, now = Date.now()): boolean {
  return entry != null && entry.status === status && now - entry.at < RECONFIRM_COOLDOWN_MS;
}
