"use client";

import { useEffect, useState } from "react";
import { configService } from "@/services/community-service";
import { readCache, writeCache } from "@/lib/offline-cache";
import type { PublicConfig } from "@/types/community";

const CACHE_KEY = "public-config";
const EMPTY: PublicConfig = { donation: null };

// Non-secret runtime config from the API (e.g. whether donations are on).
// Falls back to the last fetched copy offline; anything missing means the
// feature is off — never a half-configured screen.
export function usePublicConfig(): PublicConfig {
  const [config, setConfig] = useState<PublicConfig>(() => readCache<PublicConfig>(CACHE_KEY)?.data ?? EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    configService
      .public(controller.signal)
      .then((c) => {
        const next = { donation: c.donation ?? null };
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
