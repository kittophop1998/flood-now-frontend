"use client";

import { Lock, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/views/view-shell";
import { useAuth } from "@/features/auth/auth-provider";
import type { AuthReason } from "@/lib/auth-gate";
import { useTranslation } from "@/lib/i18n/locale-context";

// Shown in place of a signed-in-only screen's content for guests; the button
// opens the shared sign-in sheet (and runs onSignedIn afterwards, if given).
export function SignInCard({ reason, title, hint, onSignedIn }: { reason: AuthReason; title: string; hint: string; onSignedIn?: () => void }) {
  const { t } = useTranslation();
  const { requireAuth } = useAuth();
  return (
    <EmptyState
      icon={<LockKeyhole />}
      title={title}
      hint={hint}
      action={
        <Button className="mt-2 h-11 rounded-xl" onClick={() => requireAuth(reason, onSignedIn)}>
          <Lock aria-hidden />
          {t("authLoginOrRegister")}
        </Button>
      }
    />
  );
}
