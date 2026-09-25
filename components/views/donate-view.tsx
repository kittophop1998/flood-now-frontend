"use client";

import { useState } from "react";
import { Copy, Heart, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode } from "@/components/community/qr-code";
import { ViewShell } from "@/components/views/view-shell";
import { maskPromptPayId, normalizeAmount, promptPayPayload } from "@/lib/promptpay";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { DonationConfig } from "@/types/community";

const PRESETS = [20, 50, 100];

// PromptPay donation QR. Only rendered when the API's public config has a
// valid, enabled recipient. Nothing here verifies payment — scanning the QR
// is not treated as a completed donation.
export function DonateView({ config, onBack, hidden }: { config: DonationConfig; onBack: () => void; hidden?: boolean }) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const amount = preset ?? normalizeAmount(custom);
  const customInvalid = custom.trim() !== "" && normalizeAmount(custom) == null;
  const payload = promptPayPayload(config, amount);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(config.promptpay_id);
      toast.success(t("donateIdCopied"));
    } catch {
      toast.error(t("shareFailed"));
    }
  }

  return (
    <ViewShell title={t("donateTitle")} onBack={onBack} hidden={hidden}>
      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 className="flex items-center gap-2 font-semibold">
          <Heart className="size-5 text-rose-600" aria-hidden />
          {t("donateHeading")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("donateBody")}</p>
      </section>

      <section aria-labelledby="donate-qr" className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 id="donate-qr" className="sr-only">
          PromptPay QR
        </h2>
        <p className="text-center text-sm">
          <span className="block text-xs text-muted-foreground">{t("donateRecipient")}</span>
          <span className="font-semibold">{config.recipient_name ?? maskPromptPayId(config)}</span>
        </p>
        <div className="w-full max-w-64 rounded-2xl border bg-white p-2">
          <QrCode value={payload} label={amount != null ? t("donateQrAmountLabel", { amount: amount.toFixed(2) }) : t("donateQrLabel")} className="h-auto w-full" />
        </div>
        <p className="text-center text-sm font-semibold" aria-live="polite">
          {amount != null ? t("donateAmountValue", { amount: amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }) : t("donateAnyAmount")}
        </p>

        <div className="grid w-full grid-cols-4 gap-2" role="radiogroup" aria-label={t("donateAmount")}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preset === p}
              onClick={() => {
                setPreset(preset === p ? null : p);
                setCustom("");
              }}
              className={cn(
                "min-h-11 rounded-xl border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                preset === p ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              ฿{p}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={preset == null && custom === ""}
            onClick={() => {
              setPreset(null);
              setCustom("");
            }}
            className={cn(
              "min-h-11 rounded-xl border text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              preset == null && custom === "" ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
            )}
          >
            {t("donateNoAmount")}
          </button>
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="donate-custom">{t("donateCustom")}</Label>
          <Input
            id="donate-custom"
            inputMode="decimal"
            placeholder="0.00"
            className="h-11 text-base"
            value={custom}
            aria-invalid={customInvalid}
            onChange={(e) => {
              setCustom(e.target.value);
              setPreset(null);
            }}
          />
          {customInvalid && <p className="text-sm text-destructive">{t("donateAmountInvalid")}</p>}
        </div>

        <Button variant="outline" className="h-11 w-full rounded-xl" onClick={copyId}>
          <Copy aria-hidden />
          {t("donateCopyId", { id: maskPromptPayId(config) })}
        </Button>
      </section>

      <p className="flex items-start gap-2 rounded-2xl bg-background p-3 text-xs leading-relaxed text-muted-foreground shadow-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("donateNoVerification")}
      </p>
    </ViewShell>
  );
}
