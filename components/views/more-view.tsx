"use client";

import {
  Bookmark,
  ChevronRight,
  CloudUpload,
  Handshake,
  Heart,
  Hospital,
  Languages,
  Megaphone,
  Phone,
  Radar,
  Route,
  ShieldAlert,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { CategoryIcon, SeverityBadge, StatusBadge } from "@/components/report/report-badges";
import { ViewShell } from "@/components/views/view-shell";
import { categoryLabel } from "@/lib/report-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { TranslationKey } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { REPORT_STATUSES, REPORT_TYPES, SEVERITIES } from "@/types/report";

export type MoreScreen = "menu" | "saved" | "watch" | "route" | "sos" | "helper" | "places" | "announcements" | "donate" | "sync";

const MENU: { id: Exclude<MoreScreen, "menu" | "sos" | "donate" | "sync">; icon: LucideIcon; label: TranslationKey; hint: TranslationKey }[] = [
  { id: "saved", icon: Bookmark, label: "savedPlacesTitle", hint: "savedPlacesHint" },
  { id: "watch", icon: Radar, label: "watchTitle", hint: "watchHint" },
  { id: "route", icon: Route, label: "routeTitle", hint: "routeHint" },
  { id: "helper", icon: Handshake, label: "helperTitle", hint: "helperHint" },
  { id: "places", icon: Hospital, label: "importantPlacesTitle", hint: "importantPlacesHint" },
  { id: "announcements", icon: Megaphone, label: "announcementsTitle", hint: "announcementsHint" },
];

// "More": entry points to the secondary features (progressive disclosure —
// the map screen stays uncluttered), then settings and reference.
export function MoreView({
  onOpen,
  donationAvailable,
  outboxCount,
  hidden,
}: {
  onOpen: (screen: MoreScreen) => void;
  donationAvailable: boolean;
  outboxCount: number;
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ViewShell title={t("moreTitle")} hidden={hidden}>
      <button
        type="button"
        onClick={() => onOpen("sos")}
        className="flex min-h-16 items-center gap-3 rounded-2xl bg-red-600 p-4 text-left text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Siren className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold">{t("sosTitle")}</span>
          <span className="block text-sm text-red-50">{t("sosMenuHint")}</span>
        </span>
        <ChevronRight className="size-5 shrink-0" aria-hidden />
      </button>

      <nav aria-label={t("moreTitle")} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <ul className="divide-y">
          {MENU.map((item) => (
            <MenuRow key={item.id} icon={item.icon} label={t(item.label)} hint={t(item.hint)} onClick={() => onOpen(item.id)} />
          ))}
          {outboxCount > 0 && (
            <MenuRow icon={CloudUpload} label={t("syncTitle")} hint={t("syncPendingCount", { n: outboxCount })} onClick={() => onOpen("sync")} />
          )}
          {donationAvailable && (
            <MenuRow icon={Heart} label={t("donateTitle")} hint={t("donateHint")} onClick={() => onOpen("donate")} accent />
          )}
        </ul>
      </nav>

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

function MenuRow({ icon: Icon, label, hint, onClick, accent }: { icon: LucideIcon; label: string; hint: string; onClick: () => void; accent?: boolean }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary", accent && "bg-rose-50 text-rose-600")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{label}</span>
          <span className="block truncate text-sm text-muted-foreground">{hint}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}
