"use client";

import { useEffect, useReducer } from "react";
import { Clock } from "lucide-react";
import { formatFreshness } from "@/lib/freshness";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/locale-context";

export function FreshnessLabel({ lastVerifiedAt, isExpired, className }: { lastVerifiedAt: string; isExpired: boolean; className?: string }) {
  const { t } = useTranslation();
  // Label is derived from lastVerifiedAt + wall-clock time, so it's computed
  // directly in render; the effect only owns the re-render ticker.
  const [, retick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const interval = setInterval(retick, 30_000);
    return () => clearInterval(interval);
  }, []);
  const label = formatFreshness(lastVerifiedAt, t);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isExpired ? "text-muted-foreground" : "text-foreground/70",
        className,
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      {isExpired ? t("expiredPrefix") : t("lastVerifiedPrefix")}
      {label}
    </span>
  );
}
