"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reportsService } from "@/services/reports-service";
import { ApiError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import { PROBLEM_REASONS, type ProblemReason } from "@/types/report";

// "Report a problem" with an incident. Several independent reports hide it
// pending review (deterministic threshold on the server).
export function ReportProblemDialog({ reportId, open, onOpenChange }: { reportId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ProblemReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) {
      setError(t("problemChooseReason"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await reportsService.reportProblem(reportId, { device_id: getDeviceId(), reason, details: details.trim() || null });
      toast.success(t("problemSent"));
      onOpenChange(false);
      setReason(null);
      setDetails("");
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : t("problemFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t("problemTitle")}</DialogTitle>
          <DialogDescription>{t("problemBody")}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t("problemTitle")} className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2">
          {PROBLEM_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={cn(
                "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                reason === r ? "border-primary bg-accent text-primary" : "bg-background hover:bg-muted",
              )}
            >
              {t(`problemReason.${r}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="problem-details">
            {t("problemDetails")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
          </Label>
          <Textarea id="problem-details" rows={2} maxLength={1000} className="text-base" value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button className="h-11 rounded-xl" onClick={submit} disabled={sending}>
            {sending && <Loader2 className="animate-spin" aria-hidden />}
            {t("problemSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
