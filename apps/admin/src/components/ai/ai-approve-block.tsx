"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { approveAiDraft, getAiCandidates } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { AI_LIMITS, type AiCandidate, type AiConfigVersion, type AiRunMode, type AiState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_CANDIDATES_KEY, AI_REVIEWS_KEY, useSetAiState } from "./ai-common";
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

/** "Sinov (20 ta video)" yoki "Hammasi", sinov videolarini tanlash va "Tasdiqlash". */
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

  const replacingRun = state.run && state.run.version !== draft.version ? state.run.version : null;

  return (
    <section aria-labelledby="ai-approve-title" className="space-y-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
      <div>
        <h3 id="ai-approve-title" className="text-sm font-semibold text-ink">
          Tasdiqlash va ishga tushirish
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Tasdiqlangach versiya {draft.version} qulflanadi va videolar AI tekshiruviga navbatga qo&apos;yiladi.
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
          title="Hammasi"
          hint="Barcha qabul qilingan videolar darhol tekshiriladi. Keyin qabul qilinadiganlar ham avtomatik."
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
              Videolarni tanlash
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
        <Button onClick={() => setConfirming(true)} disabled={!ready}>
          <Lock className="size-4" aria-hidden />
          Tasdiqlash
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
          title={`Versiya ${draft.version} tasdiqlansinmi?`}
          description={
            <div className="space-y-2">
              <p>
                Versiya {draft.version} <strong className="font-medium text-ink">qulflanadi</strong>: rasmlar va
                mezonlarni endi o&apos;zgartirib bo&apos;lmaydi. Keyin o&apos;zgartirish kerak bo&apos;lsa — «Yangi
                versiya» yaratasiz.
              </p>
              <p>
                {mode === "TRIAL"
                  ? `Sinov: ${trialList.length || trialSize} ta video AI tekshiruviga yuboriladi.`
                  : "Barcha qabul qilingan videolar navbatga qo'yiladi. Keyin qabul qilinadigan videolar ham avtomatik tekshiriladi."}
              </p>
              {replacingRun !== null && (
                <p>
                  «Natijalar»da endi versiya {replacingRun} o&apos;rniga versiya {draft.version} natijalari ko&apos;rinadi.
                </p>
              )}
              <p className="text-xs text-slate-500">
                Tekshiruv pullik (Claude API) — sarf «Jarayon» bo&apos;limida ko&apos;rinadi. AI xulosasi videolar
                holatini o&apos;zi o&apos;zgartirmaydi.
              </p>
            </div>
          }
          confirmLabel="Tasdiqlash"
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
                ? `Versiya ${draft.version} tasdiqlandi — sinov videolari navbatga qo'yildi.`
                : `Versiya ${draft.version} tasdiqlandi — barcha videolar navbatga qo'yildi.`,
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
