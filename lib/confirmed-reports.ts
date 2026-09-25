// Tracks which reports this device has already confirmed and with what
// status, purely for UI state (highlighting the button already pressed).
// The API doesn't expose per-device confirmation state, so this is
// client-only and best-effort — it's fine if it's lost (private mode, a
// cleared localStorage); worst case the button just isn't pre-highlighted.
import type { ConfirmationStatus } from "@/types/report";

const STORAGE_KEY = "floodnow_confirmed_reports";

function readMap(): Record<string, ConfirmationStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getConfirmedStatus(reportId: string): ConfirmationStatus | null {
  return readMap()[reportId] ?? null;
}

export function setConfirmedStatus(reportId: string, status: ConfirmationStatus): void {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    map[reportId] = status;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort only
  }
}
