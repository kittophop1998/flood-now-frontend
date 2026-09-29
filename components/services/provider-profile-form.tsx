"use client";

import { useState } from "react";
import { Loader2, Lock, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { MapLocationPicker } from "@/components/map/map-location-picker";
import { ImagePicker } from "@/components/report/image-picker";
import { useImageUpload } from "@/features/reports/use-image-upload";
import { formatDistance } from "@/lib/distance";
import { SERVICE_CATEGORY_META } from "@/lib/service-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/types/community";
import { SERVICE_CATEGORIES, SERVICE_RADII_M, type MyProvider, type ProviderInput, type ServiceCategory } from "@/types/local-services";

type Errors = Partial<Record<"name" | "categories" | "phone" | "location" | "price", true>>;

// Create or edit the user's service-provider (shop/business) profile.
// Registering is free; a verified badge is only ever granted by FloodNow
// after a review — it isn't set here and can't be bought.
export function ProviderProfileForm({
  provider,
  userLocation,
  onUseMyLocation,
  onSave,
  onCancel,
}: {
  provider: MyProvider | null;
  userLocation: LatLng | null;
  onUseMyLocation: () => Promise<LatLng | null>;
  // Returns an error message (or "network"), null on success.
  onSave: (input: ProviderInput) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(provider?.display_name ?? "");
  const [categories, setCategories] = useState<ServiceCategory[]>(provider?.categories ?? []);
  const [description, setDescription] = useState(provider?.description ?? "");
  const [phone, setPhone] = useState(provider?.phone ?? "");
  const [line, setLine] = useState(provider?.line_id ?? "");
  const [location, setLocation] = useState<LocationValue | null>(
    provider ? { latitude: provider.latitude, longitude: provider.longitude, label: provider.location_name ?? undefined } : null,
  );
  const [radius, setRadius] = useState(provider?.service_radius_m ?? 10000);
  const [hours, setHours] = useState(provider?.business_hours ?? "");
  const [mobile, setMobile] = useState(provider?.mobile_service ?? false);
  const [available, setAvailable] = useState(provider?.available ?? true);
  const [price, setPrice] = useState(provider?.starting_price_thb != null ? String(provider.starting_price_thb) : "");
  const [logoKey, setLogoKey] = useState(provider?.logo_key ?? null);
  const [picker, setPicker] = useState<{ search: boolean } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logo = useImageUpload();

  function toggle(c: ServiceCategory) {
    setCategories((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  }

  async function save() {
    const priceNum = price.trim() === "" ? null : Number(price);
    const next: Errors = {};
    if (!name.trim()) next.name = true;
    if (categories.length === 0) next.categories = true;
    if (phone.trim().length < 3) next.phone = true;
    if (!location) next.location = true;
    if (priceNum != null && (!Number.isInteger(priceNum) || priceNum < 0)) next.price = true;
    setErrors(next);
    if (Object.keys(next).length > 0 || !location) return;
    if (logo.state.status === "uploading" || logo.state.status === "failed") return;
    setSaving(true);
    setError(null);
    const err = await onSave({
      display_name: name.trim(),
      categories,
      description: description.trim() || null,
      phone: phone.trim(),
      line_id: line.trim() || null,
      latitude: location.latitude,
      longitude: location.longitude,
      // "My location" is our own label for a GPS fix, not a place name.
      location_name: location.label && location.label !== t("myLocation") ? location.label : null,
      service_radius_m: radius,
      business_hours: hours.trim() || null,
      mobile_service: mobile,
      available,
      starting_price_thb: priceNum,
      logo_key: logo.state.status === "uploaded" ? logo.state.objectKey : logoKey,
    });
    setSaving(false);
    if (err) setError(err === "network" ? t("serviceRequestNetworkError") : err);
  }

  const optionClass = "min-h-11 rounded-xl border px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <section aria-labelledby="provider-form-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 id="provider-form-title" className="font-semibold">
        {provider ? t("providerEditProfile") : t("providerOnboardingTitle")}
      </h2>

      <div className="grid gap-1.5">
        <Label htmlFor="provider-name">{t("providerName")}</Label>
        <Input id="provider-name" maxLength={80} className="h-11 text-base" value={name} aria-invalid={errors.name} onChange={(e) => setName(e.target.value)} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("providerCategories")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {SERVICE_CATEGORIES.map((c) => {
            const Icon = SERVICE_CATEGORY_META[c];
            const on = categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  on ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
                  errors.categories && "border-destructive/60",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(`serviceCategory.${c}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="provider-description">
          {t("providerDescription")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Textarea id="provider-description" rows={3} maxLength={2000} className="text-base" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="provider-phone">{t("contactPhoneLabel")}</Label>
          <Input id="provider-phone" type="tel" maxLength={32} className="h-11 text-base" value={phone} aria-invalid={errors.phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="provider-line">
            LINE <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input id="provider-line" maxLength={64} className="h-11 text-base" placeholder="@myshop" value={line} onChange={(e) => setLine(e.target.value)} />
        </div>
      </div>
      <p className="-mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("providerContactPrivacy")}
      </p>

      <LocationField
        label={t("providerLocation")}
        labelId="provider-location"
        value={location}
        onChange={setLocation}
        onUseMyLocation={onUseMyLocation}
        onPickOnMap={() => setPicker({ search: false })}
        onSearch={() => setPicker({ search: true })}
        invalid={errors.location}
      />
      {picker && (
        <MapLocationPicker
          title={t("providerPickLocation")}
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

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("providerServiceRadius")}</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-5">
          {SERVICE_RADII_M.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={radius === r}
              onClick={() => setRadius(r)}
              className={cn(optionClass, radius === r ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted")}
            >
              {formatDistance(r, t)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="provider-hours">
            {t("providerHours")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input id="provider-hours" maxLength={200} className="h-11 text-base" placeholder={t("providerHoursPlaceholder")} value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="provider-price">
            {t("providerStartingPriceLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </Label>
          <Input
            id="provider-price"
            inputMode="numeric"
            className="h-11 text-base"
            placeholder="฿"
            value={price}
            aria-invalid={errors.price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
        {t("providerMobileServiceQuestion")}
        <Switch checked={mobile} onCheckedChange={setMobile} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
        {t("providerAvailableToggle")}
        <Switch checked={available} onCheckedChange={setAvailable} />
      </label>

      <div className="grid gap-1.5">
        <span className="text-sm font-semibold">
          {t("providerLogo")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </span>
        {logoKey && provider?.logo_url && logo.state.status === "empty" ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={provider.logo_url} alt="" className="size-16 rounded-xl border object-cover" />
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setLogoKey(null)}>
              <Trash2 aria-hidden />
              {t("providerLogoRemove")}
            </Button>
          </div>
        ) : (
          <ImagePicker state={logo.state} onSelect={logo.select} onRetry={logo.retry} onRemove={logo.remove} />
        )}
      </div>

      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {t("providerFormMissing")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="outline" className="h-12 rounded-xl" onClick={onCancel} disabled={saving}>
            {t("cancel")}
          </Button>
        )}
        <Button className="h-12 flex-1 rounded-xl text-base" onClick={save} disabled={saving || logo.state.status === "uploading"}>
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {provider ? t("providerSave") : t("providerRegister")}
        </Button>
      </div>
    </section>
  );
}
