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

    let cancelled = false;
    const onSuccess = (pos: GeolocationPosition) => {
      if (!cancelled) setState({ status: "granted", latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    };
    const onFinalError = (err: GeolocationPositionError) => {
      if (!cancelled) setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });
    };

    // A high-accuracy (GPS) fix often times out indoors or on desktops with no
    // GPS; fall back to a coarse network/Wi-Fi fix instead of giving up.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) return onFinalError(err);
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 15_000,
          maximumAge: 5 * 60_000,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
