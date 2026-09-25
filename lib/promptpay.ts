// Thai PromptPay QR payload (EMVCo merchant-presented QR, BOT spec). Pure
// and deterministic: the same recipient + amount always yields the same
// string. The recipient id comes from the API's public config, which has
// already validated/normalized it (apps/api/internal/domain/donation).
import type { DonationConfig } from "@/types/community";

const PROMPTPAY_AID = "A000000677010111";

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo requires.
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Phone numbers are sent as 0066 + 9 digits; ids go under their own sub-tag.
function recipientTag(config: Pick<DonationConfig, "promptpay_id" | "id_type">): string {
  switch (config.id_type) {
    case "phone":
      return tlv("01", `0066${config.promptpay_id.replace(/^0/, "")}`.padStart(13, "0"));
    case "national_id":
      return tlv("02", config.promptpay_id);
    case "ewallet":
      return tlv("03", config.promptpay_id);
  }
}

export const MAX_DONATION_AMOUNT = 1_000_000;

// A usable amount in baht (2 decimals, > 0), or null for "payer enters it".
export function normalizeAmount(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > MAX_DONATION_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

// Builds the payload. Without an amount the QR is static (point of
// initiation 11) and the payer types the amount in their banking app.
export function promptPayPayload(config: Pick<DonationConfig, "promptpay_id" | "id_type">, amount?: number | null): string {
  const value = normalizeAmount(amount ?? null);
  const body =
    tlv("00", "01") +
    tlv("01", value != null ? "12" : "11") +
    tlv("29", tlv("00", PROMPTPAY_AID) + recipientTag(config)) +
    tlv("58", "TH") +
    tlv("53", "764") +
    (value != null ? tlv("54", value.toFixed(2)) : "");
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}

// Masks the middle of an id for display ("081-xxx-5678").
export function maskPromptPayId(config: Pick<DonationConfig, "promptpay_id" | "id_type">): string {
  const id = config.promptpay_id;
  if (config.id_type === "phone") return `${id.slice(0, 3)}-xxx-${id.slice(-4)}`;
  return `${id.slice(0, 1)}${"x".repeat(Math.max(0, id.length - 5))}${id.slice(-4)}`;
}
