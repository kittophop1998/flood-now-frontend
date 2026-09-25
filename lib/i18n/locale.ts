import { en, type TranslationKey } from "./en";
import { th } from "./th";

export type Locale = "en" | "th";
export type { TranslationKey };
export type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export const DEFAULT_LOCALE: Locale = "en";
export const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, th };

const STORAGE_KEY = "floodnow:locale";

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "th";
}

// Mirrors lib/device-id.ts: localStorage first, then a best-effort fallback —
// here the browser's language instead of a freshly generated id.
export function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to browser detection.
  }
  return window.navigator.language?.toLowerCase().startsWith("th") ? "th" : DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore — locale just won't survive a reload
  }
}
