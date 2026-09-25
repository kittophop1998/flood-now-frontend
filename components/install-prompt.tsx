"use client";

import { useEffect, useRef, useState } from "react";
import { Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hasSeenInstallPrompt, installModeFor, isMobile, markInstallPromptSeen, type InstallMode } from "@/lib/install-prompt";
import { useTranslation } from "@/lib/i18n/locale-context";
import type { TranslationKey } from "@/lib/i18n/locale";

// Not in TypeScript's DOM lib yet (Chromium-only API).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Give the browser time to fire beforeinstallprompt (and the map time to
// load) before deciding which hint to show.
const SHOW_DELAY_MS = 3000;

const STEPS: Record<Exclude<InstallMode, "native">, { icon: typeof Share; key: TranslationKey }[]> = {
  ios: [
    { icon: Share, key: "installIosStep1" },
    { icon: SquarePlus, key: "installIosStep2" },
  ],
  manual: [
    { icon: EllipsisVertical, key: "installManualStep1" },
    { icon: Download, key: "installManualStep2" },
  ],
};

// First-visit popup on phones suggesting to install FloodNow to the home
// screen. Uses the browser's own install dialog where available (Android
// Chrome/Edge/Samsung), step-by-step instructions otherwise (iOS Safari).
// Shown once; remembered in localStorage.
export function InstallPrompt() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<InstallMode | null>(null);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const decide = () =>
      installModeFor({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        standalone,
        seen: hasSeenInstallPrompt(),
        nativePromptAvailable: deferred.current != null,
      });
    // Desktop, already installed, or already shown once: nothing to do.
    if (hasSeenInstallPrompt() || standalone || !isMobile(navigator.userAgent, navigator.maxTouchPoints)) return;

    const onBeforeInstall = (e: Event) => {
      // Replace the browser's own mini-infobar with our popup.
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setMode((m) => (m ? "native" : m)); // upgrade instructions already on screen
    };
    const onInstalled = () => {
      markInstallPromptSeen();
      setMode(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    const timer = setTimeout(() => {
      const next = decide();
      if (next) {
        markInstallPromptSeen(); // first visit only, even if ignored
        setMode(next);
      }
    }, SHOW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const e = deferred.current;
    setMode(null);
    if (!e) return;
    await e.prompt();
    deferred.current = null;
  }

  return (
    <Dialog open={mode != null} onOpenChange={(open) => !open && setMode(null)}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl" />
            <DialogTitle className="text-lg leading-snug font-semibold">{t("installTitle")}</DialogTitle>
          </div>
          <DialogDescription className="leading-relaxed">{t("installBody")}</DialogDescription>
        </DialogHeader>

        {mode && mode !== "native" && (
          <ol className="flex flex-col gap-2">
            {STEPS[mode].map(({ icon: Icon, key }, i) => (
              <li key={key} className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{t(key)}</span>
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              </li>
            ))}
          </ol>
        )}

        <DialogFooter>
          {mode === "native" ? (
            <>
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setMode(null)}>
                {t("installLater")}
              </Button>
              <Button className="h-11 rounded-xl" onClick={install}>
                <Download aria-hidden />
                {t("installNow")}
              </Button>
            </>
          ) : (
            <Button className="h-11 rounded-xl" onClick={() => setMode(null)}>
              {t("installGotIt")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
