"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MapPin, Users, Phone, Baby, PersonStanding, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TypeBadge, SeverityBadge } from "@/components/report/report-badges";
import { FreshnessLabel } from "@/components/report/freshness-label";
import { useConfirmReport } from "@/features/reports/use-confirm-report";
import { getConfirmedStatus, setConfirmedStatus } from "@/lib/confirmed-reports";
import { imageKitUrl } from "@/lib/imagekit";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { ConfirmationStatus, Report } from "@/types/report";

// Callers must render this with `key={report.id}` so switching reports
// remounts the component — that lets deviceStatus initialize lazily from
// localStorage instead of syncing it via an effect.
export function ReportDetail({ report, onConfirmed }: { report: Report; onConfirmed: (updated: Report) => void }) {
  const { t } = useTranslation();
  const { confirm, pendingStatus, error } = useConfirmReport();
  const [deviceStatus, setDeviceStatus] = useState<ConfirmationStatus | null>(() => getConfirmedStatus(report.id));

  async function handleConfirm(status: ConfirmationStatus) {
    const updated = await confirm(report.id, status);
    if (updated) {
      setConfirmedStatus(report.id, status);
      setDeviceStatus(status);
      onConfirmed(updated);
    }
  }

  const imageUrl = report.image_url ?? imageKitUrl(report.image_key);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={report.type} />
        <SeverityBadge severity={report.severity} />
      </div>

      <FreshnessLabel lastVerifiedAt={report.last_verified_at} isExpired={report.is_expired} />

      {report.type === "help_needed" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {t("helpNotDispatchNotice")}
        </div>
      )}

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={t("reportPhotoAlt")} className="h-48 w-full rounded-lg object-cover" />
      )}

      {report.description && <p className="text-sm leading-relaxed">{report.description}</p>}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="size-4 shrink-0" aria-hidden />
        {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
      </div>

      {report.water_level_cm != null && (
        <div className="text-sm">
          <span className="font-medium">{t("waterLevelLabel")}</span> {report.water_level_cm} {t("cmUnit")}
        </div>
      )}

      {report.type === "help_needed" && (
        <div className="grid gap-2 rounded-lg border p-3 text-sm">
          {report.people_count != null && (
            <div className="flex items-center gap-2">
              <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t(report.people_count === 1 ? "personCountOne" : "personCountOther", { n: report.people_count })}
            </div>
          )}
          {report.has_child && (
            <div className="flex items-center gap-2">
              <Baby className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("childPresent")}
            </div>
          )}
          {report.has_elderly && (
            <div className="flex items-center gap-2">
              <PersonStanding className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("elderlyPresent")}
            </div>
          )}
          {report.contact_phone && (
            <a href={`tel:${report.contact_phone}`} className="flex items-center gap-2 text-primary">
              <Phone className="size-4 shrink-0" aria-hidden />
              {report.contact_phone}
            </a>
          )}
        </div>
      )}

      <Separator />

      <div>
        <p className="mb-2 text-sm font-medium">{t("stillAccurateQuestion")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={deviceStatus === "still_active" ? "default" : "outline"}
            className={cn("h-12", deviceStatus === "still_active" && "ring-2 ring-primary ring-offset-2")}
            disabled={pendingStatus !== null}
            onClick={() => handleConfirm("still_active")}
          >
            {pendingStatus === "still_active" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {t("stillActive")}
          </Button>
          <Button
            type="button"
            variant={deviceStatus === "cleared" ? "default" : "outline"}
            className={cn("h-12", deviceStatus === "cleared" && "ring-2 ring-primary ring-offset-2")}
            disabled={pendingStatus !== null}
            onClick={() => handleConfirm("cleared")}
          >
            {pendingStatus === "cleared" ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            {t("cleared")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("confirmationSummary", { stillActive: report.still_active_count, cleared: report.cleared_count })}
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
