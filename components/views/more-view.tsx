"use client";

import { Languages, Phone, ShieldAlert } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { CategoryIcon, SeverityBadge, StatusBadge } from "@/components/report/report-badges";
import { ViewShell } from "@/components/views/view-shell";
import { categoryLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { REPORT_STATUSES, REPORT_TYPES, SEVERITIES } from "@/types/report";

export function MoreView() {
  const { t } = useTranslation();
  return (
    <ViewShell title={t("moreTitle")}>
      <section className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 className="flex items-center gap-2 font-semibold">
          <Languages className="size-5 text-primary" aria-hidden />
          {t("language")}
        </h2>
        <LocaleToggle />
      </section>

      <section aria-labelledby="disclaimer-title" className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
        <h2 id="disclaimer-title" className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="size-5" aria-hidden />
          {t("disclaimerTitle")}
        </h2>
        <p className="text-sm leading-relaxed">{t("disclaimer")}</p>
        <div className="flex flex-wrap gap-2">
          {["1669", "191", "1784"].map((n) => (
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

      <section aria-labelledby="how-title" className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 id="how-title" className="font-semibold">
          {t("howItWorksTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("howItWorks1")}</li>
          <li>{t("howItWorks2")}</li>
          <li>{t("howItWorks3")}</li>
        </ul>
      </section>

      <section aria-labelledby="legend-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs">
        <h2 id="legend-title" className="font-semibold">
          {t("legendTitle")}
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {REPORT_TYPES.map((type) => (
            <li key={type} className="flex items-center gap-2 text-sm">
              <CategoryIcon type={type} size="sm" />
              {categoryLabel(t, type)}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          {SEVERITIES.map((s) => (
            <SeverityBadge key={s} severity={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
      </section>
    </ViewShell>
  );
}
