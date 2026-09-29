"use client";

import { useState } from "react";
import { ChevronRight, CircleAlert, Plus, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderBrowser } from "@/components/services/provider-browser";
import { CustomerRequestCard, ServiceStatusBadge } from "@/components/services/customer-request-card";
import { ServiceRequestForm } from "@/components/services/service-request-form";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useAuth } from "@/features/auth/auth-provider";
import type { CustomerServicesApi } from "@/features/services/use-customer-services";
import { SERVICE_CATEGORY_META } from "@/lib/service-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { LatLng } from "@/types/community";
import type { ServiceCategory } from "@/types/local-services";

export interface ServiceRequestIntent {
  category: ServiceCategory | null;
  providerName?: string | null;
}

// Local services (commercial): request a mechanic, tow truck or other paid
// service nearby, compare offers and get matched. Deliberately not SOS —
// SOS stays free community help and is linked, never merged.
export function ServicesView({
  services,
  intent,
  onIntentConsumed,
  origin,
  userLocation,
  onUseMyLocation,
  onOpenSos,
  onBack,
  hidden,
}: {
  services: CustomerServicesApi;
  // Opened from a provider card / Nearby: start in the request form.
  intent: ServiceRequestIntent | null;
  onIntentConsumed: () => void;
  origin: LatLng;
  userLocation: LatLng | null;
  onUseMyLocation: () => Promise<LatLng | null>;
  onOpenSos: () => void;
  onBack: () => void;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState<ServiceRequestIntent | null>(intent);
  // An intent from outside replaces the current form once.
  const [seenIntent, setSeenIntent] = useState(intent);
  if (intent !== seenIntent) {
    setSeenIntent(intent);
    if (intent) setForm(intent);
  }

  function closeForm() {
    setForm(null);
    onIntentConsumed();
  }

  return (
    <ViewShell title={t("servicesTitle")} subtitle={t("servicesSubtitle")} onBack={onBack} hidden={hidden}>
      <button
        type="button"
        onClick={onOpenSos}
        className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-left text-sm text-red-900 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <Siren className="size-5 shrink-0 text-red-600" aria-hidden />
        <span className="min-w-0 flex-1">{t("servicesSosHint")}</span>
        <ChevronRight className="size-4 shrink-0" aria-hidden />
      </button>

      {form ? (
        <ServiceRequestForm
          key={`${form.category ?? "none"}:${form.providerName ?? ""}`}
          services={services}
          initialCategory={form.category}
          preferredProviderName={form.providerName}
          userLocation={userLocation}
          onUseMyLocation={onUseMyLocation}
          onCreated={closeForm}
          onCancel={closeForm}
        />
      ) : (
        <Button className="h-12 rounded-xl text-base" onClick={() => setForm({ category: null })}>
          <Plus aria-hidden />
          {t("serviceRequestNew")}
        </Button>
      )}

      {user && services.status === "error" && services.requests.length === 0 && (
        <EmptyState
          icon={<CircleAlert />}
          title={t("serviceRequestsLoadFailed")}
          action={
            <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={services.reload}>
              {t("retry")}
            </Button>
          }
        />
      )}

      {services.active.length > 0 && (
        <section aria-labelledby="my-service-requests" className="flex flex-col gap-2">
          <h2 id="my-service-requests" className="px-1 font-semibold">
            {t("serviceMyRequests")}
          </h2>
          {services.active.map((r) => (
            <CustomerRequestCard key={r.id} request={r} services={services} />
          ))}
        </section>
      )}

      <section aria-labelledby="providers-nearby" className="flex flex-col gap-2">
        <h2 id="providers-nearby" className="px-1 font-semibold">
          {t("servicesProvidersNearby")}
        </h2>
        <ProviderBrowser origin={origin} onRequest={(category, provider) => setForm({ category, providerName: provider?.display_name ?? null })} />
      </section>

      {services.history.length > 0 && (
        <section aria-labelledby="service-history" className="flex flex-col gap-2">
          <h2 id="service-history" className="px-1 font-semibold">
            {t("serviceHistory")}
          </h2>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-xs">
            {services.history.map((r) => {
              const Icon = SERVICE_CATEGORY_META[r.category];
              return (
                <li key={r.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{t(`serviceCategory.${r.category}`)}</span>
                  <ServiceStatusBadge status={r.status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </ViewShell>
  );
}
