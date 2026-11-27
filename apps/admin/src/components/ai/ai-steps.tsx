"use client";

import { usePathname } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, PencilLine, PlayCircle, Sparkles } from "lucide-react";

import { LinkButton } from "@/components/winner/link-button";
import { Button } from "@/components/ui/button";
import { Step, type StepState } from "@/components/ui/steps";
import { createAiDraft } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { AI_LIMITS, type AiState, type AiVerdict } from "@/lib/types";

import { AI_SECTION_IDS, ErrorAlert, scrollToAiSection, useSetAiState } from "./ai-common";

type AiStepNumber = 1 | 2 | 3 | 4;

/**
 * Hozir qaysi qadam: qoralama bor yoki hali sozlanmagan — 1; sinov ketmoqda (yoki sinovda video
 * bo'lmagan) — 2; sinov tugagan — 3; hamma videolar tekshirishga berilgan — 4.
 */
function currentAiStep(state: AiState): AiStepNumber {
  const { draft, active, run, progress } = state;
  if (draft || !active || !run || run.version !== active.version) return 1;
  if (run.mode === "FULL") return 4;
  return progress.queued + progress.processing > 0 || progress.total === 0 ? 2 : 3;
}

interface AiStepsProps {
  state: AiState;
  /** "Hammasini ishga tushirish" tasdiqlash oynasini ochish. */
  onRunAll: () => void;
}

/**
 * Sahifa tepasidagi ish tartibi: 1. Namuna rasm va mezon → 2. Sinov → 3. Hammasini tekshirish →
 * 4. Shubhalilarni ko'rib chiqish. Joriy qadam holatdan aniqlanadi va faqat uning ichida bitta asosiy
 * tugma bo'ladi.
 */
export function AiSteps({ state, onRunAll }: AiStepsProps) {
  const pathname = usePathname();
  const setState = useSetAiState();
  const create = useMutation({
    mutationFn: createAiDraft,
    onSuccess: (next) => {
      setState(next);
      scrollToAiSection(AI_SECTION_IDS.config, AI_SECTION_IDS.configTitle);
    },
  });

  const { draft, active, run, progress, settings } = state;
  const current = currentAiStep(state);
  const stepState = (step: AiStepNumber): StepState =>
    step < current ? "done" : step === current ? "current" : "todo";

  const finished = progress.done + progress.failed;
  const inFlight = progress.queued + progress.processing;
  const counter = `${formatNumber(finished)} / ${formatNumber(progress.total)}`;
  // Ketayotgan (yoki tugagan) sinovda — haqiqiy soni; aks holda — sozlamadagi.
  const trialSize = run?.mode === "TRIAL" && !draft && progress.total > 0 ? progress.total : settings.trialSize;
  const resultsHref = (verdict: AiVerdict) => `${pathname}?verdict=${verdict}#${AI_SECTION_IDS.results}`;
  // Server'dagi qoralama bo'yicha: mezon yozilgan yoki kamida bitta rasm bor (tasdiqlash sharti).
  const draftReady =
    draft !== null &&
    (draft.criteria.trim().length >= AI_LIMITS.criteriaMinToApprove || draft.references.length > 0);

  return (
    <section aria-labelledby="ai-steps-title">
      {/* Qadam sarlavhalari (h3) sahifa sarlavhasidan bir pog'ona pastda tursin. */}
      <h2 id="ai-steps-title" className="sr-only">
        AI tekshiruvi qadamlari
      </h2>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Step
          number={1}
          title="Namuna rasm va mezon"
          state={stepState(1)}
          actions={
            current === 1 &&
            (draft ? (
              draftReady ? (
                <Button size="sm" onClick={() => scrollToAiSection(AI_SECTION_IDS.approve, AI_SECTION_IDS.approveStart)}>
                  <ArrowDown className="size-4" aria-hidden />
                  Sinovni boshlash
                </Button>
              ) : (
                <Button size="sm" onClick={() => scrollToAiSection(AI_SECTION_IDS.config, AI_SECTION_IDS.configTitle)}>
                  <ArrowDown className="size-4" aria-hidden />
                  Rasm va mezon kiritish
                </Button>
              )
            ) : (
              <Button size="sm" onClick={() => create.mutate()} loading={create.isPending}>
                {!create.isPending &&
                  (active ? <PencilLine className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />)}
                {active ? "O'zgartirish" : "Sozlashni boshlash"}
              </Button>
            ))
          }
        >
          {current !== 1 && active ? (
            <>
              {formatNumber(active.references.length)} ta namuna rasm
              {active.criteria.trim() ? ", mezonlar yozilgan" : ""} — amalda.
            </>
          ) : draft ? (
            active ? (
              "Yangi sozlamalar tayyorlanmoqda. Ular kuchga kirguncha AI eskisi bo'yicha ishlaydi."
            ) : draftReady ? (
              "Rasm va mezonlar bor — endi pastda sinovni boshlang."
            ) : (
              "Mahsulot rasmlarini qo'shing yoki videoda nima bo'lishi kerakligini yozing."
            )
          ) : active ? (
            "Sozlamalarni yangilash uchun ulardan nusxa oching."
          ) : (
            "AI hali sozlanmagan. Mahsulot rasmlari va mezonlarni kiritasiz."
          )}
          {create.isError && <ErrorAlert className="mt-2">{errorMessage(create.error)}</ErrorAlert>}
        </Step>

        <Step number={2} title={`Sinov (${formatNumber(trialSize)} ta video)`} state={stepState(2)}>
          {current === 2 ? (
            progress.total === 0 ? (
              "Sinov uchun qabul qilingan video topilmadi."
            ) : (
              <>
                Sinov ketmoqda: <span className="font-semibold text-ink tabular-nums">{counter}</span>. Sahifa o&apos;zi
                yangilanadi.
              </>
            )
          ) : current > 2 ? (
            run?.mode === "TRIAL" ? (
              <>Sinov tugadi: {formatNumber(finished)} ta video tekshirildi.</>
            ) : (
              "Bu bosqich o'tdi."
            )
          ) : (
            `AI avval ${formatNumber(settings.trialSize)} ta videoda sinaladi — natijasini o'zingiz baholaysiz.`
          )}
        </Step>

        <Step
          number={3}
          title="Hammasini tekshirish"
          state={stepState(3)}
          actions={
            current === 3 && (
              <Button size="sm" onClick={onRunAll}>
                <PlayCircle className="size-4" aria-hidden />
                Hammasini ishga tushirish
              </Button>
            )
          }
        >
          {current === 3 ? (
            "Pastdagi natijalar to'g'ri chiqsa — hamma videolarni tekshirishga bering. Bo'lmasa — «O'zgartirish» bilan aniqlashtiring."
          ) : current > 3 ? (
            inFlight > 0 ? (
              <>
                Tekshirilmoqda: <span className="font-semibold text-ink tabular-nums">{counter}</span>. Sahifa o&apos;zi
                yangilanadi.
              </>
            ) : progress.total === 0 ? (
              "Hali qabul qilingan video yo'q — yangilari kelishi bilan o'zi tekshiriladi."
            ) : (
              <>
                Hammasi tekshirildi
                {progress.failed > 0 && <> ({formatNumber(progress.failed)} tasini tekshirib bo&apos;lmadi)</>}. Yangi
                videolar ham o&apos;zi tekshiriladi.
              </>
            )
          ) : (
            "Sinov yaxshi chiqsa, qolgan barcha videolar tekshiriladi."
          )}
        </Step>

        <Step
          number={4}
          title="Shubhalilarni ko'rib chiqish"
          state={stepState(4)}
          actions={
            current === 4 && (
              <>
                <LinkButton href={resultsHref("UNCERTAIN")} variant={progress.uncertain > 0 ? "primary" : "secondary"}>
                  Shubhali videolar ({formatNumber(progress.uncertain)})
                  <ArrowRight className="size-4" aria-hidden />
                </LinkButton>
                {progress.rejected > 0 && (
                  <LinkButton href={resultsHref("REJECTED")} variant="secondary">
                    Rad etilganlar ({formatNumber(progress.rejected)})
                  </LinkButton>
                )}
              </>
            )
          }
        >
          {current === 4
            ? progress.uncertain > 0
              ? "AI ikkilangan videolarni ko'ring va «Mos» yoki «Mos emas» deb belgilang."
              : "Hozircha shubhali video yo'q."
            : "AI ikkilangan videolarni o'zingiz ko'rib chiqasiz."}
        </Step>
      </ol>
    </section>
  );
}
