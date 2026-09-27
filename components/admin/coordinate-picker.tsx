"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Check, LocateFixed, MapPinned, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "@/components/ui/detail-popup";
import { CenterPin } from "@/components/map/center-pin";
import { useApproximateAddress } from "@/features/reports/use-location-lookups";
import { requestPosition, DEFAULT_CENTER } from "@/features/reports/use-geolocation";
import { useTranslation } from "@/lib/i18n/locale-context";

type LatLng = { latitude: number; longitude: number };

const PickerMap = dynamic(() => import("@/components/admin/coordinate-picker-map").then((m) => m.CoordinatePickerMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />,
});

// "Pick on map" button for an admin form's lat/lng fields, opening a dialog
// with the same drag-the-map-under-a-fixed-pin flow as the main app's
// LocationPicker (components/map/location-picker.tsx), minus the
// report-specific "nearby reports at this pin" panel.
export function CoordinatePickerButton({ value, onPick }: { value: LatLng | null; onPick: (point: LatLng) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="h-11 gap-1.5 rounded-xl" onClick={() => setOpen(true)}>
        <MapPinned aria-hidden />
        {t("adminPickOnMap")}
      </Button>
      {open && (
        <CoordinatePickerDialog
          initial={value ?? DEFAULT_CENTER}
          onCancel={() => setOpen(false)}
          onConfirm={(point) => {
            onPick(point);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function CoordinatePickerDialog({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: LatLng;
  onCancel: () => void;
  onConfirm: (point: LatLng) => void;
}) {
  const { t } = useTranslation();
  const [point, setPoint] = useState(initial);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const { place, status: addressStatus } = useApproximateAddress(point);

  const useMyLocation = useCallback(() => {
    setLocating(true);
    requestPosition((state) => {
      setLocating(false);
      if (state.status === "granted") {
        const next = { latitude: state.latitude, longitude: state.longitude };
        setPoint(next);
        setFlyTarget(next);
      }
    }, true);
  }, []);

  return (
    <DetailPopup
      labelledBy="coord-picker-title"
      onClose={onCancel}
      header={
        <h2 id="coord-picker-title" className="text-lg font-semibold">
          {t("pickTitle")}
        </h2>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("dragPinHint")}</p>
        <div className="relative h-64 w-full overflow-hidden rounded-2xl border">
          <PickerMap initialCenter={initial} flyTarget={flyTarget} onMoveEnd={setPoint} />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
            <CenterPin />
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl bg-muted px-3 py-2.5">
          <div className="min-w-0 text-sm" aria-live="polite">
            <p className="truncate font-medium">
              {place?.name ?? (addressStatus === "loading" ? t("locatingAddress") : t("locationPinned"))}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={useMyLocation} disabled={locating}>
            <LocateFixed aria-hidden />
            {t("useMyLocation")}
          </Button>
          <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onCancel}>
            <X aria-hidden />
            {t("cancel")}
          </Button>
          <Button type="button" className="col-span-2 h-11 rounded-xl text-base" onClick={() => onConfirm(point)}>
            <Check aria-hidden />
            {t("useThisSpot")}
          </Button>
        </div>
      </div>
    </DetailPopup>
  );
}
