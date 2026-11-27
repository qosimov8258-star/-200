"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { checkTargetsNow, getTargetCheckStatus } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDayTime, formatNumber } from "@/lib/format";

/** Tekshiruv ketayotganda (masalan, avtomatik) — tugagani ko'rinsin. */
const RUNNING_REFETCH_MS = 15_000;

/**
 * Instagram reklama kutubxonasi tekshiruvi — bitta ixcham qator: oxirgi va keyingi tekshiruv,
 * "Hozir tekshirish". To'liq natija (nechta akkaunt, nechta reklama) — "Batafsil" ichida.
 */
export function AdsCheckBar({ onChecked }: { onChecked: (message: string) => void }) {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["target-check"],
    queryFn: getTargetCheckStatus,
    refetchInterval: (query) => (query.state.data?.running ? RUNNING_REFETCH_MS : false),
  });

  const check = useMutation({
    mutationFn: checkTargetsNow,
    onSuccess: async (report) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["target-check"] }),
        queryClient.invalidateQueries({ queryKey: ["target-cases"] }),
      ]);
      // Xato bo'lsa — shu qatorning o'zida qizil matn bilan ko'rinadi (oxirgi tekshiruv natijasi).
      if (!report.error) {
        onChecked(
          `Reklama tekshirildi: ${formatNumber(report.checked)} ta akkaunt, ${formatNumber(report.found)} ta faol reklama.`,
        );
      }
    },
  });

  const autoRunning = status.data?.running === true;
  // Avtomatik tekshiruv tugagach — yangi topilganlar jadvalda ham darhol ko'rinsin.
  const wasAutoRunning = useRef(false);
  useEffect(() => {
    if (wasAutoRunning.current && !autoRunning) {
      void queryClient.invalidateQueries({ queryKey: ["target-cases"] });
    }
    wasAutoRunning.current = autoRunning;
  }, [autoRunning, queryClient]);

  const lastCheck = status.data?.lastCheck ?? null;
  const nextCheckOn = status.data?.nextCheckOn ?? null;
  const running = check.isPending || autoRunning;
  const lastError = !running ? (lastCheck?.error ?? null) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-sm">
      <Library className="size-4 shrink-0 text-brand-600" aria-hidden />
      <p className="min-w-0 flex-1 text-slate-600" aria-live="polite">
        <span className="font-medium text-ink">Reklama tekshiruvi:</span>{" "}
        {running ? (
          "tekshirilmoqda… (1–3 daqiqa)"
        ) : status.isPending ? (
          "…"
        ) : status.isError && !status.data ? (
          // So'rov o'tmagan bo'lsa — "hali bo'lmagan" deb noto'g'ri ko'rsatilmasin.
          "holatini olib bo'lmadi"
        ) : (
          <>
            oxirgisi{" "}
            <span className="tabular-nums">{lastCheck ? formatDayTime(lastCheck.at) : "hali bo'lmagan"}</span>
            {lastError && <span className="text-red-700"> (xato bilan tugadi)</span>}
            {nextCheckOn && (
              <>
                <span aria-hidden> · </span>
                keyingisi <span className="tabular-nums">{formatDate(nextCheckOn)}</span>
              </>
            )}
          </>
        )}
      </p>
      <Button variant="secondary" size="sm" loading={running} onClick={() => check.mutate()}>
        {!running && <RefreshCw className="size-3.5" aria-hidden />}
        Hozir tekshirish
      </Button>
      {check.isError ? (
        <p role="alert" className="w-full text-xs text-red-700">
          {errorMessage(check.error)}
        </p>
      ) : (
        lastError && <p className="w-full text-xs text-red-700">Sabab: {lastError}</p>
      )}
    </div>
  );
}
