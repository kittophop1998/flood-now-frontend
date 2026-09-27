"use client";

import { useEffect, useRef } from "react";
import Map, { NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type LatLng = { latitude: number; longitude: number };

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Kept in sync with the worker path set up in components/map/map-view.tsx.
setWorkerUrl("/maplibre-gl-worker.js");

// Bare map for the admin coordinate picker: no report/place layers, just a
// camera the operator pans under the fixed center pin the dialog draws on
// top. `flyTarget` is a fresh object each time ("use my location") so the
// camera moves even to the same point twice in a row.
export function CoordinatePickerMap({
  initialCenter,
  flyTarget,
  onMoveEnd,
}: {
  initialCenter: LatLng;
  flyTarget: LatLng | null;
  onMoveEnd: (point: LatLng) => void;
}) {
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTarget) return;
    map.flyTo({ center: [flyTarget.longitude, flyTarget.latitude], zoom: Math.max(map.getZoom(), 15), duration: 600 });
  }, [flyTarget]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{ ...initialCenter, zoom: 14 }}
      onMoveEnd={() => {
        const c = mapRef.current?.getCenter();
        if (c) onMoveEnd({ latitude: c.lat, longitude: c.lng });
      }}
      mapStyle={OPENFREEMAP_STYLE}
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
    </Map>
  );
}
