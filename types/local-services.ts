// Mirrors docs/api-spec.md#local-services: commercial service providers,
// service requests, offers, jobs and the provider credit wallet. A separate
// domain from SOS/helpers (types/community.ts) — never mix the two.

export const SERVICE_CATEGORIES = [
  "towing",
  "auto_repair",
  "tyre",
  "battery",
  "mobile_mechanic",
  "transport",
  "electrician",
  "plumber",
  "water_pump",
  "other",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_RADII_M = [3000, 5000, 10000, 20000, 50000] as const;

export const SERVICE_REQUEST_STATUSES = [
  "open",
  "pending_provider_confirmation",
  "matched",
  "on_the_way",
  "arrived",
  "completed",
  "cancelled",
  "expired",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export type OfferStatus = "pending" | "selected" | "accepted" | "rejected" | "expired";

export const CANCEL_REASONS = [
  "changed_mind",
  "found_other",
  "no_response",
  "unable_to_contact",
  "provider_unavailable",
  "customer_unreachable",
  "other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const ISSUE_REASONS = ["no_response", "unable_to_contact", "no_show", "price_dispute", "safety", "other"] as const;
export type IssueReason = (typeof ISSUE_REASONS)[number];

// Public view of a provider: no phone/LINE, only an approximate base point.
export interface ServiceProvider {
  id: string;
  display_name: string;
  categories: ServiceCategory[];
  description: string | null;
  location_name: string | null;
  approx_latitude: number;
  approx_longitude: number;
  service_radius_m: number;
  business_hours: string | null;
  mobile_service: boolean;
  available: boolean;
  // Only when the provider set one; never invented.
  starting_price_thb: number | null;
  logo_url: string | null;
  // Set by an operator after a real review — never bought.
  verified: boolean;
  distance_m: number | null;
}

// The owner's own profile (GET/PUT /provider/me).
export interface MyProvider {
  id: string;
  display_name: string;
  categories: ServiceCategory[];
  description: string | null;
  phone: string;
  line_id: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  service_radius_m: number;
  business_hours: string | null;
  mobile_service: boolean;
  available: boolean;
  starting_price_thb: number | null;
  logo_key: string | null;
  logo_url: string | null;
  verified: boolean;
  status: "active" | "suspended";
  credit_balance: number;
  low_credit: boolean;
  summary?: { nearby_open: number; offers_pending: number; active_jobs: number; completed_jobs: number };
  created_at: string;
  updated_at: string;
}

export interface ProviderInput {
  display_name: string;
  categories: ServiceCategory[];
  description: string | null;
  phone: string;
  line_id: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  service_radius_m: number;
  business_hours: string | null;
  mobile_service: boolean;
  available: boolean;
  starting_price_thb: number | null;
  logo_key: string | null;
}

export interface OfferBrief {
  id: string;
  status: OfferStatus;
  // null = assessed on site ("ประเมินหน้างาน").
  price_thb: number | null;
  eta_minutes: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerOffer extends OfferBrief {
  distance_m: number;
  provider: ServiceProvider;
}

export interface RequestEvent {
  status: ServiceRequestStatus;
  actor: "customer" | "provider" | "system";
  note: string | null;
  created_at: string;
}

export interface ServiceMatch {
  id: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  started_travel_at: string | null;
  closed_at: string | null;
  cancelled_by: "customer" | "provider" | null;
  cancel_reason: string | null;
  // Provider view only.
  fee_credits?: number;
  fee_waived?: boolean;
}

// A request as one of its parties sees it (customer, or the matched provider).
export interface ServiceRequest {
  id: string;
  role: "customer" | "provider";
  category: ServiceCategory;
  description: string | null;
  vehicle_info: string | null;
  image_key: string | null;
  image_url: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  contact_phone: string;
  status: ServiceRequestStatus;
  selected_offer_id: string | null;
  selection_expires_at: string | null;
  expires_at: string;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  events: RequestEvent[];
  offers: CustomerOffer[];
  match: ServiceMatch | null;
  agreed_offer: OfferBrief | null;
  // Customer view, after a match only.
  provider: {
    id: string;
    display_name: string;
    phone: string;
    line_id: string | null;
    latitude: number;
    longitude: number;
    location_name: string | null;
    verified: boolean;
    logo_url: string | null;
  } | null;
  // Provider view, after a match only.
  customer: { display_name: string; contact_phone: string } | null;
  refund_until: string | null;
}

export interface CreateServiceRequestInput {
  client_id: string;
  category: ServiceCategory;
  description: string | null;
  vehicle_info: string | null;
  image_key: string | null;
  latitude: number;
  longitude: number;
  location_name: string | null;
  contact_phone: string;
}

// A request as a provider sees it before a match: approximate area only.
export interface RedactedRequest {
  id: string;
  category: ServiceCategory;
  description: string | null;
  vehicle_info: string | null;
  image_url: string | null;
  approx_latitude: number;
  approx_longitude: number;
  distance_m: number;
  status: ServiceRequestStatus;
  selection_expires_at: string | null;
  expires_at: string;
  created_at: string;
  my_offer?: OfferBrief | null;
}

export interface ProviderOffer extends OfferBrief {
  request: RedactedRequest;
}

export interface OfferInput {
  price_thb: number | null;
  eta_minutes: number;
  note: string | null;
}

export interface ProviderJob {
  match: ServiceMatch;
  offer: OfferBrief;
  // Exact point/location only while the match is active or completed.
  request: RedactedRequest & { latitude?: number; longitude?: number; location_name?: string | null };
  customer: { display_name: string; contact_phone: string } | null;
}

export type CreditTxType = "welcome_credit" | "top_up" | "match_fee" | "refund" | "admin_adjustment";

export interface CreditTransaction {
  id: number;
  type: CreditTxType;
  amount: number;
  balance_after: number;
  match_id: string | null;
  topup_id: string | null;
  note: string | null;
  created_at: string;
}

export type TopupStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

export interface Topup {
  id: string;
  package_id: string;
  amount_thb: number;
  credit_amount: number;
  status: TopupStatus;
  paid_at: string | null;
  created_at: string;
}

export interface TopupPackage {
  id: string;
  thb: number;
  credits: number;
}

export interface Wallet {
  balance: number;
  low_credit: boolean;
  match_fee: number;
  credit_enabled: boolean;
  topup_enabled: boolean;
  packages: TopupPackage[];
  transactions: CreditTransaction[];
  topups: Topup[];
}

// GET /config/public → local_services (null when the feature is off).
export interface LocalServicesConfig {
  credit_enabled: boolean;
  topup_enabled: boolean;
  match_fee: number;
  confirm_timeout_seconds: number;
  refund_grace_seconds: number;
}
