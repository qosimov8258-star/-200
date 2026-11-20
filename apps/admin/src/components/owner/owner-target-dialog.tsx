"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/api-error";
import { updateOwnerTarget } from "@/lib/owner-api";
import { OWNER_TARGET_LABELS } from "@/lib/owner-labels";
import type { TargetCaseListItem, TargetCaseStatus } from "@/lib/types";

import { ownerFullName } from "./owner-common";

const STATUSES: TargetCaseStatus[] = ["NEW", "WARNED", "DISQUALIFIED", "DISMISSED"];
const MAX_NOTE_LENGTH = 300;

interface OwnerTargetDialogProps {
  item: TargetCaseListItem;
  onClose: () => void;
  onDone: (updated: TargetCaseListItem) => void;
}

/** Target holatini istalgan holatga o'tkazish (admin bo'limidagi cheklovlarsiz) va ixtiyoriy izoh. */
export function OwnerTargetDialog({ item, onClose, onDone }: OwnerTargetDialogProps) {
  const [status, setStatus] = useState<TargetCaseStatus>(() => STATUSES.find((value) => value !== item.status) ?? item.status);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => updateOwnerTarget(item.id, { status, note: note.trim() || undefined }),
    onSuccess: (updated) => onDone(updated),
  });

  const unchanged = status === item.status;
  const effect =
    status === "DISQUALIFIED" && item.status !== "DISQUALIFIED"
      ? "Ishtirokchi ham chetlatiladi — reytingdan chiqadi."
      : item.status === "DISQUALIFIED" && status !== "DISQUALIFIED"
        ? "Ishtirokchining boshqa chetlatish holati bo'lmasa, u faol holatga qaytadi."
        : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unchanged) mutation.mutate();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Target holatini o'zgartirish"
      description={
        <>
          <strong className="font-medium text-slate-900">{ownerFullName(item.participant)}</strong> — hozirgi holat:{" "}
          «{OWNER_TARGET_LABELS[item.status]}».
        </>
      }
      busy={mutation.isPending}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage(mutation.error)}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="owner-target-status">Yangi holat</Label>
          <Select
            id="owner-target-status"
            data-autofocus
            value={status}
            disabled={mutation.isPending}
            onChange={(event) => {
              const next = STATUSES.find((value) => value === event.target.value);
              if (next) setStatus(next);
            }}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {OWNER_TARGET_LABELS[value]}
                {value === item.status ? " (hozirgi)" : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-target-note">
            Izoh <span className="font-normal text-slate-400">(ixtiyoriy)</span>
          </Label>
          <Textarea
            id="owner-target-note"
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            disabled={mutation.isPending}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Masalan: reklama kabineti ko'rildi, target yo'q"
            aria-describedby="owner-target-note-hint"
          />
          <p id="owner-target-note-hint" className="text-right text-xs text-slate-400 tabular-nums">
            {note.length}/{MAX_NOTE_LENGTH}
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-[#f7f6fb] px-3 py-2.5 text-xs text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <span>
            {effect && <span className="block font-medium text-ink">{effect}</span>}
            Ishtirokchiga bot orqali xabar yuborilmaydi.
          </span>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            variant={status === "DISQUALIFIED" ? "danger" : "primary"}
            loading={mutation.isPending}
            disabled={unchanged}
          >
            Saqlash
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
