"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { errorMessage } from "@/lib/api-error";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { Label } from "./label";
import { Textarea } from "./textarea";

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

interface ReasonDialogProps {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  variant: "primary" | "danger";
  placeholder?: string;
  /** Maydon nomi (standart — "Sabab"). */
  fieldLabel?: string;
  /** Eng kam belgilar soni (standart — 5). */
  minLength?: number;
  /** Tasdiqlanganda chaqiriladi; xato tashlasa — xabar oynada ko'rsatiladi. */
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
  /** Amal muvaffaqiyatli bajarilgach. */
  onDone: () => void;
}

/**
 * Sabab so'raydigan tasdiqlash oynasi: sabab majburiy va audit logga yoziladi
 * (TZ 2-bo'lim: barcha Admin harakatlari audit logda).
 */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  variant,
  placeholder,
  fieldLabel = "Sabab",
  minLength = MIN_REASON_LENGTH,
  onConfirm,
  onClose,
  onDone,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const mutation = useMutation({
    mutationFn: () => onConfirm(reason.trim()),
    onSuccess: () => onDone(),
  });

  const reasonTooShort = reason.trim().length < minLength;
  const reasonError = showValidation && reasonTooShort;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowValidation(true);
    if (!reasonTooShort) {
      mutation.mutate();
    }
  }

  return (
    <Dialog open onClose={onClose} title={title} description={description} busy={mutation.isPending}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage(mutation.error)}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="action-reason">{fieldLabel}</Label>
          <Textarea
            id="action-reason"
            data-autofocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            maxLength={MAX_REASON_LENGTH}
            disabled={mutation.isPending}
            aria-invalid={reasonError || undefined}
            aria-describedby="action-reason-hint"
          />
          <p
            id="action-reason-hint"
            className={reasonError ? "text-xs text-red-600" : "text-xs text-slate-500"}
          >
            {reasonError
              ? `${fieldLabel}ni yozing (kamida ${minLength} ta belgi).`
              : `${fieldLabel} amallar tarixiga yoziladi: kim, nima, qachon.`}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" variant={variant} loading={mutation.isPending}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
