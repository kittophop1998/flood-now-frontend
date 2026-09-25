"use client";

import { useCallback, useEffect, useState } from "react";

export type GeolocationState =
  | { status: "loading" }
  | { status: "granted"; latitude: number; longitude: number }
  | { status: "denied" | "unavailable" };

// Bangkok — a reasonable default center when location isn't available.
export const DEFAULT_CENTER = { latitude: 13.7563, longitude: 100.5018 };

function requestPosition(onDone: (state: GeolocationState) => void) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onDone({ status: "unavailable" });
    return;
  }
  const onSuccess = (pos: GeolocationPosition) =>
    onDone({ status: "granted", latitude: pos.coords.latitude, longitude: pos.coords.longitude });
  const onFinalError = (err: GeolocationPositionError) =>
    onDone({ status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" });

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
}

// Current device position plus `locate()` to ask again (e.g. "use my
// location" after GPS was unavailable). It resolves with the new state so the
// caller can act on it immediately.
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    requestPosition((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const locate = useCallback(
    () =>
      new Promise<GeolocationState>((resolve) => {
        requestPosition((next) => {
          setState(next);
          resolve(next);
        });
      }),
    [],
  );

  return { geo: state, locate };
}
