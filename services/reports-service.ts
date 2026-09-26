import { apiClient, toQuery } from "@/services/api-client";
import type {
  AggregateResult,
  BoundingBox,
  ConfirmReportInput,
  CreateReportInput,
  ListReportsQuery,
  ListReportsResult,
  NearbyQuery,
  ProblemReportInput,
  Report,
  ReportType,
} from "@/types/report";

function bboxParams(bbox?: BoundingBox) {
  if (!bbox) return {};
  return { min_lat: bbox.minLat, max_lat: bbox.maxLat, min_lng: bbox.minLng, max_lng: bbox.maxLng };
}

export const reportsService = {
  list: (query: ListReportsQuery = {}, signal?: AbortSignal) =>
    apiClient.get<ListReportsResult>(
      `/api/v1/reports${toQuery({
        ...bboxParams(query.bbox),
        types: query.types,
        severities: query.severities,
        statuses: query.statuses,
        updated_since: query.updatedSince,
        limit: query.limit,
      })}`,
      signal,
    ),

  // Zoomed-out map: reports grouped into grid cells sized for `zoom`.
  aggregate: (query: Omit<ListReportsQuery, "limit" | "updatedSince"> & { bbox: BoundingBox; zoom: number }, signal?: AbortSignal) =>
    apiClient.get<AggregateResult>(
      `/api/v1/reports/aggregate${toQuery({
        ...bboxParams(query.bbox),
        zoom: Math.max(0, Math.min(16, Math.floor(query.zoom))),
        types: query.types,
        severities: query.severities,
        statuses: query.statuses,
      })}`,
      signal,
    ),

  nearby: (query: NearbyQuery, signal?: AbortSignal) =>
    apiClient
      .get<{ reports: Report[] }>(
        `/api/v1/reports/nearby${toQuery({
          lat: query.latitude,
          lng: query.longitude,
          radius_m: query.radiusM,
          types: query.types,
          sort: query.sort,
          limit: query.limit,
        })}`,
        signal,
      )
      .then((r) => r.reports),

  // Open reports of the same category close enough to be the same incident;
  // the radius is decided server-side per category.
  duplicates: (latitude: number, longitude: number, type: ReportType, signal?: AbortSignal) =>
    apiClient
      .get<{ reports: Report[] }>(`/api/v1/reports/duplicates${toQuery({ lat: latitude, lng: longitude, type })}`, signal)
      .then((r) => r.reports),

  get: (id: string) => apiClient.get<Report>(`/api/v1/reports/${id}`),

  create: (input: CreateReportInput) => apiClient.post<Report>("/api/v1/reports", input),

  confirm: (id: string, input: ConfirmReportInput) =>
    apiClient.post<Report>(`/api/v1/reports/${id}/confirmations`, input),

  // "Report a problem" with an incident (moderation).
  reportProblem: (id: string, input: ProblemReportInput) =>
    apiClient.post<{ id: string; status: string }>(`/api/v1/reports/${id}/problems`, input),
};

export { bboxParams };
