"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { ReportMarker } from "@/components/map/report-marker";
import { AnnouncementMarker, CctvClusterMarker, CctvMarker, EventMarker, ImportantPlaceMarker, SavedPlaceMarker } from "@/components/map/overlay-markers";
import { LocationDot } from "@/components/map/location-dot";
import { CenterPin } from "@/components/map/center-pin";
import { clusterPoints, CLUSTER_MAX_ZOOM } from "@/lib/cluster";
import { GISTDA_FLOOD_META, ROUTE_RISK_META } from "@/lib/community-meta";
import { circleRing } from "@/lib/distance";
import { MAP_CONTAINER_STYLE, MAP_STYLE_URL } from "@/lib/map-config";
import { isRecentlyUpdated } from "@/lib/map-filters";
import { severityRank } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import { useNow } from "@/features/common/use-now";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import type { Report } from "@/types/report";
import type { Announcement, CctvCamera, CommunityEvent, EvaluatedRoute, FloodAreaCollection, ImportantPlace, SavedPlace } from "@/types/community";

type LatLng = { latitude: number; longitude: number };

// A request to move the camera; pass a fresh object to fly again even to the
// same place.
export interface MapFocus extends LatLng {
  zoom?: number;
  // When set, fit this [west, south, east, north] box instead of flying to a point.
  bounds?: [number, number, number, number];
}

// Candidate routes drawn on the map; `selected` is highlighted.
export interface RouteOverlay {
  routes: EvaluatedRoute[];
  selected: number;
}

export type LayerSelection =
  | { kind: "place"; id: string }
  | { kind: "announcement"; id: string }
  | { kind: "flood"; ref: number }
  | { kind: "cctv"; id: string }
  | { kind: "event"; id: string }
  | null;

const FLOOD_FILL_LAYER = "gistda-flood-fill";

export interface MapViewProps {
  initialCenter: LatLng;
  focus: MapFocus | null;
  reports: Report[];
  selectedReportId: string | null;
  onSelectReport: (report: Report) => void;
  // A tap on the map itself (not a marker); floodRef is the GISTDA flood
  // area under the tap, if any.
  onMapClick?: (floodRef: number | null) => void;
  userLocation: LatLng | null;
  pickMode: boolean;
  onViewportChange: (viewport: Viewport) => void;
  // Height (px) of the panel/sheet covering the bottom of the map. It becomes
  // camera padding so the pick pin and focused reports stay in view above it.
  bottomInset: number;
  places: ImportantPlace[];
  announcements: Announcement[];
  // Official GISTDA flood areas, drawn under every marker; null = layer off
  // (pass an empty collection while it loads so the layer stays mounted).
  floodAreas: FloodAreaCollection | null;
  // Official DOH cameras (empty when the layer is off).
  cameras: CctvCamera[];
  // Community events (public) and the signed-in user's own saved places
  // (private; empty for guests) — two separate groups from reports.
  events: CommunityEvent[];
  savedPlaces: SavedPlace[];
  selectedLayer: LayerSelection;
  onSelectPlace: (place: ImportantPlace) => void;
  onSelectCamera: (camera: CctvCamera) => void;
  onSelectAnnouncement: (a: Announcement) => void;
  onSelectEvent: (event: CommunityEvent) => void;
  onSelectSavedPlace: (place: SavedPlace) => void;
  route: RouteOverlay | null;
}

// The map is uncontrolled (MapLibre owns the camera) so panning doesn't
// re-render React; markers only re-cluster when a move ends.
// Report pins are never grouped; below this zoom they draw as compact dots.
const COMPACT_PIN_MAX_ZOOM = 13;
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
  places,
  announcements,
  floodAreas,
  cameras,
  events,
  savedPlaces,
  selectedLayer,
  onSelectPlace,
  onSelectCamera,
  onSelectAnnouncement,
  onSelectEvent,
  onSelectSavedPlace,
  route,
}: MapViewProps) {
  const { t } = useTranslation();
  const mapRef = useRef<MapRef | null>(null);
  const [zoom, setZoom] = useState(14);
  const now = useNow(60_000);
  // First label layer of the base style: the flood fill goes just below it,
  // so place and road names stay readable on top of the water.
  const [labelLayerId, setLabelLayerId] = useState<string | undefined>(undefined);

  // Cap the padding so a fully expanded sheet doesn't squeeze the camera
  // center into a sliver at the top.
  const [containerH, setContainerH] = useState(0);
  const padBottom = Math.round(Math.min(bottomInset, containerH * 0.6));
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => map.easeTo({ padding: { top: 0, left: 0, right: 0, bottom: padBottom }, duration: 300 });
    // A bottom sheet appearing mid-flight (e.g. the nearby summary while the
    // map flies to the user) must not cancel the flight: pad once it lands.
    if (!map.isMoving()) {
      apply();
      return;
    }
    map.once("moveend", apply);
    return () => {
      map.off("moveend", apply);
    };
  }, [padBottom]);

  useEffect(() => {
    if (focus?.bounds) {
      const [w, s, e, n] = focus.bounds;
      mapRef.current?.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: { top: 120, bottom: 40 + padBottom, left: 40, right: 40 }, duration: 800, maxZoom: 16 },
      );
      return;
    }
    if (focus) {
      mapRef.current?.flyTo({
        center: [focus.longitude, focus.latitude],
        zoom: focus.zoom ?? Math.max(mapRef.current.getZoom(), 15),
        duration: 800,
      });
    }
    // padBottom is read at the time of the focus request only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Every report is its own pin (no grouping at any zoom). Recent ones are
  // drawn last so they sit on top of older pins at the same spot.
  const pins = useMemo(
    () =>
      reports
        .map((report) => ({ report, recent: isRecentlyUpdated(report, now) }))
        .sort((a, b) => Number(a.recent) - Number(b.recent)),
    [reports, now],
  );
  const compact = zoom < COMPACT_PIN_MAX_ZOOM;

  // Cameras cluster (screen-space grouping), so a
  // zoomed-out map shows a few count pills instead of overlapping icons. The
  // selected camera always stays its own marker.
  const selectedCameraId = selectedLayer?.kind === "cctv" ? selectedLayer.id : null;
  const cameraClusters = useMemo(() => {
    const selected = cameras.find((c) => c.id === selectedCameraId);
    const rest = clusterPoints(
      cameras.filter((c) => c !== selected),
      zoom,
    );
    return selected ? [...rest, { kind: "point" as const, key: selected.id, item: selected }] : rest;
  }, [cameras, zoom, selectedCameraId]);

  const areas = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: announcements
        .filter((a) => a.radius_m && a.latitude != null && a.longitude != null)
        .map((a) => ({
          type: "Feature" as const,
          properties: { id: a.id },
          geometry: { type: "Polygon" as const, coordinates: [circleRing({ latitude: a.latitude!, longitude: a.longitude! }, a.radius_m!)] },
        })),
    }),
    [announcements],
  );

  // Draw alternatives first so the selected route sits on top.
  const routeLines = useMemo(() => {
    if (!route) return null;
    const order = route.routes.map((_, i) => i).filter((i) => i !== route.selected).concat(route.selected);
    return {
      type: "FeatureCollection" as const,
      features: order.map((i) => ({
        type: "Feature" as const,
        properties: { selected: i === route.selected, color: ROUTE_RISK_META[route.routes[i].risk].color },
        geometry: route.routes[i].geometry,
      })),
    };
  }, [route]);

  const selectedFloodRef = selectedLayer?.kind === "flood" ? selectedLayer.ref : -1;
  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const ref = e.features?.find((f) => f.layer.id === FLOOD_FILL_LAYER)?.properties?.ref;
      onMapClick?.(typeof ref === "number" && !pickMode ? ref : null);
    },
    [onMapClick, pickMode],
  );

  return (
    <div className="relative h-full w-full" role="region" aria-label={t("mapLabel")}>
      <Map
        ref={mapRef}
        initialViewState={{ ...initialCenter, zoom: 14 }}
        onLoad={(e) => {
          // Compact attribution starts expanded over the map; keep it behind
          // its (i) button until the user asks.
          e.target.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
          setLabelLayerId(e.target.getStyle().layers.find((l) => l.type === "symbol")?.id);
          emitViewport();
        }}
        onMoveEnd={emitViewport}
        onClick={handleClick}
        interactiveLayerIds={floodAreas && !pickMode ? [FLOOD_FILL_LAYER] : undefined}
        mapStyle={MAP_STYLE_URL}
        style={MAP_CONTAINER_STYLE}
        attributionControl={false}
      >
        <AttributionControl position="bottom-left" compact />
        <NavigationControl position="bottom-right" showCompass={false} />

        {/* Mounted once while the layer is on; new periods/regions only swap
            its data, never tear the layer down. */}
        {floodAreas && (
          <Source id="gistda-flood" type="geojson" data={floodAreas} attribution="GISTDA">
            <Layer
              id={FLOOD_FILL_LAYER}
              type="fill"
              beforeId={labelLayerId}
              paint={{ "fill-color": GISTDA_FLOOD_META.fill, "fill-opacity": GISTDA_FLOOD_META.fillOpacity }}
            />
            <Layer
              id="gistda-flood-line"
              type="line"
              beforeId={labelLayerId}
              paint={{
                "line-color": GISTDA_FLOOD_META.line,
                "line-opacity": ["case", ["==", ["get", "ref"], selectedFloodRef], 1, 0.45],
                "line-width": ["case", ["==", ["get", "ref"], selectedFloodRef], 2.5, 0.8],
              }}
            />
          </Source>
        )}

        {areas.features.length > 0 && (
          <Source id="announcement-areas" type="geojson" data={areas}>
            <Layer id="announcement-area-fill" type="fill" paint={{ "fill-color": "#4338ca", "fill-opacity": 0.08 }} />
            <Layer id="announcement-area-line" type="line" paint={{ "line-color": "#4338ca", "line-width": 2, "line-dasharray": [2, 2] }} />
          </Source>
        )}

        {routeLines && (
          <Source id="route" type="geojson" data={routeLines}>
            <Layer
              id="route-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#ffffff", "line-width": ["case", ["get", "selected"], 10, 6] }}
            />
            <Layer
              id="route-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{
                "line-color": ["case", ["get", "selected"], ["get", "color"], "#94a3b8"],
                "line-width": ["case", ["get", "selected"], 6, 3.5],
              }}
            />
          </Source>
        )}

        {!pickMode &&
          cameraClusters.map((c) =>
            c.kind === "cluster" ? (
              <Marker
                key={`cc:${c.key}`}
                latitude={c.latitude}
                longitude={c.longitude}
                anchor="center"
                style={{ zIndex: 1 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  mapRef.current?.flyTo({
                    center: [c.longitude, c.latitude],
                    zoom: Math.min(CLUSTER_MAX_ZOOM, mapRef.current.getZoom() + 2),
                    duration: 500,
                  });
                }}
              >
                <CctvClusterMarker count={c.items.length} label={t("cctvClusterAria", { n: c.items.length })} />
              </Marker>
            ) : (
              <Marker
                key={`cam:${c.key}`}
                latitude={c.item.latitude}
                longitude={c.item.longitude}
                anchor="center"
                style={{ zIndex: c.item.id === selectedCameraId ? 4 : 1 }}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  onSelectCamera(c.item);
                }}
              >
                <CctvMarker selected={c.item.id === selectedCameraId} label={t("cctvMarkerAria", { name: c.item.name })} />
              </Marker>
            ),
          )}

        {!pickMode &&
          places.map((p) => (
            <Marker
              key={`p:${p.id}`}
              latitude={p.latitude}
              longitude={p.longitude}
              anchor="center"
              style={{ zIndex: 2 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectPlace(p);
              }}
            >
              <ImportantPlaceMarker
                place={p}
                selected={selectedLayer?.kind === "place" && selectedLayer.id === p.id}
                label={t("placeAriaLabel", { name: p.name, category: t(`ipCategory.${p.category}`) })}
              />
            </Marker>
          ))}

        {!pickMode &&
          savedPlaces.map((p) => (
            <Marker
              key={`sp:${p.id}`}
              latitude={p.latitude}
              longitude={p.longitude}
              anchor="center"
              style={{ zIndex: 1 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectSavedPlace(p);
              }}
            >
              <SavedPlaceMarker place={p} label={t("savedPlaceAriaLabel", { name: p.name })} />
            </Marker>
          ))}

        {!pickMode &&
          events.map((ev) => (
            <Marker
              key={`ev:${ev.id}`}
              latitude={ev.latitude}
              longitude={ev.longitude}
              anchor="center"
              style={{ zIndex: 2 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectEvent(ev);
              }}
            >
              <EventMarker
                event={ev}
                selected={selectedLayer?.kind === "event" && selectedLayer.id === ev.id}
                label={t("eventAriaLabel", { title: ev.title })}
              />
            </Marker>
          ))}

        {!pickMode &&
          announcements.map((a) => (
            <Marker
              key={`a:${a.id}`}
              latitude={a.latitude!}
              longitude={a.longitude!}
              anchor="center"
              style={{ zIndex: 3 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectAnnouncement(a);
              }}
            >
              <AnnouncementMarker
                announcement={a}
                selected={selectedLayer?.kind === "announcement" && selectedLayer.id === a.id}
                label={t("announcementAriaLabel", { title: a.title })}
              />
            </Marker>
          ))}

        {userLocation && (
          <Marker latitude={userLocation.latitude} longitude={userLocation.longitude} anchor="center">
            <LocationDot />
          </Marker>
        )}

        {pins.map(({ report, recent }) => {
          const selected = report.id === selectedReportId;
          const stale = currentStatus(report, now) !== "active";
          return (
            <Marker
              key={report.id}
              latitude={report.latitude}
              longitude={report.longitude}
              anchor="center"
              style={{ zIndex: selected ? 4 : stale ? 0 : recent ? (severityRank(report.severity) >= 3 ? 3 : 2) : 1 }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (!pickMode) onSelectReport(report);
              }}
            >
              <ReportMarker report={report} selected={selected} now={now} dimmed={pickMode} recent={recent} compact={compact} />
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
