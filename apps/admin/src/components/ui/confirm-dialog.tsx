"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { errorMessage } from "@/lib/api-error";

import { Button } from "./button";
import { Dialog } from "./dialog";

interface ConfirmDialogProps {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  variant?: "primary" | "danger";
  /** Tasdiqlanganda chaqiriladi; xato tashlasa — xabar oynada ko'rsatiladi. */
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}

/** Sabab so'ramaydigan oddiy tasdiqlash oynasi. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  variant = "primary",
  onConfirm,
  onClose,
  onDone,
}: ConfirmDialogProps) {
  const mutation = useMutation({ mutationFn: onConfirm, onSuccess: () => onDone() });

  return (
    <Dialog open onClose={onClose} title={title} description={description} busy={mutation.isPending}>
      {mutation.isError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{errorMessage(mutation.error)}</span>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
          Bekor qilish
        </Button>
        <Button
          variant={variant}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          data-autofocus
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
