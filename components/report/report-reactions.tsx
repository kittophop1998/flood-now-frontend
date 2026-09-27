"use client";

import { useState, type ReactNode } from "react";
import { Heart, HeartHandshake, Loader2 } from "lucide-react";
import { useReportReaction } from "@/features/reports/use-report-reaction";
import { clearMyReaction, getMyReaction, nextReaction, setMyReaction } from "@/lib/report-reactions";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { ReactionType, Report } from "@/types/report";

// Lightweight social feedback on a community report — social only, never
// severity/trust/freshness/route-safety/moderation input (docs/api-spec.md).
// Not optimistic: mirrors the confirmation vote buttons' pending-spinner UX
// (components/report/report-detail.tsx VoteButton) rather than faking counts,
// since that's the pattern this app already uses for report mutations.
export function ReportReactions({ report, onReacted }: { report: Report; onReacted: (updated: Report) => void }) {
  const { t } = useTranslation();
  const { react, pendingType, error } = useReportReaction();
  const [mine, setMine] = useState<ReactionType | null>(() => getMyReaction(report.id));
  const pending = pendingType !== null;

  async function tap(type: ReactionType) {
    const next = nextReaction(mine, type);
    const updated = await react(report.id, type, next);
    if (!updated) return;
    if (next) setMyReaction(report.id, next);
    else clearMyReaction(report.id);
    setMine(next);
    onReacted(updated);
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("reactionsHeading")}</h3>
      <div className="flex gap-2">
        <ReactionChip
          selected={mine === "like"}
          pending={pendingType === "like"}
          disabled={pending}
          icon={<Heart className={cn(mine === "like" && "fill-current")} aria-hidden />}
          tone="rose"
          label={t("reactionLike")}
          count={report.like_count ?? 0}
          onClick={() => tap("like")}
        />
        <ReactionChip
          selected={mine === "support"}
          pending={pendingType === "support"}
          disabled={pending}
          icon={<HeartHandshake aria-hidden />}
          tone="teal"
          label={t("reactionSupport")}
          count={report.support_count ?? 0}
          onClick={() => tap("support")}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}

function ReactionChip({
  selected,
  pending,
  disabled,
  icon,
  tone,
  label,
  count,
  onClick,
}: {
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  icon: ReactNode;
  tone: "rose" | "teal";
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-busy={pending}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        "disabled:opacity-60",
        selected
          ? tone === "rose"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-teal-200 bg-teal-50 text-teal-700"
          : "border bg-background text-muted-foreground hover:bg-muted",
      )}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      <span>{label}</span>{" "}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
