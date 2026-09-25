import type { Locale, TranslateFn } from "@/lib/i18n/locale";

// A report verified within this window reads as "up to date"; older (but not
// yet expired) reports are flagged as possibly stale. Well inside the
// default 2h REPORT_TTL so the warning shows up before the report expires.
export const FRESH_WINDOW_MS = 30 * 60_000;

export type FreshnessState = "recent" | "stale" | "expired";

export function freshnessState(
  report: { last_verified_at: string; expires_at: string; is_expired: boolean },
  now: Date = new Date(),
): FreshnessState {
  if (report.is_expired || now.getTime() >= new Date(report.expires_at).getTime()) return "expired";
  return now.getTime() - new Date(report.last_verified_at).getTime() <= FRESH_WINDOW_MS ? "recent" : "stale";
}

export function formatFreshness(lastVerifiedAt: string, t: TranslateFn, now: Date = new Date()): string {
  const verified = new Date(lastVerifiedAt);
  const diffMs = now.getTime() - verified.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { n: diffMin });

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("hoursAgo", { n: diffHr });

  const diffDay = Math.round(diffHr / 24);
  return t("daysAgo", { n: diffDay });
}

// Elapsed time without the "ago" suffix, e.g. "58 min" — for phrasing like
// "no confirmation for 58 min".
export function formatDuration(since: string, t: TranslateFn, now: Date = new Date()): string {
  const diffMin = Math.max(1, Math.round((now.getTime() - new Date(since).getTime()) / 60000));
  if (diffMin < 60) return t("durationMinutes", { n: diffMin });
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("durationHours", { n: diffHr });
  return t("durationDays", { n: Math.round(diffHr / 24) });
}

// Wall-clock time of an event ("11:03 น." / "11:03"), with the date prepended
// when it wasn't today.
export function formatClockTime(iso: string, locale: Locale, now: Date = new Date()): string {
  const date = new Date(iso);
  const tag = locale === "th" ? "th-TH" : "en-GB";
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const clock = locale === "th" ? `${time} น.` : time;
  if (date.toDateString() === now.toDateString()) return clock;
  const day = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }).format(date);
  return `${day} ${clock}`;
}
