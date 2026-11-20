"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { QueryProvider } from "@/components/providers/query-provider";
import { Button } from "@/components/ui/button";
import { IosIcon } from "@/components/ui/ios-icon";
import { FullScreenSpinner } from "@/components/ui/spinner";
import { isUnauthorized } from "@/lib/api-error";
import { getOwnerMe, ownerLogout } from "@/lib/owner-api";
import type { OwnerUser } from "@/lib/owner-types";

import { OwnerLogin } from "./owner-login";
import { OwnerVault } from "./owner-vault";

type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; owner: OwnerUser }
  /** `expired` — ish davomida sessiya tugadi (formada shu haqda yoziladi). */
  | { status: "unauthenticated"; expired: boolean }
  | { status: "error" };

/**
 * Yashirin `/owner` sahifasi: admin sessiyasidan mustaqil, o'z kirish formasi bilan.
 * Sessiya `GET owner/auth/me` bilan tekshiriladi; ish davomida istalgan so'rov yoki amal 401
 * qaytarsa — kesh tozalanadi va forma qayta ko'rsatiladi.
 */
export function OwnerScreen() {
  return (
    <QueryProvider>
      <OwnerGate />
    </QueryProvider>
  );
}

function OwnerGate() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOwnerMe()
      .then((owner) => {
        if (!cancelled) setState({ status: "authenticated", owner });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(isUnauthorized(error) ? { status: "unauthenticated", expired: false } : { status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Sessiya ish davomida tugasa — so'rov va amallardagi 401 ni kuzatamiz.
  useEffect(() => {
    function handleError(error: unknown) {
      if (!isUnauthorized(error)) return;
      setState((current) => (current.status === "authenticated" ? { status: "unauthenticated", expired: true } : current));
    }
    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") handleError(event.action.error);
    });
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") handleError(event.action.error);
    });
    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [queryClient]);

  // Chiqilganda yoki sessiya tugaganda — boshqa egaga oldingi ma'lumot ko'rinmasin.
  useEffect(() => {
    if (state.status === "unauthenticated") queryClient.clear();
  }, [state.status, queryClient]);

  const handleLogin = useCallback((owner: OwnerUser) => setState({ status: "authenticated", owner }), []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await ownerLogout();
    } catch {
      // Chiqish so'rovi o'tmasa ham (tarmoq xatosi) forma ko'rsatiladi.
    } finally {
      setLoggingOut(false);
      setState({ status: "unauthenticated", expired: false });
    }
  }

  if (state.status === "loading") {
    return <FullScreenSpinner label="Sessiya tekshirilmoqda…" />;
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
        <p className="text-sm text-slate-600">Server bilan bog&apos;lanib bo&apos;lmadi.</p>
        <Button
          variant="secondary"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Qayta urinish
        </Button>
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return <OwnerLogin expired={state.expired} onSuccess={handleLogin} />;
  }

  return <OwnerVault owner={state.owner} onLogout={handleLogout} loggingOut={loggingOut} />;
}
