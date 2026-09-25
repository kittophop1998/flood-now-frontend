"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { Plus, Navigation, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { MapLoadingOverlay, MapErrorBanner, LocationDeniedBanner } from "@/components/map/map-states";
import { ReportForm } from "@/components/report/report-form";
import { ReportDetail } from "@/components/report/report-detail";
import { LocaleToggle } from "@/components/locale-toggle";
import { useReports } from "@/features/reports/use-reports";
import { useCreateReport } from "@/features/reports/use-create-report";
import { useGeolocation, DEFAULT_CENTER } from "@/features/reports/use-geolocation";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { CreateReportInput, Report } from "@/types/report";

const MapView = dynamic(() => import("@/components/map/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <MapLoadingOverlay />
    </div>
  ),
});

type Mode =
  | { kind: "browse" }
  | { kind: "picking"; latitude: number; longitude: number }
  | { kind: "creating"; latitude: number; longitude: number }
  | { kind: "detail"; reportId: string };

export default function HomePage() {
  const { t } = useTranslation();
  const geo = useGeolocation();
  const { reports, status, errorMessage, reload, upsertReport } = useReports();
  const { submit, submitting, error: createError } = useCreateReport();

  const initialCenter = useMemo(() => {
    return geo.status === "granted" ? { latitude: geo.latitude, longitude: geo.longitude } : DEFAULT_CENTER;
  }, [geo]);

  const [mode, setMode] = useState<Mode>({ kind: "browse" });
  const mapCenterRef = useRef(initialCenter);
  // Closing the detail modal is two-phase: hide the dialog first, then leave
  // detail mode once the exit animation finishes, so the popup doesn't empty
  // out mid-fade.
  const [detailClosing, setDetailClosing] = useState(false);
  const detailContentRef = useRef<HTMLDivElement>(null);

  const handleCenterChange = useCallback((latitude: number, longitude: number) => {
    mapCenterRef.current = { latitude, longitude };
  }, []);

  const handlePickLocationChange = useCallback((latitude: number, longitude: number) => {
    setMode((prev) => (prev.kind === "picking" ? { kind: "picking", latitude, longitude } : prev));
  }, []);

  function startPicking() {
    setMode({ kind: "picking", ...mapCenterRef.current });
  }

  function useMyLocation() {
    if (geo.status === "granted") {
      mapCenterRef.current = { latitude: geo.latitude, longitude: geo.longitude };
      setMode({ kind: "picking", latitude: geo.latitude, longitude: geo.longitude });
    }
  }

  function confirmLocation() {
    if (mode.kind !== "picking") return;
    setMode({ kind: "creating", latitude: mode.latitude, longitude: mode.longitude });
  }

  function closeDrawer() {
    setMode({ kind: "browse" });
  }

  async function handleCreateSubmit(input: Omit<CreateReportInput, "image_key">, imageFile: File | null) {
    const created = await submit(input, imageFile);
    if (created) {
      upsertReport(created);
      setMode({ kind: "detail", reportId: created.id });
    }
  }

  const selectedReport: Report | undefined =
    mode.kind === "detail" ? reports.find((r) => r.id === mode.reportId) : undefined;

  const detailOpen = selectedReport != null && !detailClosing;

  function handleDetailOpenChangeComplete(open: boolean) {
    if (open) return;
    setDetailClosing(false);
    setMode((prev) => (prev.kind === "detail" ? { kind: "browse" } : prev));
  }

  // Land focus on the close button at the top rather than the first control
  // in the body — otherwise a tall modal can open pre-scrolled to the
  // confirm buttons.
  function focusDetailClose() {
    return detailContentRef.current?.querySelector<HTMLElement>('[data-slot="dialog-close"]') ?? true;
  }

  const userLocation = geo.status === "granted" ? { latitude: geo.latitude, longitude: geo.longitude } : null;

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView
        center={initialCenter}
        reports={reports}
        onSelectReport={(id) => setMode({ kind: "detail", reportId: id })}
        selectedReportId={mode.kind === "detail" ? mode.reportId : null}
        userLocation={userLocation}
        pickMode={mode.kind === "picking"}
        onPickLocationChange={handlePickLocationChange}
        onCenterChange={handleCenterChange}
      />

      {status === "loading" && <MapLoadingOverlay />}
      {status === "error" && errorMessage && <MapErrorBanner message={errorMessage} onRetry={reload} />}
      {status !== "error" && geo.status === "denied" && mode.kind === "browse" && <LocationDeniedBanner />}

      {mode.kind === "browse" && (
        <>
          <LocaleToggle className="absolute bottom-6 left-4" />
          <Button
            size="lg"
            className="absolute bottom-6 right-4 h-14 gap-2 rounded-full px-5 text-base shadow-xl"
            onClick={startPicking}
          >
            <Plus className="size-5" aria-hidden />
            {t("reportButton")}
          </Button>
        </>
      )}

      {mode.kind === "picking" && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-background/95 p-4 pb-6 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <p className="text-center text-sm text-muted-foreground">{t("dragPinHint")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="lg" className="h-12 flex-1 gap-2" onClick={closeDrawer}>
              <X className="size-4" aria-hidden />
              {t("cancel")}
            </Button>
            {geo.status === "granted" && (
              <Button type="button" variant="outline" size="lg" className="h-12 gap-2" onClick={useMyLocation}>
                <Navigation className="size-4" aria-hidden />
                {t("myLocation")}
              </Button>
            )}
            <Button type="button" size="lg" className="h-12 flex-1 gap-2" onClick={confirmLocation}>
              <Check className="size-4" aria-hidden />
              {t("useThisSpot")}
            </Button>
          </div>
        </div>
      )}

      <Drawer open={mode.kind === "creating"} onOpenChange={(open) => !open && closeDrawer()}>
        <DrawerContent className="max-h-[88dvh]">
          {mode.kind === "creating" && (
            <>
              <DrawerHeader>
                <DrawerTitle>{t("newReportTitle")}</DrawerTitle>
              </DrawerHeader>
              <ReportForm
                latitude={mode.latitude}
                longitude={mode.longitude}
                onChangeLocation={() => setMode({ kind: "picking", latitude: mode.latitude, longitude: mode.longitude })}
                onSubmit={handleCreateSubmit}
                submitting={submitting}
                submitError={createError}
              />
            </>
          )}
        </DrawerContent>
      </Drawer>

      {/* Report detail floats over the map as a centered modal; the map's own
          view state is untouched, so position/zoom survive closing it. */}
      <Dialog open={detailOpen} onOpenChange={(open) => !open && setDetailClosing(true)} onOpenChangeComplete={handleDetailOpenChangeComplete}>
        <DialogContent
          ref={detailContentRef}
          initialFocus={focusDetailClose}
          className="flex max-h-[88dvh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-h-[85dvh] sm:max-w-[520px]"
        >
          {selectedReport && (
            <ReportDetail
              key={selectedReport.id}
              report={selectedReport}
              userLocation={userLocation}
              onConfirmed={upsertReport}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
