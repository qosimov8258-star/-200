"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { approveAiDraft, getAiCandidates } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { AI_LIMITS, type AiCandidate, type AiConfigVersion, type AiRunMode, type AiState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_CANDIDATES_KEY, AI_REVIEWS_KEY, AI_SECTION_IDS, useSetAiState } from "./ai-common";
import { CandidatePicker } from "./ai-candidate-picker";

/** Xulosada shuncha ism ko'rinadi, qolgani "+N". */
const PREVIEW_NAMES = 6;

interface ApproveBlockProps {
  state: AiState;
  draft: AiConfigVersion;
  /** Tasdiqlash mumkinmi (mezon yoki rasm bor). */
  ready: boolean;
  /** Saqlanmagan mezonlarni tasdiqlashdan oldin saqlash. */
  flushCriteria: () => Promise<void>;
  onApproved: (message: string) => void;
}

/**
 * "Ishga tushirish": sinov (20 ta video) yoki hamma videolar, sinov videolarini tanlash va boshlash.
 * Boshlangach rasm va mezonlar o'zgarmaydi (backend versiyani qulflaydi).
 */
export function ApproveBlock({ state, draft, ready, flushCriteria, onApproved }: ApproveBlockProps) {
  const setState = useSetAiState();
  const queryClient = useQueryClient();
  const trialSize = state.settings.trialSize;

  const [mode, setMode] = useState<AiRunMode>("TRIAL");
  /** null — standart: eng ko'p ko'rilganlar (backend o'zi tanlaydi). */
  const [custom, setCustom] = useState<AiCandidate[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const defaults = useQuery({
    queryKey: [...AI_CANDIDATES_KEY, ""],
    queryFn: () => getAiCandidates(),
  });
  const defaultList = (defaults.data ?? []).slice(0, trialSize);
  const trialList = custom ?? defaultList;

  const replacingRun = state.run !== null && state.run.version !== draft.version;
  const trialCount = trialList.length || trialSize;

  return (
    <section
      id={AI_SECTION_IDS.approve}
      aria-labelledby="ai-approve-title"
      className="scroll-mt-28 space-y-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4"
    >
      <div>
        <h3 id="ai-approve-title" className="text-sm font-semibold text-ink">
          Ishga tushirish
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Boshlagach, rasm va mezonlar shu holicha qoladi va videolar AI navbatiga qo&apos;yiladi.
        </p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Qaysi videolar tekshirilsin</legend>
        <ModeOption
          checked={mode === "TRIAL"}
          onSelect={() => setMode("TRIAL")}
          title={`Sinov (${trialSize} ta video)`}
          hint={`Avval ${trialSize} ta videoda tekshirib ko'ring. Natijalar to'g'ri chiqsa — keyin hammasini ishga tushirasiz.`}
          recommended
        />
        <ModeOption
          checked={mode === "FULL"}
          onSelect={() => setMode("FULL")}
          title="Hamma videolar"
          hint="Barcha qabul qilingan videolar darhol tekshiriladi. Keyin qabul qilinadiganlar ham o'zi tekshiriladi."
        />
      </fieldset>

      {mode === "TRIAL" && (
        <div className="space-y-2 rounded-xl border border-line bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink">
              <span className="font-medium tabular-nums">{trialList.length} ta video</span>{" "}
              <span className="text-slate-500">
                {custom ? "— o'zingiz tanlagansiz" : "— eng ko'p ko'rilganlar"}
              </span>
            </p>
            <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
              <ListChecks className="size-4" aria-hidden />
              Boshqa videolarni tanlash
            </Button>
          </div>
          {defaults.isError && !custom ? (
            <p className="text-xs text-red-600">{errorMessage(defaults.error)}</p>
          ) : trialList.length > 0 ? (
            <p className="text-xs break-words text-slate-500">
              {trialList
                .slice(0, PREVIEW_NAMES)
                .map((item) => item.fullName)
                .join(", ")}
              {trialList.length > PREVIEW_NAMES && ` va yana ${trialList.length - PREVIEW_NAMES} ta`}
            </p>
          ) : defaults.isPending ? (
            <p className="text-xs text-slate-500">Videolar ro&apos;yxati yuklanmoqda…</p>
          ) : (
            <p className="text-xs text-slate-500">Hozircha qabul qilingan video yo&apos;q.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button id={AI_SECTION_IDS.approveStart} onClick={() => setConfirming(true)} disabled={!ready}>
          <PlayCircle className="size-4" aria-hidden />
          {mode === "TRIAL" ? `Sinovni boshlash (${trialCount} ta video)` : "Hamma videolarni tekshirish"}
        </Button>
        {!ready && (
          <p className="text-xs text-slate-500">
            Avval mezonlarni yozing (kamida {AI_LIMITS.criteriaMinToApprove} ta belgi) yoki kamida bitta rasm qo&apos;shing.
          </p>
        )}
      </div>

      {picking && (
        <CandidatePicker
          selected={trialList}
          defaults={defaultList}
          limit={trialSize}
          onClose={() => setPicking(false)}
          onSave={(selected) => {
            // Standart ro'yxatning o'zi tanlansa — "o'zingiz tanlagansiz" deb ko'rsatmaymiz.
            const same =
              selected.length === defaultList.length &&
              selected.every((item, index) => item.shortcode === defaultList[index]?.shortcode);
            setCustom(same ? null : selected);
            setPicking(false);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={mode === "TRIAL" ? "Sinov boshlansinmi?" : "Hamma videolar tekshirilsinmi?"}
          description={
            <div className="space-y-2">
              <p>
                Shundan keyin bu rasm va mezonlar o&apos;zgarmaydi (o&apos;zgartirish uchun «O&apos;zgartirish» bilan
                yangi nusxa ochasiz).{" "}
                {mode === "TRIAL"
                  ? `${trialCount} ta video tekshiriladi.`
                  : "Barcha qabul qilingan videolar tekshiriladi, keyin qabul qilinadiganlar ham o'zi tekshiriladi."}
              </p>
              {replacingRun && (
                <p>«Natijalar»da endi avvalgi sozlamalar o&apos;rniga shu sozlamalar natijalari ko&apos;rinadi.</p>
              )}
              <p className="text-xs text-slate-500">
                Tekshiruv pullik — sarf «Jarayon»da ko&apos;rinadi.{" "}
                {state.acceptanceGate
                  ? "Yangi yuborilgan videolar ham shu sozlamalar bilan tekshiriladi: AI tasdiqlasa — qabul, aks holda — «Qo'lda tekshiruv»."
                  : "AI xulosasi videolar holatini o'zi o'zgartirmaydi."}
              </p>
            </div>
          }
          confirmLabel={mode === "TRIAL" ? "Sinovni boshlash" : "Tekshirishni boshlash"}
          onConfirm={async () => {
            await flushCriteria();
            const next = await approveAiDraft(
              mode === "TRIAL" && custom
                ? { mode, trialShortcodes: custom.map((item) => item.shortcode) }
                : { mode },
            );
            setState(next);
            return next;
          }}
          onClose={() => setConfirming(false)}
          onDone={async () => {
            setConfirming(false);
            onApproved(
              mode === "TRIAL"
                ? "Sinov boshlandi — videolar AI navbatiga qo'yildi."
                : "Tekshiruv boshlandi — barcha videolar AI navbatiga qo'yildi.",
            );
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: AI_REVIEWS_KEY }),
              queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
            ]);
          }}
        />
      )}
    </section>
  );
}

function ModeOption({
  checked,
  onSelect,
  title,
  hint,
  recommended = false,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  recommended?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-xl border bg-white p-3 transition-colors",
        checked ? "border-brand-500 ring-2 ring-brand-500/15" : "border-line hover:border-brand-200",
      )}
    >
      <input
        type="radio"
        name="ai-run-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 shrink-0 accent-brand-500"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-ink">
          {title}
          {recommended && <span className="text-xs font-normal text-brand-700">tavsiya etiladi</span>}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
