"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { UserRoundPlus, UsersRound } from "lucide-react";
import { toneClass, type Tone } from "@/lib/report-meta";
import {
  AREA_LEVEL_META,
  IMPORTANT_PLACE_STATUS_META,
  OFFICIAL_ICON,
  ROUTE_RISK_META,
  SOS_STATUS_META,
} from "@/lib/community-meta";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { AreaLevel, ImportantPlaceStatus, RouteRisk, SosStatus } from "@/types/community";

const badgeBase = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap";

// Icon + label + tone; never color alone.
export function ToneBadge({ icon: Icon, tone, className, children }: { icon: LucideIcon; tone: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn(badgeBase, toneClass(tone), className)}>
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function RouteRiskBadge({ risk, className }: { risk: RouteRisk; className?: string }) {
  const { t } = useTranslation();
  const meta = ROUTE_RISK_META[risk];
  return (
    <ToneBadge icon={meta.icon} tone={meta.tone} className={className}>
      {t(`routeRisk.${risk}`)}
    </ToneBadge>
  );
}

export function AreaLevelBadge({ level }: { level: AreaLevel }) {
  const { t } = useTranslation();
  const meta = AREA_LEVEL_META[level];
  return (
    <ToneBadge icon={meta.icon} tone={meta.tone}>
      {t(`areaLevel.${level}`)}
    </ToneBadge>
  );
}

export function SosStatusBadge({ status }: { status: SosStatus }) {
  const { t } = useTranslation();
  const meta = SOS_STATUS_META[status];
  return (
    <ToneBadge icon={meta.icon} tone={meta.tone}>
      {t(`sosStatus.${status}`)}
    </ToneBadge>
  );
}

export function PlaceStatusBadge({ status }: { status: ImportantPlaceStatus }) {
  const { t } = useTranslation();
  const meta = IMPORTANT_PLACE_STATUS_META[status];
  return (
    <ToneBadge icon={meta.icon} tone={meta.tone}>
      {t(`ipStatus.${status}`)}
    </ToneBadge>
  );
}

// Source badges: official information vs. community reports must never look
// alike.
export function OfficialBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn(badgeBase, "border-indigo-700 bg-indigo-700 text-white", className)}>
      <OFFICIAL_ICON className="size-3.5" aria-hidden />
      {t("sourceOfficial")}
    </span>
  );
}

export function CommunityBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn(badgeBase, "border-slate-300 bg-background text-slate-700", className)}>
      <UsersRound className="size-3.5" aria-hidden />
      {t("sourceCommunity")}
    </span>
  );
}

// An important place someone added from the app (not operator-curated).
export function UserAddedBadge({ mine, className }: { mine?: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn(badgeBase, "border-slate-300 bg-background text-slate-700", className)}>
      <UserRoundPlus className="size-3.5" aria-hidden />
      {mine ? t("ipMine") : t("ipFromUser")}
    </span>
  );
}

// "Last updated at …" line for data shown from the offline cache.
export function StaleDataNote({ savedAt, className }: { savedAt: string; className?: string }) {
  const { t, locale } = useTranslation();
  const when = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(savedAt));
  return (
    <p className={cn("rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950", className)} role="status">
      {t("offlineDataAsOf", { when })}
    </p>
  );
}
