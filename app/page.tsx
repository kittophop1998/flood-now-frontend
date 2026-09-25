"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CloudUpload, Layers, LocateFixed, MapPinOff, RefreshCw, SearchX, Siren, WifiOff, ZoomIn } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { BottomNav, type AppTab } from "@/components/bottom-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { MapNotice, MapStatusPill } from "@/components/map/map-states";
import { MapTopBar } from "@/components/map/map-top-bar";
import { FilterSheet } from "@/components/map/filter-sheet";
import { LayersSheet } from "@/components/map/layers-sheet";
import { LocationPicker } from "@/components/map/location-picker";
import { RouteSummary } from "@/components/map/route-summary";
import { ReportForm, type ReportDraft } from "@/components/report/report-form";
import { ReportDetailSheet } from "@/components/report/report-detail";
import { AnnouncementSheet, ImportantPlaceSheet } from "@/components/layers/layer-detail-sheet";
import { NearbyView } from "@/components/views/nearby-view";
import { AlertsView } from "@/components/views/alerts-view";
import { MoreView, type MoreScreen } from "@/components/views/more-view";
import { SavedPlacesView } from "@/components/views/saved-places-view";
import { WatchView } from "@/components/views/watch-view";
import { RouteView, type RouteDraft } from "@/components/views/route-view";
import { SosView } from "@/components/views/sos-view";
import { HelperView } from "@/components/views/helper-view";
import { ImportantPlacesView } from "@/components/views/important-places-view";
import { AnnouncementsView } from "@/components/views/announcements-view";
import { DonateView } from "@/components/views/donate-view";
import { SyncView } from "@/components/views/sync-view";
import type { MapFocus, RouteOverlay } from "@/components/map/map-view";
import { useViewportReports, type Viewport } from "@/features/reports/use-viewport-reports";
import { useCreateReport } from "@/features/reports/use-create-report";
import { useConfirmReport } from "@/features/reports/use-confirm-report";
import { useGeolocation, DEFAULT_CENTER } from "@/features/reports/use-geolocation";
import { useAlerts } from "@/features/alerts/use-alerts";
import { useOnlineStatus } from "@/features/common/use-online-status";
import { useMediaQuery } from "@/features/common/use-media-query";
import { useNow } from "@/features/common/use-now";
import { useOutbox } from "@/features/offline/use-outbox";
import { usePublicConfig } from "@/features/config/use-public-config";
import { useSavedPlaces } from "@/features/places/use-saved-places";
import { useRouteEvaluation } from "@/features/route/use-route-evaluation";
import { useSos } from "@/features/sos/use-sos";
import { DEFAULT_LAYERS, useViewportLayers, type LayerFilters } from "@/features/layers/use-viewport-layers";
import { reportsService } from "@/services/reports-service";
import { setConfirmation } from "@/lib/confirmed-reports";
import { newClientId } from "@/lib/outbox";
import { DEFAULT_FILTERS, applyClientFilters, type MapFilters } from "@/lib/map-filters";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CreateReportInput, Place, Report } from "@/types/report";
import type { Announcement, ImportantPlace, LatLng, RouteEvaluation, SavedPlace } from "@/types/community";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

type Mode =
  | { kind: "browse" }
  | { kind: "picking" }
  | { kind: "creating"; location: LatLng }
  // Choosing a point for another screen (saved place, route end, SOS); that
  // screen stays mounted but hidden and gets the point back via onPick.
  | { kind: "pickingFor"; title: string; onPick: (point: LatLng) => void };

type LayerSelection = { kind: "place"; place: ImportantPlace } | { kind: "announcement"; announcement: Announcement } | null;

const RADIUS_ZOOM: Record<number, number> = { 1: 15, 3: 13, 5: 12, 10: 11 };
const WATCH_ZOOM: Record<number, number> = { 1000: 14, 3000: 13, 5000: 12 };

function setReportParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("report", id);
  else url.searchParams.delete("report");
  window.history.replaceState(null, "", url);
}

function routeBounds(result: RouteEvaluation): [number, number, number, number] {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const r of result.routes) {
    for (const [lng, lat] of r.geometry.coordinates) {
      w = Math.min(w, lng);
      e = Math.max(e, lng);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
  }
  return [w, s, e, n];
}

export default function HomePage() {
  const { t, locale } = useTranslation();
  const { geo, locate } = useGeolocation();
  const online = useOnlineStatus();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const now = useNow();
  const alerts = useAlerts();
  const { submit, submitting, error: createError } = useCreateReport();
  const { confirm } = useConfirmReport();
  const config = usePublicConfig();
  const savedPlaces = useSavedPlaces();
  const [tab, setTab] = useState<AppTab>("map");
  const [moreScreen, setMoreScreen] = useState<MoreScreen>("menu");
  const sos = useSos(tab === "more" && (moreScreen === "sos" || moreScreen === "helper"));
  const routeEval = useRouteEvaluation();

  const [mode, setMode] = useState<Mode>({ kind: "browse" });
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [layerSelection, setLayerSelection] = useState<LayerSelection>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<LayerFilters>(DEFAULT_LAYERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [layersSheetOpen, setLayersSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [pickerHeight, setPickerHeight] = useState(0);
  const [routeCardHeight, setRouteCardHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationNoticeDismissed, setLocationNoticeDismissed] = useState(false);
  const [routeDraft, setRouteDraft] = useState<RouteDraft>({ origin: null, destination: null, vehicle: "sedan" });
  const [routeOverlay, setRouteOverlay] = useState<(RouteOverlay & { result: RouteEvaluation; origin: LatLng; destination: LatLng }) | null>(null);
  // One idempotency key per report form, reused across retries.
  const createClientId = useRef<string | null>(null);

  const { reports, cells, mode: mapMode, staleSince, status, refreshing, hasMore, errorMessage, reload, upsertReport } =
    useViewportReports(viewport, filters);
  const layerData = useViewportLayers(viewport, layers);
  const outbox = useOutbox(upsertReport);

  const userLocation = useMemo(
    () => (geo.status === "granted" ? { latitude: geo.latitude, longitude: geo.longitude } : null),
    [geo],
  );
  const mapCenter = viewport?.center ?? userLocation ?? DEFAULT_CENTER;

  // Center on the user once, when their position first resolves — unless a
  // shared report link already decided where to look.
  const centeredOnUser = useRef(false);
  useEffect(() => {
    if (userLocation && !centeredOnUser.current) {
      centeredOnUser.current = true;
      if (!new URLSearchParams(window.location.search).has("report")) setFocus({ ...userLocation, zoom: 14 });
    }
  }, [userLocation]);

  const openReport = useCallback((report: Report, fly = true) => {
    setTab("map");
    setMode({ kind: "browse" });
    setLayerSelection(null);
    setSelected(report);
    setReportParam(report.id);
    if (fly) setFocus({ latitude: report.latitude, longitude: report.longitude, zoom: 16 });
  }, []);

  const closeReport = useCallback(() => {
    setSelected(null);
    setReportParam(null);
  }, []);

  // Shared links: /?report=<id> opens that report over the map.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("report");
    if (!id) return;
    reportsService
      .get(id)
      .then((r) => openReport(r))
      .catch(() => {
        toast.error(t("reportNotFound"));
        setReportParam(null);
      });
    // Runs once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the open sheet in sync with the latest copy from the map data.
  const selectedReport = (selected && reports.find((r) => r.id === selected.id)) ?? selected;

  const applyUpdate = useCallback(
    (updated: Report) => {
      upsertReport(updated);
      setSelected((cur) => (cur?.id === updated.id ? updated : cur));
    },
    [upsertReport],
  );

  const visibleReports = useMemo(
    () => applyClientFilters(reports, filters, userLocation, now),
    [reports, filters, userLocation, now],
  );

  async function requestLocation(): Promise<LatLng | null> {
    setLocating(true);
    const next = await locate();
    setLocating(false);
    if (next.status === "granted") return { latitude: next.latitude, longitude: next.longitude };
    toast.error(next.status === "denied" ? t("locationDenied") : t("locationUnavailable"));
    return null;
  }

  async function goToMyLocation(zoom?: number) {
    const loc = userLocation ?? (await requestLocation());
    if (loc) setFocus({ ...loc, zoom });
    return loc;
  }

  async function myLocation() {
    return userLocation ?? (await requestLocation());
  }

  function changeFilters(next: MapFilters) {
    if (next.nearMe && !filters.nearMe && userLocation) {
      setFocus({ ...userLocation, zoom: RADIUS_ZOOM[next.radiusKm] });
    }
    setFilters(next);
  }

  async function enableNearMe() {
    const loc = await requestLocation();
    if (loc) {
      setFocus({ ...loc, zoom: RADIUS_ZOOM[filters.radiusKm] });
      setFilters((f) => ({ ...f, nearMe: true }));
    }
  }

  function startReport() {
    closeReport();
    setLayerSelection(null);
    setTab("map");
    setDraft(null);
    createClientId.current = newClientId();
    setMode({ kind: "picking" });
    if (userLocation) setFocus({ ...userLocation, zoom: 17 });
  }

  // Another screen asks for a point on the map; it stays mounted (hidden).
  const requestPick = useCallback(
    (title: string, onPick: (p: LatLng) => void) => {
      closeReport();
      setLayerSelection(null);
      setMode({ kind: "pickingFor", title, onPick });
      if (userLocation) setFocus({ ...userLocation, zoom: 16 });
    },
    [closeReport, userLocation],
  );

  function editLocation(current: ReportDraft) {
    if (mode.kind !== "creating") return;
    setDraft(current);
    setFocus({ ...mode.location, zoom: 17 });
    setMode({ kind: "picking" });
  }

  function cancelReport() {
    setDraft(null);
    setMode({ kind: "browse" });
  }

  async function handleCreate(input: CreateReportInput) {
    const withId = { ...input, client_id: createClientId.current ?? newClientId() };
    const created = navigator.onLine ? await submit(withId) : "network";
    if (created === "network") {
      // Offline: keep it in the outbox and send it when the network returns.
      outbox.queueReport(withId);
      setDraft(null);
      setMode({ kind: "browse" });
      toast.success(t("reportQueued"));
      return;
    }
    if (!created) return; // the form stays open with its input intact
    upsertReport(created);
    setDraft(null);
    toast.success(t("reportCreated"));
    openReport(created);
  }

  async function confirmExisting(existing: Report) {
    const updated = await confirm(existing.id, "still_active");
    if (!updated) {
      toast.error(t("failedConfirmReport"));
      return;
    }
    setConfirmation(updated.id, "still_active");
    applyUpdate(updated);
    setDraft(null);
    toast.success(t("confirmSuccess"));
    openReport(updated);
  }

  function selectPlace(place: Place) {
    setFocus({ latitude: place.latitude, longitude: place.longitude, zoom: 15 });
  }

  const followedReportIds = new Set(alerts.follows.filter((f) => f.kind === "report").map((f) => f.report_id));
  async function toggleFollow(report: Report) {
    const existing = alerts.follows.find((f) => f.kind === "report" && f.report_id === report.id);
    const ok = existing ? await alerts.unfollow(existing.id) : await alerts.followReport(report.id);
    if (!ok) toast.error(t("followFailed"));
    return ok;
  }

  function openMore(screen: MoreScreen) {
    setTab("more");
    setMoreScreen(screen);
  }

  function changeTab(next: AppTab) {
    setTab(next);
    if (next === "more") setMoreScreen("menu");
  }

  function openLayerItem(selection: NonNullable<LayerSelection>) {
    closeReport();
    setTab("map");
    setLayerSelection(selection);
    const point = selection.kind === "place" ? selection.place : selection.announcement;
    if (point.latitude != null && point.longitude != null) setFocus({ latitude: point.latitude, longitude: point.longitude, zoom: 15 });
  }

  function showSavedPlace(p: SavedPlace) {
    setTab("map");
    setFocus({ latitude: p.latitude, longitude: p.longitude, zoom: WATCH_ZOOM[p.watch_radius_m] ?? 14 });
  }

  function planRoute(end: "origin" | "destination", p: SavedPlace) {
    setRouteDraft((d) => ({
      ...d,
      [end]: { latitude: p.latitude, longitude: p.longitude, label: p.name },
      vehicle: p.preferred_vehicle ?? d.vehicle,
    }));
    routeEval.reset();
    openMore("route");
  }

  function showRoute(result: RouteEvaluation, index: number) {
    if (!routeDraft.origin || !routeDraft.destination) return;
    closeReport();
    setLayerSelection(null);
    setRouteOverlay({ routes: result.routes, selected: index, result, origin: routeDraft.origin, destination: routeDraft.destination });
    setTab("map");
    setFocus({ ...routeDraft.origin, bounds: routeBounds(result) });
  }

  const picking = mode.kind === "picking" || mode.kind === "pickingFor";
  const onMap = tab === "map";
  const sheetOpen = onMap && !picking && selectedReport != null;
  const layerSheetOpen = onMap && !picking && !sheetOpen && layerSelection != null;
  const routeCardOpen = onMap && !picking && !sheetOpen && !layerSheetOpen && routeOverlay != null;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const layersActive = (layers.places ? 1 : 0) + (layers.announcements ? 1 : 0);
  const outboxCount = outbox.pendingCount + outbox.failedCount;
  // On desktop the sheet floats at the side, so it doesn't cover the map bottom.
  const bottomInset = isDesktop
    ? 0
    : picking
      ? pickerHeight
      : sheetOpen || layerSheetOpen
        ? sheetHeight
        : routeCardOpen
          ? routeCardHeight
          : 0;

  const pickerRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setPickerHeight(el.offsetHeight));
    ro.observe(el);
    return () => {
      ro.disconnect();
      setPickerHeight(0);
    };
  }, []);

  const routeCardRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setRouteCardHeight(el.offsetHeight));
    ro.observe(el);
    return () => {
      ro.disconnect();
      setRouteCardHeight(0);
    };
  }, []);

  const staleClock = staleSince
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(staleSince))
    : null;

  const moreHidden = picking;
  const back = () => setMoreScreen("menu");
  // The donate screen exists only while the API reports a valid config.
  const screen: MoreScreen = moreScreen === "donate" && !config.donation ? "menu" : moreScreen;

  return (
    <main
      className="relative h-dvh w-full overflow-hidden bg-muted"
      style={{ "--map-bottom-inset": `${bottomInset}px` } as React.CSSProperties}
    >
      <div className={picking ? "absolute inset-0" : "absolute inset-x-0 top-0 bottom-(--nav-h)"}>
        <MapView
          initialCenter={DEFAULT_CENTER}
          focus={focus}
          reports={visibleReports}
          selectedReportId={sheetOpen ? selectedReport.id : null}
          onSelectReport={openReport}
          onMapClick={
            sheetOpen ? closeReport : layerSheetOpen ? () => setLayerSelection(null) : undefined
          }
          userLocation={userLocation}
          pickMode={picking}
          onViewportChange={setViewport}
          bottomInset={bottomInset}
          cells={cells}
          places={layerData.places}
          announcements={layerData.announcements}
          selectedLayer={
            layerSelection?.kind === "place"
              ? { kind: "place", id: layerSelection.place.id }
              : layerSelection?.kind === "announcement"
                ? { kind: "announcement", id: layerSelection.announcement.id }
                : null
          }
          onSelectPlace={(place) => openLayerItem({ kind: "place", place })}
          onSelectAnnouncement={(announcement) => openLayerItem({ kind: "announcement", announcement })}
          route={routeOverlay}
        />

        {onMap && !picking && (
          <>
            <button
              type="button"
              onClick={reload}
              aria-label={t("refreshMapButton")}
              disabled={refreshing}
              className="absolute right-3 bottom-[calc(var(--map-bottom-inset)+4.5rem)] z-10 flex size-12 items-center justify-center rounded-2xl border bg-background text-primary shadow-lg transition-[bottom] duration-300 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 sm:bottom-[9.25rem]"
            >
              <RefreshCw className={refreshing ? "size-5 animate-spin" : "size-5"} />
            </button>
            <button
              type="button"
              onClick={() => goToMyLocation(Math.max(viewport?.zoom ?? 14, 15))}
              aria-label={t("myLocationButton")}
              disabled={locating}
              className="absolute right-3 bottom-[calc(var(--map-bottom-inset)+0.75rem)] z-10 flex size-12 items-center justify-center rounded-2xl border bg-background text-primary shadow-lg transition-[bottom] duration-300 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 sm:bottom-[5.5rem]"
            >
              <LocateFixed className={locating ? "size-5 animate-pulse" : "size-5"} />
            </button>
            <button
              type="button"
              onClick={() => openMore("sos")}
              aria-label={sos.active ? t("sosShortcutActive") : t("sosTitle")}
              className="absolute bottom-[calc(var(--map-bottom-inset)+3.25rem)] left-3 z-10 flex h-12 items-center gap-1.5 rounded-2xl bg-red-600 px-3.5 text-sm font-bold text-white shadow-lg transition-[bottom] duration-300 hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:bottom-[5.5rem]"
            >
              <Siren className={sos.active ? "size-5 animate-pulse" : "size-5"} aria-hidden />
              SOS
              {sos.active && <span className="rounded-full bg-white/25 px-1.5 text-[11px] font-semibold">{t(`sosStatus.${sos.active.status}`)}</span>}
            </button>
          </>
        )}
      </div>

      {onMap && !picking && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 pt-[calc(var(--safe-top)+0.5rem)]">
          <MapTopBar
            filters={filters}
            onFiltersChange={changeFilters}
            onOpenFilterSheet={() => setFilterSheetOpen(true)}
            onSelectPlace={selectPlace}
            searchArea={viewport?.bbox ?? null}
            canFilterNearMe={userLocation != null}
            onNeedLocation={enableNearMe}
            onOpenLayers={() => setLayersSheetOpen(true)}
            layersActive={layersActive}
          />
          <div className="flex flex-col items-center gap-2 px-3">
            {!online && (
              <MapNotice icon={<WifiOff />} tone="warn">
                {staleClock ? t("offlineShowingAsOf", { when: staleClock }) : t("offlineNotice")}
              </MapNotice>
            )}
            {online && staleClock && (
              <MapNotice icon={<CircleAlert />} tone="warn" action={{ label: t("retry"), onClick: reload }}>
                {t("serverUnreachableAsOf", { when: staleClock })}
              </MapNotice>
            )}
            {outboxCount > 0 && (
              <MapNotice icon={<CloudUpload />} tone={outbox.failedCount > 0 ? "error" : "warn"} action={{ label: t("view"), onClick: () => openMore("sync") }}>
                {outbox.failedCount > 0 ? t("syncFailedCount", { n: outbox.failedCount }) : t("syncPendingCount", { n: outbox.pendingCount })}
              </MapNotice>
            )}
            {status === "error" && errorMessage && (
              <MapNotice icon={<CircleAlert />} tone="error" action={{ label: t("retry"), onClick: reload }}>
                {errorMessage}
              </MapNotice>
            )}
            {(geo.status === "denied" || geo.status === "unavailable") && !locationNoticeDismissed && (
              <MapNotice icon={<MapPinOff />} action={{ label: t("close"), onClick: () => setLocationNoticeDismissed(true) }}>
                {geo.status === "denied" ? t("locationDenied") : t("locationUnavailable")}
              </MapNotice>
            )}
            {status === "ready" && hasMore && (
              <MapNotice icon={<ZoomIn />}>{t("zoomInForMore")}</MapNotice>
            )}
            {status === "ready" && mapMode === "aggregate" && cells.length > 0 && !sheetOpen && (
              <MapNotice icon={<Layers />}>{t("zonesNotice")}</MapNotice>
            )}
            {layerData.placesStatus === "zoom" && <MapNotice icon={<ZoomIn />}>{t("placesZoomIn")}</MapNotice>}
            {status === "ready" && !refreshing && visibleReports.length === 0 && cells.length === 0 && !sheetOpen && !layerSheetOpen && (
              <MapNotice
                icon={<SearchX />}
                action={filtersActive ? { label: t("clearFilters"), onClick: () => setFilters(DEFAULT_FILTERS) } : undefined}
              >
                {filtersActive ? t("noReportsFiltered") : t("noReportsInView")}
              </MapNotice>
            )}
            {(refreshing || geo.status === "loading") && (
              <MapStatusPill>{refreshing ? t("loadingReports") : t("locating")}</MapStatusPill>
            )}
          </div>
        </div>
      )}

      {sheetOpen && (
        <ReportDetailSheet
          key={selectedReport.id}
          report={selectedReport}
          userLocation={userLocation}
          onClose={closeReport}
          onConfirmed={applyUpdate}
          following={followedReportIds.has(selectedReport.id)}
          onToggleFollow={() => toggleFollow(selectedReport)}
          onVisibleHeightChange={setSheetHeight}
          onQueueVote={(voteStatus) => outbox.queueConfirm(selectedReport.id, voteStatus)}
        />
      )}
      {layerSheetOpen && layerSelection.kind === "place" && (
        <ImportantPlaceSheet
          key={layerSelection.place.id}
          place={layerSelection.place}
          onClose={() => setLayerSelection(null)}
          onVisibleHeightChange={setSheetHeight}
        />
      )}
      {layerSheetOpen && layerSelection.kind === "announcement" && (
        <AnnouncementSheet
          key={layerSelection.announcement.id}
          announcement={layerSelection.announcement}
          onClose={() => setLayerSelection(null)}
          onVisibleHeightChange={setSheetHeight}
        />
      )}
      {routeCardOpen && (
        <div ref={routeCardRef}>
          <RouteSummary
            result={routeOverlay.result}
            selected={routeOverlay.selected}
            origin={routeOverlay.origin}
            destination={routeOverlay.destination}
            onSelect={(i) => setRouteOverlay((o) => (o ? { ...o, selected: i } : o))}
            onClose={() => setRouteOverlay(null)}
            onDetails={() => openMore("route")}
          />
        </div>
      )}

      {picking && (
        <LocationPicker
          ref={pickerRef}
          point={mapCenter}
          locating={locating}
          title={mode.kind === "pickingFor" ? mode.title : undefined}
          onUseMyLocation={() => goToMyLocation(17)}
          onCancel={mode.kind === "pickingFor" ? () => setMode({ kind: "browse" }) : cancelReport}
          onConfirm={() => {
            if (mode.kind === "pickingFor") {
              mode.onPick(mapCenter);
              setMode({ kind: "browse" });
            } else {
              setMode({ kind: "creating", location: mapCenter });
            }
          }}
          onOpenReport={
            mode.kind === "picking"
              ? (r) => {
                  setDraft(null);
                  openReport(r);
                }
              : undefined
          }
        />
      )}

      {tab === "nearby" && (
        <NearbyView
          key="nearby"
          userLocation={userLocation}
          mapCenter={mapCenter}
          locationBlocked={geo.status === "denied"}
          locating={locating}
          onLocate={requestLocation}
          onSelect={openReport}
        />
      )}
      {tab === "alerts" && (
        <AlertsView
          key="alerts"
          alerts={alerts}
          knownReports={selected ? [selected, ...reports] : reports}
          userLocation={userLocation}
          mapCenter={mapCenter}
          onSelect={openReport}
        />
      )}
      {tab === "more" && screen === "menu" && (
        <MoreView onOpen={openMore} donationAvailable={config.donation != null} outboxCount={outboxCount} hidden={moreHidden} />
      )}
      {tab === "more" && screen === "saved" && (
        <SavedPlacesView
          places={savedPlaces}
          onBack={back}
          hidden={moreHidden}
          onUseMyLocation={myLocation}
          onPick={requestPick}
          onShowOnMap={showSavedPlace}
          onRouteFrom={(p) => planRoute("origin", p)}
          onRouteTo={(p) => planRoute("destination", p)}
        />
      )}
      {tab === "more" && screen === "watch" && (
        <WatchView places={savedPlaces} onBack={back} hidden={moreHidden} onAddPlace={() => setMoreScreen("saved")} onSelectReport={openReport} />
      )}
      {tab === "more" && screen === "route" && (
        <RouteView
          draft={routeDraft}
          onDraftChange={setRouteDraft}
          evaluation={routeEval}
          savedPlaces={savedPlaces.places}
          onBack={back}
          hidden={moreHidden}
          onUseMyLocation={myLocation}
          onPick={requestPick}
          onSelectReport={openReport}
          onShowOnMap={showRoute}
        />
      )}
      {tab === "more" && screen === "sos" && (
        <SosView sos={sos} online={online} onBack={back} hidden={moreHidden} onUseMyLocation={myLocation} onPick={requestPick} />
      )}
      {tab === "more" && screen === "helper" && (
        <HelperView
          sos={sos}
          userLocation={userLocation}
          locationBlocked={geo.status === "denied"}
          onLocate={requestLocation}
          onBack={back}
          hidden={moreHidden}
        />
      )}
      {tab === "more" && screen === "places" && (
        <ImportantPlacesView
          center={mapCenter}
          layers={layers}
          onLayersChange={setLayers}
          onOpen={(place) => {
            setLayers((l) => ({ ...l, places: true }));
            openLayerItem({ kind: "place", place });
          }}
          onBack={back}
          hidden={moreHidden}
        />
      )}
      {tab === "more" && screen === "announcements" && (
        <AnnouncementsView
          layers={layers}
          onLayersChange={setLayers}
          onOpen={(announcement) => openLayerItem({ kind: "announcement", announcement })}
          onBack={back}
          hidden={moreHidden}
        />
      )}
      {tab === "more" && screen === "donate" && config.donation && <DonateView config={config.donation} onBack={back} hidden={moreHidden} />}
      {tab === "more" && screen === "sync" && <SyncView outbox={outbox} online={online} onBack={back} hidden={moreHidden} />}

      {!picking && <BottomNav active={tab} onChange={changeTab} onReport={startReport} unreadCount={alerts.unreadCount} />}

      <FilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onApply={changeFilters}
        canFilterNearMe={userLocation != null}
      />
      <InstallPrompt />
      <LayersSheet open={layersSheetOpen} onOpenChange={setLayersSheetOpen} layers={layers} onChange={setLayers} />

      <Drawer open={mode.kind === "creating"} onOpenChange={(open) => !open && cancelReport()}>
        <DrawerContent className="h-[94dvh] max-h-[94dvh] sm:mx-auto sm:max-w-xl">
          {mode.kind === "creating" && (
            <>
              <DrawerHeader className="border-b pb-3 text-left">
                <DrawerTitle className="text-lg font-semibold">{t("newReportTitle")}</DrawerTitle>
              </DrawerHeader>
              {!online && (
                <p role="status" className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {t("reportOfflineNote")}
                </p>
              )}
              <ReportForm
                location={mode.location}
                draft={draft}
                onChangeLocation={editLocation}
                onSubmit={handleCreate}
                submitting={submitting}
                submitError={createError}
                onConfirmExisting={confirmExisting}
                onViewExisting={(r) => {
                  setDraft(null);
                  openReport(r);
                }}
                onRequestSos={() => {
                  cancelReport();
                  openMore("sos");
                }}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>
    </main>
  );
}
