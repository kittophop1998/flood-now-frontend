import { apiClient, toQuery } from "@/services/api-client";
import { bboxParams } from "@/services/reports-service";
import type { BoundingBox, Vehicle } from "@/types/report";
import type {
  Announcement,
  CreateSosInput,
  FloodLayer,
  GistdaPeriod,
  HelperInput,
  HelperProfile,
  ImportantPlace,
  ImportantPlaceCategory,
  ImportantPlaceStatus,
  LatLng,
  NearbySos,
  PublicConfig,
  RouteEvaluation,
  SavedPlace,
  SavedPlaceInput,
  SosRequest,
  SosStatus,
} from "@/types/community";

// Saved places are private to this device: every call carries device_id.
export const savedPlacesService = {
  list: (deviceId: string, signal?: AbortSignal) =>
    apiClient
      .get<{ saved_places: SavedPlace[] }>(`/api/v1/saved-places${toQuery({ device_id: deviceId })}`, signal)
      .then((r) => r.saved_places),
  create: (input: SavedPlaceInput) => apiClient.post<SavedPlace>("/api/v1/saved-places", input),
  update: (id: string, input: SavedPlaceInput) => apiClient.patch<SavedPlace>(`/api/v1/saved-places/${id}`, input),
  remove: (deviceId: string, id: string) =>
    apiClient.delete<void>(`/api/v1/saved-places/${id}${toQuery({ device_id: deviceId })}`),
};

export const routesService = {
  evaluate: (origin: LatLng, destination: LatLng, vehicle: Vehicle, signal?: AbortSignal) =>
    apiClient.post<RouteEvaluation>("/api/v1/routes/evaluate", { origin, destination, vehicle }, signal),
};

export const sosService = {
  create: (input: CreateSosInput) => apiClient.post<SosRequest>("/api/v1/sos", input),
  mine: (deviceId: string, signal?: AbortSignal) =>
    apiClient.get<{ sos: SosRequest[] }>(`/api/v1/sos/mine${toQuery({ device_id: deviceId })}`, signal).then((r) => r.sos),
  get: (deviceId: string, id: string, signal?: AbortSignal) =>
    apiClient.get<SosRequest>(`/api/v1/sos/${id}${toQuery({ device_id: deviceId })}`, signal),
  setStatus: (deviceId: string, id: string, status: SosStatus) =>
    apiClient.post<SosRequest>(`/api/v1/sos/${id}/status`, { device_id: deviceId, status }),
  accept: (deviceId: string, id: string) => apiClient.post<SosRequest>(`/api/v1/sos/${id}/accept`, { device_id: deviceId }),
};

export const helpersService = {
  me: (deviceId: string, signal?: AbortSignal) =>
    apiClient
      .get<{ helper: HelperProfile | null }>(`/api/v1/helpers/me${toQuery({ device_id: deviceId })}`, signal)
      .then((r) => r.helper),
  save: (input: HelperInput) => apiClient.put<{ helper: HelperProfile }>("/api/v1/helpers/me", input).then((r) => r.helper),
  nearbySos: (deviceId: string, at: LatLng, signal?: AbortSignal) =>
    apiClient
      .get<{ sos: NearbySos[] }>(`/api/v1/helpers/sos/nearby${toQuery({ device_id: deviceId, lat: at.latitude, lng: at.longitude })}`, signal)
      .then((r) => r.sos),
};

export const importantPlacesService = {
  list: (
    query: { bbox: BoundingBox; categories?: ImportantPlaceCategory[]; statuses?: ImportantPlaceStatus[] },
    signal?: AbortSignal,
  ) =>
    apiClient.get<{ places: ImportantPlace[]; has_more: boolean }>(
      `/api/v1/important-places${toQuery({ ...bboxParams(query.bbox), categories: query.categories, statuses: query.statuses })}`,
      signal,
    ),
};

export const announcementsService = {
  list: (query: { bbox?: BoundingBox; includeExpired?: boolean } = {}, signal?: AbortSignal) =>
    apiClient
      .get<{ announcements: Announcement[] }>(
        `/api/v1/announcements${toQuery({ ...bboxParams(query.bbox), include_expired: query.includeExpired ? "true" : undefined })}`,
        signal,
      )
      .then((r) => r.announcements),
  get: (id: string) => apiClient.get<Announcement>(`/api/v1/announcements/${id}`),
};

// Official GISTDA flood areas, served (cached) by the API — the browser never
// talks to GISTDA or sees its key.
export const officialFloodService = {
  get: (query: { period: GistdaPeriod; bbox: BoundingBox }, signal?: AbortSignal) =>
    apiClient.get<FloodLayer>(`/api/v1/official/gistda/flood${toQuery({ period: query.period, ...bboxParams(query.bbox) })}`, signal),
};

export const configService = {
  // Non-secret runtime configuration (e.g. whether donations are enabled).
  public: (signal?: AbortSignal) => apiClient.get<PublicConfig>("/api/v1/config/public", signal),
};
