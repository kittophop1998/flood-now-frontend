"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, LocateFixed, MapPinOff, SearchX, WifiOff, ZoomIn } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { BottomNav, type AppTab } from "@/components/bottom-nav";
import { MapNotice, MapStatusPill } from "@/components/map/map-states";
import { MapTopBar } from "@/components/map/map-top-bar";
import { FilterSheet } from "@/components/map/filter-sheet";
import { LocationPicker } from "@/components/map/location-picker";
import { ReportForm, type ReportDraft } from "@/components/report/report-form";
import { ReportDetailSheet } from "@/components/report/report-detail";
import { NearbyView } from "@/components/views/nearby-view";
import { AlertsView } from "@/components/views/alerts-view";
import { MoreView } from "@/components/views/more-view";
import type { MapFocus } from "@/components/map/map-view";
import { useViewportReports, type Viewport } from "@/features/reports/use-viewport-reports";
import { useCreateReport } from "@/features/reports/use-create-report";
import { useConfirmReport } from "@/features/reports/use-confirm-report";
import { useGeolocation, DEFAULT_CENTER } from "@/features/reports/use-geolocation";
import { useAlerts } from "@/features/alerts/use-alerts";
import { useOnlineStatus } from "@/features/common/use-online-status";
import { useMediaQuery } from "@/features/common/use-media-query";
import { useNow } from "@/features/common/use-now";
import { reportsService } from "@/services/reports-service";
import { setConfirmation } from "@/lib/confirmed-reports";
import { DEFAULT_FILTERS, applyClientFilters, type MapFilters } from "@/lib/map-filters";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CreateReportInput, Place, Report } from "@/types/report";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-muted" />,
});

type LatLng = { latitude: number; longitude: number };
type Mode = { kind: "browse" } | { kind: "picking" } | { kind: "creating"; location: LatLng };

const RADIUS_ZOOM: Record<number, number> = { 1: 15, 3: 13, 5: 12, 10: 11 };

function setReportParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("report", id);
  else url.searchParams.delete("report");
  window.history.replaceState(null, "", url);
}

export default function HomePage() {
  const { t } = useTranslation();
  const { geo, locate } = useGeolocation();
  const online = useOnlineStatus();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const now = useNow();
  const alerts = useAlerts();
  const { submit, submitting, error: createError } = useCreateReport();
  const { confirm } = useConfirmReport();

  const [tab, setTab] = useState<AppTab>("map");
  const [mode, setMode] = useState<Mode>({ kind: "browse" });
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [pickerHeight, setPickerHeight] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationNoticeDismissed, setLocationNoticeDismissed] = useState(false);

  const { reports, status, refreshing, hasMore, errorMessage, reload, upsertReport } = useViewportReports(viewport, filters);

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
    setSelected(report);
    setReportParam(report.id);
    if (fly) setFocus({ latitude: report.latitude, longitude: report.longitude });
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
    setTab("map");
    setDraft(null);
    setMode({ kind: "picking" });
    if (userLocation) setFocus({ ...userLocation, zoom: 17 });
  }

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
    const created = await submit(input);
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

  const picking = mode.kind === "picking";
  const onMap = tab === "map";
  const sheetOpen = onMap && !picking && selectedReport != null;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  // On desktop the sheet floats at the side, so it doesn't cover the map bottom.
  const bottomInset = isDesktop ? 0 : picking ? pickerHeight : sheetOpen ? sheetHeight : 0;

  const pickerRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(() => setPickerHeight(el.offsetHeight));
    ro.observe(el);
    return () => {
      ro.disconnect();
      setPickerHeight(0);
    };
  }, []);

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
          onMapClick={sheetOpen ? closeReport : undefined}
          userLocation={userLocation}
          pickMode={picking}
          onViewportChange={setViewport}
          bottomInset={bottomInset}
        />

        {onMap && !picking && (
          <button
            type="button"
            onClick={() => goToMyLocation(Math.max(viewport?.zoom ?? 14, 15))}
            aria-label={t("myLocationButton")}
            disabled={locating}
            className="absolute right-3 bottom-[calc(var(--map-bottom-inset)+0.75rem)] z-10 flex size-12 items-center justify-center rounded-2xl border bg-background text-primary shadow-lg transition-[bottom] duration-300 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 sm:bottom-[5.5rem]"
          >
            <LocateFixed className={locating ? "size-5 animate-pulse" : "size-5"} />
          </button>
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
          />
          <div className="flex flex-col items-center gap-2 px-3">
            {!online && (
              <MapNotice icon={<WifiOff />} tone="warn">
                {t("offlineNotice")}
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
            {status === "ready" && !refreshing && visibleReports.length === 0 && !sheetOpen && (
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
        />
      )}

      {picking && (
        <LocationPicker
            ref={pickerRef}
            point={mapCenter}
            locating={locating}
            onUseMyLocation={() => goToMyLocation(17)}
            onCancel={cancelReport}
            onConfirm={() => setMode({ kind: "creating", location: mapCenter })}
            onOpenReport={(r) => {
              setDraft(null);
              openReport(r);
            }}
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
      {tab === "more" && <MoreView key="more" />}

      {!picking && <BottomNav active={tab} onChange={setTab} onReport={startReport} unreadCount={alerts.unreadCount} />}

      <FilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onApply={changeFilters}
        canFilterNearMe={userLocation != null}
      />

      <Drawer open={mode.kind === "creating"} onOpenChange={(open) => !open && cancelReport()}>
        <DrawerContent className="h-[94dvh] max-h-[94dvh] sm:mx-auto sm:max-w-xl">
          {mode.kind === "creating" && (
            <>
              <DrawerHeader className="border-b pb-3 text-left">
                <DrawerTitle className="text-lg font-semibold">{t("newReportTitle")}</DrawerTitle>
              </DrawerHeader>
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
              />
            </>
          )}
        </DrawerContent>
      </Drawer>
    </main>
  );
}
