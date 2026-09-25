"use client";

import { Bell, Ellipsis, Map, Navigation2, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n/locale";

export type AppTab = "map" | "nearby" | "alerts" | "more";

const TABS: { id: AppTab; label: TranslationKey; icon: typeof Map }[] = [
  { id: "map", label: "navMap", icon: Map },
  { id: "nearby", label: "navNearby", icon: Navigation2 },
  { id: "alerts", label: "navAlerts", icon: Bell },
  { id: "more", label: "navMore", icon: Ellipsis },
];

// แผนที่ · ใกล้ฉัน · (+ รายงาน) · แจ้งเตือน · เพิ่มเติม. The report action sits
// in the middle as the one prominent call to action.
export function BottomNav({
  active,
  onChange,
  onReport,
  unreadCount,
}: {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  onReport: () => void;
  unreadCount: number;
}) {
  const { t } = useTranslation();
  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  const tab = (item: (typeof TABS)[number]) => {
    const Icon = item.icon;
    const selected = active === item.id;
    return (
      <li key={item.id} className="flex-1">
        <button
          type="button"
          onClick={() => onChange(item.id)}
          aria-current={selected ? "page" : undefined}
          className={cn(
            "relative flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ring",
            selected ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", selected && "bg-accent")}>
            <Icon className="size-5" aria-hidden strokeWidth={selected ? 2.4 : 2} />
          </span>
          {t(item.label)}
          {item.id === "alerts" && unreadCount > 0 && (
            <span
              className="absolute top-1.5 left-1/2 ml-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
              aria-label={t("unreadBadge", { n: unreadCount })}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <nav
      aria-label="FloodNow"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {left.map(tab)}
        <li className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onReport}
            className="-mt-5 flex flex-col items-center gap-0.5 text-[11px] font-semibold text-primary focus-visible:outline-none"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95 [button:focus-visible_&]:outline-2 [button:focus-visible_&]:outline-offset-2 [button:focus-visible_&]:outline-ring">
              <Plus className="size-7" aria-hidden strokeWidth={2.5} />
            </span>
            {t("navReport")}
          </button>
        </li>
        {right.map(tab)}
      </ul>
    </nav>
  );
}
