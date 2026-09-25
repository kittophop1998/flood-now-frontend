"use client";

import { useState } from "react";
import { Check, CircleAlert, Loader2, Lock, Minus, Phone, Plus, Siren, UsersRound, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SosStatusBadge } from "@/components/community/badges";
import { LocationField, type LocationValue } from "@/components/community/location-field";
import { ViewShell } from "@/components/views/view-shell";
import { useNow } from "@/features/common/use-now";
import type { SosApi } from "@/features/sos/use-sos";
import { SOS_PROGRESS, SOS_TYPE_META } from "@/lib/community-meta";
import { formatClockTime, formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { SOS_TYPES, type LatLng, type SosRequest, type SosType } from "@/types/community";

type PickFn = (title: string, onPick: (p: LatLng) => void) => void;

const EMERGENCY_NUMBERS = ["1669", "1784", "191"];

// SOS: kept separate from normal incident reports. It's shown to opted-in
// community helpers nearby — never presented as dispatched to officials.
export function SosView({
  sos,
  online,
  onBack,
  hidden,
  onUseMyLocation,
  onPick,
}: {
  sos: SosApi;
  online: boolean;
  onBack: () => void;
  hidden?: boolean;
  onUseMyLocation: () => Promise<LatLng | null>;
  onPick: PickFn;
}) {
  const { t } = useTranslation();
  const history = sos.mine.filter((r) => r.id !== sos.active?.id).slice(0, 5);

  return (
    <ViewShell title={t("sosTitle")} subtitle={t("sosSubtitle")} onBack={onBack} hidden={hidden}>
      <EmergencyNumbers />
      {sos.active ? (
        <ActiveSos request={sos.active} sos={sos} />
      ) : (
        <SosForm sos={sos} online={online} onUseMyLocation={onUseMyLocation} onPick={onPick} />
      )}
      {history.length > 0 && (
        <section aria-labelledby="sos-history" className="flex flex-col gap-2">
          <h2 id="sos-history" className="px-1 font-semibold">
            {t("sosHistory")}
          </h2>
          <ul className="flex flex-col divide-y rounded-2xl border bg-card shadow-xs">
            {history.map((r) => {
              const Icon = SOS_TYPE_META[r.type];
              return (
                <li key={r.id} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{t(`sosType.${r.type}`)}</span>
                  <SosStatusBadge status={r.status} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </ViewShell>
  );
}

function EmergencyNumbers() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-red-900">
      <p className="text-sm leading-relaxed font-medium">{t("sosNotOfficial")}</p>
      <div className="flex flex-wrap gap-2">
        {EMERGENCY_NUMBERS.map((n) => (
          <a
            key={n}
            href={`tel:${n}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-red-300 bg-background px-3 text-sm font-semibold text-red-800"
          >
            <Phone className="size-4" aria-hidden />
            {n}
          </a>
        ))}
      </div>
    </section>
  );
}

function SosForm({
  sos,
  online,
  onUseMyLocation,
  onPick,
}: {
  sos: SosApi;
  online: boolean;
  onUseMyLocation: () => Promise<LatLng | null>;
  onPick: PickFn;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<SosType | null>(null);
  const [people, setPeople] = useState(1);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const sending = sos.send.status === "sending";

  function review() {
    if (!type || !location) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setConfirmOpen(true);
  }

  async function submit() {
    if (!type || !location) return;
    setConfirmOpen(false);
    await sos.create({
      type,
      latitude: location.latitude,
      longitude: location.longitude,
      people_count: people,
      description: description.trim() || null,
      contact_phone: phone.trim() || null,
    });
  }

  return (
    <section aria-labelledby="sos-form-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs">
      <h2 id="sos-form-title" className="font-semibold">
        {t("sosFormTitle")}
      </h2>

      {!online && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-red-600 bg-red-50 p-3 text-sm font-semibold text-red-900">
          <WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden />
          {t("sosOfflineWarning")}
        </p>
      )}

      {sos.send.status === "not_sent" && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border-2 border-red-600 bg-red-50 p-3 text-red-900">
          <p className="flex items-center gap-2 text-base font-bold">
            <CircleAlert className="size-5 shrink-0" aria-hidden />
            {t("sosNotSent")}
          </p>
          <p className="text-sm">{sos.send.offline ? t("sosNotSentOffline") : (sos.send.message ?? t("sosNotSentError"))}</p>
          <p className="text-sm font-medium">{t("sosCallInstead")}</p>
          <Button className="h-12 rounded-xl bg-red-600 text-base text-white hover:bg-red-700" onClick={submit} disabled={sending || !type || !location}>
            {t("sosRetrySend")}
          </Button>
        </div>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          {t("sosTypeQuestion")} <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary">{t("required")}</span>
        </legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {SOS_TYPES.map((s) => {
            const Icon = SOS_TYPE_META[s];
            const selected = type === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(s)}
                className={cn(
                  "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-center text-xs leading-tight font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  selected ? "border-red-600 bg-red-50 text-red-900 ring-2 ring-red-600/30" : "bg-background hover:bg-muted",
                  missing && !type && "border-destructive/60",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(`sosType.${s}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <LocationField
        label={t("sosLocation")}
        labelId="sos-location"
        value={location}
        onChange={setLocation}
        onUseMyLocation={onUseMyLocation}
        onPickOnMap={() => onPick(t("pickSosTitle"), setLocation)}
        invalid={missing && !location}
      />

      <div className="flex items-center justify-between gap-3">
        <span id="sos-people" className="text-sm font-semibold">
          {t("sosPeople")}
        </span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="sos-people">
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" aria-label={t("decrease")} onClick={() => setPeople((n) => Math.max(1, n - 1))}>
            <Minus aria-hidden />
          </Button>
          <output className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">
            {people}
          </output>
          <Button type="button" variant="outline" size="icon" className="size-11 rounded-xl" aria-label={t("increase")} onClick={() => setPeople((n) => Math.min(500, n + 1))}>
            <Plus aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sos-description">
          {t("sosDescription")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Textarea
          id="sos-description"
          rows={2}
          maxLength={1000}
          className="text-base"
          placeholder={t("sosDescriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sos-phone">
          {t("contactPhoneLabel")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        </Label>
        <Input id="sos-phone" type="tel" autoComplete="tel" maxLength={32} className="h-11 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("sosPrivacyNote")}
        </p>
      </div>

      {missing && (
        <p role="alert" className="text-sm text-destructive">
          {t("sosMissing")}
        </p>
      )}

      <Button className="h-14 rounded-xl bg-red-600 text-base font-bold text-white hover:bg-red-700" onClick={review} disabled={sending || !online}>
        {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Siren aria-hidden />}
        {sending ? t("sosSending") : t("sosSend")}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{t("sosConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("sosConfirmBody")}</DialogDescription>
          </DialogHeader>
          {type && (
            <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-medium">
              {(() => {
                const Icon = SOS_TYPE_META[type];
                return <Icon className="size-4" aria-hidden />;
              })()}
              {t(`sosType.${type}`)} · {t("personCountOther", { n: people })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirmOpen(false)}>
              {t("cancel")}
            </Button>
            <Button className="h-11 rounded-xl bg-red-600 text-white hover:bg-red-700" onClick={submit}>
              <Siren aria-hidden />
              {t("sosConfirmSend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ActiveSos({ request, sos }: { request: SosRequest; sos: SosApi }) {
  const { t, locale } = useTranslation();
  const now = useNow();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = SOS_TYPE_META[request.type];
  const reached = new Map(request.events.map((e) => [e.status, e.created_at]));
  const currentStep = SOS_PROGRESS.indexOf(request.status);

  async function act(status: "cancelled" | "completed") {
    setBusy(true);
    await sos.setStatus(request.id, status);
    setBusy(false);
    setConfirmCancel(false);
  }

  return (
    <section aria-labelledby="sos-active-title" className="flex flex-col gap-4 rounded-2xl border-2 border-red-600 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="sos-active-title" className="text-lg font-bold">
            {t("sosActiveTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`sosType.${request.type}`)} · {t("sosSentAgo", { ago: formatFreshness(request.created_at, t, now) })}
          </p>
        </div>
        <SosStatusBadge status={request.status} />
      </div>

      <p className="rounded-xl bg-muted px-3 py-2.5 text-sm" aria-live="polite">
        {t(`sosStatusHint.${request.status}`)}
        {request.status === "waiting" && request.nearby_helper_count != null && (
          <span className="mt-1 flex items-center gap-1.5 font-medium">
            <UsersRound className="size-4" aria-hidden />
            {request.nearby_helper_count > 0 ? t("sosHelpersNearby", { n: request.nearby_helper_count }) : t("sosNoHelpersNearby")}
          </span>
        )}
      </p>

      <ol className="flex flex-col gap-0" aria-label={t("sosTimeline")}>
        {SOS_PROGRESS.map((step, i) => {
          const done = i <= currentStep;
          const at = reached.get(step);
          return (
            <li key={step} className="flex items-start gap-3">
              <span className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 text-xs",
                    done ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-background text-slate-400",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                {i < SOS_PROGRESS.length - 1 && <span className={cn("h-5 w-0.5", i < currentStep ? "bg-teal-600" : "bg-slate-200")} aria-hidden />}
              </span>
              <span className={cn("pt-1 text-sm", done ? "font-medium" : "text-muted-foreground")}>
                {t(`sosStatus.${step}`)}
                {at && done && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{formatClockTime(at, locale, now)}</span>}
                <span className="sr-only">{done ? t("done") : t("notYet")}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {request.helper && (
        <div className="flex flex-col gap-1 rounded-xl border bg-teal-50 p-3 text-sm text-teal-950">
          <p className="font-semibold">{t("sosHelperAssigned", { name: request.helper.display_name ?? t("sosHelperAnonymous") })}</p>
          {request.helper.contact_phone && (
            <a href={`tel:${request.helper.contact_phone}`} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary underline-offset-2 hover:underline">
              <Phone className="size-4" aria-hidden />
              {request.helper.contact_phone}
            </a>
          )}
        </div>
      )}

      {sos.actionError && (
        <p role="alert" className="text-sm text-destructive">
          {sos.actionError}
        </p>
      )}

      {request.status === "arrived" && (
        <Button className="h-12 rounded-xl text-base" onClick={() => act("completed")} disabled={busy}>
          <Check aria-hidden />
          {t("sosMarkCompleted")}
        </Button>
      )}
      {confirmCancel ? (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <p className="text-sm font-medium">{t("sosCancelConfirm")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirmCancel(false)}>
              {t("sosKeep")}
            </Button>
            <Button variant="destructive" className="h-11 rounded-xl" onClick={() => act("cancelled")} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {t("sosCancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => setConfirmCancel(true)}>
          {t("sosCancel")}
        </Button>
      )}
    </section>
  );
}
