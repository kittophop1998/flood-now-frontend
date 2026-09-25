"use client";

import { useEffect, useState } from "react";
import { BellOff, BellPlus, CircleAlert, FileText, Info, Loader2, MapPinned, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ReportSummary } from "@/components/report/report-card";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { isUnread, type AlertsApi } from "@/features/alerts/use-alerts";
import { useNow } from "@/features/common/use-now";
import { formatDistance } from "@/lib/distance";
import { formatFreshness } from "@/lib/freshness";
import { reportTitle } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { NOTIFICATION_KINDS, type Report } from "@/types/report";

const RADII_M = [1000, 3000, 5000];

type LatLng = { latitude: number; longitude: number };

export function AlertsView({
  alerts,
  knownReports,
  userLocation,
  mapCenter,
  onSelect,
}: {
  alerts: AlertsApi;
  // Reports already loaded elsewhere, used to label report follows.
  knownReports: Report[];
  userLocation: LatLng | null;
  mapCenter: LatLng;
  onSelect: (report: Report) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [radius, setRadius] = useState(3000);
  const [pending, setPending] = useState<string | null>(null);
  const origin = userLocation ?? mapCenter;
  const { markAllRead, lastRead } = alerts;
  // Items that were unread when the view opened stay highlighted while it's open.
  const [readCursor] = useState(lastRead);

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  function followedTitle(reportId: string | null) {
    const report = knownReports.find((r) => r.id === reportId) ?? alerts.notifications.find((n) => n.report.id === reportId)?.report;
    return report ? `${t("followReportItem")} · ${reportTitle(t, report)}` : t("followReportItem");
  }

  async function run(key: string, action: () => Promise<boolean>) {
    setPending(key);
    await action();
    setPending(null);
  }

  return (
    <ViewShell title={t("alertsTitle")}>
      <p className="flex items-start gap-2 rounded-2xl bg-background p-3 text-xs leading-relaxed text-muted-foreground shadow-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("alertsInAppNote")}
      </p>

      <section aria-labelledby="follow-area-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <div>
          <h2 id="follow-area-title" className="font-semibold">
            {t("followAreaTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("followAreaHint")} · {userLocation ? t("followAreaAtYou") : t("followAreaAtMap")}
          </p>
        </div>
        <div role="radiogroup" aria-labelledby="follow-area-title" className="grid grid-cols-3 gap-2">
          {RADII_M.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={radius === r}
              onClick={() => setRadius(r)}
              className={cn(
                "min-h-11 rounded-xl border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                radius === r ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {formatDistance(r, t)}
            </button>
          ))}
        </div>
        <Button
          className="h-12 rounded-xl"
          disabled={pending === "area"}
          onClick={() => run("area", () => alerts.followArea(origin.latitude, origin.longitude, radius))}
        >
          {pending === "area" ? <Loader2 className="animate-spin" aria-hidden /> : <BellPlus aria-hidden />}
          {t("followAreaButton")}
        </Button>
        {alerts.actionError && (
          <p role="alert" className="text-sm text-destructive">
            {alerts.actionError}
          </p>
        )}
      </section>

      <section aria-labelledby="following-title" className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 id="following-title" className="font-semibold">
          {t("followingTitle")}
        </h2>
        {alerts.follows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noFollows")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {alerts.follows.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2">
                {f.kind === "area" ? (
                  <MapPinned className="size-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {f.kind === "area" ? t("followAreaItem", { d: formatDistance(f.radius_m ?? 0, t) }) : followedTitle(f.report_id)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {f.kind === "area" ? `${f.latitude?.toFixed(4)}, ${f.longitude?.toFixed(4)}` : formatFreshness(f.created_at, t, now)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 rounded-full text-muted-foreground"
                  aria-label={t("unfollow")}
                  disabled={pending === f.id}
                  onClick={() => run(f.id, () => alerts.unfollow(f.id))}
                >
                  {pending === f.id ? <Loader2 className="animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="notify-title" className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 id="notify-title" className="mb-1 font-semibold">
          {t("notifyTitle")}
        </h2>
        {NOTIFICATION_KINDS.map((kind) => (
          <div key={kind} className="flex min-h-11 items-center justify-between gap-3">
            <Label htmlFor={`notify-${kind}`} className="font-normal leading-snug">
              {t(`notify.${kind}`)}
            </Label>
            <Switch
              id={`notify-${kind}`}
              checked={alerts.prefs[kind]}
              onCheckedChange={(checked) => alerts.setPrefs({ ...alerts.prefs, [kind]: checked })}
            />
          </div>
        ))}
      </section>

      <section aria-labelledby="feed-title" className="flex flex-col gap-2">
        <h2 id="feed-title" className="px-1 pt-1 font-semibold">
          {t("feedTitle")}
        </h2>
        {alerts.feedStatus === "loading" && <div className="h-24 animate-pulse rounded-2xl bg-background" aria-hidden />}
        {alerts.feedStatus === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("feedFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={alerts.reloadFeed}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {alerts.feedStatus === "ready" && alerts.notifications.length === 0 && <EmptyState icon={<BellOff />} title={t("feedEmpty")} />}
        {alerts.feedStatus === "ready" &&
          alerts.notifications.map((n) => {
            const unread = isUnread(n, readCursor);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n.report)}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border bg-card p-3.5 text-left shadow-xs transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  unread && "border-primary/40",
                )}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                  {unread && <span className="rounded-full bg-primary px-1.5 py-px text-[10px] text-primary-foreground">{t("newBadge")}</span>}
                  {t(`notification.${n.kind}`)}
                  <span className="font-normal text-muted-foreground">· {formatFreshness(n.created_at, t, now)}</span>
                </span>
                <ReportSummary report={n.report} now={now} />
              </button>
            );
          })}
      </section>
    </ViewShell>
  );
}
