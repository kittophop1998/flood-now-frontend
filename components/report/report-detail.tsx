"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Bell, BellRing, CircleCheck, CircleX, Clock, Flag, Loader2, MapPin, Navigation, PenLine, Phone, Share2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailLinkButton, DetailList, DetailPopup, DetailRow, DetailSection } from "@/components/ui/detail-popup";
import { ReportProblemDialog } from "@/components/report/report-problem-dialog";
import { ReportUpdateDialog } from "@/components/report/report-update-dialog";
import { CommunityBadge } from "@/components/community/badges";
import { NearbyCctv } from "@/components/layers/layer-detail";
import { PassabilityGrid } from "@/components/report/passability";
import { CategoryIcon, DepthGauge, SeverityBadge, StatusBadge, WaterDepthBadge } from "@/components/report/report-badges";
import { useConfirmReport } from "@/features/reports/use-confirm-report";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { useNow } from "@/features/common/use-now";
import { getConfirmation, isInCooldown, setConfirmation, type DeviceConfirmation } from "@/lib/confirmed-reports";
import { directionsUrl, reportShareUrl, shareLink } from "@/lib/directions";
import { distanceMeters, formatDistance } from "@/lib/distance";
import { formatClockTime, formatDuration, formatFreshness, freshnessLine } from "@/lib/freshness";
import { reportShareText } from "@/lib/share";
import { imageKitUrl } from "@/lib/imagekit";
import { CATEGORY_META, WATER_DEPTH_META, hasKnownPassability, reportTitle, waterDepthLabel } from "@/lib/report-meta";
import { currentStatus, isOpen } from "@/lib/report-status";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { ConditionUpdate, ConfirmationStatus, Report } from "@/types/report";
import type { CctvCamera } from "@/types/community";

type LatLng = { latitude: number; longitude: number };

// Render with `key={report.id}` so switching reports resets vote state.
export function ReportDetailPopup({
  report,
  userLocation,
  onClose,
  onConfirmed,
  following,
  onToggleFollow,
  onVisibleHeightChange,
  onQueueVote,
  cctvEnabled,
  onOpenCamera,
}: {
  report: Report;
  userLocation: LatLng | null;
  onClose: () => void;
  onConfirmed: (updated: Report) => void;
  following: boolean;
  onToggleFollow: () => Promise<boolean>;
  onVisibleHeightChange?: (px: number) => void;
  // Offline: the vote (and any condition update whose photo was already
  // uploaded) is queued and sent when the network returns.
  onQueueVote: (status: ConfirmationStatus, condition?: ConditionUpdate) => void;
  // The official camera layer is available: show the nearest cameras.
  cctvEnabled: boolean;
  onOpenCamera: (camera: CctvCamera) => void;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const { confirm, pendingStatus, error } = useConfirmReport();
  const [deviceVote, setDeviceVote] = useState<DeviceConfirmation | null>(() => getConfirmation(report.id));
  const [justVoted, setJustVoted] = useState<ConfirmationStatus | "updated" | null>(null);
  const [showCoords, setShowCoords] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [queuedVote, setQueuedVote] = useState<ConfirmationStatus | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  // Remounts the update dialog per opening so it starts from the latest report.
  const [updateKey, setUpdateKey] = useState(0);
  const { place } = useApproximateAddress(report);

  const status = currentStatus(report, now);
  const fields = CATEGORY_META[report.type].fields;
  const imageUrl = report.image_url ?? imageKitUrl(report.image_key);
  const headingId = `report-${report.id}-title`;
  const distance = userLocation ? distanceMeters(userLocation, report) : null;
  const locationText = place?.name ?? (distance != null ? t("locationDistance", { d: formatDistance(distance, t) }) : null);

  function queueVote(next: ConfirmationStatus, condition?: ConditionUpdate) {
    onQueueVote(next, condition);
    setDeviceVote(setConfirmation(report.id, next));
    setQueuedVote(next);
    setJustVoted(null);
  }

  // Returns whether the vote was sent or queued.
  async function vote(next: ConfirmationStatus, condition?: ConditionUpdate): Promise<boolean> {
    setJustVoted(null);
    if (!navigator.onLine) {
      queueVote(next, condition);
      return true;
    }
    const updated = await confirm(report.id, next, condition);
    if (updated) {
      setDeviceVote(setConfirmation(report.id, next));
      setJustVoted(condition ? "updated" : next);
      setQueuedVote(null);
      onConfirmed(updated);
      return true;
    }
    if (!navigator.onLine) {
      queueVote(next, condition);
      return true;
    }
    return false;
  }

  function handleVote(next: ConfirmationStatus) {
    if (isInCooldown(deviceVote, next)) return;
    vote(next);
  }

  function openUpdate() {
    setUpdateKey((k) => k + 1);
    setUpdateOpen(true);
  }

  // An update always carries new information, so it skips the repeat-tap
  // cooldown; with nothing changed it is a plain "still happening".
  async function handleUpdate(condition: ConditionUpdate) {
    const changed = Object.keys(condition).length > 0;
    if (await vote("still_active", changed ? condition : undefined)) setUpdateOpen(false);
  }

  async function handleShare() {
    const result = await shareLink(reportShareUrl(report.id), reportTitle(t, report), reportShareText(t, report, now));
    if (result === "copied") toast.success(t("shareCopied"));
    if (result === "failed") toast.error(t("shareFailed"));
  }

  async function handleFollow() {
    setFollowPending(true);
    const ok = await onToggleFollow();
    setFollowPending(false);
    if (ok && !following) toast.success(t("followed"));
  }

  const title = reportTitle(t, report);

  const header = (
    <div className={cn("flex items-start gap-3", status !== "active" && "opacity-90")}>
      <CategoryIcon type={report.type} size="lg" className={cn("shadow-sm", status === "possibly_stale" && "saturate-50")} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h2 id={headingId} tabIndex={-1} className="text-lg leading-snug font-semibold outline-none sm:text-xl">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={report.severity} />
          {status !== "active" && <StatusBadge status={status} />}
          {report.type === "flooded" && report.water_depth && report.water_depth !== "unknown" && (
            <WaterDepthBadge depth={report.water_depth} />
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {freshnessLine(report, t, now)}
          </span>
          {report.still_active_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-3.5" aria-hidden />
              {t("confirmationsCount", { n: report.still_active_count })}
            </span>
          )}
          {locationText && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{place && distance != null ? `${locationText} · ${formatDistance(distance, t)}` : locationText}</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-2">
      <Button variant="outline" className="h-11 flex-1 rounded-xl bg-background sm:flex-none sm:px-4" onClick={handleShare}>
        <Share2 aria-hidden />
        {t("share")}
      </Button>
      <Button
        variant="outline"
        className={cn("h-11 flex-1 rounded-xl bg-background sm:flex-none sm:px-4", following && "border-primary/40 bg-accent text-accent-foreground")}
        onClick={handleFollow}
        disabled={followPending}
        aria-pressed={following}
      >
        {following ? <BellRing aria-hidden /> : <Bell aria-hidden />}
        {following ? t("following") : t("follow")}
      </Button>
      <DetailLinkButton href={directionsUrl(report.latitude, report.longitude)} className="flex-[1.4] sm:ml-auto sm:flex-none sm:px-5">
        <Navigation aria-hidden />
        {t("directions")}
      </DetailLinkButton>
    </div>
  );

  return (
    <DetailPopup
      labelledBy={headingId}
      onClose={onClose}
      header={header}
      footer={footer}
      accent={CATEGORY_META[report.type].color}
      onVisibleHeightChange={onVisibleHeightChange}
    >
      <StatusNotice report={report} status={status} now={now} />

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={t("reportPhotoAlt")}
          loading="lazy"
          className="aspect-[16/10] w-full rounded-2xl bg-muted object-cover"
        />
      )}

      {fields.passability && hasKnownPassability(report.passability) && (
        <DetailSection title={t("passabilityHeading")}>
          <PassabilityGrid passability={report.passability} />
        </DetailSection>
      )}

      <section className="flex flex-col gap-2.5 rounded-2xl bg-muted/60 p-3.5">
        <h3 className="text-sm font-semibold">{t("situationQuestion")}</h3>
        <div className="grid grid-cols-3 gap-2">
          <VoteButton
            selected={false}
            pending={false}
            disabled={pendingStatus !== null}
            icon={<PenLine />}
            hint={t("voteStillChangedHint")}
            onClick={openUpdate}
            aria-haspopup="dialog"
          >
            {t("voteStillChanged")}
          </VoteButton>
          <VoteButton
            selected={deviceVote?.status === "still_active"}
            pending={pendingStatus === "still_active" && !updateOpen}
            disabled={pendingStatus !== null}
            icon={<CircleCheck />}
            hint={t("voteUnchangedHint")}
            onClick={() => handleVote("still_active")}
          >
            {t("voteUnchanged")}
          </VoteButton>
          <VoteButton
            selected={deviceVote?.status === "cleared"}
            pending={pendingStatus === "cleared"}
            disabled={pendingStatus !== null}
            icon={<CircleX />}
            hint={t("voteGoneHint")}
            onClick={() => handleVote("cleared")}
          >
            {t("voteGone")}
          </VoteButton>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("confirmationsCount", { n: report.still_active_count })} · {t("clearedCount", { n: report.cleared_count })}
        </p>
        <div aria-live="polite" className="text-sm empty:hidden">
          {queuedVote ? (
            <p className="text-amber-800">{t("voteQueued")}</p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : (
            justVoted && (
              <p className="text-teal-700">
                {t(justVoted === "cleared" ? "clearedSuccess" : justVoted === "updated" ? "updateSuccess" : "confirmSuccess")}
              </p>
            )
          )}
        </div>
      </section>

      {report.description?.trim() && (
        <DetailSection title={t("descriptionHeading")}>
          <p className="text-sm leading-relaxed break-words whitespace-pre-line">{report.description}</p>
        </DetailSection>
      )}

      <DetailList>
        <DetailRow label={t("severityHeading")}>
          <span className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={report.severity} />
            <span className="text-muted-foreground">{t(`severityHint.${report.severity}`)}</span>
          </span>
        </DetailRow>
        {fields.waterDepth && report.water_depth && (
          <DetailRow label={t("waterDepthLabel")}>
            <span className="flex flex-wrap items-center gap-2">
              <DepthGauge depth={report.water_depth} />
              {waterDepthLabel(t, report.water_depth)}
              {WATER_DEPTH_META[report.water_depth].rangeKey && (
                <span className="text-muted-foreground">({t(WATER_DEPTH_META[report.water_depth].rangeKey!)})</span>
              )}
            </span>
          </DetailRow>
        )}
        {report.water_level_cm != null && (
          <DetailRow label={t("waterDepthLabel")}>{t("waterLevelValue", { n: report.water_level_cm })}</DetailRow>
        )}
        <DetailRow label={t("reportedAtLabel")}>
          <time dateTime={report.created_at}>
            {formatClockTime(report.created_at, locale, now)} · {formatFreshness(report.created_at, t, now)}
          </time>
        </DetailRow>
        <DetailRow label={t("lastConfirmedLabel")}>
          <time dateTime={report.last_verified_at}>{formatFreshness(report.last_verified_at, t, now)}</time>
        </DetailRow>
        {report.people_count != null && (
          <DetailRow label={t("peopleCountLabel")}>
            {t(report.people_count === 1 ? "personCountOne" : "personCountOther", { n: report.people_count })}
          </DetailRow>
        )}
        {(report.has_child || report.has_elderly) && (
          <DetailRow label={t("vulnerableLabel")}>
            {[report.has_child && t("childrenValue"), report.has_elderly && t("elderlyValue")].filter(Boolean).join(", ")}
          </DetailRow>
        )}
        {report.contact_phone && (
          <DetailRow label={t("contactLabel")}>
            <a href={`tel:${report.contact_phone}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary underline-offset-2 hover:underline">
              <Phone className="size-3.5" aria-hidden />
              {report.contact_phone}
            </a>
          </DetailRow>
        )}
        <DetailRow label={t("locationHeading")}>
          <span className="flex flex-col gap-0.5">
            <span>{place?.display_name ?? locationText ?? t("locationPinned")}</span>
            <button
              type="button"
              className="self-start text-xs font-normal text-muted-foreground underline-offset-2 hover:underline focus-visible:underline"
              aria-expanded={showCoords}
              onClick={() => setShowCoords((v) => !v)}
            >
              {showCoords ? t("hideCoordinates") : t("showCoordinates")}
            </button>
            {showCoords && (
              <span className="text-xs font-normal text-muted-foreground tabular-nums select-all">
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </span>
            )}
          </span>
        </DetailRow>
      </DetailList>

      <NearbyCctv at={report} enabled={cctvEnabled} onOpen={onOpenCamera} />

      {report.type === "help_needed" && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">{t("helpNotDispatchNotice")}</p>
      )}

      <div className="flex flex-col items-center gap-1 border-t pt-4">
        <CommunityBadge />
        <p className="text-center text-[11px] text-muted-foreground">{t("routeDisclaimer")}</p>
        <Button variant="ghost" className="h-10 rounded-xl text-muted-foreground" onClick={() => setProblemOpen(true)}>
          <Flag aria-hidden />
          {t("problemOpen")}
        </Button>
      </div>
      <ReportProblemDialog reportId={report.id} open={problemOpen} onOpenChange={setProblemOpen} />
      <ReportUpdateDialog
        key={updateKey}
        report={report}
        open={updateOpen}
        onOpenChange={setUpdateOpen}
        onSubmit={handleUpdate}
        submitting={pendingStatus !== null}
        error={updateOpen ? error : null}
      />
    </DetailPopup>
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

function VoteButton({
  selected,
  pending,
  disabled,
  icon,
  hint,
  onClick,
  children,
  "aria-haspopup": hasPopup,
}: {
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  icon: ReactNode;
  hint: string;
  onClick: () => void;
  children: ReactNode;
  "aria-haspopup"?: "dialog";
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      className="h-auto min-h-16 flex-col gap-0.5 rounded-xl px-1.5 py-2 text-sm whitespace-normal [&_svg]:size-5"
      aria-pressed={hasPopup ? undefined : selected}
      aria-haspopup={hasPopup}
      aria-busy={pending}
      disabled={disabled}
      onClick={onClick}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      <span className="leading-tight">{children}</span>
      <span className={cn("text-[11px] leading-tight font-normal", selected ? "opacity-90" : "text-muted-foreground")}>{hint}</span>
    </Button>
  );
}
