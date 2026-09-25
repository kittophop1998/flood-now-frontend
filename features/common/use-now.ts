"use client";

import { useEffect, useState } from "react";

// Current time, refreshed periodically so "8 min ago" labels and
// active → possibly stale transitions update without a refetch.
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
