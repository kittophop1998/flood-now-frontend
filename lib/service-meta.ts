// Presentation + small pure rules for local services (providers, service
// requests, offers, wallet) — the commercial counterpart of
// lib/community-meta.ts. Local services use the normal navy/primary look;
// red stays reserved for SOS/emergency.
import {
  BatteryCharging,
  Bus,
  CircleCheck,
  CircleX,
  Clock,
  Disc,
  Hammer,
  Hourglass,
  Navigation,
  ShowerHead,
  Store,
  Truck,
  UserRoundCheck,
  Waves,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/report-meta";
import type { TranslateFn } from "@/lib/i18n/locale";
import type {
  CreditTxType,
  CustomerOffer,
  OfferStatus,
  ServiceCategory,
  ServiceRequest,
  ServiceRequestStatus,
  TopupStatus,
} from "@/types/local-services";

export const SERVICE_CATEGORY_META: Record<ServiceCategory, LucideIcon> = {
  towing: Truck,
  auto_repair: Wrench,
  tyre: Disc,
  battery: BatteryCharging,
  mobile_mechanic: Hammer,
  transport: Bus,
  electrician: Zap,
  plumber: ShowerHead,
  water_pump: Waves,
  other: Store,
};

// Categories whose request form offers the optional vehicle field (mirrors
// TakesVehicleInfo in apps/api/internal/domain/localservice).
export const VEHICLE_SERVICE_CATEGORIES: ServiceCategory[] = ["towing", "auto_repair", "tyre", "battery", "mobile_mechanic"];

export const SERVICE_STATUS_META: Record<ServiceRequestStatus, { icon: LucideIcon; tone: Tone }> = {
  open: { icon: Clock, tone: "info" },
  pending_provider_confirmation: { icon: Hourglass, tone: "warn" },
  matched: { icon: UserRoundCheck, tone: "ok" },
  on_the_way: { icon: Navigation, tone: "ok" },
  arrived: { icon: CircleCheck, tone: "ok" },
  completed: { icon: CircleCheck, tone: "muted" },
  cancelled: { icon: CircleX, tone: "muted" },
  expired: { icon: CircleX, tone: "muted" },
};

export const JOB_PROGRESS: ServiceRequestStatus[] = ["matched", "on_the_way", "arrived", "completed"];

export function isClosedStatus(s: ServiceRequestStatus): boolean {
  return s === "completed" || s === "cancelled" || s === "expired";
}

export function isMatchedStatus(s: ServiceRequestStatus): boolean {
  return s === "matched" || s === "on_the_way" || s === "arrived";
}

// Re-derives a request's status between polls from the server's own
// timestamps (never hardcoded durations), mirroring Request.Effective in
// the API: past expiry before a match → expired; a selection past its
// confirmation deadline → open again.
export function currentRequestStatus(
  r: Pick<ServiceRequest, "status" | "expires_at" | "selection_expires_at">,
  now: Date,
): ServiceRequestStatus {
  if ((r.status === "open" || r.status === "pending_provider_confirmation") && now.getTime() >= Date.parse(r.expires_at)) return "expired";
  if (r.status === "pending_provider_confirmation" && r.selection_expires_at && now.getTime() >= Date.parse(r.selection_expires_at)) return "open";
  return r.status;
}

// Offers the customer can still choose, cheapest first (on-site estimates
// after priced ones), then fastest. Purely by the offer — no paid ranking.
export function comparableOffers(offers: CustomerOffer[]): CustomerOffer[] {
  return offers
    .filter((o) => o.status === "pending" || o.status === "selected")
    .sort((a, b) => {
      const pa = a.price_thb ?? Number.POSITIVE_INFINITY;
      const pb = b.price_thb ?? Number.POSITIVE_INFINITY;
      return pa - pb || a.eta_minutes - b.eta_minutes || Date.parse(a.created_at) - Date.parse(b.created_at);
    });
}

export function offerStatusTone(s: OfferStatus): Tone {
  return s === "accepted" ? "ok" : s === "selected" ? "warn" : s === "pending" ? "info" : "muted";
}

export function formatTHB(amount: number, locale: "th" | "en"): string {
  return new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(amount);
}

// "฿800" or "ประเมินหน้างาน" (price assessed on site).
export function offerPriceText(price: number | null, t: TranslateFn, locale: "th" | "en"): string {
  return price == null ? t("offerOnSite") : formatTHB(price, locale);
}

// Seconds left until an ISO deadline (never negative).
export function secondsLeft(iso: string | null, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.parse(iso) - now.getTime()) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const CREDIT_TX_TONE: Record<CreditTxType, Tone> = {
  welcome_credit: "ok",
  top_up: "ok",
  refund: "ok",
  match_fee: "info",
  admin_adjustment: "muted",
};

export const TOPUP_STATUS_TONE: Record<TopupStatus, Tone> = {
  pending: "warn",
  paid: "ok",
  failed: "danger",
  expired: "muted",
  refunded: "muted",
};

// "+100" / "−20" for a credit amount.
export function signedCredits(amount: number): string {
  return amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`;
}

// Whether the API error means "not enough credit to accept" (402).
export function isInsufficientCredit(err: unknown): err is { code: string; fields?: Record<string, string> } {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "INSUFFICIENT_CREDIT";
}

// A provider's LINE id ("@shop" or a personal id) → a LINE link. Only an
// http(s) URL is passed through as-is, so a stored value can't become a
// javascript: link.
export function lineUrl(id: string): string {
  const v = id.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://line.me/R/ti/p/${encodeURIComponent(v.startsWith("@") ? v : `~${v}`)}`;
}
