"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getMe, logout as apiLogout } from "./api";
import { isUnauthorized } from "./api-error";
import type { AdminUser } from "./types";

type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; admin: AdminUser }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

interface AuthContextValue {
  state: AuthState;
  reload: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((admin) => {
        if (!cancelled) setState({ status: "authenticated", admin });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(
          isUnauthorized(error)
            ? { status: "unauthenticated" }
            : { status: "error", message: "Server bilan bog'lanib bo'lmadi." },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState({ status: "unauthenticated" });
    }
  }, []);

  const value = useMemo(() => ({ state, reload, logout }), [state, reload, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth faqat AuthProvider ichida ishlatiladi.");
  }
  return context;
}

/** Faqat kirilgan holatda ishlatiladigan komponentlar uchun. */
export function useCurrentAdmin(): AdminUser {
  const { state } = useAuth();
  if (state.status !== "authenticated") {
    throw new Error("useCurrentAdmin faqat kirilgan holatda ishlatiladi.");
  }
  return state.admin;
}
