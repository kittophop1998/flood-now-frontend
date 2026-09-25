"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Route,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet, type SheetSnap } from "@/components/ui/bottom-sheet";
import { ReportSummary } from "@/components/report/report-card";
import { PassabilityGrid } from "@/components/report/passability";
import { DepthGauge, SeverityBadge } from "@/components/report/report-badges";
import { useConfirmReport } from "@/features/reports/use-confirm-report";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { useNow } from "@/features/common/use-now";
import { getConfirmation, isInCooldown, setConfirmation, type DeviceConfirmation } from "@/lib/confirmed-reports";
import { directionsUrl, reportShareUrl, shareLink } from "@/lib/directions";
import { distanceMeters, formatDistance } from "@/lib/distance";
import { formatClockTime, formatDuration, formatFreshness } from "@/lib/freshness";
import { imageKitUrl } from "@/lib/imagekit";
import { CATEGORY_META, WATER_DEPTH_META, hasKnownPassability, reportTitle, waterDepthLabel } from "@/lib/report-meta";
import { currentStatus, isOpen } from "@/lib/report-status";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { ConfirmationStatus, Report } from "@/types/report";

type LatLng = { latitude: number; longitude: number };

// Render with `key={report.id}` so switching reports resets snap/vote state.
export function ReportDetailSheet({
  report,
  userLocation,
  onClose,
  onConfirmed,
  following,
  onToggleFollow,
  onVisibleHeightChange,
}: {
  report: Report;
  userLocation: LatLng | null;
  onClose: () => void;
  onConfirmed: (updated: Report) => void;
  following: boolean;
  onToggleFollow: () => Promise<boolean>;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const { confirm, pendingStatus, error } = useConfirmReport();
  const [deviceVote, setDeviceVote] = useState<DeviceConfirmation | null>(() => getConfirmation(report.id));
  const [justVoted, setJustVoted] = useState<ConfirmationStatus | null>(null);
  const [showCoords, setShowCoords] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const { place } = useApproximateAddress(report);

  const status = currentStatus(report, now);
  const fields = CATEGORY_META[report.type].fields;
  const imageUrl = report.image_url ?? imageKitUrl(report.image_key);
  const headingId = `report-${report.id}-title`;
  const distance = userLocation ? distanceMeters(userLocation, report) : null;
  const locationText = place?.name ?? (distance != null ? t("locationDistance", { d: formatDistance(distance, t) }) : null);

  async function handleVote(next: ConfirmationStatus) {
    if (isInCooldown(deviceVote, next)) return;
    setJustVoted(null);
    const updated = await confirm(report.id, next);
    if (updated) {
      setDeviceVote(setConfirmation(report.id, next));
      setJustVoted(next);
      onConfirmed(updated);
    }
  }

  async function handleShare() {
    const result = await shareLink(reportShareUrl(report.id), reportTitle(t, report));
    if (result === "copied") toast.success(t("shareCopied"));
    if (result === "failed") toast.error(t("shareFailed"));
  }

  async function handleFollow() {
    setFollowPending(true);
    const ok = await onToggleFollow();
    setFollowPending(false);
    if (ok && !following) toast.success(t("followed"));
  }

  const peek = (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <ReportSummary
            report={report}
            now={now}
            headingId={headingId}
            headingAs="h2"
            distanceM={place ? distance : null}
            locationText={locationText}
          />
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-11 shrink-0 rounded-full" onClick={onClose} aria-label={t("close")}>
          <X className="size-5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-11 rounded-xl text-sm"
          onClick={() => setSnap(snap === "peek" ? "full" : "peek")}
          aria-expanded={snap !== "peek"}
        >
          {snap === "peek" ? t("viewDetails") : t("collapseSheet")}
        </Button>
        <a
          href={directionsUrl(report.latitude, report.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Navigation className="size-4" aria-hidden />
          {t("directions")}
        </a>
      </div>
    </div>
  );

  return (
    <BottomSheet
      open
      snap={snap}
      onSnapChange={setSnap}
      onClose={onClose}
      labelledBy={headingId}
      peek={peek}
      expandLabel={t("expandSheet")}
      collapseLabel={t("collapseSheet")}
      onVisibleHeightChange={onVisibleHeightChange}
    >
      <div className="flex flex-col gap-5 border-t px-4 pt-4">
        <StatusNotice report={report} status={status} now={now} />

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={t("reportPhotoAlt")}
            loading="lazy"
            className="aspect-[4/3] w-full rounded-2xl bg-muted object-cover"
          />
        )}

        {fields.passability && hasKnownPassability(report.passability) && (
          <Section title={t("passabilityHeading")}>
            <PassabilityGrid passability={report.passability} />
          </Section>
        )}

        <Section title={t("stillAccurateQuestion")}>
          <div className="grid grid-cols-2 gap-2">
            <VoteButton
              selected={deviceVote?.status === "still_active"}
              pending={pendingStatus === "still_active"}
              disabled={pendingStatus !== null}
              icon={<CircleCheck />}
              onClick={() => handleVote("still_active")}
            >
              {t("stillActive")}
            </VoteButton>
            <VoteButton
              selected={deviceVote?.status === "cleared"}
              pending={pendingStatus === "cleared"}
              disabled={pendingStatus !== null}
              icon={<CircleX />}
              onClick={() => handleVote("cleared")}
            >
              {t("cleared")}
            </VoteButton>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("confirmationsCount", { n: report.still_active_count })} · {t("clearedCount", { n: report.cleared_count })}
          </p>
          <div aria-live="polite" className="text-sm empty:hidden">
            {error ? (
              <p className="text-destructive">{error}</p>
            ) : (
              justVoted && (
                <p className="text-teal-700">{t(justVoted === "cleared" ? "clearedSuccess" : "confirmSuccess")}</p>
              )
            )}
          </div>
        </Section>

        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
          <Row label={t("severityHeading")}>
            <span className="flex flex-wrap items-center gap-1.5">
              <SeverityBadge severity={report.severity} />
              <span className="text-muted-foreground">{t(`severityHint.${report.severity}`)}</span>
            </span>
          </Row>
          {fields.waterDepth && report.water_depth && (
            <Row label={t("waterDepthLabel")}>
              <span className="flex items-center gap-2">
                <DepthGauge depth={report.water_depth} />
                {waterDepthLabel(t, report.water_depth)}
                {WATER_DEPTH_META[report.water_depth].rangeKey && (
                  <span className="text-muted-foreground">({t(WATER_DEPTH_META[report.water_depth].rangeKey!)})</span>
                )}
              </span>
            </Row>
          )}
          {report.water_level_cm != null && (
            <Row label={t("waterDepthLabel")}>{t("waterLevelValue", { n: report.water_level_cm })}</Row>
          )}
          <Row label={t("reportedAtLabel")}>
            <time dateTime={report.created_at}>
              {formatClockTime(report.created_at, locale, now)} · {formatFreshness(report.created_at, t, now)}
            </time>
          </Row>
          <Row label={t("lastConfirmedLabel")}>
            <time dateTime={report.last_verified_at}>{formatFreshness(report.last_verified_at, t, now)}</time>
          </Row>
          {report.people_count != null && (
            <Row label={t("peopleCountLabel")}>
              {t(report.people_count === 1 ? "personCountOne" : "personCountOther", { n: report.people_count })}
            </Row>
          )}
          {(report.has_child || report.has_elderly) && (
            <Row label={t("vulnerableLabel")}>
              {[report.has_child && t("childrenValue"), report.has_elderly && t("elderlyValue")].filter(Boolean).join(", ")}
            </Row>
          )}
          {report.contact_phone && (
            <Row label={t("contactLabel")}>
              <a href={`tel:${report.contact_phone}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary underline-offset-2 hover:underline">
                <Phone className="size-3.5" aria-hidden />
                {report.contact_phone}
              </a>
            </Row>
          )}
          <Row label={t("locationHeading")}>
            <span className="flex flex-col gap-0.5">
              <span className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span>{place?.display_name ?? locationText ?? t("locationPinned")}</span>
              </span>
              <button
                type="button"
                className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:underline"
                aria-expanded={showCoords}
                onClick={() => setShowCoords((v) => !v)}
              >
                {showCoords ? t("hideCoordinates") : t("showCoordinates")}
              </button>
              {showCoords && (
                <span className="text-xs text-muted-foreground tabular-nums select-all">
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </span>
              )}
            </span>
          </Row>
        </dl>

        {report.description?.trim() && (
          <Section title={t("descriptionHeading")}>
            <p className="text-sm leading-relaxed break-words whitespace-pre-line">{report.description}</p>
          </Section>
        )}

        {report.type === "help_needed" && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">{t("helpNotDispatchNotice")}</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" className="h-12 flex-col gap-0.5 rounded-xl text-xs" onClick={handleShare}>
            <Share2 className="size-4" aria-hidden />
            {t("share")}
          </Button>
          <Button
            variant="outline"
            className={cn("h-12 flex-col gap-0.5 rounded-xl text-xs", following && "border-primary/40 bg-accent text-accent-foreground")}
            onClick={handleFollow}
            disabled={followPending}
            aria-pressed={following}
          >
            {following ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
            {following ? t("following") : t("follow")}
          </Button>
          <a
            href={directionsUrl(report.latitude, report.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border bg-background text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Route className="size-4" aria-hidden />
            {t("viewRoute")}
          </a>
        </div>
        <p className="-mt-3 text-center text-[11px] text-muted-foreground">{t("routeDisclaimer")}</p>
      </div>
    </BottomSheet>
  );
}

function StatusNotice({ report, status, now }: { report: Report; status: Report["status"]; now: Date }) {
  const { t } = useTranslation();
  if (status === "active") return null;
  const message =
    status === "possibly_stale"
      ? t("staleWarning", { duration: formatDuration(report.last_verified_at, t, now) })
      : status === "resolved"
        ? t("resolvedNotice")
        : t("expiredNotice");
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
        isOpen(status) ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700",
      )}
    >
      {status === "resolved" ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {message}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </>
  );
}

function VoteButton({
  selected,
  pending,
  disabled,
  icon,
  onClick,
  children,
}: {
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      className="h-12 rounded-xl text-sm [&_svg]:size-5"
      aria-pressed={selected}
      aria-busy={pending}
      disabled={disabled}
      onClick={onClick}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
    </Button>
  );
}
