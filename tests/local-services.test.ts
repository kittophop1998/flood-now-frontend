import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comparableOffers,
  currentRequestStatus,
  formatCountdown,
  isClosedStatus,
  lineUrl,
  offerPriceText,
  secondsLeft,
  signedCredits,
} from "@/lib/service-meta";
import { en } from "@/lib/i18n/en";
import { th } from "@/lib/i18n/th";
import type { TranslateFn } from "@/lib/i18n/locale";
import type { CustomerOffer } from "@/types/local-services";

const t: TranslateFn = (key, vars) => en[key].replace(/\{(\w+)\}/g, (_, token: string) => String(vars?.[token] ?? ""));

const now = new Date("2026-09-29T10:00:00Z");
const base = { status: "open" as const, expires_at: "2026-09-29T12:00:00Z", selection_expires_at: null };

test("request status is re-derived from the server's timestamps", () => {
  assert.equal(currentRequestStatus(base, now), "open");
  assert.equal(currentRequestStatus(base, new Date("2026-09-29T12:00:00Z")), "expired");
  const pending = { status: "pending_provider_confirmation" as const, expires_at: base.expires_at, selection_expires_at: "2026-09-29T10:10:00Z" };
  assert.equal(currentRequestStatus(pending, now), "pending_provider_confirmation");
  // The provider didn't confirm in time: the customer can choose again.
  assert.equal(currentRequestStatus(pending, new Date("2026-09-29T10:10:00Z")), "open");
  // A matched job never expires on the client either.
  assert.equal(currentRequestStatus({ ...base, status: "matched" }, new Date("2026-10-30T00:00:00Z")), "matched");
  assert.ok(isClosedStatus("expired") && isClosedStatus("cancelled") && !isClosedStatus("matched"));
});

function offer(id: string, price: number | null, eta: number, status: CustomerOffer["status"] = "pending"): CustomerOffer {
  return {
    id,
    status,
    price_thb: price,
    eta_minutes: eta,
    note: null,
    created_at: "2026-09-29T09:00:00Z",
    updated_at: "2026-09-29T09:00:00Z",
    distance_m: 1000,
    provider: {} as CustomerOffer["provider"],
  };
}

test("offers compare by price, then arrival time; on-site estimates last; closed ones hidden", () => {
  const sorted = comparableOffers([
    offer("onsite", null, 5),
    offer("slow", 500, 60),
    offer("fast", 500, 15),
    offer("cheap", 300, 90),
    offer("gone", 100, 5, "rejected"),
    offer("old", 100, 5, "expired"),
  ]);
  assert.deepEqual(
    sorted.map((o) => o.id),
    ["cheap", "fast", "slow", "onsite"],
  );
});

test("price, countdown and credit formatting", () => {
  assert.equal(offerPriceText(null, t, "en"), "Price assessed on site");
  assert.match(offerPriceText(800, t, "en"), /800/);
  assert.equal(secondsLeft("2026-09-29T10:02:05Z", now), 125);
  assert.equal(secondsLeft("2026-09-29T09:00:00Z", now), 0);
  assert.equal(formatCountdown(125), "2:05");
  assert.equal(signedCredits(100), "+100");
  assert.equal(signedCredits(-20), "−20");
});

test("LINE ids become LINE links; only http(s) is passed through", () => {
  assert.equal(lineUrl("@myshop"), "https://line.me/R/ti/p/%40myshop");
  assert.equal(lineUrl("somchai"), "https://line.me/R/ti/p/~somchai");
  assert.equal(lineUrl("https://line.me/ti/p/abc"), "https://line.me/ti/p/abc");
  assert.ok(lineUrl("javascript:alert(1)").startsWith("https://line.me/"));
});

test("SOS copy stays free/community and service copy never says SOS", () => {
  for (const dict of [en, th]) {
    for (const [key, value] of Object.entries(dict)) {
      if (key.startsWith("serviceRequest") || key.startsWith("offer") || key.startsWith("wallet")) {
        assert.ok(!/SOS/.test(value), `${key} must not be labelled SOS: ${value}`);
      }
    }
  }
  assert.match(th.sosSubtitle, /อาสา/);
  assert.match(th.sosSubtitle, /ฟรี/);
  assert.equal(th.servicesSubtitle, "เรียกช่าง รถยก และบริการในพื้นที่");
  assert.equal(th.providerSubtitle, "เปิดร้านและรับงานจากคนในพื้นที่");
  assert.equal(th.sosMenuHint, "ขอความช่วยเหลือจากอาสาใกล้คุณ");
});
