"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideManualReview } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { MANUAL_REVIEW_REJECT_LABELS } from "@/lib/labels";
import type { ManualReviewItem, ManualReviewRejectReason } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_NOTE_LENGTH = 500;
const REJECT_REASONS = Object.keys(MANUAL_REVIEW_REJECT_LABELS) as ManualReviewRejectReason[];

/** Qaror videolar ro'yxati, ishtirokchilar (va ularning videolari), reyting va audit logga ta'sir qiladi. */
function useInvalidateAfterDecision() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["manual-reviews", "participants", "participant-reels", "daily-rating", "dashboard", "audit-log"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
}

const fullName = (item: ManualReviewItem) => `${item.participant.firstName} ${item.participant.lastName}`;

interface DialogProps {
  item: ManualReviewItem;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function ApproveDialog({ item, onClose, onDone }: DialogProps) {
  const invalidate = useInvalidateAfterDecision();
  const name = fullName(item);
  return (
    <ConfirmDialog
      title="Videoni tasdiqlash"
      description={
        <>
          <strong className="font-medium text-slate-900">{name}</strong> videosi reytingga
          {item.kind === "LOST_REEL" ? " qaytariladi" : " qo'shiladi"} va ishtirokchiga bot orqali
          xabar boradi. Ko&apos;rishlar Apify videoni keyingi yig&apos;ishlarda topganda yangilanadi.
          Tasdiqlashdan oldin video ochiq va mahsulot haqida ekaniga ishonch hosil qiling.
        </>
      }
      confirmLabel="Tasdiqlash"
      onConfirm={async () => {
        await decideManualReview(item.id, { decision: "approve" });
        await invalidate();
      }}
      onClose={onClose}
      onDone={() => onDone(`${name} videosi tasdiqlandi.`)}
    />
  );
}

export function RejectDialog({ item, onClose, onDone }: DialogProps) {
  const invalidate = useInvalidateAfterDecision();
  const name = fullName(item);
  const [reason, setReason] = useState<ManualReviewRejectReason>("NOT_FOUND");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      await decideManualReview(item.id, { decision: "reject", reason, note: note.trim() || undefined });
      await invalidate();
    },
    onSuccess: () => onDone(`${name} videosi rad etildi.`),
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Videoni rad etish"
      description={
        <>
          <strong className="font-medium text-slate-900">{name}</strong> tanlangan sabab bilan bot
          orqali xabar oladi va boshqa video linkini yubora oladi.
        </>
      }
      busy={mutation.isPending}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage(mutation.error)}</span>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Sabab</legend>
          {REJECT_REASONS.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm",
                reason === value
                  ? "border-brand-500 bg-brand-50 text-slate-900"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="reject-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                disabled={mutation.isPending}
                className="accent-brand-600"
              />
              {MANUAL_REVIEW_REJECT_LABELS[value]}
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="reject-note">Izoh (ixtiyoriy)</Label>
          <Textarea
            id="reject-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Masalan: akkaunt yopiq, video ko'rinmayapti"
            maxLength={MAX_NOTE_LENGTH}
            disabled={mutation.isPending}
            aria-describedby="reject-note-hint"
          />
          <p id="reject-note-hint" className="text-xs text-slate-500">
            Izoh audit logga yoziladi, ishtirokchiga yuborilmaydi.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="danger" loading={mutation.isPending}>
            Rad etish
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
