"use client";

import { useState } from "react";
import { CircleCheck, CopyCheck, Eye, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportSummary } from "@/components/report/report-card";
import { formatFreshness } from "@/lib/freshness";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { Report } from "@/types/report";

// Shown in the new-report form when an open report of the same category is
// close by. It suggests confirming instead of duplicating but never blocks
// creating a new report.
export function DuplicateNotice({
  report,
  now,
  onConfirm,
  onView,
  onDismiss,
}: {
  report: Report;
  now: Date;
  onConfirm: () => Promise<void>;
  onView: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section aria-labelledby="duplicate-title" className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5">
      <div className="flex items-start gap-2">
        <CopyCheck className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
        <div>
          <h3 id="duplicate-title" className="text-sm font-semibold text-amber-950">
            {t("duplicateTitle", { ago: formatFreshness(report.last_verified_at, t, now) })}
          </h3>
          <p className="text-xs text-amber-900">{t("duplicateBody")}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-background p-3">
        <ReportSummary report={report} now={now} distanceM={report.distance_m} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="col-span-2 h-11 rounded-xl" onClick={handleConfirm} disabled={confirming}>
          {confirming ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
          {t("confirmThisReport")}
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl bg-background" onClick={onView}>
          <Eye aria-hidden />
          {t("viewDetails")}
        </Button>
        <Button type="button" variant="outline" className="h-11 rounded-xl bg-background" onClick={onDismiss}>
          <Plus aria-hidden />
          {t("createNewAnyway")}
        </Button>
      </div>
    </section>
  );
}
