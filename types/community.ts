// Mirrors docs/api-spec.md for saved places, safe routes, SOS/helpers,
// important places, announcements, moderation and public config. Keep in
// sync with the API contract by hand, like types/report.ts.
import type { Report, Severity, Vehicle } from "@/types/report";

export type LatLng = { latitude: number; longitude: number };

// --- Saved places / watch areas ---

export const PLACE_ICONS = ["home", "work", "family", "custom"] as const;
export type PlaceIcon = (typeof PLACE_ICONS)[number];

export const WATCH_RADII_M = [1000, 3000, 5000] as const;

export type AreaLevel = "clear" | "caution" | "severe";

export interface SavedPlace {
  id: string;
  name: string;
  icon: PlaceIcon;
  latitude: number;
  longitude: number;
  watch_radius_m: number;
  preferred_vehicle: Vehicle | null;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
  area: {
    level: AreaLevel;
    active_count: number;
    severe_count: number;
    latest_update_at: string | null;
  };
}

export interface SavedPlaceInput {
  device_id: string;
  name?: string;
  icon?: PlaceIcon;
  latitude?: number;
  longitude?: number;
  watch_radius_m?: number;
  // "" clears it on update.
  preferred_vehicle?: Vehicle | "";
  notification_enabled?: boolean;
}

// --- Safe route ---

export type RouteRisk = "safe" | "caution" | "blocked";
export type RouteImpact = "blocked" | "caution" | "info";
export type RouteReason =
  | "impassable_for_vehicle"
  | "not_recommended_for_vehicle"
  | "caution_for_vehicle"
  | "possibly_outdated"
  | "severe_unknown_access"
  | "road_closed"
  | "passable_for_vehicle"
  | "nearby_incident";

export interface RouteIncident {
  report: Report;
  distance_from_route_m: number;
  impact: RouteImpact;
  reason: RouteReason;
}

export interface EvaluatedRoute {
  distance_m: number;
  duration_s: number;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  risk: RouteRisk;
  incident_count: number;
  blocking_count: number;
  caution_count: number;
  incidents: RouteIncident[];
}

export interface RouteEvaluation {
  vehicle: Vehicle;
  evaluated_at: string;
  data_complete: boolean;
  routes: EvaluatedRoute[];
}

// --- SOS / helpers ---

export const SOS_TYPES = [
  "trapped",
  "elderly_or_patient",
  "vehicle_stalled",
  "need_boat",
  "need_high_vehicle",
  "need_food_water",
  "need_shelter",
  "other",
] as const;
export type SosType = (typeof SOS_TYPES)[number];

export const SOS_STATUSES = ["waiting", "matched", "on_the_way", "arrived", "completed", "cancelled"] as const;
export type SosStatus = (typeof SOS_STATUSES)[number];

export const CAPABILITIES = [
  "high_vehicle",
  "boat",
  "first_aid",
  "food_water",
  "vehicle_repair",
  "towing",
  "shelter",
  "other",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const HELPER_RADII_M = [1000, 3000, 5000, 10000] as const;

export interface SosEvent {
  status: SosStatus;
  actor: "requester" | "helper";
  created_at: string;
}

export interface SosRequest {
  id: string;
  role: "requester" | "helper";
  type: SosType;
  description: string | null;
  latitude: number;
  longitude: number;
  people_count: number | null;
  contact_phone: string | null;
  status: SosStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  events: SosEvent[];
  helper: { display_name: string | null; contact_phone: string | null; capabilities: Capability[] } | null;
  nearby_helper_count: number | null;
}

export interface CreateSosInput {
  device_id: string;
  client_id: string;
  type: SosType;
  description?: string | null;
  latitude: number;
  longitude: number;
  people_count?: number | null;
  contact_phone?: string | null;
}

// Redacted view for helpers browsing: rounded location, no contact.
export interface NearbySos {
  id: string;
  type: SosType;
  description: string | null;
  approx_latitude: number;
  approx_longitude: number;
  distance_m: number;
  people_count: number | null;
  created_at: string;
  required_capabilities: Capability[];
}

export interface HelperProfile {
  active: boolean;
  capabilities: Capability[];
  radius_m: number;
  display_name: string | null;
  contact_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  location_at: string | null;
  updated_at: string;
}

export interface HelperInput {
  device_id: string;
  active: boolean;
  capabilities: Capability[];
  radius_m: number;
  display_name?: string | null;
  contact_phone?: string | null;
  latitude?: number;
  longitude?: number;
}

// --- Important places ---

export const IMPORTANT_PLACE_CATEGORIES = [
  "hospital",
  "shelter",
  "food_water",
  "rescue",
  "police",
  "fuel",
  "vehicle_repair",
  "boat_point",
  "other",
] as const;
export type ImportantPlaceCategory = (typeof IMPORTANT_PLACE_CATEGORIES)[number];

export const IMPORTANT_PLACE_STATUSES = ["open", "closed", "full", "unknown"] as const;
export type ImportantPlaceStatus = (typeof IMPORTANT_PLACE_STATUSES)[number];

export interface ImportantPlace {
  id: string;
  name: string;
  category: ImportantPlaceCategory;
  latitude: number;
  longitude: number;
  address: string | null;
  status: ImportantPlaceStatus;
  description: string | null;
  contact: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export type ImportantPlaceInput = Partial<Omit<ImportantPlace, "id" | "created_at" | "updated_at">>;

// --- Official announcements ---

export const ANNOUNCEMENT_TYPES = [
  "flood_warning",
  "evacuation",
  "road_closure",
  "water_release",
  "weather",
  "shelter_info",
  "general",
] as const;
export type AnnouncementType = (typeof ANNOUNCEMENT_TYPES)[number];

export type AnnouncementStatus = "draft" | "scheduled" | "active" | "expired";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  severity: Severity;
  source_name: string;
  source_url: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_m: number | null;
  starts_at: string;
  ends_at: string | null;
  status: AnnouncementStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementInput {
  title?: string;
  body?: string;
  type?: AnnouncementType;
  severity?: Severity;
  source_name?: string;
  source_url?: string;
  latitude?: number;
  longitude?: number;
  radius_m?: number;
  clear_location?: boolean;
  starts_at?: string;
  ends_at?: string;
  clear_ends_at?: boolean;
  publish?: boolean;
}

// --- Moderation (admin) ---

export interface ModerationItem {
  report: Report & { hidden_at: string | null; hidden_reason: "auto_threshold" | "admin" | null };
  complaint_count: number;
  reasons: Partial<Record<string, number>>;
  latest_at: string;
  complaints: { id: string; reason: string; details: string | null; created_at: string }[];
  events: { kind: string; created_at: string }[];
}

export type ModerationAction = "dismiss" | "hide" | "unhide";

// --- Public config ---

export interface DonationConfig {
  promptpay_id: string;
  id_type: "phone" | "national_id" | "ewallet";
  recipient_name: string | null;
}

export interface PublicConfig {
  donation: DonationConfig | null;
  // True when the official GISTDA flood layer is configured on the API.
  gistda_flood: boolean;
}

// --- Official GISTDA flood layer (GET /official/gistda/flood) ---

export const GISTDA_PERIODS = ["1d", "3d", "7d", "30d"] as const;
export type GistdaPeriod = (typeof GISTDA_PERIODS)[number];

export interface FloodAreaProperties {
  // Index of the area in the server's snapshot, stable while fetched_at is.
  ref: number;
  id?: string;
  observed_at?: string;
}

export interface FloodAreaCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "MultiPolygon"; coordinates: [number, number][][][] };
    properties: FloodAreaProperties;
  }[];
}

export interface FloodLayer {
  source: "GISTDA";
  period: GistdaPeriod;
  observed_at: string | null;
  fetched_at: string;
  // The provider was unreachable and this is the server's last good copy.
  stale: boolean;
  source_url: string;
  has_more: boolean;
  areas: FloodAreaCollection;
}
