"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { followsService } from "@/services/follows-service";
import { ApiError, isAbortError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import {
  readLastRead,
  readNotificationPrefs,
  writeLastRead,
  writeNotificationPrefs,
  type NotificationPrefs,
} from "@/lib/notification-prefs";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { AppNotification, Follow } from "@/types/report";

const POLL_INTERVAL_MS = 60_000;

export function isUnread(n: AppNotification, lastRead: string | null): boolean {
  return !lastRead || Date.parse(n.created_at) > Date.parse(lastRead);
}

// Follows + the in-app notification feed for this device. Delivery is
// pull-based while the app is open; there is no push yet.
export function useAlerts() {
  const { t } = useTranslation();
  const [follows, setFollows] = useState<Follow[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [feedStatus, setFeedStatus] = useState<"loading" | "ready" | "error">("loading");
  const [prefs, setPrefsState] = useState<NotificationPrefs>(() => readNotificationPrefs());
  const [lastRead, setLastRead] = useState<string | null>(() => readLastRead());
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFollows = useCallback(async () => {
    try {
      setFollows(await followsService.list(getDeviceId()));
    } catch {
      // The feed request below surfaces connectivity problems.
    }
  }, []);

  const loadFeed = useCallback(async (signal?: AbortSignal) => {
    try {
      setNotifications(await followsService.notifications(getDeviceId(), undefined, signal));
      setFeedStatus("ready");
    } catch (err) {
      if (!isAbortError(err)) setFeedStatus("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadFollows();
    loadFeed(controller.signal);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadFeed();
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadFollows, loadFeed]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionError(null);
      try {
        await action();
        await Promise.all([loadFollows(), loadFeed()]);
        return true;
      } catch (err) {
        setActionError(err instanceof ApiError && err.status !== 0 ? err.message : t("followFailed"));
        return false;
      }
    },
    [loadFollows, loadFeed, t],
  );

  const followArea = useCallback(
    (latitude: number, longitude: number, radiusM: number) =>
      run(() => followsService.create({ device_id: getDeviceId(), kind: "area", latitude, longitude, radius_m: radiusM })),
    [run],
  );
  const followReport = useCallback(
    (reportId: string) => run(() => followsService.create({ device_id: getDeviceId(), kind: "report", report_id: reportId })),
    [run],
  );
  const unfollow = useCallback((id: string) => run(() => followsService.remove(getDeviceId(), id)), [run]);

  const setPrefs = useCallback((next: NotificationPrefs) => {
    setPrefsState(next);
    writeNotificationPrefs(next);
  }, []);

  const visible = useMemo(() => notifications.filter((n) => prefs[n.kind]), [notifications, prefs]);
  const unreadCount = useMemo(() => visible.filter((n) => isUnread(n, lastRead)).length, [visible, lastRead]);

  const markAllRead = useCallback(() => {
    const newest = visible[0]?.created_at;
    if (!newest || (lastRead && Date.parse(newest) <= Date.parse(lastRead))) return;
    setLastRead(newest);
    writeLastRead(newest);
  }, [visible, lastRead]);

  return {
    follows,
    notifications: visible,
    feedStatus,
    unreadCount,
    lastRead,
    prefs,
    setPrefs,
    followArea,
    followReport,
    unfollow,
    markAllRead,
    actionError,
    reloadFeed: () => loadFeed(),
  };
}

export type AlertsApi = ReturnType<typeof useAlerts>;
