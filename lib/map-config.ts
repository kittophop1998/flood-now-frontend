import { setWorkerUrl } from "maplibre-gl";

// Shared base-map settings for every MapLibre map in the app
// (components/map/map-view.tsx, components/map/picker-map.tsx).
// Change the basemap look here and it applies everywhere.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" } as const;

// Turbopack can't statically resolve maplibre-gl's internal
// `new URL(`./${file}`, import.meta.url)` worker lookup, so the map silently
// fails to render ("Worker failed to load"). Point it at a self-hosted copy
// instead (kept in sync with the maplibre-gl version in package.json).
setWorkerUrl("/maplibre-gl-worker.js");
