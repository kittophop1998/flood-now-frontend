"use client";

import { CircleAlert, CloudUpload, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ViewShell } from "@/components/views/view-shell";
import { useNow } from "@/features/common/use-now";
import type { OutboxApi } from "@/features/offline/use-outbox";
import { formatFreshness } from "@/lib/freshness";
import { categoryLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";

// Reports and votes made offline, waiting to be sent (or rejected by the
// server and needing a decision). Each has an idempotency key, so "retry"
// can never create a duplicate.
export function SyncView({ outbox, online, onBack, hidden }: { outbox: OutboxApi; online: boolean; onBack: () => void; hidden?: boolean }) {
  const { t } = useTranslation();
  const now = useNow();
  return (
    <ViewShell title={t("syncTitle")} subtitle={online ? t("syncOnline") : t("syncOffline")} onBack={onBack} hidden={hidden}>
      {outbox.items.length === 0 ? (
        <EmptyState icon={<CloudUpload />} title={t("syncEmpty")} />
      ) : (
        <>
          <Button className="h-12 rounded-xl" onClick={outbox.syncNow} disabled={!online || outbox.syncing}>
            {outbox.syncing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {t("syncNow")}
          </Button>
          <ul className="flex flex-col gap-2">
            {outbox.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-3.5 shadow-xs">
                <div className="flex items-start gap-2">
                  {item.status === "failed" ? (
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
                  ) : (
                    <CloudUpload className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">
                      {item.kind === "report"
                        ? t("syncItemReport", { type: categoryLabel(t, item.payload.type) })
                        : t(item.payload.status === "cleared" ? "syncItemCleared" : "syncItemConfirm")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === "failed" ? t("syncFailed") : t("syncPending")} · {formatFreshness(item.createdAt, t, now)}
                    </p>
                    {item.status === "failed" && item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" className="h-11 rounded-xl text-destructive" onClick={() => outbox.discard(item.id)}>
                    <Trash2 aria-hidden />
                    {t("syncDiscard")}
                  </Button>
                  {item.status === "failed" && (
                    <Button variant="outline" className="h-11 rounded-xl" onClick={() => outbox.retry(item.id)} disabled={!online}>
                      <RefreshCw aria-hidden />
                      {t("retry")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </ViewShell>
  );
}
