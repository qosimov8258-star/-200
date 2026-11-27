"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Dices, History, PartyPopper, Plus, Scale, Ticket } from "lucide-react";

import { DrawPeriodPicker } from "@/components/draws/draw-period-picker";
import { DrawPoolCard } from "@/components/draws/draw-pool-card";
import { DrawResult } from "@/components/draws/draw-result";
import { DrawSettingsCard } from "@/components/draws/draw-settings-card";
import { DrawStockSummary } from "@/components/draws/draw-stock-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getDraw, getDraws, getDrawSetup, previewDraw, runDraw } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { drawRunSettings, stageLabel, type DrawPeriodChoice } from "@/lib/draw-rules";
import { formatDateTime, formatNumber } from "@/lib/format";
import { DRAW_STATUS_LABELS, DRAW_STATUS_TONES } from "@/lib/labels";
import type { DrawSettings, DrawSetup, VoucherDraw, VoucherDrawSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { voucherTabHref } from "@/lib/winner-links";

import { SectionTitle } from "./section-title";
import { VoucherWinners } from "./voucher-winners";

/**
 * G'oliblar → "Voucher" tabi: oylik voucherlar uchun random tanlov va uning g'oliblari.
 * Chapda — voucherlar qoldig'i va "Yangi tanlov" (doimiy sozlamalar, bosqich, bitta "Tanlash");
 * tanlov ochilsa (`?draw=<id>`) shu joyda uning natijasi. O'ngda (kompyuterda) — tanlovlar tarixi.
 * Pastda — barcha voucher g'oliblari.
 */
export function VoucherTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("draw");
  /** Tanlovni ochish (`null` — "Yangi tanlov"); brauzer tarixiga yoziladi. */
  const open = (id: string | null) => router.push(voucherTabHref(id));

  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  const draws = useQuery({ queryKey: ["draws"], queryFn: getDraws });

  /** "Tanlash" bilan hozirgina o'tkazilgan tanlov — natija ustida qisqa xabar ko'rsatiladi. */
  const [freshId, setFreshId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <DrawStockSummary />

          <section className="space-y-4" aria-labelledby="voucher-draw-title">
            <SectionTitle
              id="voucher-draw-title"
              icon={Dices}
              title={selectedId ? "Tanlov natijasi" : "Voucher tanlovi sozlamalari"}
              meta={selectedId ? null : "Tanlovni tepadagi barabanda o'tkazing"}
              action={
                selectedId ? (
                  <Button variant="secondary" onClick={() => open(null)}>
                    <Plus className="size-4" aria-hidden />
                    Yangi tanlov
                  </Button>
                ) : null
              }
            />
            {selectedId ? (
              <SelectedDraw id={selectedId} fresh={freshId === selectedId} onBack={() => open(null)} />
            ) : setup.isPending ? (
              <Spinner />
            ) : setup.isError || !setup.data ? (
              <p role="alert" className="text-sm text-red-700">
                {setup.isError ? errorMessage(setup.error) : "Sozlamalarni yuklab bo'lmadi."}
              </p>
            ) : (
              // Oddiy yo'l — tepadagi baraban. Bu yerda: zaxira soni, bot xabari, maxsus davr va h.k.
              <details className="group rounded-2xl border border-line bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-ink">
                  Batafsil: sozlamalar, maxsus davr va qo&apos;lda tanlov
                  <span className="text-xs font-normal text-muted group-open:hidden">ochish</span>
                </summary>
                <div className="border-t border-line p-5">
                  <NewDraw
                    setup={setup.data}
                    onCreated={(draw) => {
                      setFreshId(draw.id);
                      open(draw.id);
                    }}
                  />
                </div>
              </details>
            )}
          </section>
        </div>

        <aside className="grid min-w-0 content-start items-start gap-4 md:grid-cols-2 xl:grid-cols-1">
          <DrawHistory
            items={draws.data}
            loading={draws.isPending}
            error={draws.isError ? errorMessage(draws.error) : null}
            selectedId={selectedId}
            onSelect={open}
          />
          <FairnessNote />
        </aside>
      </div>

      <section className="space-y-4" aria-labelledby="voucher-winners-title">
        <SectionTitle id="voucher-winners-title" icon={Ticket} title="Voucher g'oliblari" />
        <VoucherWinners />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Yangi tanlov: doimiy sozlamalar, bosqich va bitta "Tanlash" tugmasi. */
function NewDraw({ setup, onCreated }: { setup: DrawSetup; onCreated: (draw: VoucherDraw) => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<DrawPeriodChoice | null>(null);
  const period: DrawPeriodChoice = picked ?? {
    stage: setup.defaults.stage,
    periodFrom: setup.defaults.periodFrom,
    periodTo: setup.defaults.periodTo,
  };
  const saved = setup.saved;
  const settings = saved ? drawRunSettings(setup.defaults.prizeId, saved, period) : null;

  // Nomzodlar soni — ma'lumot uchun (alohida qadam emas): "Tanlash" uni kutmaydi.
  const preview = useQuery({
    queryKey: ["draw-preview", settings],
    queryFn: () => previewDraw(settings as DrawSettings),
    enabled: settings !== null,
    placeholderData: keepPreviousData,
  });

  const run = useMutation({
    mutationFn: runDraw,
    onSuccess: async (draw) => {
      queryClient.setQueryData(["draw", draw.id], draw);
      onCreated(draw);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["draws"] }),
        queryClient.invalidateQueries({ queryKey: ["draw-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
      ]);
    },
  });

  // Oldingi davrning (placeholder) natijasi bo'yicha to'smaymiz.
  const current = preview.isPlaceholderData ? undefined : preview.data;
  const existing = current?.warnings.some((w) => w.includes("allaqachon o'tkazilgan")) ?? false;
  const empty = current !== undefined && current.eligibleCount === 0;
  const blocker = !saved
    ? "Avval sozlamalarni tasdiqlang."
    : editing
      ? "Avval sozlamalarni saqlang yoki tahrirlashni bekor qiling."
      : existing
        ? "Bu bosqich uchun tanlov o'tkazilgan — natija tarixda."
        : empty
          ? "Bu bosqichda talabga javob beradigan nomzod yo'q."
          : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <DrawSettingsCard setup={setup} editing={editing} onEditingChange={setEditing} />
        <DrawPeriodPicker
          setup={setup}
          value={period}
          onChange={(next) => {
            run.reset();
            setPicked(next);
          }}
          disabled={run.isPending}
        />
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start">
        <DrawPoolCard
          preview={settings ? preview.data : undefined}
          loading={preview.isFetching}
          error={preview.isError ? errorMessage(preview.error) : null}
          winnersCount={saved?.winnersCount ?? setup.defaults.winnersCount}
          reservesCount={saved?.reservesCount ?? setup.defaults.reservesCount}
        />
        {run.isError && (
          <p role="alert" className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errorMessage(run.error)}
          </p>
        )}
        <Button
          className="h-12 w-full text-base"
          disabled={settings === null || blocker !== null}
          loading={run.isPending}
          onClick={() => settings && run.mutate(settings)}
        >
          {!run.isPending && <Dices className="size-5" aria-hidden />}
          {run.isPending ? "Tanlanmoqda…" : "Tanlash"}
        </Button>
        <p className={cn("text-center text-xs", blocker ? "text-amber-700" : "text-slate-500")}>
          {blocker ?? (
            <>
              Bir bosishda {formatNumber(saved?.winnersCount ?? 0)} g&apos;olib va{" "}
              {formatNumber(saved?.reservesCount ?? 0)} zaxira tanlanadi. Natija qoralama bo&apos;ladi — tekshirib,
              tasdiqlagach g&apos;oliblarga yuboriladi.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function SelectedDraw({ id, fresh, onBack }: { id: string; fresh: boolean; onBack: () => void }) {
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
  // "Tanlandi!" faqat natija hali tasdiqlanmagan paytda: tasdiqlangach yoki yuborilgach u eskiradi.
  const showFresh = fresh && draw.data.status === "DRAFT";
  return (
    <div className="space-y-4">
      {showFresh && (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          <PartyPopper className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
          <span>
            <b className="font-semibold">Tanlandi!</b> Endi 2-qadam: g&apos;oliblar ro&apos;yxatini ko&apos;rib chiqing
            va «Natijani tasdiqlash»ni bosing.
          </span>
        </p>
      )}
      <DrawResult draw={draw.data} />
    </div>
  );
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
        <Spinner className="px-5 py-4" />
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
                aria-current={selectedId === item.id ? "true" : undefined}
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
          <li>Oldingi oylarda voucher yutganlar ham qatnashadi — har oy alohida tanlov (oferta 6.1.5).</li>
          <li>Server kriptografik tasodifiy kalit (seed) yaratadi va nomzodlarni aralashtiradi.</li>
          <li>Birinchilari — g&apos;oliblar, keyingilari — zaxira.</li>
          <li>Kalit va nomzodlar izi saqlanadi: natijani istalgan payt qayta tekshirish mumkin.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
