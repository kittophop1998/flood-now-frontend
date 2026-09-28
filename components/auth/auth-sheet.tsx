"use client";

import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth-service";
import { ApiError } from "@/services/api-client";
import { getDeviceId } from "@/lib/device-id";
import type { AuthReason } from "@/lib/auth-gate";
import type { AuthSession } from "@/lib/auth-session";
import { useTranslation } from "@/lib/i18n/locale-context";

export type AuthSheetMode = "prompt" | "login" | "register";

// The one reusable "sign in to use this feature" sheet (opened only through
// features/auth useAuth().requireAuth / openSignIn). Signing in happens right
// here, over the current screen, so the person never loses their place.
export function AuthSheet({
  open,
  mode,
  reason,
  onModeChange,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  mode: AuthSheetMode;
  reason: AuthReason;
  onModeChange: (mode: AuthSheetMode) => void;
  onClose: () => void;
  onSignedIn: (session: AuthSession) => void;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      // The device id lets the API move saved places this device made
      // before accounts existed into the account.
      const deviceId = getDeviceId() || undefined;
      const res =
        mode === "register"
          ? await authService.register({ email, password, display_name: displayName, device_id: deviceId })
          : await authService.login({ email, password, device_id: deviceId });
      onSignedIn({ user: res.user, csrfToken: res.csrf_token });
      setPassword("");
    } catch (err) {
      setError(authErrorMessage(err, mode, t));
    } finally {
      setSending(false);
    }
  }

  const title = mode === "login" ? t("authLoginTitle") : mode === "register" ? t("authRegisterTitle") : t("authRequiredTitle");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-accent text-primary">
            <LockKeyhole className="size-5" aria-hidden />
          </span>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription>{mode === "prompt" ? t(`authReason.${reason}`) : t("authFormHint")}</DialogDescription>
        </DialogHeader>

        {mode === "prompt" ? (
          <>
            {/* The category reason already says what guests can report. */}
            {reason !== "reportCategory" && <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">{t("authGuestNote")}</p>}
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button className="h-11 w-full rounded-xl" onClick={() => onModeChange("login")}>
                {t("authLogin")}
              </Button>
              <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => onModeChange("register")}>
                {t("authRegister")}
              </Button>
              <Button variant="ghost" className="h-11 w-full rounded-xl" onClick={onClose}>
                {t("cancel")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            {mode === "register" && (
              <div className="grid gap-1.5">
                <Label htmlFor="auth-name">{t("authDisplayName")}</Label>
                <Input
                  id="auth-name"
                  autoComplete="nickname"
                  maxLength={60}
                  className="h-11 rounded-xl"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t("authDisplayNameHint")}</p>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="auth-email">{t("authEmail")}</Label>
              <Input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="h-11 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="auth-password">{t("authPassword")}</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={mode === "register" ? 8 : undefined}
                maxLength={72}
                className="h-11 rounded-xl"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === "register" && <p className="text-xs text-muted-foreground">{t("authPasswordHint")}</p>}
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="h-11 rounded-xl" disabled={sending}>
              {sending && <Loader2 className="animate-spin" aria-hidden />}
              {mode === "register" ? t("authRegister") : t("authLogin")}
            </Button>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="link" className="h-11 px-0" onClick={() => onModeChange(mode === "login" ? "register" : "login")}>
                {mode === "login" ? t("authNoAccount") : t("authHaveAccount")}
              </Button>
              <Button type="button" variant="ghost" className="h-11 rounded-xl" onClick={onClose}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function authErrorMessage(err: unknown, mode: AuthSheetMode, t: ReturnType<typeof useTranslation>["t"]): string {
  if (!(err instanceof ApiError) || err.status === 0) return t("authNetworkError");
  if (err.code === "UNAUTHORIZED") return t("authInvalidCredentials");
  if (err.code === "CONFLICT") return t("authEmailTaken");
  if (err.code === "RATE_LIMITED") return t("authTooManyAttempts");
  if (err.code === "VALIDATION_ERROR") {
    if (err.fields?.email) return t("authInvalidEmail");
    if (err.fields?.password) return t("authPasswordHint");
    if (err.fields?.display_name) return t("authDisplayNameHint");
  }
  return mode === "register" ? t("authRegisterFailed") : t("authLoginFailed");
}
