import { apiClient, toQuery } from "@/services/api-client";
import type { AppNotification, CreateFollowInput, Follow } from "@/types/report";

export const followsService = {
  list: (deviceId: string) =>
    apiClient.get<{ follows: Follow[] }>(`/api/v1/follows${toQuery({ device_id: deviceId })}`).then((r) => r.follows),

  create: (input: CreateFollowInput) => apiClient.post<Follow>("/api/v1/follows", input),

  remove: (deviceId: string, id: string) =>
    apiClient.delete<void>(`/api/v1/follows/${id}${toQuery({ device_id: deviceId })}`),

  // In-app notification feed for the device's follows. Pull-based: there is
  // no push delivery yet (see docs/api-spec.md).
  notifications: (deviceId: string, since?: string, signal?: AbortSignal) =>
    apiClient
      .get<{ notifications: AppNotification[] }>(`/api/v1/notifications${toQuery({ device_id: deviceId, since })}`, signal)
      .then((r) => r.notifications),
};
