// Lightweight anonymous per-device identity for MVP anti-duplicate
// confirmation protection only — NOT authentication. See docs/product-spec.md.
const STORAGE_KEY = "floodnow_device_id";

// In-memory fallback so a session without localStorage (private mode,
// blocked storage) still gets one stable id per page load.
let sessionFallbackId: string | null = null;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    if (!sessionFallbackId) sessionFallbackId = crypto.randomUUID();
    return sessionFallbackId;
  }
}
