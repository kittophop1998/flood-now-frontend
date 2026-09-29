"use client";

import { useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { MapLocationPicker } from "@/components/map/map-location-picker";
import { ImagePicker } from "@/components/report/image-picker";
import { useAuth } from "@/features/auth/auth-provider";
import { useImageUpload } from "@/features/reports/use-image-upload";
import type { CustomerServicesApi } from "@/features/services/use-customer-services";
import { SERVICE_CATEGORY_META, VEHICLE_SERVICE_CATEGORIES } from "@/lib/service-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/types/community";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/types/local-services";

// A commercial service request — never an SOS. Everything typed stays in
// this form while a guest signs in; sending then continues. The exact point
// and phone go only to the provider the customer ends up matched with.
export function ServiceRequestForm({
  services,
  initialCategory,
  preferredProviderName,
  userLocation,
  onUseMyLocation,
  onCreated,
  onCancel,
}: {
  services: CustomerServicesApi;
  initialCategory: ServiceCategory | null;
  // Opened from a provider's card: say so (the request still goes to every
  // matching provider nearby; that one can quote too).
  preferredProviderName?: string | null;
  userLocation: LatLng | null;
  onUseMyLocation: () => Promise<LatLng | null>;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { user, requireAuth } = useAuth();
  const [category, setCategory] = useState<ServiceCategory | null>(initialCategory);
  const [description, setDescription] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [picker, setPicker] = useState<{ search: boolean } | null>(null);
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const image = useImageUpload();
  const takesVehicle = category != null && VEHICLE_SERVICE_CATEGORIES.includes(category);

  async function send() {
    if (!category || !location || phone.trim().length < 3) {
      setMissing(true);
      return;
    }
    if (image.state.status === "uploading" || image.state.status === "failed") return;
    setMissing(false);
    setSending(true);
    setError(null);
    const result = await services.create({
      category,
      description: description.trim() || null,
      vehicle_info: takesVehicle ? vehicle.trim() || null : null,
      image_key: image.state.status === "uploaded" ? image.state.objectKey : null,
      latitude: location.latitude,
      longitude: location.longitude,
      // "My location" is our own label for a GPS fix, not a place name.
      location_name: location.label && location.label !== t("myLocation") ? location.label : null,
      contact_phone: phone.trim(),
    });
    setSending(false);
    if (typeof result === "string") {
      setError(result === "network" ? t("serviceRequestNetworkError") : result);
      return;
    }
    onCreated();
  }

  return (
    <section aria-labelledby="service-form-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <div>
        <h2 id="service-form-title" className="font-semibold">
          {t("serviceRequestFormTitle")}
        </h2>
        {preferredProviderName && <p className="mt-0.5 text-sm text-muted-foreground">{t("serviceRequestFromProvider", { name: preferredProviderName })}</p>}
      </div>

      {!user && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("serviceRequestSignInNote")}
        </p>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          {t("serviceRequestCategory")} <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary">{t("required")}</span>
        </legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {SERVICE_CATEGORIES.map((c) => {
            const Icon = SERVICE_CATEGORY_META[c];
            const on = category === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCategory(c)}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-xs leading-tight font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on ? "border-primary bg-accent text-primary ring-2 ring-primary/25" : "bg-background hover:bg-muted",
                  missing && !category && "border-destructive/60",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(`serviceCategory.${c}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="service-description">
          {t("serviceRequestDetails")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Textarea
          id="service-description"
          rows={3}
          maxLength={1000}
          className="text-base"
          placeholder={t("serviceRequestDetailsPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {takesVehicle && (
        <div className="grid gap-1.5">
          <Label htmlFor="service-vehicle">
            {t("serviceRequestVehicle")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input
            id="service-vehicle"
            maxLength={120}
            className="h-11 text-base"
            placeholder={t("serviceRequestVehiclePlaceholder")}
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
          />
        </div>
      )}

      <LocationField
        label={t("serviceRequestLocation")}
        labelId="service-location"
        value={location}
        onChange={setLocation}
        onUseMyLocation={onUseMyLocation}
        onPickOnMap={() => setPicker({ search: false })}
        onSearch={() => setPicker({ search: true })}
        invalid={missing && !location}
      />
      {picker && (
        <MapLocationPicker
          title={t("serviceRequestPickLocation")}
          value={location}
          initialCenter={userLocation}
          autoFocusSearch={picker.search}
          onCancel={() => setPicker(null)}
          onConfirm={(next) => {
            setLocation(next);
            setPicker(null);
          }}
        />
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="service-phone">
          {t("contactPhoneLabel")} <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary">{t("required")}</span>
        </Label>
        <Input
          id="service-phone"
          type="tel"
          autoComplete="tel"
          maxLength={32}
          className="h-11 text-base"
          aria-invalid={missing && phone.trim().length < 3}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("serviceRequestPrivacy")}
        </p>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">
          {t("stepPhoto")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </span>
        <ImagePicker state={image.state} onSelect={image.select} onRetry={image.retry} onRemove={image.remove} />
      </div>

      <p className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">{t("servicePaymentOutside")}</p>

      {missing && (
        <p role="alert" className="text-sm text-destructive">
          {t("serviceRequestMissing")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="h-12 rounded-xl" onClick={onCancel} disabled={sending}>
          {t("cancel")}
        </Button>
        <Button className="h-12 flex-1 rounded-xl text-base" onClick={() => requireAuth("serviceRequest", send)} disabled={sending || image.state.status === "uploading"}>
          {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {t("serviceRequestSend")}
        </Button>
      </div>
    </section>
  );
}
