"use client";

import { useState, type ReactNode } from "react";
import { Clock, ExternalLink, MapPin, Navigation, Phone, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet, type SheetSnap } from "@/components/ui/bottom-sheet";
import { OfficialBadge, PlaceStatusBadge, UserAddedBadge } from "@/components/community/badges";
import { FloodSwatch } from "@/components/map/official-flood-legend";
import { CctvGlyph } from "@/components/map/cctv-legend";
import { SeverityBadge } from "@/components/report/report-badges";
import { useNow } from "@/features/common/use-now";
import { useOnlineStatus } from "@/features/common/use-online-status";
import { useCctvNear } from "@/features/layers/use-doh-cctv";
import { cctvRoadLabel, cctvTitle, floodAreaBBox } from "@/lib/cctv";
import { ANNOUNCEMENT_TYPE_META, IMPORTANT_PLACE_META } from "@/lib/community-meta";
import { directionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatClockTime, formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { BoundingBox } from "@/types/report";
import type { Announcement, CctvCamera, CctvLayer, FloodAreaProperties, FloodLayer, ImportantPlace, LatLng } from "@/types/community";

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
            {place.origin === "community" && <UserAddedBadge mine={place.mine} />}
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
      {place.origin === "community" && <p className="mt-4 px-4 text-xs font-medium text-amber-900">{t("ipFromUserNote")}</p>}
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
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const headingId = "gistda-flood-title";
  const observedAt = area.observed_at ?? layer.observed_at;
  const feature = layer.areas.features.find((f) => f.properties.ref === area.ref);
  const areaBBox = feature ? floodAreaBBox(feature) : null;
  const cameras = useCctvNear(areaBBox ? { bbox: areaBBox } : null, cctvEnabled);

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
      {cameras.length > 0 && areaBBox && (
        <div className="flex items-center gap-2.5 rounded-2xl border bg-muted/40 py-1.5 pr-1.5 pl-2.5">
          <CctvGlyph className="size-8" />
          <span className="min-w-0 flex-1 text-sm font-medium">
            {cameras.length === 1 ? t("cctvNearAreaOne") : t("cctvNearArea", { n: cameras.length })}
          </span>
          <Button variant="ghost" className="h-11 shrink-0 rounded-xl px-3 text-sm text-primary" onClick={() => onShowCameras(areaBBox)}>
            {t("cctvShowNearby")}
          </Button>
        </div>
      )}
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

function CctvSourceLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
      <ExternalLink className="size-4" aria-hidden />
    </a>
  );
}

// Detail sheet for one official DOH camera. FloodNow shows no picture of its
// own: every camera is "external_link" (DOH offers no picture feed meant
// for reuse), so the sheet names the camera and hands off to DOH's page.
// It's always attributed to DOH and never presented as FloodNow's, as live,
// or as saying anything about flooding.
export function CctvSheet({
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
  const [snap, setSnap] = useState<SheetSnap>("peek");
  const headingId = `cctv-${camera.id}-title`;
  const road = cctvRoadLabel(camera, t);

  const peek = (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <div className="flex items-start gap-3">
        <CctvGlyph className="size-10 [&>svg]:size-5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-blue-900">{t("cctvTitle")}</p>
          <h2 id={headingId} tabIndex={-1} className="mt-0.5 text-base leading-snug font-semibold outline-none">
            {cctvTitle(camera, t)}
          </h2>
          {road && <p className="mt-0.5 text-xs text-muted-foreground">{t("cctvStation", { code: camera.name })}</p>}
        </div>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-11 shrink-0 rounded-full" onClick={onClose} aria-label={t("close")}>
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-4 text-center">
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
        <CctvSourceLink href={camera.external_url}>{t("cctvOpenSource")}</CctvSourceLink>
        {!online && <p className="-mt-1 text-[11px] text-muted-foreground">{t("cctvNeedsNetwork")}</p>}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{t("cctvSourceLine")}</span>
        {list && <span>{t("cctvListUpdated", { ago: formatFreshness(list.fetched_at, t, now) })}</span>}
        {list?.stale && <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-amber-900">{t("cctvStaleBadge")}</span>}
      </p>
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
        <p className="text-sm">{t("cctvFindHint", { code: camera.name })}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
          <Row label={t("gistdaSource")}>{t("cctvSourceName")}</Row>
          {road && <Row label={t("cctvRoadRow")}>{road}</Row>}
          <Row label={t("cctvStationRow")}>{camera.name}</Row>
        </dl>
        <p className="text-xs text-muted-foreground">{t("cctvNotFloodNow")}</p>
      </div>
    </BottomSheet>
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
