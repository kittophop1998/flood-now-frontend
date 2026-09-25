"use client";

import { useEffect, useState } from "react";
import { ChevronRight, CircleAlert, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OfficialBadge } from "@/components/community/badges";
import { SeverityBadge } from "@/components/report/report-badges";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { announcementsService } from "@/services/community-service";
import { isAbortError } from "@/services/api-client";
import { useNow } from "@/features/common/use-now";
import { ANNOUNCEMENT_TYPE_META } from "@/lib/community-meta";
import { formatClockTime } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { LayerFilters } from "@/features/layers/use-viewport-layers";
import type { Announcement } from "@/types/community";

// Official announcements, entered by an operator and always shown with
// their source — kept visually distinct from community reports.
export function AnnouncementsView({
  layers,
  onLayersChange,
  onOpen,
  onBack,
  hidden,
}: {
  layers: LayerFilters;
  onLayersChange: (next: LayerFilters) => void;
  onOpen: (a: Announcement) => void;
  onBack: () => void;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const [includeExpired, setIncludeExpired] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    announcementsService
      .list({ includeExpired }, controller.signal)
      .then((list) => {
        setItems(list);
        setStatus("ready");
      })
      .catch((err) => {
        if (!isAbortError(err)) setStatus("error");
      });
    return () => controller.abort();
  }, [includeExpired, retry]);

  return (
    <ViewShell title={t("announcementsTitle")} subtitle={t("announcementsSubtitle")} onBack={onBack} hidden={hidden}>
      <div className="flex flex-col divide-y rounded-2xl border bg-card px-4 shadow-xs">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Label htmlFor="layer-ann" className="font-medium">
            {t("layerAnnouncementsToggle")}
          </Label>
          <Switch id="layer-ann" checked={layers.announcements} onCheckedChange={(v) => onLayersChange({ ...layers, announcements: v })} />
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Label htmlFor="ann-expired" className="font-normal">
            {t("announcementsShowEnded")}
          </Label>
          <Switch id="ann-expired" checked={includeExpired} onCheckedChange={setIncludeExpired} />
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {status === "loading" && <div className="h-28 animate-pulse rounded-2xl bg-background" aria-hidden />}
        {status === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("announcementsFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={() => setRetry((n) => n + 1)}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {status === "ready" && items.length === 0 && <EmptyState icon={<Megaphone />} title={t("noAnnouncements")} hint={t("noAnnouncementsHint")} />}
        {status === "ready" && items.map((a) => <AnnouncementCard key={a.id} announcement={a} onOpen={() => onOpen(a)} />)}
      </div>
    </ViewShell>
  );
}

export function AnnouncementCard({ announcement: a, onOpen }: { announcement: Announcement; onOpen: () => void }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const Icon = ANNOUNCEMENT_TYPE_META[a.type];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-2xl border-l-4 border-indigo-700 bg-card p-3.5 text-left shadow-xs hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <OfficialBadge />
        <SeverityBadge severity={a.severity} />
        {a.status === "expired" && <span className="text-xs font-semibold text-muted-foreground">{t("announcementEnded")}</span>}
      </span>
      <span className="flex items-start gap-2">
        <Icon className="mt-0.5 size-5 shrink-0 text-indigo-700" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{a.title}</span>
          <span className="block text-xs text-muted-foreground">
            {t(`annType.${a.type}`)} · {a.source_name} · {formatClockTime(a.starts_at, locale, now)}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </span>
    </button>
  );
}
