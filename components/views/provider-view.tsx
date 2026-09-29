"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Check,
  CircleAlert,
  EyeOff,
  Hourglass,
  Inbox,
  Loader2,
  MapPin,
  MessageSquareQuote,
  Navigation,
  Phone,
  SearchX,
  Send,
  Store,
  Timer,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToneBadge } from "@/components/community/badges";
import { ServiceStatusBadge } from "@/components/services/customer-request-card";
import { ProviderProfileForm } from "@/components/services/provider-profile-form";
import { WalletPanel } from "@/components/services/wallet-panel";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useNow } from "@/features/common/use-now";
import { useMyProvider, useProviderWork, useWallet, type ProviderWorkApi } from "@/features/services/use-provider";
import { directionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatFreshness } from "@/lib/freshness";
import { SERVICE_CATEGORY_META, formatCountdown, offerPriceText, offerStatusTone, secondsLeft } from "@/lib/service-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/types/community";
import type { LocalServicesConfig, OfferInput, ProviderJob, ProviderOffer, RedactedRequest, ServiceRequestStatus } from "@/types/local-services";

export type ProviderTab = "requests" | "offers" | "jobs" | "wallet" | "profile";
const TABS: ProviderTab[] = ["requests", "offers", "jobs", "wallet", "profile"];

// "For service providers": onboarding for a user without a provider profile,
// otherwise the provider dashboard. Commercial and separate from helper
// mode (volunteer SOS help, which stays free and has its own screen).
export function ProviderView({
  config,
  initialTab,
  userLocation,
  onUseMyLocation,
  onBack,
  hidden,
}: {
  config: LocalServicesConfig;
  initialTab?: ProviderTab;
  userLocation: LatLng | null;
  onUseMyLocation: () => Promise<LatLng | null>;
  onBack: () => void;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const { user, requireAuth } = useAuth();
  const me = useMyProvider(user != null);
  const [editing, setEditing] = useState(false);

  return (
    <ViewShell title={t("providerTitle")} subtitle={t("providerSubtitle")} onBack={onBack} hidden={hidden}>
      {!user ? (
        <ProviderIntro onStart={() => requireAuth("provider")} />
      ) : me.status === "loading" || me.status === "idle" ? (
        <div className="h-48 animate-pulse rounded-2xl bg-background" aria-hidden />
      ) : me.status === "error" && !me.provider ? (
        <EmptyState
          icon={<CircleAlert />}
          title={t("providerLoadFailed")}
          action={
            <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={me.reload}>
              {t("retry")}
            </Button>
          }
        />
      ) : !me.provider ? (
        <>
          <ProviderIntro />
          <ProviderProfileForm provider={null} userLocation={userLocation} onUseMyLocation={onUseMyLocation} onSave={me.save} />
        </>
      ) : editing ? (
        <ProviderProfileForm
          provider={me.provider}
          userLocation={userLocation}
          onUseMyLocation={onUseMyLocation}
          onSave={async (input) => {
            const err = await me.save(input);
            if (!err) setEditing(false);
            return err;
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Dashboard me={me} config={config} initialTab={initialTab} onEdit={() => setEditing(true)} />
      )}
    </ViewShell>
  );
}

function ProviderIntro({ onStart }: { onStart?: () => void }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <Store className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">{t("providerIntroTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("providerIntroBody")}</p>
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
        <li>{t("providerIntroFree")}</li>
        <li>{t("providerIntroPayPerMatch")}</li>
        <li>{t("providerIntroPaymentOutside")}</li>
        <li>{t("providerIntroNotVolunteer")}</li>
      </ul>
      {onStart && (
        <Button className="h-12 rounded-xl text-base" onClick={onStart}>
          {t("providerRegisterCta")}
        </Button>
      )}
    </section>
  );
}

function Dashboard({
  me,
  config,
  initialTab,
  onEdit,
}: {
  me: ReturnType<typeof useMyProvider>;
  config: LocalServicesConfig;
  initialTab?: ProviderTab;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const p = me.provider!;
  const [tab, setTab] = useState<ProviderTab>(initialTab ?? "requests");
  const [toggling, setToggling] = useState(false);
  const work = useProviderWork(true, p.available && p.status === "active");
  const wallet = useWallet(true);
  const selections = work.offers.filter((o) => o.status === "selected");
  const activeJobs = work.jobs.filter((j) => j.match.status === "active");

  async function refreshAll() {
    await Promise.all([me.reload(), wallet.reload(), work.reload()]);
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{p.display_name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {p.verified && (
                <ToneBadge icon={BadgeCheck} tone="info">
                  {t("providerVerified")}
                </ToneBadge>
              )}
              {p.status === "suspended" && (
                <ToneBadge icon={TriangleAlert} tone="danger">
                  {t("providerSuspended")}
                </ToneBadge>
              )}
            </div>
          </div>
        </div>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-muted px-3 font-semibold">
          {t("providerAvailableToggle")}
          <Switch
            checked={p.available}
            disabled={toggling || p.status !== "active"}
            onCheckedChange={async (v) => {
              setToggling(true);
              await me.setAvailable(v);
              setToggling(false);
            }}
          />
        </label>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label={t("providerStatNearby")} value={p.available ? work.requests.length : "–"} />
          <Stat label={t("providerStatActive")} value={activeJobs.length} />
          {/* The wallet is refetched after top-ups and matches; prefer it over the profile copy. */}
          <Stat
            label={t("providerStatCredit")}
            value={wallet.wallet?.balance ?? p.credit_balance}
            warn={wallet.wallet?.low_credit ?? p.low_credit}
          />
        </dl>
      </section>

      {selections.map((o) => (
        <SelectionCard
          key={o.id}
          offer={o}
          work={work}
          fee={config.credit_enabled ? config.match_fee : 0}
          onTopUp={() => setTab("wallet")}
          onAccepted={refreshAll}
        />
      ))}

      <div role="tablist" aria-label={t("providerTitle")} className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "min-h-10 shrink-0 rounded-full px-3.5 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              tab === id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`providerTab.${id}`)}
          </button>
        ))}
      </div>

      {work.actionError && (
        <p role="alert" className="text-sm text-destructive">
          {work.actionError}
        </p>
      )}

      {tab === "requests" && <RequestsTab available={p.available} work={work} />}
      {tab === "offers" && <OffersTab work={work} />}
      {tab === "jobs" && <JobsTab work={work} onChanged={refreshAll} />}
      {tab === "wallet" && <WalletPanel wallet={wallet} />}
      {tab === "profile" && (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-xs">
          <p className="text-muted-foreground">{p.categories.map((c) => t(`serviceCategory.${c}`)).join(" · ")}</p>
          <p>
            <Phone className="mr-1 inline size-4" aria-hidden />
            {p.phone}
            {p.line_id ? ` · LINE ${p.line_id}` : ""}
          </p>
          <p>
            <MapPin className="mr-1 inline size-4" aria-hidden />
            {p.location_name ?? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`} · {formatDistance(p.service_radius_m, t)}
          </p>
          {!p.verified && <p className="text-xs text-muted-foreground">{t("providerVerifiedExplain")}</p>}
          <Button variant="outline" className="h-11 rounded-xl" onClick={onEdit}>
            {t("providerEditProfile")}
          </Button>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-background px-1 py-2", warn && "border-amber-300 bg-amber-50")}>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
    </div>
  );
}

// The customer chose this provider: accept (qualified match — the fee is
// charged now, once) or decline (free), before the deadline.
function SelectionCard({
  offer,
  work,
  fee,
  onTopUp,
  onAccepted,
}: {
  offer: ProviderOffer;
  work: ProviderWorkApi;
  fee: number;
  onTopUp: () => void;
  onAccepted: () => void;
}) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [short, setShort] = useState<{ balance: number; required: number } | null>(null);
  const r = offer.request;
  const Icon = SERVICE_CATEGORY_META[r.category];
  const left = secondsLeft(r.selection_expires_at, now);

  return (
    <section aria-live="polite" className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{t("providerChosenTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t(`serviceCategory.${r.category}`)} · {t("distanceAway", { d: formatDistance(r.distance_m, t) })} · {offerPriceText(offer.price_thb, t, locale)}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900 tabular-nums">
          <Hourglass className="size-3.5" aria-hidden />
          {formatCountdown(left)}
        </span>
      </div>
      <p className="rounded-xl bg-muted px-3 py-2 text-sm">{fee > 0 ? t("providerAcceptFeeNote", { n: fee }) : t("providerAcceptNoFee")}</p>
      {short && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("providerInsufficientCredit")}
          </p>
          <p>{t("providerInsufficientDetail", { balance: short.balance, required: short.required })}</p>
          <Button className="h-11 rounded-xl" onClick={onTopUp}>
            {t("walletTopUp")}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-12 rounded-xl"
          disabled={busy !== null || left === 0}
          onClick={async () => {
            setBusy("reject");
            await work.reject(offer.id);
            setBusy(null);
          }}
        >
          {busy === "reject" ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
          {t("providerDecline")}
        </Button>
        <Button
          className="h-12 rounded-xl text-base"
          disabled={busy !== null || left === 0}
          onClick={async () => {
            setBusy("accept");
            setShort(null);
            const res = await work.accept(offer.id);
            setBusy(null);
            if (res.ok) onAccepted();
            else if (res.insufficient) setShort(res.insufficient);
          }}
        >
          {busy === "accept" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
          {t("providerAccept")}
        </Button>
      </div>
    </section>
  );
}

function RequestsTab({ available, work }: { available: boolean; work: ProviderWorkApi }) {
  const { t } = useTranslation();
  if (!available) return <EmptyState icon={<EyeOff />} title={t("providerOffTitle")} hint={t("providerOffHint")} />;
  if (work.status === "loading" || work.status === "idle") return <div className="h-32 animate-pulse rounded-2xl bg-background" aria-hidden />;
  if (work.status === "error")
    return (
      <EmptyState
        icon={<CircleAlert />}
        title={t("providerWorkFailed")}
        action={
          <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={work.reload}>
            {t("retry")}
          </Button>
        }
      />
    );
  if (work.requests.length === 0) return <EmptyState icon={<SearchX />} title={t("providerNoRequests")} hint={t("providerNoRequestsHint")} />;
  return (
    <ul className="flex flex-col gap-2">
      {work.requests.map((r) => (
        <RequestCard key={r.id} request={r} work={work} />
      ))}
    </ul>
  );
}

function RequestCard({ request: r, work }: { request: RedactedRequest; work: ProviderWorkApi }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [offering, setOffering] = useState(false);
  const Icon = SERVICE_CATEGORY_META[r.category];
  const mine = r.my_offer;
  const editable = !mine || mine.status === "pending";

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(`serviceCategory.${r.category}`)}</p>
          <p className="text-xs text-muted-foreground">
            {t("distanceAway", { d: formatDistance(r.distance_m, t) })} · {formatFreshness(r.created_at, t, now)} · {t("providerApproxArea")}
          </p>
        </div>
      </div>
      {r.description && <p className="text-sm break-words whitespace-pre-line">{r.description}</p>}
      {r.vehicle_info && <p className="text-sm text-muted-foreground">{t("serviceRequestVehicle")}: {r.vehicle_info}</p>}
      {r.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image_url} alt="" className="max-h-48 w-full rounded-xl border object-cover" />
      )}
      {mine && (
        <p className="flex items-center gap-2 text-sm">
          <ToneBadge icon={MessageSquareQuote} tone={offerStatusTone(mine.status)}>
            {t(`offerStatus.${mine.status}`)}
          </ToneBadge>
          {offerPriceText(mine.price_thb, t, locale)} · {t("offerEta", { n: mine.eta_minutes })}
        </p>
      )}
      {offering ? (
        <OfferForm
          initial={mine ?? null}
          onCancel={() => setOffering(false)}
          onSend={async (input) => {
            const ok = await work.sendOffer(r.id, input);
            if (ok) setOffering(false);
            return ok;
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => work.dismiss(r.id)}>
            <EyeOff aria-hidden />
            {t("providerIgnore")}
          </Button>
          <Button className="h-11 rounded-xl" disabled={!editable} onClick={() => setOffering(true)}>
            <Send aria-hidden />
            {mine ? t("providerEditOffer") : t("providerSendOffer")}
          </Button>
        </div>
      )}
    </li>
  );
}

function OfferForm({
  initial,
  onSend,
  onCancel,
}: {
  initial: { price_thb: number | null; eta_minutes: number; note: string | null } | null;
  onSend: (input: OfferInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [onSite, setOnSite] = useState(initial ? initial.price_thb == null : false);
  const [price, setPrice] = useState(initial?.price_thb != null ? String(initial.price_thb) : "");
  const [eta, setEta] = useState(initial ? String(initial.eta_minutes) : "30");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const priceNum = Number(price);
  const etaNum = Number(eta);
  const valid = (onSite || (price !== "" && Number.isInteger(priceNum) && priceNum >= 0)) && Number.isInteger(etaNum) && etaNum >= 1 && etaNum <= 1440;

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3">
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
        {t("offerOnSite")}
        <Switch checked={onSite} onCheckedChange={setOnSite} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {!onSite && (
          <div className="grid gap-1.5">
            <Label htmlFor="offer-price">{t("offerPrice")}</Label>
            <Input id="offer-price" inputMode="numeric" className="h-11 text-base" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="offer-eta">
            <Timer className="inline size-3.5" aria-hidden /> {t("offerEtaLabel")}
          </Label>
          <Input id="offer-eta" inputMode="numeric" className="h-11 text-base" value={eta} onChange={(e) => setEta(e.target.value.replace(/[^\d]/g, ""))} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="offer-note">
          {t("offerNote")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Textarea id="offer-note" rows={2} maxLength={500} className="text-base" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">{t("offerFreeNote")}</p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onCancel} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button
          className="h-11 flex-1 rounded-xl"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            await onSend({ price_thb: onSite ? null : priceNum, eta_minutes: etaNum, note: note.trim() || null });
            setBusy(false);
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {t("providerSendOffer")}
        </Button>
      </div>
    </div>
  );
}

function OffersTab({ work }: { work: ProviderWorkApi }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  if (work.offers.length === 0) return <EmptyState icon={<Inbox />} title={t("providerNoOffers")} />;
  return (
    <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-xs">
      {work.offers.map((o) => {
        const Icon = SERVICE_CATEGORY_META[o.request.category];
        return (
          <li key={o.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
            <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {t(`serviceCategory.${o.request.category}`)} · {offerPriceText(o.price_thb, t, locale)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {formatDistance(o.request.distance_m, t)} · {formatFreshness(o.updated_at, t, now)}
              </span>
            </span>
            <ToneBadge icon={MessageSquareQuote} tone={offerStatusTone(o.status)}>
              {t(`offerStatus.${o.status}`)}
            </ToneBadge>
          </li>
        );
      })}
    </ul>
  );
}

const JOB_NEXT: Partial<Record<ServiceRequestStatus, { to: ServiceRequestStatus; label: "jobStartTravel" | "jobArrived" | "jobComplete" }>> = {
  matched: { to: "on_the_way", label: "jobStartTravel" },
  on_the_way: { to: "arrived", label: "jobArrived" },
  arrived: { to: "completed", label: "jobComplete" },
};

function JobsTab({ work, onChanged }: { work: ProviderWorkApi; onChanged: () => void }) {
  const { t } = useTranslation();
  const active = work.jobs.filter((j) => j.match.status === "active");
  const history = work.jobs.filter((j) => j.match.status !== "active").slice(0, 10);
  if (work.jobs.length === 0) return <EmptyState icon={<Inbox />} title={t("providerNoJobs")} hint={t("providerNoJobsHint")} />;
  return (
    <div className="flex flex-col gap-3">
      {active.map((j) => (
        <JobCard key={j.match.id} job={j} work={work} onChanged={onChanged} />
      ))}
      {history.length > 0 && (
        <section aria-labelledby="job-history" className="flex flex-col gap-2">
          <h3 id="job-history" className="px-1 font-semibold">
            {t("providerJobHistory")}
          </h3>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-xs">
            {history.map((j) => {
              const Icon = SERVICE_CATEGORY_META[j.request.category];
              return (
                <li key={j.match.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {t(`serviceCategory.${j.request.category}`)}
                    {j.match.fee_credits != null && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {j.match.fee_waived ? t("jobFeeWaived") : t("jobFee", { n: j.match.fee_credits })}
                      </span>
                    )}
                  </span>
                  <ServiceStatusBadge status={j.match.status === "cancelled" ? "cancelled" : j.request.status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function JobCard({ job: j, work, onChanged }: { job: ProviderJob; work: ProviderWorkApi; onChanged: () => void }) {
  const { t, locale } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [backOut, setBackOut] = useState(false);
  const Icon = SERVICE_CATEGORY_META[j.request.category];
  const next = JOB_NEXT[j.request.status];
  const canBackOut = j.request.status === "matched" || j.request.status === "on_the_way";

  async function go(fn: () => Promise<boolean>) {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (ok) onChanged();
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-card p-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(`serviceCategory.${j.request.category}`)}</p>
          <p className="text-xs text-muted-foreground">
            {j.customer?.display_name} · {offerPriceText(j.offer.price_thb, t, locale)}
          </p>
        </div>
        <ServiceStatusBadge status={j.request.status} />
      </div>
      {j.request.description && <p className="text-sm break-words whitespace-pre-line">{j.request.description}</p>}
      {j.request.location_name && (
        <p className="flex items-start gap-1.5 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          {j.request.location_name}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {j.request.latitude != null && j.request.longitude != null && (
          <a href={directionsUrl(j.request.latitude, j.request.longitude)} target="_blank" rel="noopener noreferrer" className={linkButton}>
            <Navigation className="size-4" aria-hidden />
            {t("directions")}
          </a>
        )}
        {j.customer && (
          <a href={`tel:${j.customer.contact_phone}`} className={linkButton}>
            <Phone className="size-4" aria-hidden />
            {j.customer.contact_phone}
          </a>
        )}
      </div>
      {next && (
        <Button className="h-12 rounded-xl text-base" disabled={busy} onClick={() => go(() => work.setJobStatus(j.request.id, next.to))}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t(next.label)}
        </Button>
      )}
      {canBackOut &&
        (backOut ? (
          <div className="flex flex-col gap-2 rounded-xl border p-3">
            <p className="text-sm">{t("jobBackOutConfirm")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setBackOut(false)}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" className="h-11 rounded-xl" disabled={busy} onClick={() => go(() => work.backOut(j.request.id, "provider_unavailable"))}>
                {t("jobBackOut")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => setBackOut(true)}>
            {t("jobCantMakeIt")}
          </Button>
        ))}
    </article>
  );
}

const linkButton =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background px-2 text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
