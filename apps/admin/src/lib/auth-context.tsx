"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

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

/**
 * Joriy xodim sessiyasi. `QueryProvider` ichida ishlatiladi: panel ishlab turganda
 * istalgan so'rov yoki amal 401 qaytarsa (sessiya tugagan, cookie o'chgan), holat
 * "unauthenticated" ga o'tadi va panel layout'i login sahifasiga yo'naltiradi.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
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

  // Sessiya ish davomida tugasa — so'rovlar va amallardagi 401 ni kuzatamiz.
  useEffect(() => {
    function handleError(error: unknown) {
      if (isUnauthorized(error)) {
        setState((current) => (current.status === "unauthenticated" ? current : { status: "unauthenticated" }));
      }
    }

    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        handleError(event.action.error);
      }
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        handleError(event.action.error);
      }
    });

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Chiqish so'rovi o'tmasa ham (tarmoq xatosi) panel login sahifasiga qaytadi.
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
