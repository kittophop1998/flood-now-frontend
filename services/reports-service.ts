import { apiClient } from "@/services/api-client";
import type {
  BoundingBox,
  ConfirmReportInput,
  CreateReportInput,
  Report,
} from "@/types/report";

function bboxQuery(bbox?: BoundingBox): string {
  if (!bbox) return "";
  const params = new URLSearchParams({
    min_lat: String(bbox.minLat),
    max_lat: String(bbox.maxLat),
    min_lng: String(bbox.minLng),
    max_lng: String(bbox.maxLng),
  });
  return `?${params.toString()}`;
}

export const reportsService = {
  list: (bbox?: BoundingBox) =>
    apiClient.get<{ reports: Report[] }>(`/api/v1/reports${bboxQuery(bbox)}`).then((r) => r.reports),

  get: (id: string) => apiClient.get<Report>(`/api/v1/reports/${id}`),

  create: (input: CreateReportInput) => apiClient.post<Report>("/api/v1/reports", input),

  confirm: (id: string, input: ConfirmReportInput) =>
    apiClient.post<Report>(`/api/v1/reports/${id}/confirmations`, input),
};
