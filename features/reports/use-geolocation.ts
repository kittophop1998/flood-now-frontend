"use client";

import { useEffect, useState } from "react";

export type GeolocationState =
  | { status: "loading" }
  | { status: "granted"; latitude: number; longitude: number }
  | { status: "denied" | "unavailable" };

// Bangkok — a reasonable default center when location isn't available.
export const DEFAULT_CENTER = { latitude: 13.7563, longitude: 100.5018 };

export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<GeolocationState>({ status: "loading" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: "granted", latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  return state;
}
