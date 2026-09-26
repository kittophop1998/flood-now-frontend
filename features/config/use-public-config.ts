"use client";

import { useEffect, useState } from "react";
import { configService } from "@/services/community-service";
import { readCache, writeCache } from "@/lib/offline-cache";
import type { PublicConfig } from "@/types/community";

const CACHE_KEY = "public-config";
const EMPTY: PublicConfig = { donation: null, gistda_flood: false, doh_cctv: false };

// Non-secret runtime config from the API (e.g. whether donations are on).
// Falls back to the last fetched copy offline; anything missing means the
// feature is off — never a half-configured screen.
export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>(() => ({ ...EMPTY, ...readCache<PublicConfig>(CACHE_KEY)?.data }));

  useEffect(() => {
    const controller = new AbortController();
    configService
      .public(controller.signal)
      .then((c) => {
        const next = { donation: c.donation ?? null, gistda_flood: c.gistda_flood === true, doh_cctv: c.doh_cctv === true };
        setConfig(next);
        writeCache(CACHE_KEY, next);
      })
      .catch(() => {
        // Offline, API down or aborted: keep the cached (or empty = features
        // off) config.
      });
    return () => controller.abort();
  }, []);

  return config;
}
