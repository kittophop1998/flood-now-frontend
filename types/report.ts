// Mirrors docs/api-spec.md. Keep in sync with the API contract by hand —
// this is the single place the frontend defines "what a report looks like."

export const REPORT_TYPES = [
  "flooded",
  "road_blocked",
  "vehicle_stalled",
  "help_needed",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const SEVERITIES = [
  "passable",
  "caution",
  "small_vehicle_not_recommended",
  "impassable",
] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIRMATION_STATUSES = ["still_active", "cleared"] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];

export interface Report {
  id: string;
  type: ReportType;
  severity: Severity;
  latitude: number;
  longitude: number;
  water_level_cm: number | null;
  description: string | null;
  image_key: string | null;
  image_url: string | null;
  people_count: number | null;
  has_child: boolean | null;
  has_elderly: boolean | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  last_verified_at: string;
  expires_at: string;
  is_expired: boolean;
  still_active_count: number;
  cleared_count: number;
}

export interface CreateReportInput {
  type: ReportType;
  severity: Severity;
  latitude: number;
  longitude: number;
  water_level_cm?: number | null;
  description?: string | null;
  image_key?: string | null;
  people_count?: number | null;
  has_child?: boolean | null;
  has_elderly?: boolean | null;
  contact_phone?: string | null;
}

export interface ConfirmReportInput {
  device_id: string;
  status: ConfirmationStatus;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface PresignUploadInput {
  content_type: string;
  content_length: number;
}

export interface PresignUploadResult {
  object_key: string;
  upload_url: string;
  expires_in: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}
