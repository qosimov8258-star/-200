"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteAiReference, updateAiReference } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatFileSize } from "@/lib/format";
import { AI_REF_KIND_LABELS } from "@/lib/labels";
import { AI_LIMITS, type AiRefKind, type AiReferenceImage, type AiReferenceUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { KindBadge, ReferenceImage, useSetAiState } from "./ai-common";

const KINDS: AiRefKind[] = ["MUST", "MUST_NOT", "INFO"];

/** Kartaning chap chizig'i — turi bir qarashda ko'rinsin. */
const KIND_BORDER: Record<AiRefKind, string> = {
  MUST: "border-l-up",
  MUST_NOT: "border-l-down",
  INFO: "border-l-slate-300",
};

const NOTE_PLACEHOLDER: Record<AiRefKind, string> = {
  MUST: "Masalan: qadoqdagi logotip aniq ko'rinsin",
  MUST_NOT: "Masalan: raqobatchi brend qadog'i",
  INFO: "Masalan: mahsulotning boshqa rangdagi qadog'i",
};

const MIME_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Qoralamadagi namuna rasm: turi (darhol saqlanadi), izoh (maydondan chiqqanda saqlanadi), o'chirish. */
export function DraftReferenceCard({ reference, index }: { reference: AiReferenceImage; index: number }) {
  const setState = useSetAiState();
  const queryClient = useQueryClient();
  const noteId = useId();
  const kindId = useId();

  const [note, setNote] = useState(reference.note);
  const [seenNote, setSeenNote] = useState(reference.note);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Serverdagi izoh boshqa joydan o'zgarsa (masalan, ikkinchi oynada) — maydon ham yangilansin.
  if (reference.note !== seenNote) {
    setSeenNote(reference.note);
    setNote(reference.note);
  }

  const save = useMutation({
    mutationFn: (update: AiReferenceUpdate) => updateAiReference(reference.id, update),
    onSuccess: (state) => setState(state),
  });

  const status: SaveStatus = save.isPending ? "saving" : save.isError ? "error" : save.isSuccess ? "saved" : "idle";
  const label = `${index + 1}-rasm`;

  function saveNote() {
    if (note.trim() === reference.note.trim()) return;
    save.mutate({ note: note.trim() });
  }

  return (
    <li
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line border-l-4 bg-white",
        KIND_BORDER[reference.kind],
      )}
    >
      <div className="relative">
        <ReferenceImage id={reference.id} alt={`${label}: ${AI_REF_KIND_LABELS[reference.kind]}`} className="aspect-[4/3]" />
        <KindBadge kind={reference.kind} className="absolute top-2 left-2 shadow-sm" />
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="space-y-1">
          <label htmlFor={kindId} className="text-xs font-medium text-slate-600">
            Turi
          </label>
          <Select
            id={kindId}
            value={reference.kind}
            disabled={save.isPending}
            onChange={(event) => save.mutate({ kind: event.target.value as AiRefKind })}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {AI_REF_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label htmlFor={noteId} className="text-xs font-medium text-slate-600">
            Izoh — AI nimaga qarasin
          </label>
          <Textarea
            id={noteId}
            rows={2}
            value={note}
            maxLength={AI_LIMITS.noteMax}
            placeholder={NOTE_PLACEHOLDER[reference.kind]}
            onChange={(event) => setNote(event.target.value)}
            onBlur={saveNote}
          />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-slate-500" aria-live="polite">
            {status === "saving" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saqlanmoqda…
              </span>
            ) : status === "saved" ? (
              <span className="inline-flex items-center gap-1 text-up">
                <Check className="size-3.5" aria-hidden />
                Saqlandi
              </span>
            ) : (
              <span className="tabular-nums">
                {MIME_LABELS[reference.mime] ?? reference.mime} · {formatFileSize(reference.sizeBytes)}
              </span>
            )}
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            aria-label={`${label}ni o'chirish`}
          >
            <Trash2 className="size-4" aria-hidden />
            O&apos;chirish
          </Button>
        </div>

        {status === "error" && <p className="text-xs text-red-600">{errorMessage(save.error)}</p>}
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Rasm o'chirilsinmi?"
          description="Rasm faqat shu qoralamadan o'chadi. Tasdiqlangan versiyalarga ta'sir qilmaydi."
          confirmLabel="O'chirish"
          variant="danger"
          onConfirm={async () => setState(await deleteAiReference(reference.id))}
          onClose={() => setConfirmingDelete(false)}
          onDone={async () => {
            setConfirmingDelete(false);
            await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
          }}
        />
      )}
    </li>
  );
}

/** Tasdiqlangan versiyadagi rasm — faqat ko'rish. */
export function ReadonlyReferenceCard({ reference, index }: { reference: AiReferenceImage; index: number }) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line border-l-4 bg-white",
        KIND_BORDER[reference.kind],
      )}
    >
      <div className="relative">
        <ReferenceImage
          id={reference.id}
          alt={`${index + 1}-rasm: ${AI_REF_KIND_LABELS[reference.kind]}`}
          className="aspect-[4/3]"
        />
        <KindBadge kind={reference.kind} className="absolute top-2 left-2 shadow-sm" />
      </div>
      <p className={cn("p-3 text-sm break-words", reference.note ? "text-slate-700" : "text-slate-400")}>
        {reference.note || "Izoh yozilmagan"}
      </p>
    </li>
  );
}
