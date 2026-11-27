import { useEffect, useRef, useSyncExternalStore } from "react";

import { t } from "../i18n";
import { getConfirm, registerConfirmHost, subscribeConfirm } from "../lib/confirm-store";

/**
 * Telegram'dan tashqaridagi tasdiqlash oynasi (`confirmDialog` → `requestConfirm`).
 * Istoriya ko'ruvchisi (z-90) va toast (z-95) ustida turadi.
 */
export function ConfirmHost() {
  const request = useSyncExternalStore(subscribeConfirm, getConfirm, getConfirm);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => registerConfirmHost(), []);

  useEffect(() => {
    if (!request) return;
    okRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") request.resolve(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 px-4 pt-4 sm:items-center"
      style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
      onClick={() => request.resolve(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
        className="animate-rise w-full max-w-sm rounded-card bg-surface p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="confirm-message" className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
          {request.message}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-12 rounded-tile bg-chip text-[15px] font-semibold text-ink active:scale-[0.98]"
            onClick={() => request.resolve(false)}
          >
            {t.confirmCancel}
          </button>
          <button
            ref={okRef}
            type="button"
            className="h-12 rounded-tile bg-ink text-[15px] font-semibold text-white active:scale-[0.98]"
            onClick={() => request.resolve(true)}
          >
            {t.confirmOk}
          </button>
        </div>
      </div>
    </div>
  );
}
