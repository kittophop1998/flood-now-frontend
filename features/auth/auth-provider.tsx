"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AuthSheet, type AuthSheetMode } from "@/components/auth/auth-sheet";
import { authService } from "@/services/auth-service";
import { getAuthSession, setAuthSession, subscribeAuthSession, type AuthSession } from "@/lib/auth-session";
import type { AuthReason } from "@/lib/auth-gate";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  // Runs `action` now when signed in. A guest instead gets the "sign in to use
  // this feature" sheet; `action` runs once they have signed in (resuming
  // what they tapped). Returns whether it ran immediately. This is the one
  // place the app decides "needs an account" — see lib/auth-gate.ts.
  requireAuth: (reason: AuthReason, action?: () => void) => boolean;
  openSignIn: (mode?: Exclude<AuthSheetMode, "prompt">) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const serverSnapshot = () => null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore<AuthSession | null>(subscribeAuthSession, getAuthSession, serverSnapshot);
  const user = session?.user ?? null;
  const [sheet, setSheet] = useState<{ mode: AuthSheetMode; reason: AuthReason } | null>(null);
  const pending = useRef<(() => void) | null>(null);

  // Revalidate a stored session once per load (expired → back to guest; the
  // api client clears it on 401). Offline keeps the stored session.
  const token = session?.token;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    authService
      .me(controller.signal)
      .then((fresh) => {
        const cur = getAuthSession();
        if (cur?.token === token) setAuthSession({ token, user: fresh });
      })
      .catch(() => {});
    return () => controller.abort();
    // Only for the token present at load / sign-in.
  }, [token]);

  const requireAuth = useCallback(
    (reason: AuthReason, action?: () => void) => {
      if (getAuthSession()) {
        action?.();
        return true;
      }
      pending.current = action ?? null;
      setSheet({ mode: "prompt", reason });
      return false;
    },
    [],
  );

  const openSignIn = useCallback((mode: Exclude<AuthSheetMode, "prompt"> = "login") => {
    pending.current = null;
    setSheet({ mode, reason: "generic" });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Offline or already expired: forgetting it locally is what matters.
    }
    setAuthSession(null);
  }, []);

  const value = useMemo(() => ({ user, requireAuth, openSignIn, signOut }), [user, requireAuth, openSignIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthSheet
        open={sheet != null}
        mode={sheet?.mode ?? "prompt"}
        reason={sheet?.reason ?? "generic"}
        onModeChange={(mode) => setSheet((s) => (s ? { ...s, mode } : s))}
        onClose={() => {
          pending.current = null;
          setSheet(null);
        }}
        onSignedIn={(next) => {
          setAuthSession(next);
          setSheet(null);
          const action = pending.current;
          pending.current = null;
          // Resume what the guest tapped, after this render settles.
          if (action) setTimeout(action, 0);
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
