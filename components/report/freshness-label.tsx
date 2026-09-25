"use client";

import { useEffect, useReducer } from "react";
import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { formatDuration, formatFreshness, freshnessState } from "@/lib/freshness";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Report } from "@/types/report";

const STATE_META = {
  recent: { icon: CircleCheck, className: "text-emerald-700", label: "freshRecent" },
  stale: { icon: TriangleAlert, className: "text-amber-700", label: "freshStale" },
  expired: { icon: Clock, className: "text-muted-foreground", label: "freshExpired" },
} as const;

// Answers "how current is this?": a headline state (never color-only), when
// it was last confirmed, and how many people back it up.
export function FreshnessLabel({ report, className }: { report: Report; className?: string }) {
  const { t } = useTranslation();
  // Everything is derived from the report timestamps + wall-clock time, so
  // it's computed directly in render; the effect only owns the re-render ticker.
  const [, retick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const interval = setInterval(retick, 30_000);
    return () => clearInterval(interval);
  }, []);

  const state = freshnessState(report);
  const meta = STATE_META[state];
  const Icon = meta.icon;

  const when =
    state === "recent"
      ? t(report.still_active_count > 0 ? "verifiedAgo" : "reportedAgo", {
          ago: formatFreshness(report.last_verified_at, t),
        })
      : t("noConfirmationFor", { duration: formatDuration(report.last_verified_at, t) });

  const counts = [
    report.still_active_count > 0 && t("stillActivePeople", { n: report.still_active_count }),
    report.cleared_count > 0 && t("clearedPeople", { n: report.cleared_count }),
  ].filter(Boolean);

  return (
    <div className={cn("flex gap-2.5", className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} aria-hidden />
      <div className="min-w-0 text-sm leading-snug">
        <p className={cn("font-semibold", meta.className)}>{t(meta.label)}</p>
        <p className="text-muted-foreground">{when}</p>
        {counts.length > 0 && <p className="text-muted-foreground">{counts.join(" · ")}</p>}
      </div>
    </div>
  );
}
