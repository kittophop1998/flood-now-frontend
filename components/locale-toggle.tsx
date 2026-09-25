"use client";

import { useTranslation } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locale";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "EN" },
  { locale: "th", label: "TH" },
];

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-full border bg-background/95 text-xs font-semibold shadow-lg",
        className,
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          aria-pressed={locale === option.locale}
          onClick={() => setLocale(option.locale)}
          className={cn(
            "px-3 py-2 transition-colors",
            locale === option.locale ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
