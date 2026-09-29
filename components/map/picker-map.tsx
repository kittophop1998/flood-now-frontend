"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { CenterPin } from "@/components/map/center-pin";
import { MAP_CONTAINER_STYLE, MAP_STYLE_URL } from "@/lib/map-config";
import type { LatLng } from "@/types/community";

// Bare map for choosing a point, with no report/place layers. Used two ways:
// the admin coordinate picker pans it under a fixed center pin its dialog
// draws on top (`onMoveEnd`), and MapLocationPicker drops a draggable pin
// where the user taps (`marker` + `onPick`). `flyTarget` is a fresh object
// each time so the camera moves even to the same point twice in a row.
export function PickerMap({
  initialCenter,
  initialZoom = 14,
  flyTarget,
  onMoveEnd,
  marker,
  onPick,
  onLoad,
  onError,
}: {
  initialCenter: LatLng;
  initialZoom?: number;
  flyTarget: LatLng | null;
  onMoveEnd?: (point: LatLng) => void;
  marker?: LatLng | null;
  onPick?: (point: LatLng) => void;
  onLoad?: () => void;
  onError?: () => void;
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
      initialViewState={{ ...initialCenter, zoom: initialZoom }}
      onMoveEnd={
        onMoveEnd &&
        (() => {
          const c = mapRef.current?.getCenter();
          if (c) onMoveEnd({ latitude: c.lat, longitude: c.lng });
        })
      }
      onClick={onPick && ((e) => onPick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }))}
      onLoad={onLoad}
      onError={onError}
      mapStyle={MAP_STYLE_URL}
      style={MAP_CONTAINER_STYLE}
      attributionControl={false}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
      {marker && (
        <Marker
          latitude={marker.latitude}
          longitude={marker.longitude}
          anchor="bottom"
          draggable={!!onPick}
          onDragEnd={(e) => onPick?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
        >
          <CenterPin />
        </Marker>
      )}
    </Map>
  );
}
