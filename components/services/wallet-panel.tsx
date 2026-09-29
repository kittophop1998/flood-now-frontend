"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, CircleAlert, CircleCheck, Download, Loader2, QrCode as QrIcon, RotateCw, ScanLine, Smartphone, TriangleAlert, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/community/badges";
import { QrCode } from "@/components/community/qr-code";
import { EmptyState } from "@/components/views/view-shell";
import type { useWallet } from "@/features/services/use-provider";
import { formatClockTime } from "@/lib/freshness";
import { saveQrImage } from "@/lib/qr-image";
import { CREDIT_TX_TONE, TOPUP_STATUS_META, formatTHB, signedCredits } from "@/lib/service-meta";
import { toneClass } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Topup, TopupPackage } from "@/types/local-services";

type WalletApi = ReturnType<typeof useWallet>;

// FloodNow credit: what a provider pays per qualified match (customer
// selected them AND they accepted). Top-ups are PromptPay only (a Stripe
// PromptPay payment whose QR is shown here) and are credited only after
// Stripe confirms the payment to our server; the customer's payment for the
// job itself never goes through FloodNow.
export function WalletPanel({ wallet: w }: { wallet: WalletApi }) {
  const { t, locale } = useTranslation();
  const now = new Date();

  if (w.status === "loading" && !w.wallet) return <div className="h-40 animate-pulse rounded-2xl bg-background" aria-hidden />;
  if (w.status === "error" && !w.wallet)
    return (
      <EmptyState
        icon={<CircleAlert />}
        title={t("walletLoadFailed")}
        action={
          <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={w.reload}>
            {t("retry")}
          </Button>
        }
      />
    );
  if (!w.wallet) return null;
  const wallet = w.wallet;

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-xs">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <WalletIcon className="size-4" aria-hidden />
          {t("walletBalance")}
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {wallet.balance} <span className="text-base font-medium text-muted-foreground">{t("walletCredits")}</span>
        </p>
        <p className="text-sm text-muted-foreground">{wallet.credit_enabled ? t("walletMatchFee", { n: wallet.match_fee }) : t("walletFeeWaived")}</p>
        {wallet.low_credit && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-950">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("walletLowCredit")}
          </p>
        )}
      </section>

      {wallet.topup_enabled &&
        wallet.packages.length > 0 &&
        (w.payment ? <PromptPayPayment wallet={w} payment={w.payment} /> : <TopUpPicker wallet={w} packages={wallet.packages} />)}

      <section aria-labelledby="wallet-history" className="flex flex-col gap-2">
        <h3 id="wallet-history" className="px-1 font-semibold">
          {t("walletHistory")}
        </h3>
        {wallet.transactions.length === 0 ? (
          <p className="rounded-2xl border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">{t("walletNoTransactions")}</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-xs">
            {wallet.transactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(`creditTx.${tx.type}`)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatClockTime(tx.created_at, locale, now)}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </span>
                </span>
                <span className={cn("rounded-full border px-2 py-0.5 text-sm font-semibold tabular-nums", toneClass(CREDIT_TX_TONE[tx.type]))}>{signedCredits(tx.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {wallet.topups.length > 0 && (
        <section aria-labelledby="wallet-topups" className="flex flex-col gap-2">
          <h3 id="wallet-topups" className="px-1 font-semibold">
            {t("walletTopups")}
          </h3>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-xs">
            {wallet.topups.map((tp) => (
              <li key={tp.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {t("walletPackageCredits", { n: tp.credit_amount })} · {formatTHB(tp.amount_thb, locale)}
                  </span>
                  <span className="block text-xs text-muted-foreground">{formatClockTime(tp.created_at, locale, now)}</span>
                </span>
                {tp.status === "pending" && tp.promptpay && w.payment?.id !== tp.id ? (
                  <Button variant="outline" className="h-9 rounded-lg px-3" onClick={() => w.resume(tp)}>
                    <QrIcon aria-hidden />
                    {t("walletShowQr")}
                  </Button>
                ) : (
                  <ToneBadge icon={TOPUP_STATUS_META[tp.status].icon} tone={TOPUP_STATUS_META[tp.status].tone}>
                    {t(`topupStatus.${tp.status}`)}
                  </ToneBadge>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Choose a package, then create its PromptPay QR.
function TopUpPicker({ wallet: w, packages }: { wallet: WalletApi; packages: TopupPackage[] }) {
  const { t, locale } = useTranslation();
  const [selected, setSelected] = useState(packages[Math.min(1, packages.length - 1)].id);
  const pkg = packages.find((p) => p.id === selected) ?? packages[0];

  return (
    <section aria-labelledby="topup-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h3 id="topup-title" className="font-semibold">
          {t("walletTopUp")}
        </h3>
        <PromptPayMark />
      </div>
      <div role="radiogroup" aria-label={t("walletTopUp")} className="grid grid-cols-3 gap-2">
        {packages.map((p) => {
          const on = p.id === selected;
          const bonus = p.credits - p.thb;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(p.id)}
              className={cn(
                "relative flex min-h-24 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-1 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on ? "border-primary bg-accent" : "border-border bg-background hover:bg-muted",
              )}
            >
              {on && (
                <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" aria-hidden />
                </span>
              )}
              <span className="text-xl font-bold tabular-nums">{p.credits}</span>
              <span className="text-xs text-muted-foreground">{t("walletCredits")}</span>
              <span className="mt-1 text-sm font-semibold">{formatTHB(p.thb, locale)}</span>
              {bonus > 0 && <span className="rounded-full bg-teal-100 px-2 text-[11px] font-semibold text-teal-800">{t("walletBonus", { n: bonus })}</span>}
            </button>
          );
        })}
      </div>
      {w.startError && (
        <p role="alert" className="text-sm text-destructive">
          {w.startError === "network" ? t("serviceRequestNetworkError") : w.startError}
        </p>
      )}
      <Button className="h-12 rounded-xl text-base" disabled={w.starting} onClick={() => w.startTopup(pkg.id)}>
        {w.starting ? <Loader2 className="animate-spin" aria-hidden /> : <QrIcon aria-hidden />}
        {t("walletPayPromptPay", { amount: formatTHB(pkg.thb, locale) })}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("walletTopupNote")}</p>
    </section>
  );
}

// The PromptPay QR for one top-up, then its outcome. Polled by useWallet.
function PromptPayPayment({ wallet: w, payment: p }: { wallet: WalletApi; payment: Topup }) {
  const { locale } = useTranslation();
  const [saving, setSaving] = useState(false);
  const amount = formatTHB(p.amount_thb, locale);
  const ref = useRef<HTMLDivElement>(null);
  // Bring the QR (or its outcome) into view when it appears or changes.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [p.id, p.status]);

  return (
    <div ref={ref} className="scroll-mt-3">
      <PaymentBody wallet={w} payment={p} amount={amount} saving={saving} setSaving={setSaving} />
    </div>
  );
}

function PaymentBody({
  wallet: w,
  payment: p,
  amount,
  saving,
  setSaving,
}: {
  wallet: WalletApi;
  payment: Topup;
  amount: string;
  saving: boolean;
  setSaving: (v: boolean) => void;
}) {
  const { t } = useTranslation();

  if (p.status === "paid") {
    return (
      <section role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center text-teal-950 shadow-xs">
        <span className="flex size-16 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
          <Check className="size-9" strokeWidth={3} aria-hidden />
        </span>
        <div>
          <h3 className="text-lg font-bold">{t("walletPaidTitle")}</h3>
          <p className="text-sm">{t("walletTopupPaid", { n: p.credit_amount })}</p>
        </div>
        <Button className="h-11 w-full max-w-60 rounded-xl" onClick={w.closePayment}>
          {t("walletDone")}
        </Button>
      </section>
    );
  }

  if (p.status !== "pending" || !p.promptpay) {
    return (
      <section role="status" className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-xs">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CircleAlert className="size-8" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold">{t("walletQrEndedTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("walletTopupNotPaid")}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={w.closePayment}>
            {t("close")}
          </Button>
          <Button className="h-11 rounded-xl" disabled={w.starting} onClick={() => w.startTopup(p.package_id)}>
            {w.starting ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
            {t("walletNewQr")}
          </Button>
        </div>
      </section>
    );
  }

  const qr = p.promptpay.qr_data;

  async function save() {
    setSaving(true);
    try {
      await saveQrImage(qr, `FloodNow · ${amount}`, `floodnow-promptpay-${p.id.slice(0, 8)}.png`);
    } catch {
      toast.error(t("walletSaveQrFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="promptpay-title" className="overflow-hidden rounded-3xl border bg-card shadow-md">
      <header className="flex items-center justify-between gap-3 bg-[#0e3a6d] px-4 py-3 text-white">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] opacity-80">THAI QR PAYMENT</p>
          <h3 id="promptpay-title" className="text-lg leading-tight font-bold">
            PromptPay · พร้อมเพย์
          </h3>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
          <ScanLine className="size-6" aria-hidden />
        </span>
      </header>

      <div className="flex flex-col items-center gap-4 px-4 pt-5 pb-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t("walletPayAmount")}</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{amount}</p>
          <p className="mt-0.5 text-sm font-medium text-primary">{t("walletPackageCredits", { n: p.credit_amount })}</p>
        </div>

        <div className="relative w-full max-w-64 rounded-2xl border-2 border-[#0e3a6d]/15 bg-white p-3 shadow-sm">
          <QrCode value={qr} label={t("walletQrLabel", { amount })} className="h-auto w-full" />
        </div>

        <p className="flex items-center gap-2 rounded-full bg-amber-50 px-3.5 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200" aria-live="polite">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("walletWaitingPayment")}
        </p>

        <ol className="grid w-full gap-2 text-sm">
          {[
            { icon: Smartphone, text: t("walletStep1") },
            { icon: ScanLine, text: t("walletStep2") },
            { icon: CircleCheck, text: t("walletStep3", { amount }) },
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 leading-snug">{s.text}</span>
              <s.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </li>
          ))}
        </ol>

        <div className="grid w-full grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={w.closePayment}>
            {t("cancel")}
          </Button>
          <Button className="h-11 rounded-xl" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
            {t("walletSaveQr")}
          </Button>
        </div>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">{t("walletQrNote")}</p>
      </div>
    </section>
  );
}

function PromptPayMark() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0e3a6d] px-2.5 py-1 text-xs font-bold text-white">
      <QrIcon className="size-3.5" aria-hidden />
      PromptPay
    </span>
  );
}
