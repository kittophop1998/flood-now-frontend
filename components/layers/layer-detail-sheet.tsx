"use client";

import { useState, type ReactNode } from "react";
import { Clock, ExternalLink, MapPin, Navigation, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet, type SheetSnap } from "@/components/ui/bottom-sheet";
import { OfficialBadge, PlaceStatusBadge } from "@/components/community/badges";
import { FloodSwatch } from "@/components/map/official-flood-legend";
import { SeverityBadge } from "@/components/report/report-badges";
import { useNow } from "@/features/common/use-now";
import { ANNOUNCEMENT_TYPE_META, IMPORTANT_PLACE_META } from "@/lib/community-meta";
import { directionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatClockTime, formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Announcement, FloodAreaProperties, FloodLayer, ImportantPlace } from "@/types/community";

function DirectionsLink({ latitude, longitude }: { latitude: number; longitude: number }) {
  const { t } = useTranslation();
  return (
    <a
      href={directionsUrl(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Navigation className="size-4" aria-hidden />
      {t("directions")}
    </a>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </>
  );
}

// Detail sheet for an important place (hospital, shelter…).
export function ImportantPlaceSheet({
  place,
  onClose,
  onVisibleHeightChange,
}: {
  place: ImportantPlace;
  onClose: () => void;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const meta = IMPORTANT_PLACE_META[place.category];
  const headingId = `place-${place.id}-title`;

  const peek = (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: meta.color }}>
          <meta.icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} tabIndex={-1} className="text-base leading-snug font-semibold outline-none">
            {place.name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PlaceStatusBadge status={place.status} />
            <span className="text-xs text-muted-foreground">{t(`ipCategory.${place.category}`)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("updatedAgo", { ago: formatFreshness(place.updated_at, t, now) })}</p>
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-11 shrink-0 rounded-full" onClick={onClose} aria-label={t("close")}>
          <X className="size-5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-xl text-sm" onClick={() => setSnap(snap === "peek" ? "full" : "peek")} aria-expanded={snap !== "peek"}>
          {snap === "peek" ? t("viewDetails") : t("collapseSheet")}
        </Button>
        <DirectionsLink latitude={place.latitude} longitude={place.longitude} />
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
      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 border-t px-4 pt-4 text-sm">
        {place.address && (
          <Row label={t("ipAddress")}>
            <span className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {place.address}
            </span>
          </Row>
        )}
        {place.contact && (
          <Row label={t("contactLabel")}>
            {/^[+\d][\d\s-]{5,}$/.test(place.contact) ? (
              <a href={`tel:${place.contact.replace(/[\s-]/g, "")}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary underline-offset-2 hover:underline">
                <Phone className="size-3.5" aria-hidden />
                {place.contact}
              </a>
            ) : (
              place.contact
            )}
          </Row>
        )}
        {place.source && <Row label={t("ipSource")}>{place.source}</Row>}
        {place.description && <Row label={t("descriptionHeading")}>{place.description}</Row>}
      </dl>
      <p className="mt-4 px-4 text-xs text-muted-foreground">{t("ipStatusDisclaimer")}</p>
    </BottomSheet>
  );
}

// Detail sheet for an official announcement: source and times are always
// visible, and it's labelled OFFICIAL so it can't be mistaken for a report.
export function AnnouncementSheet({
  announcement: a,
  onClose,
  onVisibleHeightChange,
}: {
  announcement: Announcement;
  onClose: () => void;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [snap, setSnap] = useState<SheetSnap>("half");
  const Icon = ANNOUNCEMENT_TYPE_META[a.type];
  const headingId = `announcement-${a.id}-title`;

  const peek = (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <OfficialBadge />
            <SeverityBadge severity={a.severity} />
          </div>
          <h2 id={headingId} tabIndex={-1} className="mt-1 text-base leading-snug font-semibold outline-none">
            {a.title}
          </h2>
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-11 shrink-0 rounded-full" onClick={onClose} aria-label={t("close")}>
          <X className="size-5" />
        </Button>
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{t("announcementSource", { source: a.source_name })}</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden />
          {formatClockTime(a.starts_at, locale, now)}
        </span>
      </p>
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
      <div className="flex flex-col gap-4 border-t px-4 pt-4">
        <p className="text-sm leading-relaxed break-words whitespace-pre-line">{a.body}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
          <Row label={t("announcementType")}>{t(`annType.${a.type}`)}</Row>
          <Row label={t("announcementStarts")}>{formatClockTime(a.starts_at, locale, now)}</Row>
          <Row label={t("announcementEnds")}>{a.ends_at ? formatClockTime(a.ends_at, locale, now) : t("announcementNoEnd")}</Row>
          {a.radius_m != null && <Row label={t("announcementArea")}>{t("announcementRadius", { d: formatDistance(a.radius_m, t) })}</Row>}
          <Row label={t("announcementUpdated")}>{formatFreshness(a.updated_at, t, now)}</Row>
        </dl>
        {a.source_url && (
          <a
            href={a.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("announcementOpenSource")}
          </a>
        )}
        {a.latitude != null && a.longitude != null && <DirectionsLink latitude={a.latitude} longitude={a.longitude} />}
        <p className="text-xs text-muted-foreground">{t("announcementDisclaimer")}</p>
      </div>
    </BottomSheet>
  );
}

// Detail sheet for one official GISTDA flood area. It is area-level
// satellite data, so it's labelled official, carries its data period and
// times, and has none of the community confirmation controls.
export function GistdaFloodSheet({
  area,
  layer,
  stale,
  onClose,
  onVisibleHeightChange,
}: {
  area: FloodAreaProperties;
  layer: FloodLayer;
  stale: boolean;
  onClose: () => void;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const headingId = "gistda-flood-title";
  const observedAt = area.observed_at ?? layer.observed_at;

  const peek = (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex items-start gap-3">
        <FloodSwatch className="size-10 rounded-xl [&>svg]:size-5" />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} tabIndex={-1} className="text-base leading-snug font-semibold outline-none">
            {t("gistdaAreaTitle")}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <OfficialBadge />
            <span className="text-xs font-medium">{t("gistdaFrom")}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{t(`gistdaPeriodLong.${layer.period}`)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {t("updatedAgo", { ago: formatFreshness(layer.fetched_at, t, now) })}
            </span>
            {stale && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-amber-900">{t("gistdaStaleBadge")}</span>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-11 shrink-0 rounded-full" onClick={onClose} aria-label={t("close")}>
          <X className="size-5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("gistdaDisclaimer")}</p>
      <Button variant="outline" className="h-11 rounded-xl text-sm" onClick={() => setSnap(snap === "peek" ? "full" : "peek")} aria-expanded={snap !== "peek"}>
        {snap === "peek" ? t("viewDetails") : t("collapseSheet")}
      </Button>
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
      <div className="flex flex-col gap-4 border-t px-4 pt-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
          <Row label={t("gistdaSource")}>{t("gistdaSourceName")}</Row>
          <Row label={t("gistdaPeriodRow")}>{t(`gistdaPeriodLong.${layer.period}`)}</Row>
          {observedAt && <Row label={t("gistdaObserved")}>{formatClockTime(observedAt, locale, now)}</Row>}
          <Row label={t("gistdaFetched")}>{formatClockTime(layer.fetched_at, locale, now)}</Row>
        </dl>
        {layer.source_url && (
          <a
            href={layer.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ExternalLink className="size-4" aria-hidden />
            {t("gistdaOpenSource")}
          </a>
        )}
        <p className="text-xs text-muted-foreground">{t("gistdaDisclaimerRoads")}</p>
      </div>
    </BottomSheet>
  );
}
