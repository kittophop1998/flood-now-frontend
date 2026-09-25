"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ReportMarker } from "@/components/map/report-marker";
import { LocationDot } from "@/components/map/location-dot";
import { CenterPin } from "@/components/map/center-pin";
import type { Report } from "@/types/report";

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Turbopack can't statically resolve maplibre-gl's internal
// `new URL(`./${file}`, import.meta.url)` worker lookup, so the map silently
// fails to render ("Worker failed to load"). Point it at a self-hosted copy
// instead (kept in sync with the maplibre-gl version in package.json).
setWorkerUrl("/maplibre-gl-worker.js");

export interface MapViewProps {
  center: { latitude: number; longitude: number };
  reports: Report[];
  onSelectReport: (id: string) => void;
  selectedReportId?: string | null;
  userLocation?: { latitude: number; longitude: number } | null;
  pickMode?: boolean;
  onPickLocationChange?: (latitude: number, longitude: number) => void;
  // Fired on every moveend regardless of pickMode, so callers can track the
  // current center (e.g. to seed pick mode) without reading it during render.
  onCenterChange?: (latitude: number, longitude: number) => void;
}

export function MapView({
  center,
  reports,
  onSelectReport,
  selectedReportId,
  userLocation,
  pickMode,
  onPickLocationChange,
  onCenterChange,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [viewState, setViewState] = useState({
    latitude: center.latitude,
    longitude: center.longitude,
    zoom: 14,
  });

  // The map only initializes viewState once; when the center prop later
  // changes (e.g. geolocation resolves after the default fallback render, or
  // "My location" is pressed), fly to it explicitly rather than silently
  // ignoring the update. Compared by reference so passing a fresh object
  // re-centers even when the coordinates are unchanged but the user panned away.
  const prevCenterRef = useRef(center);
  useEffect(() => {
    if (center !== prevCenterRef.current) {
      mapRef.current?.flyTo({ center: [center.longitude, center.latitude], zoom: 14, duration: 800 });
      prevCenterRef.current = center;
    }
  }, [center]);

  const handleMoveEnd = useCallback(() => {
    if (!mapRef.current) return;
    const c = mapRef.current.getCenter();
    if (pickMode) onPickLocationChange?.(c.lat, c.lng);
    onCenterChange?.(c.lat, c.lng);
  }, [pickMode, onPickLocationChange, onCenterChange]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveEnd={handleMoveEnd}
        mapStyle={OPENFREEMAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {userLocation && !pickMode && (
          <Marker latitude={userLocation.latitude} longitude={userLocation.longitude} anchor="center">
            <LocationDot />
          </Marker>
        )}

        {!pickMode &&
          reports.map((report) => (
            <Marker
              key={report.id}
              latitude={report.latitude}
              longitude={report.longitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectReport(report.id);
              }}
            >
              <ReportMarker report={report} selected={report.id === selectedReportId} />
            </Marker>
          ))}
      </Map>

      {pickMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
          <CenterPin />
        </div>
      )}
    </div>
  );
}
