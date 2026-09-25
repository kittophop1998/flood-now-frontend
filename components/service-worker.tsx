"use client";

import { useEffect } from "react";

// Registers public/sw.js (app shell + map tile cache) in production builds.
// Skipped in dev so it never serves stale bundles during development.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is progressive: the app works without it.
    });
  }, []);
  return null;
}
