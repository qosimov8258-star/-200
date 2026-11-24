"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, CopyPlus, Loader2, Lock, PencilLine, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IosIcon } from "@/components/ui/ios-icon";
import { Textarea } from "@/components/ui/textarea";
import { createAiDraft, updateAiDraft } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDateTime, formatNumber } from "@/lib/format";
import { AI_LIMITS, type AiConfigVersion, type AiState } from "@/lib/types";

import { ErrorAlert, useSetAiState } from "./ai-common";
import { ApproveBlock } from "./ai-approve-block";
import { DraftReferenceCard, ReadonlyReferenceCard } from "./ai-reference-card";
import { ReferenceUpload } from "./ai-reference-upload";

const CRITERIA_PLACEHOLDER =
  "Masalan: Videoda mahsulotimiz (qadog'i yoki o'zi) kamida bir marta aniq ko'rinishi kerak. " +
  "Raqobatchi brendlar ko'rinmasin. Video mahsulot haqida bo'lsin, boshqa mavzuda emas.";

interface ConfigCardProps {
  state: AiState;
  onNotice: (message: string) => void;
}

/** "Sozlamalar (versiya N)": qoralama muharriri, tasdiqlangan versiya yoki birinchi marta boshlash. */
export function ConfigCard({ state, onNotice }: ConfigCardProps) {
  const { draft, active } = state;
  const version = draft?.version ?? active?.version ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{version ? `Sozlamalar (versiya ${version})` : "Sozlamalar"}</CardTitle>
        {draft ? (
          <Badge tone="warning">
            <PencilLine className="mr-1 size-3.5" aria-hidden />
            Qoralama — tahrirlash mumkin
          </Badge>
        ) : active ? (
          <Badge tone="success">
            <Lock className="mr-1 size-3.5" aria-hidden />
            Tasdiqlangan
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {draft ? (
          // Versiya almashsa (yangi qoralama) — mahalliy holat (mezon matni) qaytadan boshlanadi.
          <DraftEditor key={draft.version} state={state} draft={draft} onNotice={onNotice} />
        ) : active ? (
          <ActiveVersion version={active} />
        ) : (
          <EmptyConfig />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyConfig() {
  const setState = useSetAiState();
  const create = useMutation({ mutationFn: createAiDraft, onSuccess: setState });
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center">
      <IosIcon icon={Sparkles} tint="purple" size={44} />
      <p className="max-w-md text-sm text-slate-600">
        AI hali sozlanmagan. Namuna rasmlar va mezonlarni kiriting, keyin tasdiqlang — shundan so&apos;ng videolar
        tekshiriladi.
      </p>
      <Button onClick={() => create.mutate()} loading={create.isPending}>
        Sozlashni boshlash
      </Button>
      {create.isError && <ErrorAlert>{errorMessage(create.error)}</ErrorAlert>}
    </div>
  );
}

/** Tasdiqlangan versiya — faqat ko'rish, o'zgartirish uchun "Yangi versiya". */
function ActiveVersion({ version }: { version: AiConfigVersion }) {
  const setState = useSetAiState();
  const create = useMutation({ mutationFn: createAiDraft, onSuccess: setState });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-600">
          {version.approvedAt && (
            <>
              Tasdiqlangan: <span className="tabular-nums">{formatDateTime(version.approvedAt)}</span>
              {version.approvedBy && <> · {version.approvedBy}</>}.{" "}
            </>
          )}
          Bu versiya qulflangan — AI videolarni shu sozlamalar bo&apos;yicha tekshiradi.
        </p>
        <Button variant="secondary" onClick={() => create.mutate()} loading={create.isPending}>
          {!create.isPending && <CopyPlus className="size-4" aria-hidden />}
          Yangi versiya
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        «Yangi versiya» — hozirgi rasmlar va mezonlardan nusxa olinadi, uni o&apos;zgartirib tasdiqlaysiz. Tasdiqlaguningizcha
        natijalar versiya {version.version} bo&apos;yicha qoladi.
      </p>
      {create.isError && <ErrorAlert>{errorMessage(create.error)}</ErrorAlert>}

      <section aria-labelledby="ai-active-refs" className="space-y-3">
        <h3 id="ai-active-refs" className="text-sm font-semibold text-ink">
          Namuna rasmlar <span className="font-normal text-slate-500 tabular-nums">({version.references.length})</span>
        </h3>
        {version.references.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {version.references.map((reference, index) => (
              <ReadonlyReferenceCard key={reference.id} reference={reference} index={index} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Rasm qo&apos;shilmagan.</p>
        )}
      </section>

      <section aria-labelledby="ai-active-criteria" className="space-y-2">
        <h3 id="ai-active-criteria" className="text-sm font-semibold text-ink">
          Umumiy mezonlar
        </h3>
        {version.criteria.trim() ? (
          <p className="rounded-xl bg-canvas px-4 py-3 text-sm whitespace-pre-wrap break-words text-slate-700">
            {version.criteria}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Mezon yozilmagan — faqat rasmlar bo&apos;yicha.</p>
        )}
      </section>
    </div>
  );
}

function DraftEditor({ state, draft, onNotice }: { state: AiState; draft: AiConfigVersion; onNotice: (message: string) => void }) {
  const setState = useSetAiState();
  const queryClient = useQueryClient();
  const criteriaId = useId();
  const [criteria, setCriteria] = useState(draft.criteria);

  const save = useMutation({
    mutationFn: (text: string) => updateAiDraft({ criteria: text }),
    onSuccess: async (next) => {
      setState(next);
      await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  /** Maydondagi matn serverdagidan farq qiladi. */
  const dirty = criteria !== draft.criteria;
  const ready = criteria.trim().length >= AI_LIMITS.criteriaMinToApprove || draft.references.length > 0;

  function saveCriteria() {
    if (!dirty || (save.isPending && save.variables === criteria)) return;
    save.mutate(criteria);
  }

  /** Tasdiqlashdan oldin: saqlanmagan matn bo'lsa — avval saqlanadi (xato bo'lsa — tasdiqlanmaydi). */
  async function flushCriteria() {
    if (!dirty) return;
    await save.mutateAsync(criteria);
  }

  return (
    <div className="space-y-6">
      {state.active && (
        <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-slate-600">
          Hozir AI versiya {state.active.version} bo&apos;yicha ishlayapti. Bu qoralama (versiya {draft.version}) tasdiqlanmaguncha
          hech narsa o&apos;zgarmaydi.
        </p>
      )}

      <section aria-labelledby="ai-refs-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="ai-refs-title" className="text-sm font-semibold text-ink">
            Namuna rasmlar{" "}
            <span className="font-normal text-slate-500 tabular-nums">
              ({draft.references.length} / {AI_LIMITS.maxReferences})
            </span>
          </h3>
          <p className="text-xs text-slate-500">JPG, PNG yoki WebP, 15 MB gacha — yuborishdan oldin kichraytiriladi.</p>
        </div>
        <p className="text-sm text-slate-600">
          Videoda nima <strong className="font-medium text-up">ko&apos;rinishi shart</strong>, nima{" "}
          <strong className="font-medium text-down">bo&apos;lmasligi kerak</strong> — rasm bilan ko&apos;rsating va izohda
          AI nimaga qarashini yozing.
        </p>

        {draft.references.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {draft.references.map((reference, index) => (
              <DraftReferenceCard key={reference.id} reference={reference} index={index} />
            ))}
          </ul>
        )}
        {/* Bitta joyda turadi — birinchi rasm qo'shilganda ham yuklash holati yo'qolmaydi. */}
        <ReferenceUpload count={draft.references.length} variant={draft.references.length === 0 ? "empty" : "button"} />
      </section>

      <section aria-labelledby="ai-criteria-title" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="ai-criteria-title" className="text-sm font-semibold text-ink">
            <label htmlFor={criteriaId}>Umumiy mezonlar</label>
          </h3>
          <span className="text-xs text-slate-500 tabular-nums">
            {formatNumber(criteria.length)} / {formatNumber(AI_LIMITS.criteriaMax)}
          </span>
        </div>
        <Textarea
          id={criteriaId}
          rows={6}
          value={criteria}
          maxLength={AI_LIMITS.criteriaMax}
          placeholder={CRITERIA_PLACEHOLDER}
          onChange={(event) => setCriteria(event.target.value)}
          onBlur={saveCriteria}
          aria-describedby={`${criteriaId}-hint`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${criteriaId}-hint`} className="text-xs text-slate-500">
            Oddiy so&apos;zlar bilan yozing: videoda nima bo&apos;lishi va nima bo&apos;lmasligi kerak. Maydondan chiqqanda
            saqlanadi.
          </p>
          <div className="flex items-center gap-2" aria-live="polite">
            {save.isPending ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saqlanmoqda…
              </span>
            ) : dirty ? (
              <Button size="sm" variant="secondary" onClick={saveCriteria}>
                Saqlash
              </Button>
            ) : save.isSuccess && !dirty ? (
              <span className="inline-flex items-center gap-1 text-xs text-up">
                <Check className="size-3.5" aria-hidden />
                Saqlandi
              </span>
            ) : null}
          </div>
        </div>
        {save.isError && <ErrorAlert>{errorMessage(save.error)}</ErrorAlert>}
      </section>

      <ApproveBlock state={state} draft={draft} ready={ready} flushCriteria={flushCriteria} onApproved={onNotice} />
    </div>
  );
}
