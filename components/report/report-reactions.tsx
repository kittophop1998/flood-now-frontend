"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Heart, HeartHandshake, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useReportReaction } from "@/features/reports/use-report-reaction";
import { reportsService } from "@/services/reports-service";
import { getAuthSession } from "@/lib/auth-session";
import { getMyReaction, nextReaction, rememberMyReaction } from "@/lib/report-reactions";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { ReactionType, Report } from "@/types/report";

// Lightweight social feedback on a community report — social only, never
// severity/trust/freshness/route-safety/moderation input (docs/api-spec.md).
// Counts are public; reacting needs an account, so a guest's tap opens the
// sign-in sheet and the reaction is sent once they're signed in.
// Not optimistic: mirrors the confirmation vote buttons' pending-spinner UX
// (components/report/report-detail.tsx VoteButton) rather than faking counts,
// since that's the pattern this app already uses for report mutations.
export function ReportReactions({ report, onReacted }: { report: Report; onReacted: (updated: Report) => void }) {
  const { t } = useTranslation();
  const { user, requireAuth } = useAuth();
  const { react, pendingType, error } = useReportReaction();
  const userId = user?.id ?? null;
  const [mine, setMine] = useState<ReactionType | null>(null);
  const pending = pendingType !== null;

  // The user's own reaction: the API's answer when this copy carries it,
  // else the local cache, then ask the API (list copies don't carry it).
  const known = report.my_reaction;
  useEffect(() => {
    if (!userId) {
      setMine(null);
      return;
    }
    if (known !== undefined) {
      setMine(known);
      return;
    }
    setMine(getMyReaction(userId, report.id));
    let cancelled = false;
    reportsService
      .get(report.id)
      .then((fresh) => {
        if (cancelled || fresh.my_reaction === undefined) return;
        setMine(fresh.my_reaction);
        rememberMyReaction(userId, report.id, fresh.my_reaction);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, report.id, known]);

  function tap(type: ReactionType) {
    requireAuth("react", async () => {
      const next = nextReaction(mine, type);
      const updated = await react(report.id, type, next);
      if (!updated) return;
      const confirmed = updated.my_reaction !== undefined ? updated.my_reaction : next;
      // Read at send time: a resumed tap was made before signing in.
      const current = getAuthSession()?.user;
      if (current) rememberMyReaction(current.id, report.id, confirmed);
      setMine(confirmed);
      onReacted(updated);
    });
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
