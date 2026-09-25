"use client";

import { useState, type ReactNode } from "react";
import { CircleCheck, CircleDashed, Loader2, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FreshnessLabel } from "@/components/report/freshness-label";
import { useConfirmReport } from "@/features/reports/use-confirm-report";
import { getConfirmedStatus, setConfirmedStatus } from "@/lib/confirmed-reports";
import { distanceMeters, formatDistance } from "@/lib/distance";
import { formatClockTime } from "@/lib/freshness";
import { imageKitUrl } from "@/lib/imagekit";
import { REPORT_TYPE_META, SEVERITY_META, passabilityLabel, reportTypeLabel, severityLabel } from "@/lib/report-meta";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { ConfirmationStatus, Report } from "@/types/report";

type LatLng = { latitude: number; longitude: number };

// Rendered inside a <DialogContent> (it uses DialogTitle/DialogDescription).
// Callers must render this with `key={report.id}` so switching reports
// remounts the component — that lets deviceStatus initialize lazily from
// localStorage instead of syncing it via an effect.
export function ReportDetail({
  report,
  userLocation,
  onConfirmed,
}: {
  report: Report;
  userLocation?: LatLng | null;
  onConfirmed: (updated: Report) => void;
}) {
  const { t, locale } = useTranslation();
  const { confirm, pendingStatus, error } = useConfirmReport();
  const [deviceStatus, setDeviceStatus] = useState<ConfirmationStatus | null>(() => getConfirmedStatus(report.id));
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showCoords, setShowCoords] = useState(false);

  async function handleConfirm(status: ConfirmationStatus) {
    setJustConfirmed(false);
    const updated = await confirm(report.id, status);
    if (updated) {
      setConfirmedStatus(report.id, status);
      setDeviceStatus(status);
      setJustConfirmed(true);
      onConfirmed(updated);
    }
  }

  const typeMeta = REPORT_TYPE_META[report.type];
  const TypeIcon = typeMeta.icon;
  const severityMeta = SEVERITY_META[report.severity];
  const SeverityIcon = severityMeta.icon;
  const imageUrl = report.image_url ?? imageKitUrl(report.image_key);
  const vulnerable = [report.has_child && t("childrenValue"), report.has_elderly && t("elderlyValue")].filter(Boolean);

  // The API has no address field and the app has no geocoder, so the
  // human-readable location is distance-from-you when we know where the user
  // is; raw coordinates stay one tap away.
  const locationText = userLocation
    ? t("locationDistance", { d: formatDistance(distanceMeters(userLocation, report), t) })
    : t("locationPinned");

  return (
    <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
      <DialogHeader className="gap-3">
        <DialogTitle className="flex flex-col gap-2.5 pr-8 leading-normal">
          <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", typeMeta.color)}>
            <TypeIcon className="size-4" aria-hidden />
            {reportTypeLabel(t, report.type)}
          </span>
          <span className="sr-only"> — </span>
          <span className="flex items-center gap-2.5 text-xl leading-tight font-semibold text-foreground">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", severityMeta.iconClass)}>
              <SeverityIcon className="size-[18px]" aria-hidden />
            </span>
            {passabilityLabel(t, report.severity)}
          </span>
        </DialogTitle>

        <div className="flex gap-2.5 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <DialogDescription className="text-foreground">{locationText}</DialogDescription>
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
              aria-expanded={showCoords}
              onClick={() => setShowCoords((v) => !v)}
            >
              {showCoords ? t("hideCoordinates") : t("showCoordinates")}
            </button>
            {showCoords && (
              <p className="text-xs text-muted-foreground tabular-nums select-all">
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </p>
            )}
          </div>
        </div>

        <FreshnessLabel report={report} />
      </DialogHeader>

      {report.type === "help_needed" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">{t("helpNotDispatchNotice")}</p>
      )}

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={t("reportPhotoAlt")}
          loading="lazy"
          className="aspect-[16/10] max-h-60 w-full rounded-xl bg-muted object-cover"
        />
      )}

      <Section title={t("situationHeading")}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          {report.water_level_cm != null && (
            <Row label={t("waterLevelLabel")}>{t("waterLevelValue", { n: report.water_level_cm })}</Row>
          )}
          <Row label={t("trafficLabel")}>
            <span className={severityMeta.textClass}>{severityLabel(t, report.severity)}</span>
          </Row>
          {report.people_count != null && (
            <Row label={t("peopleCountLabel")}>
              {t(report.people_count === 1 ? "personCountOne" : "personCountOther", { n: report.people_count })}
            </Row>
          )}
          {vulnerable.length > 0 && <Row label={t("vulnerableLabel")}>{vulnerable.join(", ")}</Row>}
          {report.contact_phone && (
            <Row label={t("contactLabel")}>
              <a
                href={`tel:${report.contact_phone}`}
                className="inline-flex items-center gap-1.5 text-primary underline-offset-2 hover:underline"
              >
                <Phone className="size-3.5" aria-hidden />
                {report.contact_phone}
              </a>
            </Row>
          )}
          <Row label={t("reportedAtLabel")}>
            <time dateTime={report.created_at}>{formatClockTime(report.created_at, locale)}</time>
          </Row>
        </dl>
      </Section>

      {report.description?.trim() && (
        <Section title={t("descriptionHeading")}>
          <p className="max-w-prose text-sm leading-relaxed break-words whitespace-pre-line">{report.description}</p>
        </Section>
      )}

      <Separator />

      <Section title={t("stillAccurateQuestion")}>
        <div className="grid grid-cols-2 gap-2">
          <ConfirmButton
            selected={deviceStatus === "still_active"}
            pending={pendingStatus === "still_active"}
            disabled={pendingStatus !== null}
            icon={<CircleCheck />}
            onClick={() => handleConfirm("still_active")}
          >
            {t("stillActive")}
          </ConfirmButton>
          <ConfirmButton
            selected={deviceStatus === "cleared"}
            pending={pendingStatus === "cleared"}
            disabled={pendingStatus !== null}
            icon={<CircleDashed />}
            onClick={() => handleConfirm("cleared")}
          >
            {t("cleared")}
          </ConfirmButton>
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          {t("confirmationSummary", { stillActive: report.still_active_count, cleared: report.cleared_count })}
        </p>
        <div aria-live="polite" className="text-sm empty:hidden">
          {error ? (
            <p className="mt-2 text-destructive">{error}</p>
          ) : (
            justConfirmed && <p className="mt-2 text-emerald-700">{t("confirmSuccess")}</p>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </>
  );
}

function ConfirmButton({
  selected,
  pending,
  disabled,
  icon,
  onClick,
  children,
}: {
  selected: boolean;
  pending: boolean;
  disabled: boolean;
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="lg"
      variant={selected ? "default" : "outline"}
      aria-pressed={selected}
      aria-busy={pending}
      disabled={disabled}
      onClick={onClick}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
    </Button>
  );
}
