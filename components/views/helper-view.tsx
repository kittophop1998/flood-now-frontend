"use client";

import { useState } from "react";
import { CircleAlert, Handshake, Loader2, LocateFixed, Lock, Navigation, Phone, SearchX, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SosStatusBadge, ToneBadge } from "@/components/community/badges";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useNow } from "@/features/common/use-now";
import { useHelper } from "@/features/sos/use-helper";
import type { SosApi } from "@/features/sos/use-sos";
import { CAPABILITY_META, SOS_TYPE_META } from "@/lib/community-meta";
import { directionsUrl } from "@/lib/directions";
import { formatDistance } from "@/lib/distance";
import { formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { CAPABILITIES, HELPER_RADII_M, type Capability, type HelperProfile, type LatLng, type SosRequest, type SosStatus } from "@/types/community";

// Helper mode: opt in with capabilities + radius, see waiting SOS requests
// you can answer (matched by capability + distance, redacted until
// accepted), accept one and update its status.
export function HelperView({
  sos,
  userLocation,
  locationBlocked,
  onLocate,
  onBack,
  hidden,
}: {
  sos: SosApi;
  userLocation: LatLng | null;
  locationBlocked: boolean;
  onLocate: () => void;
  onBack: () => void;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const helper = useHelper(userLocation);
  const openAssignments = sos.assignments.filter((a) => a.status !== "completed" && a.status !== "cancelled");

  return (
    <ViewShell title={t("helperTitle")} subtitle={t("helperSubtitle")} onBack={onBack} hidden={hidden}>
      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{t("helperSafetyNote")}</p>

      {helper.profileStatus === "loading" && !helper.profile ? (
        <div className="h-40 animate-pulse rounded-2xl bg-background" aria-hidden />
      ) : (
        // Re-seed the form once when the server profile arrives (it starts from the offline copy).
        <HelperProfileForm key={helper.profileStatus} helper={helper} userLocation={userLocation} />
      )}

      {openAssignments.length > 0 && (
        <section aria-labelledby="helper-assignments" className="flex flex-col gap-2">
          <h2 id="helper-assignments" className="px-1 font-semibold">
            {t("helperAssignments")}
          </h2>
          {sos.actionError && (
            <p role="alert" className="text-sm text-destructive">
              {sos.actionError}
            </p>
          )}
          {openAssignments.map((a) => (
            <AssignmentCard key={a.id} request={a} sos={sos} />
          ))}
        </section>
      )}

      {helper.profile?.active && (
        <section aria-labelledby="helper-nearby" className="flex flex-col gap-2">
          <h2 id="helper-nearby" className="px-1 font-semibold">
            {t("helperNearby")}
          </h2>
          {!userLocation ? (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <CircleAlert className="size-5 shrink-0 text-amber-700" aria-hidden />
              <p className="min-w-0 flex-1">{locationBlocked ? t("locationDenied") : t("helperNeedsLocation")}</p>
              {!locationBlocked && (
                <Button variant="outline" className="h-11 shrink-0 rounded-xl bg-background" onClick={onLocate}>
                  <LocateFixed aria-hidden />
                  {t("useMyLocation")}
                </Button>
              )}
            </div>
          ) : (
            <NearbyList helper={helper} sos={sos} />
          )}
        </section>
      )}
    </ViewShell>
  );
}

function HelperProfileForm({ helper, userLocation }: { helper: ReturnType<typeof useHelper>; userLocation: LatLng | null }) {
  const { t } = useTranslation();
  const p: HelperProfile | null = helper.profile;
  const [active, setActive] = useState(p?.active ?? false);
  const [caps, setCaps] = useState<Capability[]>(p?.capabilities ?? []);
  const [radius, setRadius] = useState(p?.radius_m ?? 3000);
  const [name, setName] = useState(p?.display_name ?? "");
  const [phone, setPhone] = useState(p?.contact_phone ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (active && caps.length === 0) {
      setLocalError(t("helperNeedsCapability"));
      return;
    }
    setLocalError(null);
    const ok = await helper.save({
      active,
      capabilities: caps,
      radius_m: radius,
      display_name: name.trim() || null,
      contact_phone: phone.trim() || null,
      ...(userLocation ?? {}),
    });
    setSaved(ok);
  }

  return (
    <section aria-labelledby="helper-profile" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="helper-active" id="helper-profile" className="text-base font-semibold">
          {t("helperActive")}
        </Label>
        <Switch id="helper-active" checked={active} onCheckedChange={(v) => { setActive(v); setSaved(false); }} />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("helperCapabilities")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {CAPABILITIES.map((c) => {
            const Icon = CAPABILITY_META[c];
            const selected = caps.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCaps(selected ? caps.filter((x) => x !== c) : [...caps, c]);
                  setSaved(false);
                }}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {t(`capability.${c}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("helperRadius")}</legend>
        <div role="radiogroup" className="grid grid-cols-4 gap-2">
          {HELPER_RADII_M.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={radius === r}
              onClick={() => {
                setRadius(r);
                setSaved(false);
              }}
              className={cn(
                "min-h-11 rounded-xl border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                radius === r ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {formatDistance(r, t)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="helper-name">
          {t("helperDisplayName")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Input id="helper-name" maxLength={60} className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="helper-phone">
          {t("contactPhoneLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Input id="helper-phone" type="tel" maxLength={32} className="h-11 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("helperPrivacyNote")}
        </p>
      </div>

      {(localError || helper.saveError) && (
        <p role="alert" className="text-sm text-destructive">
          {localError ?? helper.saveError}
        </p>
      )}
      {saved && !helper.saving && (
        <p role="status" className="text-sm text-teal-700">
          {t("helperSaved")}
        </p>
      )}
      <Button className="h-12 rounded-xl text-base" onClick={save} disabled={helper.saving}>
        {helper.saving && <Loader2 className="animate-spin" aria-hidden />}
        {t("helperSave")}
      </Button>
    </section>
  );
}

function NearbyList({ helper, sos }: { helper: ReturnType<typeof useHelper>; sos: SosApi }) {
  const { t } = useTranslation();
  const now = useNow();
  const [accepting, setAccepting] = useState<string | null>(null);

  if (helper.nearbyStatus === "loading") return <div className="h-24 animate-pulse rounded-2xl bg-background" aria-hidden />;
  if (helper.nearbyStatus === "error")
    return (
      <EmptyState
        icon={<CircleAlert />}
        title={t("helperNearbyFailed")}
        action={
          <Button variant="outline" className="mt-2 h-11 rounded-xl" onClick={helper.reloadNearby}>
            {t("retry")}
          </Button>
        }
      />
    );
  if (helper.nearby.length === 0) return <EmptyState icon={<SearchX />} title={t("helperNoSos")} hint={t("helperNoSosHint")} />;

  return (
    <ul className="flex flex-col gap-2" aria-live="polite">
      {helper.nearby.map((s) => {
        const Icon = SOS_TYPE_META[s.type];
        return (
          <li key={s.id} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t(`sosType.${s.type}`)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("distanceAway", { d: formatDistance(s.distance_m, t) })} · {formatFreshness(s.created_at, t, now)}
                  {s.people_count ? <> · {t("personCountOther", { n: s.people_count })}</> : null}
                </p>
              </div>
            </div>
            {s.description && <p className="text-sm break-words whitespace-pre-line">{s.description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {s.required_capabilities.slice(0, 4).map((c) => (
                <ToneBadge key={c} icon={CAPABILITY_META[c]} tone="muted">
                  {t(`capability.${c}`)}
                </ToneBadge>
              ))}
            </div>
            <Button
              className="h-12 rounded-xl text-base"
              disabled={accepting !== null}
              onClick={async () => {
                setAccepting(s.id);
                const ok = await sos.accept(s.id);
                setAccepting(null);
                if (!ok) helper.reloadNearby();
              }}
            >
              {accepting === s.id ? <Loader2 className="animate-spin" aria-hidden /> : <Handshake aria-hidden />}
              {t("helperAccept")}
            </Button>
          </li>
        );
      })}
      {sos.actionError && (
        <li role="alert" className="text-sm text-destructive">
          {sos.actionError}
        </li>
      )}
    </ul>
  );
}

const NEXT_ACTIONS: Partial<Record<SosStatus, { to: SosStatus; label: "helperOnTheWay" | "helperArrived" | "helperComplete" }[]>> = {
  matched: [{ to: "on_the_way", label: "helperOnTheWay" }],
  on_the_way: [{ to: "arrived", label: "helperArrived" }],
  arrived: [{ to: "completed", label: "helperComplete" }],
};

function AssignmentCard({ request, sos }: { request: SosRequest; sos: SosApi }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const Icon = SOS_TYPE_META[request.type];

  async function go(to: SosStatus) {
    setBusy(true);
    await sos.setStatus(request.id, to);
    setBusy(false);
    setConfirmWithdraw(false);
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-card p-3.5 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(`sosType.${request.type}`)}</p>
          {request.people_count ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <UsersRound className="size-3.5" aria-hidden />
              {t("personCountOther", { n: request.people_count })}
            </p>
          ) : null}
        </div>
        <SosStatusBadge status={request.status} />
      </div>
      {request.description && <p className="text-sm break-words whitespace-pre-line">{request.description}</p>}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={directionsUrl(request.latitude, request.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Navigation className="size-4" aria-hidden />
          {t("directions")}
        </a>
        {request.contact_phone ? (
          <a
            href={`tel:${request.contact_phone}`}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Phone className="size-4" aria-hidden />
            {request.contact_phone}
          </a>
        ) : (
          <span className="inline-flex h-11 items-center justify-center rounded-xl border border-dashed px-2 text-center text-xs text-muted-foreground">
            {t("helperNoContact")}
          </span>
        )}
      </div>
      {(NEXT_ACTIONS[request.status] ?? []).map((a) => (
        <Button key={a.to} className="h-12 rounded-xl text-base" disabled={busy} onClick={() => go(a.to)}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t(a.label)}
        </Button>
      ))}
      {request.status !== "arrived" &&
        (confirmWithdraw ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirmWithdraw(false)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" className="h-11 rounded-xl" disabled={busy} onClick={() => go("waiting")}>
              {t("helperWithdrawConfirm")}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => setConfirmWithdraw(true)}>
            {t("helperWithdraw")}
          </Button>
        ))}
    </article>
  );
}
