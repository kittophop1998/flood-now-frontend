// Deterministic share-card text for an incident: the same report always
// produces the same message (no generated prose). Used with lib/directions
// shareLink, which appends the deep link.
import { freshnessLine } from "@/lib/freshness";
import { hasKnownPassability, passLevelLabel, reportTitle, severityLabel, vehicleLabel } from "@/lib/report-meta";
import { currentStatus } from "@/lib/report-status";
import type { TranslateFn } from "@/lib/i18n/locale";
import { VEHICLES, type Report } from "@/types/report";

export function reportShareText(t: TranslateFn, report: Report, now: Date = new Date()): string {
  const lines = [`${reportTitle(t, report)} — ${severityLabel(t, report.severity)}`];
  if (hasKnownPassability(report.passability)) {
    const p = report.passability;
    lines.push(
      VEHICLES.filter((v) => p[v] !== "unknown")
        .map((v) => `${vehicleLabel(t, v)}: ${passLevelLabel(t, p[v])}`)
        .join(" · "),
    );
  }
  const status = currentStatus(report, now);
  const freshness = [freshnessLine(report, t, now), t("confirmationsCount", { n: report.still_active_count })];
  if (status !== "active") freshness.unshift(t(`status.${status}`));
  lines.push(freshness.join(" · "));
  lines.push(t("shareFooter"));
  return lines.join("\n");
}
