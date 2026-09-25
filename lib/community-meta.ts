// Presentation for saved places, safe routes, SOS/helpers, important places
// and announcements — the counterpart of lib/report-meta.ts for these
// features, sharing its tone scale so the same meaning always looks the
// same (teal ok / amber caution / red danger), always with an icon + label.
import {
  Anchor,
  Briefcase,
  CircleCheck,
  CircleX,
  Clock,
  CloudRain,
  Construction,
  DoorOpen,
  Droplets,
  Fuel,
  Hand,
  Handshake,
  HeartPulse,
  Hospital,
  House,
  Info,
  LifeBuoy,
  Link2,
  MapPin,
  Megaphone,
  OctagonAlert,
  PersonStanding,
  Shield,
  ShieldCheck,
  Ship,
  Siren,
  Star,
  Tent,
  TriangleAlert,
  Truck,
  UsersRound,
  Utensils,
  Waves,
  Wrench,
  CarFront,
  Accessibility,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/report-meta";
import type {
  AnnouncementType,
  AreaLevel,
  Capability,
  ImportantPlaceCategory,
  ImportantPlaceStatus,
  PlaceIcon,
  RouteImpact,
  RouteRisk,
  SosStatus,
  SosType,
} from "@/types/community";

export const PLACE_ICON_META: Record<PlaceIcon, LucideIcon> = {
  home: House,
  work: Briefcase,
  family: UsersRound,
  custom: Star,
};

export const AREA_LEVEL_META: Record<AreaLevel, { icon: LucideIcon; tone: Tone }> = {
  clear: { icon: ShieldCheck, tone: "ok" },
  caution: { icon: TriangleAlert, tone: "warn" },
  severe: { icon: OctagonAlert, tone: "danger" },
};

export const ROUTE_RISK_META: Record<RouteRisk, { icon: LucideIcon; tone: Tone; color: string }> = {
  safe: { icon: ShieldCheck, tone: "ok", color: "#0f766e" },
  caution: { icon: TriangleAlert, tone: "warn", color: "#d97706" },
  blocked: { icon: CircleX, tone: "danger", color: "#dc2626" },
};

export const ROUTE_IMPACT_META: Record<RouteImpact, { icon: LucideIcon; tone: Tone }> = {
  blocked: { icon: CircleX, tone: "danger" },
  caution: { icon: TriangleAlert, tone: "warn" },
  info: { icon: Info, tone: "info" },
};

export const SOS_TYPE_META: Record<SosType, LucideIcon> = {
  trapped: Siren,
  elderly_or_patient: Accessibility,
  vehicle_stalled: CarFront,
  need_boat: Ship,
  need_high_vehicle: Truck,
  need_food_water: Utensils,
  need_shelter: Tent,
  other: Hand,
};

export const SOS_STATUS_META: Record<SosStatus, { icon: LucideIcon; tone: Tone }> = {
  waiting: { icon: Clock, tone: "warn" },
  matched: { icon: Handshake, tone: "info" },
  on_the_way: { icon: Truck, tone: "info" },
  arrived: { icon: PersonStanding, tone: "ok" },
  completed: { icon: CircleCheck, tone: "ok" },
  cancelled: { icon: CircleX, tone: "muted" },
};

// The requester-facing progress bar skips the terminal "cancelled".
export const SOS_PROGRESS: SosStatus[] = ["waiting", "matched", "on_the_way", "arrived", "completed"];

export const CAPABILITY_META: Record<Capability, LucideIcon> = {
  high_vehicle: Truck,
  boat: Ship,
  first_aid: HeartPulse,
  food_water: Utensils,
  vehicle_repair: Wrench,
  towing: Link2,
  shelter: Tent,
  other: Hand,
};

export const IMPORTANT_PLACE_META: Record<ImportantPlaceCategory, { icon: LucideIcon; color: string }> = {
  hospital: { icon: Hospital, color: "#be123c" },
  shelter: { icon: Tent, color: "#0f766e" },
  food_water: { icon: Droplets, color: "#0369a1" },
  rescue: { icon: LifeBuoy, color: "#c2410c" },
  police: { icon: Shield, color: "#1e3a8a" },
  fuel: { icon: Fuel, color: "#475569" },
  vehicle_repair: { icon: Wrench, color: "#a16207" },
  boat_point: { icon: Anchor, color: "#0e7490" },
  other: { icon: MapPin, color: "#64748b" },
};

export const IMPORTANT_PLACE_STATUS_META: Record<ImportantPlaceStatus, { icon: LucideIcon; tone: Tone }> = {
  open: { icon: DoorOpen, tone: "ok" },
  full: { icon: UsersRound, tone: "warn" },
  closed: { icon: CircleX, tone: "danger" },
  unknown: { icon: Info, tone: "muted" },
};

export const ANNOUNCEMENT_TYPE_META: Record<AnnouncementType, LucideIcon> = {
  flood_warning: Waves,
  evacuation: Siren,
  road_closure: Construction,
  water_release: Droplets,
  weather: CloudRain,
  shelter_info: Tent,
  general: Megaphone,
};

// Official announcements are always marked with this, community reports
// never are, so the two can't be confused.
export const OFFICIAL_ICON = ShieldCheck;
