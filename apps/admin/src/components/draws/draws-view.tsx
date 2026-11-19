"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Dices, History, Plus, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getDraw, getDraws, getDrawSetup, previewDraw, runDraw } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { periodLabel, stageLabel, validateDrawSettings } from "@/lib/draw-rules";
import { formatDateTime, formatNumber } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES } from "@/lib/labels";
import type { DrawSettings, VoucherDraw, VoucherDrawSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DrawPoolCard } from "./draw-pool-card";
import { DrawResult } from "./draw-result";
import { DrawRollingDialog } from "./draw-rolling-dialog";
import { DrawSettingsForm } from "./draw-settings-form";
import { DrawStockSummary } from "./draw-stock-card";

const PREVIEW_DEBOUNCE_MS = 400;

/** Random tanlov bo'limi: yangi tanlov (sozlamalar + nomzodlar) yoki tanlangan tanlov natijasi. */
export function DrawsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id");

  const select = (id: string | null) => {
    router.push(id ? `${pathname}?id=${encodeURIComponent(id)}` : pathname, { scroll: true });
  };

  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Dices className="size-6 text-brand-600" aria-hidden />
            Random tanlov
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Oylik voucher g&apos;oliblarini talabga javob beradigan ishtirokchilar orasidan adolatli tasodifiy tanlash.
          </p>
        </div>
        {selectedId && (
          <Button variant="secondary" onClick={() => select(null)}>
            <Plus className="size-4" aria-hidden />
            Yangi tanlov
          </Button>
        )}
      </header>

      <DrawStockSummary />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {selectedId ? (
            <SelectedDraw id={selectedId} onBack={() => select(null)} />
          ) : (
            <NewDraw onCreated={(draw) => select(draw.id)} />
          )}
        </div>
        <aside className="grid gap-4 md:grid-cols-2 2xl:block 2xl:space-y-4">
          <DrawHistory
            items={draws.data}
            loading={draws.isPending}
            error={draws.isError ? errorMessage(draws.error) : null}
            selectedId={selectedId}
            onSelect={select}
          />
          <FairnessNote />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NewDraw({ onCreated }: { onCreated: (draw: VoucherDraw) => void }) {
  const queryClient = useQueryClient();
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const [settings, setSettings] = useState<DrawSettings | null>(null);
  const value = settings ?? setup.data?.defaults ?? null;
  const errors = useMemo(() => (value ? validateDrawSettings(value) : {}), [value]);
  const valid = Object.keys(errors).length === 0;

  // Har harfda emas, sozlash to'xtagach hisoblaymiz.
  const [debounced, setDebounced] = useState<DrawSettings | null>(null);
  useEffect(() => {
    if (!value || !valid) return;
    const timer = setTimeout(() => setDebounced(value), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, valid]);

  const preview = useQuery({
    queryKey: ["draw-preview", debounced],
    queryFn: () => previewDraw(debounced as DrawSettings),
    enabled: debounced !== null,
    placeholderData: keepPreviousData,
  });

  const [confirming, setConfirming] = useState(false);
  const run = useMutation({
    mutationFn: (s: DrawSettings) => runDraw(s),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["draws"] }),
        queryClient.invalidateQueries({ queryKey: ["draw-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
      ]);
    },
  });
  const rolling = run.isPending || run.isSuccess;

  if (setup.isPending) return <Spinner />;
  if (setup.isError || !value || !setup.data) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {setup.isError ? errorMessage(setup.error) : "Sozlamalarni yuklab bo'lmadi."}
      </p>
    );
  }

  const blocked =
    !valid ||
    !preview.data ||
    preview.data.eligibleCount === 0 ||
    preview.data.warnings.some((w) => w.includes("allaqachon o'tkazilgan"));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <DrawSettingsForm
        setup={setup.data}
        value={value}
        errors={errors}
        onChange={setSettings}
        disabled={rolling}
      />

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <DrawPoolCard
          preview={preview.data}
          loading={preview.isFetching}
          error={preview.isError ? errorMessage(preview.error) : null}
          winnersCount={value.winnersCount}
          reservesCount={value.reservesCount}
        />
        {run.isError && (
          <p role="alert" className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errorMessage(run.error)}
          </p>
        )}
        <Button
          className="h-12 w-full text-base"
          disabled={blocked || preview.isFetching}
          onClick={() => setConfirming(true)}
        >
          <Dices className="size-5" aria-hidden />
          Random tanlovni o&apos;tkazish
        </Button>
        <p className="text-center text-xs text-slate-500">
          Natija avval qoralama bo&apos;ladi — tekshirib, tasdiqlagandan keyingina g&apos;oliblarga yuboriladi.
        </p>
      </div>

      {confirming && preview.data && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title="Random tanlovni o'tkazish"
          description={
            <>
              {formatNumber(preview.data.eligibleCount)} nomzod orasidan{" "}
              <b>{formatNumber(Math.min(value.winnersCount, preview.data.eligibleCount))} g&apos;olib</b> va{" "}
              {formatNumber(
                Math.max(0, Math.min(value.reservesCount, preview.data.eligibleCount - value.winnersCount)),
              )}{" "}
              zaxira tasodifiy tanlanadi ({stageLabel(value.stage)}, {periodLabel(value.periodFrom, value.periodTo)}).
              Natija va tasodifiy kalit audit logga yoziladi.
            </>
          }
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Bekor qilish
            </Button>
            <Button
              data-autofocus
              onClick={() => {
                setConfirming(false);
                run.mutate(value);
              }}
            >
              <Dices className="size-4" aria-hidden />
              O&apos;tkazish
            </Button>
          </div>
        </Dialog>
      )}

      {rolling && (
        <DrawRollingDialog
          names={(preview.data?.sample ?? []).map((c) => `${c.firstName} ${c.lastName}`)}
          result={run.data ?? null}
          onOpen={(draw) => {
            queryClient.setQueryData(["draw", draw.id], draw);
            run.reset();
            onCreated(draw);
          }}
        />
      )}
    </div>
  );
}

function SelectedDraw({ id, onBack }: { id: string; onBack: () => void }) {
  const draw = useQuery({ queryKey: ["draw", id], queryFn: () => getDraw(id) });
  if (draw.isPending) return <Spinner />;
  if (draw.isError) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-red-700">
          {errorMessage(draw.error)}
        </p>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Orqaga
        </Button>
      </div>
    );
  }
  return <DrawResult draw={draw.data} />;
}

function DrawHistory({
  items,
  loading,
  error,
  selectedId,
  onSelect,
}: {
  items: VoucherDrawSummary[] | undefined;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <History className="size-4 text-slate-500" aria-hidden />
        <CardTitle>Tanlovlar tarixi</CardTitle>
      </CardHeader>
      {loading ? (
        <Spinner />
      ) : error ? (
        <p className="px-5 py-4 text-sm text-red-700">{error}</p>
      ) : !items || items.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500">Hali tanlov o&apos;tkazilmagan</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full px-5 py-3 text-left transition-colors hover:bg-slate-50",
                  selectedId === item.id && "bg-brand-50/60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    #{item.number} · {stageLabel(item.stage)}
                  </span>
                  <Badge tone={DRAW_STATUS_TONES[item.status]}>{DRAW_STATUS_LABELS[item.status]}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">{item.prizeTitle}</p>
                <p className="mt-1 text-xs text-slate-600 tabular-nums">
                  {formatNumber(item.winners)} g&apos;olib · {formatNumber(item.poolSize)} nomzod
                  {item.status === "SENT" && ` · ${formatNumber(item.delivery.sent)} yuborildi`}
                </p>
                <p className="text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FairnessNote() {
  return (
    <Card className="bg-slate-50/60">
      <CardContent className="space-y-2 text-xs text-slate-600">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Scale className="size-4 text-brand-600" aria-hidden />
          Adolatli tanlov qanday ishlaydi
        </p>
        <ol className="list-decimal space-y-1 pl-4">
          <li>Talabga javob beradigan har bir ishtirokchida teng imkoniyat bor.</li>
          <li>Server kriptografik tasodifiy kalit (seed) yaratadi va nomzodlarni aralashtiradi.</li>
          <li>Birinchilari — g&apos;oliblar, keyingilari — zaxira.</li>
          <li>Kalit va nomzodlar izi saqlanadi: natijani istalgan payt qayta tekshirish mumkin.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
