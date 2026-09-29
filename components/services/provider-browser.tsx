"use client";

import { useState } from "react";
import { BadgeCheck, CircleAlert, Clock, MapPin, Search, SearchX, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DetailList, DetailPopup, DetailRow, DetailSection } from "@/components/ui/detail-popup";
import { ToneBadge } from "@/components/community/badges";
import { EmptyState } from "@/components/views/view-shell";
import { useProviders, type ProviderFilters } from "@/features/services/use-customer-services";
import { formatDistance } from "@/lib/distance";
import { SERVICE_CATEGORY_META, formatTHB } from "@/lib/service-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/types/community";
import { SERVICE_CATEGORIES, type ServiceCategory, type ServiceProvider } from "@/types/local-services";

export type RequestServiceFn = (category: ServiceCategory | null, provider?: ServiceProvider) => void;

// Nearby commercial service providers: search, category chips, "available
// now" filter and cards. Ordering is the API's fixed rule (available first,
// then nearest) — nothing paid changes it. No ratings: FloodNow has none.
export function ProviderBrowser({ origin, onRequest }: { origin: LatLng | null; onRequest: RequestServiceFn }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ProviderFilters>({ category: null, q: "", availableOnly: false });
  const [detail, setDetail] = useState<ServiceProvider | null>(null);
  const { providers, status, retry } = useProviders(origin, filters);

  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        className="flex h-11 items-center gap-1 rounded-xl border bg-background pr-1 pl-3 focus-within:ring-2 focus-within:ring-ring/50"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, q: query.trim() }));
        }}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value) setFilters((f) => ({ ...f, q: "" }));
          }}
          placeholder={t("servicesSearchPlaceholder")}
          aria-label={t("servicesSearchPlaceholder")}
          className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-base outline-none"
        />
        <Button type="submit" variant="ghost" className="h-9 rounded-lg px-3">
          {t("searchButton")}
        </Button>
      </form>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5" role="radiogroup" aria-label={t("serviceCategoryLabel")}>
        {[null, ...SERVICE_CATEGORIES].map((c) => {
          const Icon = c ? SERVICE_CATEGORY_META[c] : Store;
          const on = filters.category === c;
          return (
            <button
              key={c ?? "all"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFilters((f) => ({ ...f, category: c }))}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {c ? t(`serviceCategory.${c}`) : t("filterAll")}
            </button>
          );
        })}
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border bg-background px-3 text-sm font-medium">
        {t("servicesAvailableOnly")}
        <Switch checked={filters.availableOnly} onCheckedChange={(v) => setFilters((f) => ({ ...f, availableOnly: v }))} />
      </label>

      <div aria-live="polite" aria-busy={status === "loading"} className="flex flex-col gap-3">
        {(status === "loading" || status === "idle") && [0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-background" aria-hidden />)}
        {status === "error" && (
          <EmptyState
            icon={<CircleAlert />}
            title={t("servicesLoadFailed")}
            action={
              <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={retry}>
                {t("retry")}
              </Button>
            }
          />
        )}
        {status === "ready" && providers.length === 0 && (
          <EmptyState
            icon={<SearchX />}
            title={t("servicesEmpty")}
            hint={t("servicesEmptyHint")}
            action={
              <Button className="mt-2 h-11 rounded-xl" onClick={() => onRequest(filters.category)}>
                {t("serviceRequestCta")}
              </Button>
            }
          />
        )}
        {status === "ready" &&
          providers.map((p) => <ProviderCard key={p.id} provider={p} onDetails={() => setDetail(p)} onRequest={() => onRequest(firstCategory(p, filters.category), p)} />)}
      </div>

      {detail && (
        <ProviderDetailPopup
          provider={detail}
          onClose={() => setDetail(null)}
          onRequest={() => {
            const p = detail;
            setDetail(null);
            onRequest(firstCategory(p, filters.category), p);
          }}
        />
      )}
    </div>
  );
}

function firstCategory(p: ServiceProvider, filter: ServiceCategory | null): ServiceCategory {
  return filter && p.categories.includes(filter) ? filter : p.categories[0];
}

export function VerifiedBadge() {
  const { t } = useTranslation();
  return (
    <ToneBadge icon={BadgeCheck} tone="info">
      {t("providerVerified")}
    </ToneBadge>
  );
}

function AvailabilityBadge({ available }: { available: boolean }) {
  const { t } = useTranslation();
  return (
    <ToneBadge icon={Clock} tone={available ? "ok" : "muted"}>
      {available ? t("providerAvailable") : t("providerUnavailable")}
    </ToneBadge>
  );
}

function ProviderLogo({ provider, size = "md" }: { provider: Pick<ServiceProvider, "logo_url" | "categories">; size?: "md" | "lg" }) {
  const Icon = SERVICE_CATEGORY_META[provider.categories[0] ?? "other"];
  const cls = size === "lg" ? "size-14" : "size-11";
  if (provider.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={provider.logo_url} alt="" className={cn(cls, "shrink-0 rounded-xl border object-cover")} />;
  }
  return (
    <span className={cn(cls, "flex shrink-0 items-center justify-center rounded-xl bg-accent text-primary")}>
      <Icon className="size-6" aria-hidden />
    </span>
  );
}

export function ProviderCard({ provider: p, onDetails, onRequest }: { provider: ServiceProvider; onDetails: () => void; onRequest: () => void }) {
  const { t, locale } = useTranslation();
  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <ProviderLogo provider={p} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{p.display_name}</h3>
          <p className="truncate text-sm text-muted-foreground">{p.categories.map((c) => t(`serviceCategory.${c}`)).join(" · ")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <AvailabilityBadge available={p.available} />
            {p.verified && <VerifiedBadge />}
            {p.mobile_service && (
              <ToneBadge icon={Truck} tone="muted">
                {t("providerMobileService")}
              </ToneBadge>
            )}
          </div>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {p.distance_m != null && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {t("distanceAway", { d: formatDistance(p.distance_m, t) })}
          </span>
        )}
        {p.starting_price_thb != null && <span>{t("providerStartingPrice", { price: formatTHB(p.starting_price_thb, locale) })}</span>}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onDetails}>
          {t("providerDetails")}
        </Button>
        <Button className="h-11 rounded-xl" onClick={onRequest}>
          {t("serviceRequestCta")}
        </Button>
      </div>
    </article>
  );
}

export function ProviderDetailPopup({ provider: p, onClose, onRequest }: { provider: ServiceProvider; onClose: () => void; onRequest: () => void }) {
  const { t, locale } = useTranslation();
  const headingId = `provider-${p.id}-title`;
  return (
    <DetailPopup
      labelledBy={headingId}
      onClose={onClose}
      header={
        <div className="flex items-start gap-3">
          <ProviderLogo provider={p} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2 id={headingId} tabIndex={-1} className="text-lg leading-snug font-semibold outline-none sm:text-xl">
              {p.display_name}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <AvailabilityBadge available={p.available} />
              {p.verified && <VerifiedBadge />}
            </div>
          </div>
        </div>
      }
      footer={
        <Button className="h-12 w-full rounded-xl text-base" onClick={onRequest}>
          {t("serviceRequestCta")}
        </Button>
      }
    >
      {p.description && <p className="text-sm leading-relaxed break-words whitespace-pre-line">{p.description}</p>}
      <DetailSection title={t("providerServices")}>
        <div className="flex flex-wrap gap-1.5">
          {p.categories.map((c) => {
            const Icon = SERVICE_CATEGORY_META[c];
            return (
              <span key={c} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-background px-2.5 text-sm">
                <Icon className="size-4 text-primary" aria-hidden />
                {t(`serviceCategory.${c}`)}
              </span>
            );
          })}
        </div>
      </DetailSection>
      <DetailList>
        {p.distance_m != null && <DetailRow label={t("providerDistance")}>{formatDistance(p.distance_m, t)}</DetailRow>}
        {p.location_name && <DetailRow label={t("providerArea")}>{p.location_name}</DetailRow>}
        <DetailRow label={t("providerServiceRadius")}>{formatDistance(p.service_radius_m, t)}</DetailRow>
        {p.business_hours && <DetailRow label={t("providerHours")}>{p.business_hours}</DetailRow>}
        <DetailRow label={t("providerMobileService")}>{p.mobile_service ? t("yes") : t("no")}</DetailRow>
        {p.starting_price_thb != null && <DetailRow label={t("providerStartingPriceLabel")}>{formatTHB(p.starting_price_thb, locale)}</DetailRow>}
      </DetailList>
      <p className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{t("providerContactAfterMatch")}</p>
      {p.verified && <p className="text-xs text-muted-foreground">{t("providerVerifiedExplain")}</p>}
    </DetailPopup>
  );
}
