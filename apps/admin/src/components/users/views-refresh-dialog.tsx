"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { getViewsRefreshPreview, startViewsRefresh } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatCompact, formatDateTime, formatNumber } from "@/lib/format";
import type { ViewsRefreshRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

import { parseDigits, toText, VIEWS_PRESETS } from "./views-range-filter";

const POLL_MS = 3000;
const PREVIEW_DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const rangeText = ({ from, to }: { from: number | null; to: number | null }) => {
  if (from !== null && to !== null) return `${formatCompact(from)} – ${formatCompact(to)}`;
  if (from !== null) return `${formatCompact(from)} dan ko'p`;
  if (to !== null) return `${formatCompact(to)} gacha`;
  return "hamma videolar";
};

/**
 * "Ko'rishlarni yangilash": tanlangan oraliqdagi videolar Instagram'dan hoziroq qayta o'qiladi
 * (masalan, hafta o'rtasida sovg'a topshirishdan oldin). Fonda ishlaydi — oyna yopilsa ham davom
 * etadi; natija shu yerda ko'rinadi va ro'yxat yangilanadi. Ochilganda o'rnatiladi (boshlang'ich
 * qiymatlar — joriy filtrdan), yopilganda olib tashlanadi.
 */
export function ViewsRefreshDialog({
  open,
  onClose,
  initialMin,
  initialMax,
}: {
  open: boolean;
  onClose: () => void;
  initialMin: number | null;
  initialMax: number | null;
}) {
  const queryClient = useQueryClient();
  const [minText, setMinText] = useState(toText(initialMin));
  const [maxText, setMaxText] = useState(toText(initialMax));
  const [includeNear, setIncludeNear] = useState(true);
  /** Shu oynadan boshlangan yangilash vaqti — natijani eski natijadan ajratish uchun. */
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const request: ViewsRefreshRequest = { minViews: parseDigits(minText), maxViews: parseDigits(maxText), includeNear };
  const invalid = request.minViews !== null && request.maxViews !== null && request.minViews > request.maxViews;
  const debounced = useDebounced(request, PREVIEW_DEBOUNCE_MS);

  const preview = useQuery({
    queryKey: ["views-refresh", debounced.minViews, debounced.maxViews, debounced.includeNear],
    queryFn: () => getViewsRefreshPreview(debounced),
    enabled: open && !invalid,
    refetchInterval: (query) => (query.state.data?.running ? POLL_MS : false),
  });

  const start = useMutation({
    mutationFn: () => startViewsRefresh(request),
    onSuccess: () => {
      setStartedAt(Date.now());
      void queryClient.invalidateQueries({ queryKey: ["views-refresh"] });
      void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  const data = preview.data;
  const report = data?.lastReport ?? null;
  const ours = startedAt !== null && report !== null && Date.parse(report.startedAt) >= startedAt - 60_000;
  const running = Boolean(data?.running) || (startedAt !== null && !(ours && report?.finishedAt));
  const finished = ours && report?.finishedAt ? report : null;

  // Tugagach — ro'yxat va dashboard yangi ko'rishlarni ko'rsatsin.
  useEffect(() => {
    if (!finished) return;
    void queryClient.invalidateQueries({ queryKey: ["participants"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-top"] });
    void queryClient.invalidateQueries({ queryKey: ["daily-rating"] });
  }, [finished, queryClient]);

  const count = data?.count ?? 0;
  const busy = start.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="Ko'rishlarni yangilash"
      description="Tanlangan oraliqdagi videolarning ko'rishlari Instagram'dan hoziroq qayta o'qiladi. Har bir yangilash Apify orqali va pullik — faqat kerakli oraliqni tanlang."
      className="max-w-lg"
    >
      {startedAt === null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid && count > 0 && !running) start.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <p className="text-xs font-medium text-muted">Tez tanlash</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VIEWS_PRESETS.map((preset) => {
                const selected = preset.min === request.minViews && preset.max === request.maxViews;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setMinText(toText(preset.min));
                      setMaxText(toText(preset.max));
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      selected
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted">Oraliq (oxirgi yig&apos;ishdagi ko&apos;rishlar bo&apos;yicha)</p>
            <div className="mt-2 flex items-center gap-2">
              <label className="flex-1">
                <span className="sr-only">Ko&apos;rishlar, dan</span>
                <input
                  data-autofocus
                  inputMode="numeric"
                  placeholder="dan"
                  value={minText}
                  onChange={(event) => setMinText(toText(parseDigits(event.target.value)))}
                  aria-invalid={invalid || undefined}
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500"
                />
              </label>
              <span className="text-muted">–</span>
              <label className="flex-1">
                <span className="sr-only">Ko&apos;rishlar, gacha</span>
                <input
                  inputMode="numeric"
                  placeholder="gacha"
                  value={maxText}
                  onChange={(event) => setMaxText(toText(parseDigits(event.target.value)))}
                  aria-invalid={invalid || undefined}
                  className="h-10 w-full rounded-xl border border-line px-3 text-sm tabular-nums focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none aria-invalid:border-red-500"
                />
              </label>
            </div>
            {invalid && <p className="mt-1.5 text-xs text-red-600">«Dan» «gacha»dan katta bo&apos;lmasin.</p>}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition hover:border-brand-200">
            <input
              type="checkbox"
              checked={includeNear}
              onChange={(event) => setIncludeNear(event.target.checked)}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span className="text-sm">
              <span className="font-medium text-ink">Chegaraga yaqinlarni ham qo&apos;shish (20% pastroq)</span>
              <span className="mt-0.5 block text-xs text-muted">
                Oxirgi yig&apos;ishdan beri ko&apos;rishlari oshib, chegaradan o&apos;tgan bo&apos;lishi mumkin. Masalan, 100 ming
                tanlansa — 80 mingdan boshlab yangilanadi.
              </span>
            </span>
          </label>

          <div className="rounded-xl bg-[#f7f6fb] px-4 py-3">
            {preview.isError ? (
              <p className="text-sm text-red-600">{errorMessage(preview.error)}</p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm">
                  {preview.isFetching && !data ? (
                    <Loader2 className="size-4 animate-spin text-muted" aria-hidden />
                  ) : (
                    <RefreshCw className="size-4 text-brand-600" aria-hidden />
                  )}
                  <span>
                    <span className="font-semibold tabular-nums text-ink">{formatNumber(count)} ta video</span>{" "}
                    yangilanadi
                    {data && <span className="text-muted"> · {rangeText(data.range)}</span>}
                  </span>
                </p>
                {data?.lastSyncAt && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <Clock className="size-3.5" aria-hidden />
                    Oxirgi umumiy yig&apos;ish: {formatDateTime(data.lastSyncAt)}
                  </p>
                )}
                {data?.running && (
                  <p className="mt-1 text-xs text-amber-700">Hozir ko&apos;rishlar yig&apos;ilmoqda — tugashini kuting.</p>
                )}
              </>
            )}
          </div>

          {start.isError && (
            <p role="alert" className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {errorMessage(start.error)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={busy} disabled={invalid || count === 0 || Boolean(data?.running)}>
              <RefreshCw className="size-4" aria-hidden />
              {count > 0 ? `${formatNumber(count)} ta videoni yangilash` : "Yangilash"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {running || !finished ? (
            <div className="flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-4">
              <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-brand-600" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">Yangilanmoqda…</p>
                <p className="mt-0.5 text-muted">
                  Instagram&apos;dan {formatNumber(start.data?.count ?? count)} ta video o&apos;qilmoqda. Bu bir necha daqiqa
                  olishi mumkin. Oynani yopsangiz ham fonda davom etadi.
                </p>
              </div>
            </div>
          ) : finished.error ? (
            <div className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Yangilab bo&apos;lmadi</p>
                <p className="mt-0.5">{finished.error}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-green-50 px-4 py-4 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Ko&apos;rishlar yangilandi</p>
                <p className="mt-0.5">
                  {formatNumber(finished.requested)} tadan {formatNumber(finished.updated)} tasi yangilandi
                  {finished.missing > 0 && `, ${formatNumber(finished.missing)} tasi Instagram'da topilmadi`}. Ro&apos;yxat
                  yangi ko&apos;rishlarni ko&apos;rsatyapti.
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant={finished ? "primary" : "secondary"} onClick={onClose}>
              {finished ? "Tayyor" : "Yopish"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
