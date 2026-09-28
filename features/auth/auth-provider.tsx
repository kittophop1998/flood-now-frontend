"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AuthSheet, type AuthSheetMode } from "@/components/auth/auth-sheet";
import { authService } from "@/services/auth-service";
import { ApiError } from "@/services/api-client";
import {
  forgetLegacyStoredSession,
  getAuthSession,
  onAuthChangedElsewhere,
  setAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from "@/lib/auth-session";
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
  // Ends the session on the server. Throws when that fails (e.g. offline):
  // the HttpOnly cookie can only be revoked by the API, so we stay signed in.
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const serverSnapshot = () => null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore<AuthSession | null>(subscribeAuthSession, getAuthSession, serverSnapshot);
  const user = session?.user ?? null;
  const [sheet, setSheet] = useState<{ mode: AuthSheetMode; reason: AuthReason } | null>(null);
  const pending = useRef<(() => void) | null>(null);

  // Who is signed in comes from the session cookie, read by the API: once
  // per load and whenever another tab signs in or out. Offline (or until it
  // answers) the app is in guest mode; the cookie is untouched either way.
  useEffect(() => {
    forgetLegacyStoredSession();
    let controller = new AbortController();
    const load = () => {
      controller.abort();
      controller = new AbortController();
      authService.refresh(controller.signal).catch(() => {});
    };
    load();
    const unsubscribe = onAuthChangedElsewhere(load);
    return () => {
      unsubscribe();
      controller.abort();
    };
  }, []);

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
    } catch (err) {
      // Already signed out on the server: nothing left to revoke.
      if (!(err instanceof ApiError && err.status === 401)) throw err;
    }
    setAuthSession(null, true);
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
          setAuthSession(next, true);
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
