"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  /** `true` bo'lsa Escape va fonni bosish oynani yopmaydi (masalan, so'rov ketayotganda). */
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Brauzerning `<dialog>` elementi asosidagi modal oyna: fokus oyna ichida
 * qoladi, Escape yopadi, yopilganda fokus ochgan tugmaga qaytadi.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  busy = false,
  className,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;

    if (!dialog.open) {
      dialog.showModal();
      // Birinchi maydonga fokus: `data-autofocus` belgisi bo'lgan element.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }

    // `open` false bo'lganda yoki komponent olib tashlanganda — fokus ochgan tugmaga qaytadi.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={(event) => {
        // `close` hodisasi kechikib keladi. Shu payt oyna yana ochiq bo'lsa (React StrictMode
        // effektni qayta ishga tushirgan), bu haqiqiy yopilish emas.
        if (!event.currentTarget.open) onClose();
      }}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        // Fonga (oynaning o'ziga emas) bosilganda yopish.
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-0 text-slate-900 shadow-xl",
        "backdrop:bg-slate-900/40",
        className,
      )}
    >
      {open && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="-m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              aria-label="Yopish"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {description && (
            <div id={descriptionId} className="mt-2 text-sm text-slate-600">
              {description}
            </div>
          )}
          <div className="mt-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
