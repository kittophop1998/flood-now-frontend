// Mirrors docs/api-spec.md. Keep in sync with the API contract by hand —
// this is the single place the frontend defines "what a report looks like."

export const REPORT_TYPES = [
  "flooded",
  "road_closed",
  "accident",
  "vehicle_stalled",
  "obstruction",
  "power_outage",
  "help_needed",
  "shelter",
  "aid_point",
  "other",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

// Categories a NEW report may use (the API rejects the rest). REPORT_TYPES
// stays the full set because stored reports can still carry
// vehicle_stalled / help_needed / other; someone who needs assistance now
// uses the SOS flow instead.
export const CREATABLE_REPORT_TYPES = [
  "flooded",
  "road_closed",
  "accident",
  "obstruction",
  "power_outage",
  "shelter",
  "aid_point",
] as const satisfies readonly ReportType[];
export type CreatableReportType = (typeof CREATABLE_REPORT_TYPES)[number];

export const SEVERITIES = ["low", "moderate", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const WATER_DEPTHS = ["unknown", "ankle", "shin", "knee", "above_knee"] as const;
export type WaterDepth = (typeof WATER_DEPTHS)[number];

export const PASS_LEVELS = ["passable", "caution", "not_recommended", "impassable", "unknown"] as const;
export type PassLevel = (typeof PASS_LEVELS)[number];

export const VEHICLES = ["walk", "motorcycle", "sedan", "suv_pickup"] as const;
export type Vehicle = (typeof VEHICLES)[number];
export type Passability = Record<Vehicle, PassLevel>;

export const REPORT_STATUSES = ["active", "possibly_stale", "resolved", "expired"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CONFIRMATION_STATUSES = ["still_active", "cleared"] as const;
export type ConfirmationStatus = (typeof CONFIRMATION_STATUSES)[number];

export type GeometryType = "point" | "road_segment" | "area";

export interface Report {
  id: string;
  type: ReportType;
  severity: Severity;
  status: ReportStatus;
  latitude: number;
  longitude: number;
  geometry_type: GeometryType;
  water_depth: WaterDepth | null;
  water_level_cm: number | null;
  passability: Passability | null;
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
  stale_at: string;
  expires_at: string;
  resolved_at: string | null;
  is_expired: boolean;
  still_active_count: number;
  cleared_count: number;
  // Present only on location-based responses (nearby, duplicates).
  distance_m?: number;
}

export interface CreateReportInput {
  type: ReportType;
  severity: Severity;
  latitude: number;
  longitude: number;
  water_depth?: WaterDepth | null;
  passability?: Passability | null;
  description?: string | null;
  image_key?: string | null;
  people_count?: number | null;
  has_child?: boolean | null;
  has_elderly?: boolean | null;
  contact_phone?: string | null;
  // Idempotency key for the offline queue: re-sending returns the original.
  client_id?: string | null;
}

// What someone on the spot says has changed, sent with a still_active
// confirmation. Omitted fields stay as they are; fields that don't apply to
// the report's category are dropped by the API.
export interface ConditionUpdate {
  severity?: Severity;
  water_depth?: WaterDepth;
  passability?: Passability;
  image_key?: string;
}

export interface ConfirmReportInput extends ConditionUpdate {
  device_id: string;
  status: ConfirmationStatus;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ListReportsQuery {
  bbox?: BoundingBox;
  types?: ReportType[];
  severities?: Severity[];
  statuses?: ReportStatus[];
  updatedSince?: string;
  limit?: number;
}

export interface ListReportsResult {
  reports: Report[];
  has_more: boolean;
}

export const NEARBY_SORTS = ["distance", "recent", "severity"] as const;
export type NearbySort = (typeof NEARBY_SORTS)[number];

export interface NearbyQuery {
  latitude: number;
  longitude: number;
  radiusM?: number;
  types?: ReportType[];
  sort?: NearbySort;
  limit?: number;
}

export type FollowKind = "area" | "report";

export interface Follow {
  id: string;
  kind: FollowKind;
  report_id: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_m: number | null;
  created_at: string;
}

export type CreateFollowInput =
  | { device_id: string; kind: "report"; report_id: string }
  | { device_id: string; kind: "area"; latitude: number; longitude: number; radius_m: number };

export const NOTIFICATION_KINDS = ["severe_nearby", "updated", "confirmed", "resolved", "reopened"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  created_at: string;
  follow_id: string;
  report: Report;
}

// Zoomed-out map: open reports grouped into grid cells (GET /reports/aggregate).
export interface AggregateCell {
  latitude: number;
  longitude: number;
  count: number;
  severe_count: number;
  max_severity: Severity;
  latest_update_at: string;
}

export interface AggregateResult {
  cells: AggregateCell[];
  cell_size_deg: number;
  total: number;
}

export const PROBLEM_REASONS = [
  "false_information",
  "wrong_location",
  "duplicate",
  "outdated",
  "inappropriate_image",
  "spam",
  "privacy",
  "other",
] as const;
export type ProblemReason = (typeof PROBLEM_REASONS)[number];

export interface ProblemReportInput {
  device_id: string;
  reason: ProblemReason;
  details?: string | null;
}

export interface Place {
  name: string;
  display_name: string;
  latitude: number;
  longitude: number;
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
