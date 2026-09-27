"use client";

import type { ReactNode } from "react";
import { Clock, ExternalLink, MapPin, Navigation, Phone, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailLinkButton, DetailList, DetailPopup, DetailRow } from "@/components/ui/detail-popup";
import { AnnouncementSeverityBadge, AnnouncementTypeIcon, OfficialBadge, PlaceStatusBadge, UserAddedBadge } from "@/components/community/badges";
import { AnnouncementGallery } from "@/components/layers/announcement-images";
import { FloodSwatch } from "@/components/map/official-flood-legend";
import { CctvGlyph } from "@/components/map/cctv-legend";
import { useNow } from "@/features/common/use-now";
import { useOnlineStatus } from "@/features/common/use-online-status";
import { useCctvNear } from "@/features/layers/use-doh-cctv";
import { cctvRoadLabel, cctvTitle, floodAreaBBox } from "@/lib/cctv";
import { IMPORTANT_PLACE_META } from "@/lib/community-meta";
import { directionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatClockTime, formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { BoundingBox } from "@/types/report";
import type { Announcement, CctvCamera, CctvLayer, FloodAreaProperties, FloodLayer, ImportantPlace, LatLng } from "@/types/community";

function DirectionsLink({ latitude, longitude, className }: { latitude: number; longitude: number; className?: string }) {
  const { t } = useTranslation();
  return (
    <DetailLinkButton href={directionsUrl(latitude, longitude)} className={className}>
      <Navigation aria-hidden />
      {t("directions")}
    </DetailLinkButton>
  );
}

function StaleChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-amber-900">{children}</span>;
}

// Detail popup for an important place (hospital, shelter…).
export function ImportantPlacePopup({
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
  const meta = IMPORTANT_PLACE_META[place.category];
  const headingId = `place-${place.id}-title`;
  const phone = place.contact && /^[+\d][\d\s-]{5,}$/.test(place.contact) ? place.contact.replace(/[\s-]/g, "") : null;

  const header = (
    <div className="flex items-start gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: meta.color }}>
        <meta.icon className="size-6" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t(`ipCategory.${place.category}`)}</p>
        <h2 id={headingId} tabIndex={-1} className="-mt-1 text-lg leading-snug font-semibold outline-none sm:text-xl">
          {place.name}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <PlaceStatusBadge status={place.status} />
          {place.origin === "community" && <UserAddedBadge />}
        </div>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden />
          {t("updatedAgo", { ago: formatFreshness(place.updated_at, t, now) })}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex gap-2">
      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-none"
        >
          <Phone className="size-4" aria-hidden />
          {place.contact}
        </a>
      )}
      <DirectionsLink latitude={place.latitude} longitude={place.longitude} className="flex-1 sm:ml-auto sm:flex-none sm:px-5" />
    </div>
  );

  return (
    <DetailPopup
      labelledBy={headingId}
      onClose={onClose}
      header={header}
      footer={footer}
      accent={meta.color}
      onVisibleHeightChange={onVisibleHeightChange}
    >
      {place.description && <p className="text-sm leading-relaxed break-words whitespace-pre-line">{place.description}</p>}
      {(place.address || place.contact || place.source) && (
        <DetailList>
          {place.address && (
            <DetailRow label={t("ipAddress")}>
              <span className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {place.address}
              </span>
            </DetailRow>
          )}
          {place.contact && (
            <DetailRow label={t("contactLabel")}>
              {phone ? (
                <a href={`tel:${phone}`} className="inline-flex min-h-6 items-center gap-1.5 text-primary underline-offset-2 hover:underline">
                  <Phone className="size-3.5" aria-hidden />
                  {place.contact}
                </a>
              ) : (
                place.contact
              )}
            </DetailRow>
          )}
          {place.source && <DetailRow label={t("ipSource")}>{place.source}</DetailRow>}
        </DetailList>
      )}
      <div className="flex flex-col gap-2 text-xs">
        {place.origin === "community" && <p className="rounded-xl bg-amber-50 px-3 py-2 font-medium text-amber-900">{t("ipFromUserNote")}</p>}
        <p className="text-muted-foreground">{t("ipStatusDisclaimer")}</p>
      </div>
    </DetailPopup>
  );
}

// Detail popup for an official announcement: source and times are always
// visible, and it's labelled OFFICIAL so it can't be mistaken for a report.
// It has none of the community actions (votes, reactions, confirmations).
// `preview` marks the admin form's "preview" rendering of an unsaved draft.
export function AnnouncementPopup({
  announcement: a,
  onClose,
  onVisibleHeightChange,
  preview,
}: {
  announcement: Announcement;
  onClose: () => void;
  onVisibleHeightChange?: (px: number) => void;
  preview?: boolean;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const headingId = `announcement-${a.id}-title`;
  const hasPoint = a.latitude != null && a.longitude != null;

  const header = (
    <div className="flex items-start gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-700 text-white shadow-sm">
        <AnnouncementTypeIcon type={a.type} className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <OfficialBadge />
          <AnnouncementSeverityBadge severity={a.severity} />
          <span className="text-xs font-semibold text-indigo-800">{t(`annType.${a.type}`)}</span>
        </div>
        <h2 id={headingId} tabIndex={-1} className="text-lg leading-snug font-semibold outline-none sm:text-xl">
          {a.title}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t("announcementSource", { source: a.source_name })}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatClockTime(a.starts_at, locale, now)}
          </span>
        </p>
      </div>
    </div>
  );

  const footer =
    a.source_url || hasPoint ? (
      <div className="flex gap-2 sm:justify-end">
        {a.source_url && (
          <DetailLinkButton href={a.source_url} variant={hasPoint ? "outline" : "primary"} className="flex-1 sm:flex-none">
            <ExternalLink aria-hidden />
            {t("announcementOpenSource")}
          </DetailLinkButton>
        )}
        {hasPoint && <DirectionsLink latitude={a.latitude!} longitude={a.longitude!} className="flex-1 sm:flex-none sm:px-5" />}
      </div>
    ) : undefined;

  return (
    <DetailPopup labelledBy={headingId} onClose={onClose} header={header} footer={footer} accent="#4338ca" onVisibleHeightChange={onVisibleHeightChange}>
      {preview && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{t("annPreviewNote")}</p>}
      <AnnouncementGallery images={a.images} />
      <p className="text-[15px] leading-relaxed break-words whitespace-pre-line">{a.body}</p>
      <DetailList>
        <DetailRow label={t("announcementType")}>{t(`annType.${a.type}`)}</DetailRow>
        <DetailRow label={t("announcementStarts")}>{formatClockTime(a.starts_at, locale, now)}</DetailRow>
        <DetailRow label={t("announcementEnds")}>{a.ends_at ? formatClockTime(a.ends_at, locale, now) : t("announcementNoEnd")}</DetailRow>
        {hasPoint && (
          <DetailRow label={t("announcementArea")}>
            {a.radius_m != null ? t("announcementRadius", { d: formatDistance(a.radius_m, t) }) : t("annRadiusPoint")}
          </DetailRow>
        )}
        <DetailRow label={t("announcementUpdated")}>{formatFreshness(a.updated_at, t, now)}</DetailRow>
      </DetailList>
      <p className="text-xs text-muted-foreground">{t("announcementDisclaimer")}</p>
    </DetailPopup>
  );
}

// Detail popup for one official GISTDA flood area. It is area-level
// satellite data, so it's labelled official, carries its data period and
// times, and has none of the community confirmation controls.
export function GistdaFloodPopup({
  area,
  layer,
  stale,
  cctvEnabled,
  onShowCameras,
  onClose,
  onVisibleHeightChange,
}: {
  area: FloodAreaProperties;
  layer: FloodLayer;
  stale: boolean;
  // The camera layer is available: offer the cameras inside this area.
  cctvEnabled: boolean;
  onShowCameras: (bbox: BoundingBox) => void;
  onClose: () => void;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const headingId = "gistda-flood-title";
  const observedAt = area.observed_at ?? layer.observed_at;
  const feature = layer.areas.features.find((f) => f.properties.ref === area.ref);
  const areaBBox = feature ? floodAreaBBox(feature) : null;
  const cameras = useCctvNear(areaBBox ? { bbox: areaBBox } : null, cctvEnabled);

  const header = (
    <div className="flex items-start gap-3">
      <FloodSwatch className="size-12 rounded-2xl shadow-sm [&>svg]:size-6" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <OfficialBadge />
          <span className="text-xs font-medium">{t("gistdaFrom")}</span>
        </div>
        <h2 id={headingId} tabIndex={-1} className="text-lg leading-snug font-semibold outline-none sm:text-xl">
          {t("gistdaAreaTitle")}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
          <span>{t(`gistdaPeriodLong.${layer.period}`)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {t("updatedAgo", { ago: formatFreshness(layer.fetched_at, t, now) })}
          </span>
          {stale && <StaleChip>{t("gistdaStaleBadge")}</StaleChip>}
        </p>
      </div>
    </div>
  );

  const footer = layer.source_url ? (
    <div className="flex sm:justify-end">
      <DetailLinkButton href={layer.source_url} variant="outline" className="flex-1 sm:flex-none">
        <ExternalLink aria-hidden />
        {t("gistdaOpenSource")}
      </DetailLinkButton>
    </div>
  ) : undefined;

  return (
    <DetailPopup labelledBy={headingId} onClose={onClose} header={header} footer={footer} accent="#2563eb" onVisibleHeightChange={onVisibleHeightChange}>
      <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-sm leading-relaxed text-sky-950">{t("gistdaDisclaimer")}</p>
      {cameras.length > 0 && areaBBox && (
        <div className="flex items-center gap-2.5 rounded-2xl border bg-card py-1.5 pr-1.5 pl-2.5">
          <CctvGlyph className="size-8" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            {cameras.length === 1 ? t("cctvNearAreaOne") : t("cctvNearArea", { n: cameras.length })}
          </span>
          <Button variant="ghost" className="h-11 shrink-0 rounded-xl px-3 text-sm text-primary" onClick={() => onShowCameras(areaBBox)}>
            {t("cctvShowNearby")}
          </Button>
        </div>
      )}
      <DetailList>
        <DetailRow label={t("gistdaSource")}>{t("gistdaSourceName")}</DetailRow>
        <DetailRow label={t("gistdaPeriodRow")}>{t(`gistdaPeriodLong.${layer.period}`)}</DetailRow>
        {observedAt && <DetailRow label={t("gistdaObserved")}>{formatClockTime(observedAt, locale, now)}</DetailRow>}
        <DetailRow label={t("gistdaFetched")}>{formatClockTime(layer.fetched_at, locale, now)}</DetailRow>
      </DetailList>
      <p className="text-xs text-muted-foreground">{t("gistdaDisclaimerRoads")}</p>
    </DetailPopup>
  );
}

// Detail popup for one official DOH camera. FloodNow shows no picture of its
// own: every camera is "external_link" (DOH offers no picture feed meant
// for reuse), so the popup names the camera and hands off to DOH's page.
// It's always attributed to DOH and never presented as FloodNow's, as live,
// or as saying anything about flooding.
export function CctvPopup({
  camera,
  list,
  onClose,
  onVisibleHeightChange,
}: {
  camera: CctvCamera;
  // The list the camera came from (fetch time / staleness), if known.
  list: Pick<CctvLayer, "fetched_at" | "stale"> | null;
  onClose: () => void;
  onVisibleHeightChange?: (px: number) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const online = useOnlineStatus();
  const headingId = `cctv-${camera.id}-title`;
  const road = cctvRoadLabel(camera, t);

  const header = (
    <div className="flex items-start gap-3">
      <CctvGlyph className="size-12 shadow-sm [&>svg]:size-6" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs font-semibold text-blue-900">{t("cctvTitle")}</p>
        <h2 id={headingId} tabIndex={-1} className="text-lg leading-snug font-semibold outline-none sm:text-xl">
          {cctvTitle(camera, t)}
        </h2>
        {road && <p className="text-xs text-muted-foreground">{t("cctvStation", { code: camera.name })}</p>}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t("cctvSourceLine")}</span>
          {list && <span>{t("cctvListUpdated", { ago: formatFreshness(list.fetched_at, t, now) })}</span>}
          {list?.stale && <StaleChip>{t("cctvStaleBadge")}</StaleChip>}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="flex flex-col gap-1 sm:items-end">
      <DetailLinkButton href={camera.external_url} className="w-full sm:w-auto sm:px-5">
        {t("cctvOpenSource")}
        <ExternalLink aria-hidden />
      </DetailLinkButton>
      {!online && <p className="text-center text-[11px] text-muted-foreground">{t("cctvNeedsNetwork")}</p>}
    </div>
  );

  return (
    <DetailPopup labelledBy={headingId} onClose={onClose} header={header} footer={footer} accent="#1d4ed8" onVisibleHeightChange={onVisibleHeightChange}>
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-5 text-center">
        <CctvGlyph className="size-12 [&>svg]:size-6" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">{t("cctvExternalHeading")}</p>
          <p className="text-xs text-muted-foreground">{t("cctvExternalBody")}</p>
        </div>
        {!online && (
          <p role="status" className="flex items-start gap-1.5 text-left text-xs font-medium text-amber-900">
            <WifiOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {t("cctvOffline")}
          </p>
        )}
      </div>
      <p className="text-sm">{t("cctvFindHint", { code: camera.name })}</p>
      <DetailList>
        <DetailRow label={t("gistdaSource")}>{t("cctvSourceName")}</DetailRow>
        {road && <DetailRow label={t("cctvRoadRow")}>{road}</DetailRow>}
        <DetailRow label={t("cctvStationRow")}>{camera.name}</DetailRow>
      </DetailList>
      <p className="text-xs text-muted-foreground">{t("cctvNotFloodNow")}</p>
    </DetailPopup>
  );
}

// "Cameras near this incident": at most a few nearest cameras, as quiet
// secondary rows. Renders nothing when there are none (or the layer is off).
export function NearbyCctv({
  at,
  enabled,
  onOpen,
}: {
  at: LatLng;
  enabled: boolean;
  onOpen: (camera: CctvCamera) => void;
}) {
  const { t } = useTranslation();
  const cameras = useCctvNear({ at: { latitude: at.latitude, longitude: at.longitude } }, enabled);
  if (cameras.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-labelledby="nearby-cctv-title">
      <h3 id="nearby-cctv-title" className="text-sm font-semibold">
        {t("cctvNearIncident")}
      </h3>
      <ul className="flex flex-col divide-y rounded-2xl border">
        {cameras.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-2.5 py-1.5 pr-1.5 pl-2.5">
            <CctvGlyph className="size-8" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{t("cctvDistance", { d: formatDistance(c.distance_m ?? 0, t) })}</span>
              <span className="truncate text-xs text-muted-foreground">{cctvTitle(c, t)}</span>
            </span>
            <Button variant="ghost" className="h-11 shrink-0 rounded-xl px-3 text-sm text-primary" onClick={() => onOpen(c)}>
              {t("cctvView")}
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">{t("cctvSourceLine")}</p>
    </section>
  );
}
