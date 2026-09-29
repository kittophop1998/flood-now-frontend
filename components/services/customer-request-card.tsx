"use client";

import { useState } from "react";
import { Check, Flag, Hourglass, Loader2, MapPin, MessageCircle, Navigation, Phone, Timer, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/community/badges";
import { VerifiedBadge } from "@/components/services/provider-browser";
import { useNow } from "@/features/common/use-now";
import type { CustomerServicesApi } from "@/features/services/use-customer-services";
import { directionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatFreshness } from "@/lib/freshness";
import {
  JOB_PROGRESS,
  SERVICE_CATEGORY_META,
  SERVICE_STATUS_META,
  comparableOffers,
  currentRequestStatus,
  formatCountdown,
  lineUrl,
  offerPriceText,
  secondsLeft,
} from "@/lib/service-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { ISSUE_REASONS, type CancelReason, type IssueReason, type ServiceRequest, type ServiceRequestStatus } from "@/types/local-services";

export function ServiceStatusBadge({ status }: { status: ServiceRequestStatus }) {
  const { t } = useTranslation();
  const meta = SERVICE_STATUS_META[status];
  return (
    <ToneBadge icon={meta.icon} tone={meta.tone}>
      {t(`serviceStatus.${status}`)}
    </ToneBadge>
  );
}

const CUSTOMER_CANCEL_REASONS: CancelReason[] = ["changed_mind", "found_other", "no_response", "unable_to_contact", "other"];

// One of the customer's in-progress requests.
export function CustomerRequestCard({ request: r, services }: { request: ServiceRequest; services: CustomerServicesApi }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSent, setIssueSent] = useState(false);
  const status = currentRequestStatus(r, now);
  const Icon = SERVICE_CATEGORY_META[r.category];
  const offers = comparableOffers(r.offers);
  const selected = r.offers.find((o) => o.id === r.selected_offer_id);
  const matched = r.provider != null && (status === "matched" || status === "on_the_way" || status === "arrived" || status === "completed");

  async function act(key: string, fn: () => Promise<boolean>) {
    setBusy(key);
    await fn();
    setBusy(null);
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-xs">
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t(`serviceCategory.${r.category}`)}</h3>
          <p className="text-sm text-muted-foreground">{t("serviceRequestSentAgo", { ago: formatFreshness(r.created_at, t, now) })}</p>
        </div>
        <ServiceStatusBadge status={status} />
      </header>

      {r.description && <p className="text-sm break-words whitespace-pre-line">{r.description}</p>}

      {status === "open" && (
        <section aria-labelledby={`offers-${r.id}`} className="flex flex-col gap-2">
          <h4 id={`offers-${r.id}`} className="flex items-center gap-1.5 text-sm font-semibold">
            <UsersRound className="size-4" aria-hidden />
            {offers.length > 0 ? t("serviceOffersCount", { n: offers.length }) : t("serviceWaitingOffers")}
          </h4>
          {offers.length === 0 && <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">{t("serviceWaitingOffersHint")}</p>}
          <ul className="flex flex-col gap-2">
            {offers.map((o) => (
              <li key={o.id} className="flex flex-col gap-2.5 rounded-xl border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.provider.display_name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">{o.provider.verified && <VerifiedBadge />}</div>
                  </div>
                  <p className="shrink-0 text-right text-lg font-bold tabular-nums">{offerPriceText(o.price_thb, t, locale)}</p>
                </div>
                <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3.5" aria-hidden />
                    {t("offerEta", { n: o.eta_minutes })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {t("distanceAway", { d: formatDistance(o.distance_m, t) })}
                  </span>
                </p>
                {o.note && <p className="text-sm break-words whitespace-pre-line">{o.note}</p>}
                <Button className="h-11 rounded-xl" disabled={busy !== null} onClick={() => act(o.id, () => services.selectOffer(r.id, o.id))}>
                  {busy === o.id ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                  {t("offerChoose")}
                </Button>
              </li>
            ))}
          </ul>
          {offers.length > 0 && <p className="text-xs text-muted-foreground">{t("offerChooseHint")}</p>}
        </section>
      )}

      {status === "pending_provider_confirmation" && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" aria-live="polite">
          <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {t("serviceWaitingConfirm", { name: selected?.provider.display_name ?? "" })}{" "}
            <span className="font-semibold tabular-nums">{formatCountdown(secondsLeft(r.selection_expires_at, now))}</span>
          </span>
        </p>
      )}

      {matched && r.provider && (
        <section className="flex flex-col gap-3 rounded-xl border bg-teal-50/60 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("serviceMatchedWith")}</p>
              <p className="truncate text-base font-semibold">{r.provider.display_name}</p>
              {r.provider.verified && (
                <div className="mt-1">
                  <VerifiedBadge />
                </div>
              )}
            </div>
            {r.agreed_offer && (
              <div className="shrink-0 text-right">
                <p className="font-bold tabular-nums">{offerPriceText(r.agreed_offer.price_thb, t, locale)}</p>
                <p className="text-xs text-muted-foreground">{t("offerEta", { n: r.agreed_offer.eta_minutes })}</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${r.provider.phone}`} className={linkButton}>
              <Phone className="size-4" aria-hidden />
              {t("serviceCall")}
            </a>
            <a href={directionsUrl(r.provider.latitude, r.provider.longitude)} target="_blank" rel="noopener noreferrer" className={linkButton}>
              <Navigation className="size-4" aria-hidden />
              {t("serviceProviderLocation")}
            </a>
            {r.provider.line_id && (
              <a href={lineUrl(r.provider.line_id)} target="_blank" rel="noopener noreferrer" className={cn(linkButton, "col-span-2")}>
                <MessageCircle className="size-4" aria-hidden />
                LINE {r.provider.line_id}
              </a>
            )}
          </div>
          <ol className="grid grid-cols-4 gap-1 text-center text-[11px] leading-tight" aria-label={t("sosTimeline")}>
            {JOB_PROGRESS.map((step, i) => {
              const done = JOB_PROGRESS.indexOf(status) >= i;
              return (
                <li key={step} className={cn("rounded-lg px-1 py-1.5", done ? "bg-teal-600 font-semibold text-white" : "bg-background text-muted-foreground")}>
                  {t(`serviceStatus.${step}`)}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted-foreground">{t("servicePaymentOutside")}</p>
        </section>
      )}

      {services.actionError && (
        <p role="alert" className="text-sm text-destructive">
          {services.actionError}
        </p>
      )}

      {status === "arrived" && (
        <Button className="h-12 rounded-xl text-base" disabled={busy !== null} onClick={() => act("done", () => services.setStatus(r.id, "completed"))}>
          <Check aria-hidden />
          {t("serviceMarkCompleted")}
        </Button>
      )}

      {matched && !issueSent && (
        <IssueForm open={issueOpen} onOpenChange={setIssueOpen} onSend={async (reason) => {
          const ok = await services.reportIssue(r.id, reason);
          if (ok) setIssueSent(true);
          return ok;
        }} />
      )}
      {issueSent && <p className="text-sm text-teal-700">{t("serviceIssueSent")}</p>}

      {status !== "completed" &&
        (cancelOpen ? (
          <div className="flex flex-col gap-2 rounded-xl border p-3">
            <p className="text-sm font-medium">{t("serviceCancelQuestion")}</p>
            <div className="flex flex-wrap gap-1.5">
              {CUSTOMER_CANCEL_REASONS.map((reason) => (
                <Button
                  key={reason}
                  variant="outline"
                  className="h-10 rounded-full"
                  disabled={busy !== null}
                  onClick={() => act("cancel", () => services.cancel(r.id, reason))}
                >
                  {t(`cancelReason.${reason}`)}
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="h-10 rounded-xl" onClick={() => setCancelOpen(false)}>
              {t("serviceKeepRequest")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => setCancelOpen(true)}>
            {t("serviceCancelRequest")}
          </Button>
        ))}
    </article>
  );
}

function IssueForm({ open, onOpenChange, onSend }: { open: boolean; onOpenChange: (v: boolean) => void; onSend: (reason: IssueReason) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" className="h-10 justify-start rounded-xl text-muted-foreground" onClick={() => onOpenChange(true)}>
        <Flag aria-hidden />
        {t("serviceReportIssue")}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3">
      <p className="text-sm font-medium">{t("serviceReportIssue")}</p>
      <div className="flex flex-wrap gap-1.5">
        {ISSUE_REASONS.map((reason) => (
          <Button
            key={reason}
            variant="outline"
            className="h-10 rounded-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSend(reason);
              setBusy(false);
            }}
          >
            {t(`issueReason.${reason}`)}
          </Button>
        ))}
      </div>
      <Button variant="ghost" className="h-10 rounded-xl" onClick={() => onOpenChange(false)}>
        {t("cancel")}
      </Button>
    </div>
  );
}

const linkButton =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background px-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
