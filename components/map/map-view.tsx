"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { AttributionControl, Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ClusterMarker, ReportMarker } from "@/components/map/report-marker";
import { LocationDot } from "@/components/map/location-dot";
import { CenterPin } from "@/components/map/center-pin";
import { clusterPoints, CLUSTER_MAX_ZOOM } from "@/lib/cluster";
import { severityRank } from "@/lib/report-meta";
import { useNow } from "@/features/common/use-now";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import type { Report } from "@/types/report";

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Turbopack can't statically resolve maplibre-gl's internal
// `new URL(`./${file}`, import.meta.url)` worker lookup, so the map silently
// fails to render ("Worker failed to load"). Point it at a self-hosted copy
// instead (kept in sync with the maplibre-gl version in package.json).
setWorkerUrl("/maplibre-gl-worker.js");

type LatLng = { latitude: number; longitude: number };

// A request to move the camera; pass a fresh object to fly again even to the
// same place.
export interface MapFocus extends LatLng {
  zoom?: number;
}

export interface MapViewProps {
  initialCenter: LatLng;
  focus: MapFocus | null;
  reports: Report[];
  selectedReportId: string | null;
  onSelectReport: (report: Report) => void;
  onMapClick?: () => void;
  userLocation: LatLng | null;
  pickMode: boolean;
  onViewportChange: (viewport: Viewport) => void;
  // Height (px) of the panel/sheet covering the bottom of the map. It becomes
  // camera padding so the pick pin and focused reports stay in view above it.
  bottomInset: number;
}

// The map is uncontrolled (MapLibre owns the camera) so panning doesn't
// re-render React; markers only re-cluster when a move ends.
export const MapView = memo(function MapView({
  initialCenter,
  focus,
  reports,
  selectedReportId,
  onSelectReport,
  onMapClick,
  userLocation,
  pickMode,
  onViewportChange,
  bottomInset,
}: MapViewProps) {
  const { t } = useTranslation();
  const mapRef = useRef<MapRef | null>(null);
  const [zoom, setZoom] = useState(14);
  const now = useNow(60_000);

  // Cap the padding so a fully expanded sheet doesn't squeeze the camera
  // center into a sliver at the top.
  const [containerH, setContainerH] = useState(0);
  const padBottom = Math.round(Math.min(bottomInset, containerH * 0.6));
  useEffect(() => {
    mapRef.current?.easeTo({ padding: { top: 0, left: 0, right: 0, bottom: padBottom }, duration: 300 });
  }, [padBottom]);

  useEffect(() => {
    if (focus) {
      mapRef.current?.flyTo({
        center: [focus.longitude, focus.latitude],
        zoom: focus.zoom ?? Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
    }
  }, [focus]);

  const emitViewport = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    const c = map.getCenter();
    setZoom(map.getZoom());
    setContainerH(map.getContainer().clientHeight);
    onViewportChange({
      bbox: { minLat: b.getSouth(), maxLat: b.getNorth(), minLng: b.getWest(), maxLng: b.getEast() },
      zoom: map.getZoom(),
      center: { latitude: c.lat, longitude: c.lng },
    });
  }, [onViewportChange]);

  // The selected report is never folded into a cluster, so it stays visible
  // above its detail sheet.
  const clusters = useMemo(() => {
    const selected = reports.find((r) => r.id === selectedReportId);
    const rest = clusterPoints(
      reports.filter((r) => r !== selected),
      zoom,
    );
    return selected ? [...rest, { kind: "point" as const, key: selected.id, item: selected }] : rest;
  }, [reports, zoom, selectedReportId]);

  return (
    <div className="relative h-full w-full" role="region" aria-label={t("mapLabel")}>
      <Map
        ref={mapRef}
        initialViewState={{ ...initialCenter, zoom: 14 }}
        onLoad={(e) => {
          // Compact attribution starts expanded over the map; keep it behind
          // its (i) button until the user asks.
          e.target.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
          emitViewport();
        }}
        onMoveEnd={emitViewport}
        onClick={onMapClick}
        mapStyle={OPENFREEMAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <AttributionControl position="bottom-left" compact />
        <NavigationControl position="bottom-right" showCompass={false} />

        {userLocation && (
          <Marker latitude={userLocation.latitude} longitude={userLocation.longitude} anchor="center">
            <LocationDot />
          </Marker>
        )}

        {clusters.map((c) => {
          if (c.kind === "cluster") {
            const worst = Math.max(...c.items.map((r) => severityRank(r.severity)));
            return (
              <Marker
                key={c.key}
                latitude={c.latitude}
                longitude={c.longitude}
                anchor="center"
                style={{ zIndex: 1 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  if (pickMode) return;
                  mapRef.current?.flyTo({
                    center: [c.longitude, c.latitude],
                    zoom: Math.min(CLUSTER_MAX_ZOOM, mapRef.current.getZoom() + 2),
                    duration: 500,
                  });
                }}
              >
                <ClusterMarker
                  count={c.items.length}
                  worstRank={worst}
                  label={t("clusterAriaLabel", { n: c.items.length })}
                  dimmed={pickMode}
                />
              </Marker>
            );
          }
          const report = c.item;
          const selected = report.id === selectedReportId;
          return (
            <Marker
              key={c.key}
              latitude={report.latitude}
              longitude={report.longitude}
              anchor="center"
              style={{ zIndex: selected ? 3 : severityRank(report.severity) >= 3 ? 2 : 1 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (!pickMode) onSelectReport(report);
              }}
            >
              <ReportMarker report={report} selected={selected} now={now} dimmed={pickMode} />
            </Marker>
          );
        })}
      </Map>

      {pickMode && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center pb-8"
          style={{ bottom: padBottom }}
        >
          <CenterPin />
        </div>
      )}
    </div>
  );
});
