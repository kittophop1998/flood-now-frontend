"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { AttributionControl, Layer, Marker, NavigationControl, Source, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ClusterMarker, ReportMarker } from "@/components/map/report-marker";
import { AnnouncementMarker, ImportantPlaceMarker, ZoneMarker } from "@/components/map/overlay-markers";
import { LocationDot } from "@/components/map/location-dot";
import { CenterPin } from "@/components/map/center-pin";
import { clusterPoints, CLUSTER_MAX_ZOOM } from "@/lib/cluster";
import { GISTDA_FLOOD_META, ROUTE_RISK_META } from "@/lib/community-meta";
import { circleRing } from "@/lib/distance";
import { severityRank } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import { useNow } from "@/features/common/use-now";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Viewport } from "@/features/reports/use-viewport-reports";
import type { AggregateCell, Report } from "@/types/report";
import type { Announcement, EvaluatedRoute, FloodAreaCollection, ImportantPlace } from "@/types/community";

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
  // Zoomed-out map: aggregated cells instead of report markers.
  cells: AggregateCell[];
  places: ImportantPlace[];
  announcements: Announcement[];
  // Official GISTDA flood areas, drawn under every marker; null = layer off
  // (pass an empty collection while it loads so the layer stays mounted).
  floodAreas: FloodAreaCollection | null;
  selectedLayer: LayerSelection;
  onSelectPlace: (place: ImportantPlace) => void;
  onSelectAnnouncement: (a: Announcement) => void;
  route: RouteOverlay | null;
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
  cells,
  places,
  announcements,
  floodAreas,
  selectedLayer,
  onSelectPlace,
  onSelectAnnouncement,
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
    mapRef.current?.easeTo({ padding: { top: 0, left: 0, right: 0, bottom: padBottom }, duration: 300 });
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

  // Server cells are sized per integer zoom; at fractional zooms neighbours
  // can touch, so overlapping zones merge (summed counts, worst severity).
  const zones = useMemo(() => {
    const merged = clusterPoints(
      cells.map((c, i) => ({ ...c, id: `z${i}` })),
      Math.min(zoom, CLUSTER_MAX_ZOOM - 1),
    );
    return merged.map((m): AggregateCell & { key: string } => {
      if (m.kind === "point") return { ...m.item, key: m.key };
      const worst = m.items.reduce((a, b) => (severityRank(b.max_severity) > severityRank(a.max_severity) ? b : a));
      return {
        key: m.key,
        latitude: m.latitude,
        longitude: m.longitude,
        count: m.items.reduce((n, c) => n + c.count, 0),
        severe_count: m.items.reduce((n, c) => n + c.severe_count, 0),
        max_severity: worst.max_severity,
        latest_update_at: m.items.map((c) => c.latest_update_at).sort().at(-1)!,
      };
    });
  }, [cells, zoom]);

  const heat = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: cells.map((c) => ({
        type: "Feature" as const,
        properties: { w: c.count * severityRank(c.max_severity) },
        geometry: { type: "Point" as const, coordinates: [c.longitude, c.latitude] },
      })),
    }),
    [cells],
  );

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
        mapStyle={OPENFREEMAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <AttributionControl position="bottom-left" compact />
        <NavigationControl position="bottom-right" showCompass={false} />

        {cells.length > 0 && (
          <Source id="report-heat" type="geojson" data={heat}>
            <Layer
              id="report-heat"
              type="heatmap"
              paint={{
                "heatmap-weight": ["interpolate", ["linear"], ["get", "w"], 0, 0, 40, 1],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 11, 2.5],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 10, 11, 45],
                "heatmap-opacity": 0.55,
                "heatmap-color": [
                  "interpolate",
                  ["linear"],
                  ["heatmap-density"],
                  0, "rgba(14,165,233,0)",
                  0.25, "rgba(14,165,233,0.55)",
                  0.55, "rgba(245,158,11,0.75)",
                  0.85, "rgba(220,38,38,0.85)",
                ],
              }}
            />
          </Source>
        )}

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

        {zones.map((cell) => (
          <Marker
            key={cell.key}
            latitude={cell.latitude}
            longitude={cell.longitude}
            anchor="center"
            style={{ zIndex: 1 }}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              if (pickMode) return;
              mapRef.current?.flyTo({ center: [cell.longitude, cell.latitude], zoom: Math.min(15, mapRef.current.getZoom() + 2.5), duration: 600 });
            }}
          >
            <ZoneMarker cell={cell} label={t("zoneAriaLabel", { n: cell.count })} />
          </Marker>
        ))}

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
              style={{ zIndex: selected ? 4 : currentStatus(report, now) !== "active" ? 0 : severityRank(report.severity) >= 3 ? 2 : 1 }}
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
