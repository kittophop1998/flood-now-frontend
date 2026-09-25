import type { Locale, TranslateFn } from "@/lib/i18n/locale";

export function formatFreshness(iso: string, t: TranslateFn, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);

  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { n: diffMin });

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t("hoursAgo", { n: diffHr });

  return t("daysAgo", { n: Math.round(diffHr / 24) });
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

// The single "how current is this" line used on cards and the detail sheet:
// "Confirmed 3m ago" when someone has vouched for it since it was reported,
// otherwise "Updated 8m ago".
export function freshnessLine(
  report: { last_verified_at: string; still_active_count: number },
  t: TranslateFn,
  now: Date = new Date(),
): string {
  const ago = formatFreshness(report.last_verified_at, t, now);
  return report.still_active_count > 0 ? t("confirmedAgo", { ago }) : t("updatedAgo", { ago });
}
