"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, Dices, PartyPopper, Scale, Ticket } from "lucide-react";

import { DrawPeriodPicker } from "@/components/draws/draw-period-picker";
import { DrawPoolCard } from "@/components/draws/draw-pool-card";
import { DrawResult } from "@/components/draws/draw-result";
import { DrawSettingsCard } from "@/components/draws/draw-settings-card";
import { DrawStockSummary } from "@/components/draws/draw-stock-card";
import { VOUCHER_DRAW_ANCHOR, withDrumPrize } from "@/components/prizes/rating-prize";
import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { Spinner } from "@/components/ui/spinner";
import { getDraw, getDrawSetup, previewDraw, runDraw } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { drawRunSettings, type DrawPeriodChoice } from "@/lib/draw-rules";
import { formatNumber } from "@/lib/format";
import type { DrawSettings, DrawSetup, VoucherDraw } from "@/lib/types";
import { cn } from "@/lib/utils";
import { voucherTabHref } from "@/lib/winner-links";

import { SectionTitle } from "./section-title";
import { VoucherWinners } from "./voucher-winners";

/** "O'tkazilgan voucher tanlovlari" sarlavhasi — "Barcha tanlovlar" shu yerga qaytaradi. */
const VOUCHER_DRAWS_ANCHOR = "voucher-draws-title";

/**
 * G'oliblar → "Voucher" tabi. Tanlovning o'zi — tepadagi barabanda. Bu yerda tartib: qolgan
 * voucherlar → "O'tkazilgan voucher tanlovlari" (bitta ro'yxat, g'oliblari qator ichida) → eng
 * pastda yopiq "Batafsil" (adolatli tanlov qanday ishlaydi; qo'shimcha sozlamalar va qo'lda tanlov).
 * Tanlov ochilsa (`?draw=<id>`) — butun eni bo'yicha uning natijasi va "Barcha tanlovlar" tugmasi.
 */
export function VoucherTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("draw");
  /**
   * Tanlovni ochish (`null` — ro'yxatga qaytish); brauzer tarixiga yoziladi. Sahifa natija (yoki
   * ro'yxat) sarlavhasiga suriladi, tepadagi barabandagi sovrin saqlanadi.
   */
  const open = (id: string | null) =>
    router.push(
      `${withDrumPrize(voucherTabHref(id), searchParams.get("prize"))}#${id ? VOUCHER_DRAW_ANCHOR : VOUCHER_DRAWS_ANCHOR}`,
    );

  /** Qo'lda tanlov bilan hozirgina o'tkazilgan tanlov — natija ustida qisqa xabar ko'rsatiladi. */
  const [freshId, setFreshId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <section className="space-y-4" aria-labelledby={VOUCHER_DRAW_ANCHOR}>
        <SectionTitle
          id={VOUCHER_DRAW_ANCHOR}
          icon={Dices}
          title="Tanlov natijasi"
          action={
            <Button variant="secondary" onClick={() => open(null)}>
              <ArrowLeft className="size-4" aria-hidden />
              Barcha tanlovlar
            </Button>
          }
        />
        <SelectedDraw id={selectedId} fresh={freshId === selectedId} onBack={() => open(null)} />
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <DrawStockSummary />

      <section className="space-y-4" aria-labelledby={VOUCHER_DRAWS_ANCHOR}>
        <SectionTitle id={VOUCHER_DRAWS_ANCHOR} icon={Ticket} title="O'tkazilgan voucher tanlovlari" />
        <VoucherWinners />
      </section>

      <div className="space-y-3">
        <MoreDetails title="Batafsil: adolatli tanlov qanday ishlaydi">
          <FairnessNote />
        </MoreDetails>
        <MoreDetails
          title="Qo'shimcha sozlamalar (kamdan-kam kerak)"
          meta="zaxira soni, bot xabari, maxsus davr, qo'lda tanlov"
        >
          <AdvancedSettings
            onCreated={(draw) => {
              setFreshId(draw.id);
              open(draw.id);
            }}
          />
        </MoreDetails>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Doimiy sozlamalar va qo'lda tanlov — oddiy yo'l tepadagi baraban, bu yer kamdan-kam kerak. */
function AdvancedSettings({ onCreated }: { onCreated: (draw: VoucherDraw) => void }) {
  const setup = useQuery({ queryKey: ["draw-setup"], queryFn: getDrawSetup });
  if (setup.isPending) return <Spinner />;
  if (setup.isError || !setup.data) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {setup.isError ? errorMessage(setup.error) : "Sozlamalarni yuklab bo'lmadi."}
      </p>
    );
  }
  return <NewDraw setup={setup.data} onCreated={onCreated} />;
}

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
        ? "Bu bosqich uchun tanlov o'tkazilgan — natija ro'yxatda."
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
          {run.isPending ? "Tanlanmoqda…" : "Qo'lda tanlash"}
        </Button>
        <p className={cn("text-center text-xs", blocker ? "text-amber-700" : "text-slate-500")}>
          {blocker ?? (
            <>
              Bir bosishda {formatNumber(saved?.winnersCount ?? 0)} g&apos;olib va{" "}
              {formatNumber(saved?.reservesCount ?? 0)} zaxira tanlanadi. Natijani tasdiqlamaguningizcha hech kimga
              xabar bormaydi.
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

function FairnessNote() {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      <p className="flex items-center gap-2 font-medium text-slate-800">
        <Scale className="size-4 text-brand-600" aria-hidden />
        Har bir tanlov bir xil tartibda o&apos;tadi:
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Talabga javob beradigan har bir ishtirokchida teng imkoniyat bor.</li>
        <li>Oldingi oylarda voucher yutganlar ham qatnashadi — har oy alohida tanlov.</li>
        <li>Server tasodifiy kalit yaratadi va nomzodlarni shu kalit bilan aralashtiradi.</li>
        <li>Birinchilari — g&apos;oliblar, keyingilari — zaxira.</li>
        <li>Kalit va nomzodlar ro&apos;yxati saqlanadi: natijani istalgan payt qayta tekshirish mumkin.</li>
      </ol>
    </div>
  );
}
