import type { TranslateFn } from "@/lib/i18n/locale";

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
