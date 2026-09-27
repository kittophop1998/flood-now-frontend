"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Megaphone } from "lucide-react";
import { AnnouncementSeverityBadge, AnnouncementTypeIcon, OfficialBadge } from "@/components/community/badges";
import { collapsedIdsAfterMinimize, isBannerCollapsed, readCollapsedIds, writeCollapsedIds } from "@/lib/announcement-banner";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Announcement } from "@/types/community";

const iconButton =
  "flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40 [&>svg]:size-4.5";

// Official announcements for the map area, pinned under the filter chips. Shows
// one at a time (most severe first, as the API sorts them); tapping it opens
// the announcement popup. It can be minimized to a small pill, and stays so
// until a new announcement appears.
export function AnnouncementBanner({
  announcements,
  onOpen,
  onViewAll,
}: {
  announcements: Announcement[];
  onOpen: (a: Announcement) => void;
  onViewAll: () => void;
}) {
  const { t } = useTranslation();
  // undefined until read on the client, so the banner never flashes during hydration.
  const [collapsedIds, setCollapsedIds] = useState<string[] | null | undefined>(undefined);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => setCollapsedIds(readCollapsedIds()), []);

  if (collapsedIds === undefined || announcements.length === 0) return null;

  const ids = announcements.map((a) => a.id);
  const index = Math.max(0, currentId ? ids.indexOf(currentId) : 0);
  const current = announcements[index];
  const count = announcements.length;

  function setCollapsed(collapsed: boolean) {
    const next = collapsed ? collapsedIdsAfterMinimize(ids, collapsedIds ?? null) : null;
    writeCollapsedIds(next);
    setCollapsedIds(next);
  }

  function step(delta: number) {
    setCurrentId(ids[(index + delta + count) % count]);
  }

  if (isBannerCollapsed(ids, collapsedIds)) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label={t("annBannerExpand")}
        className="pointer-events-auto flex min-h-9 items-center gap-1.5 rounded-full border border-indigo-700/30 bg-background/95 py-1 pr-2.5 pl-3 text-xs font-semibold text-indigo-800 shadow-md backdrop-blur hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring dark:text-indigo-300"
      >
        <Megaphone className="size-4" aria-hidden />
        {t("annBannerLabel")}
        <span className="rounded-full bg-indigo-700 px-1.5 text-[11px] leading-4.5 text-white">{count}</span>
        <ChevronDown className="size-4" aria-hidden />
      </button>
    );
  }

  return (
    <section
      aria-label={t("annBannerCount", { n: count })}
      className={cn(
        "pointer-events-auto w-full overflow-hidden rounded-2xl border border-l-4 bg-background/95 shadow-md backdrop-blur",
        current.severity === "critical" ? "border-l-red-600" : current.severity === "high" ? "border-l-orange-600" : "border-l-indigo-700",
      )}
    >
      <div className="flex items-center gap-1.5 pt-1.5 pr-1.5 pl-3">
        <OfficialBadge />
        <AnnouncementSeverityBadge severity={current.severity} />
        <span className="flex-1" />
        {count > 1 && (
          <>
            <button type="button" className={iconButton} onClick={() => step(-1)} aria-label={t("annBannerPrev")}>
              <ChevronLeft />
            </button>
            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
              {t("annBannerPosition", { i: index + 1, n: count })}
            </span>
            <button type="button" className={iconButton} onClick={() => step(1)} aria-label={t("annBannerNext")}>
              <ChevronRight />
            </button>
          </>
        )}
        <button type="button" className={iconButton} onClick={() => setCollapsed(true)} aria-label={t("annBannerCollapse")}>
          <ChevronUp />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onOpen(current)}
        aria-label={t("announcementAriaLabel", { title: current.title })}
        className="flex w-full items-start gap-2 px-3 pt-1 pb-2.5 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <AnnouncementTypeIcon type={current.type} className="mt-0.5 size-5 shrink-0 text-indigo-700 dark:text-indigo-300" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{current.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {t(`annType.${current.type}`)} · {current.source_name}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground" aria-hidden />
      </button>
      {count > 1 && (
        <button
          type="button"
          onClick={onViewAll}
          className="block w-full border-t px-3 py-2 text-center text-xs font-semibold text-primary hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {t("annBannerViewAll")} ({count})
        </button>
      )}
    </section>
  );
}
