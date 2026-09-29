"use client";

import { CircleAlert, CircleCheck, CreditCard, Loader2, TriangleAlert, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/community/badges";
import { EmptyState } from "@/components/views/view-shell";
import type { useWallet } from "@/features/services/use-provider";
import { formatClockTime } from "@/lib/freshness";
import { CREDIT_TX_TONE, TOPUP_STATUS_TONE, formatTHB, signedCredits } from "@/lib/service-meta";
import { toneClass } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

// FloodNow credit: what a provider pays per qualified match (customer
// selected them AND they accepted). Top-ups go through Stripe Checkout and
// are credited only after Stripe confirms the payment to our server; the
// customer's payment for the job itself never goes through FloodNow.
export function WalletPanel({ wallet: w, cancelledReturn }: { wallet: ReturnType<typeof useWallet>; cancelledReturn: boolean }) {
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
      {(w.confirming || w.returned) && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-2xl border p-3 text-sm",
            w.confirming ? toneClass("warn") : w.returned?.status === "paid" ? toneClass("ok") : toneClass("muted"),
          )}
        >
          {w.confirming ? <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            {w.confirming
              ? t("walletConfirmingPayment")
              : w.returned?.status === "paid"
                ? t("walletTopupPaid", { n: w.returned.credit_amount })
                : cancelledReturn
                  ? t("walletTopupCancelled")
                  : t("walletTopupNotPaid")}
          </span>
        </div>
      )}

      <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-xs">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <WalletIcon className="size-4" aria-hidden />
          {t("walletBalance")}
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {wallet.balance} <span className="text-base font-medium text-muted-foreground">{t("walletCredits")}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {wallet.credit_enabled ? t("walletMatchFee", { n: wallet.match_fee }) : t("walletFeeWaived")}
        </p>
        {wallet.low_credit && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-sm text-amber-950">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("walletLowCredit")}
          </p>
        )}
      </section>

      {wallet.topup_enabled && wallet.packages.length > 0 && (
        <section aria-labelledby="topup-title" className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs">
          <h3 id="topup-title" className="font-semibold">
            {t("walletTopUp")}
          </h3>
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
            {wallet.packages.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="flex h-auto min-h-16 flex-col gap-0.5 rounded-xl py-2"
                disabled={w.starting !== null}
                onClick={() => w.startTopup(p.id)}
              >
                {w.starting === p.id ? <Loader2 className="animate-spin" aria-hidden /> : <CreditCard aria-hidden />}
                <span className="text-base font-semibold">{t("walletPackageCredits", { n: p.credits })}</span>
                <span className="text-xs text-muted-foreground">{formatTHB(p.thb, locale)}</span>
              </Button>
            ))}
          </div>
          {w.startError && (
            <p role="alert" className="text-sm text-destructive">
              {w.startError === "network" ? t("serviceRequestNetworkError") : w.startError}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">{t("walletTopupNote")}</p>
        </section>
      )}

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
                <ToneBadge icon={CreditCard} tone={TOPUP_STATUS_TONE[tp.status]}>
                  {t(`topupStatus.${tp.status}`)}
                </ToneBadge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
