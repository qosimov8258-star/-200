import { Lock, MessageCircle } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { t } from "../i18n/uz";
import { Snowfall } from "./Snowfall";

/**
 * Profildagi qulflangan maydon (ism, familiya, yosh) bosilganda: "o'zgartirib bo'lmaydi —
 * supportga yozing" oynasi (pastdan chiqadi, qishki tun uslubida). Escape yoki fonni bosish — yopish.
 */
export function LockedFieldSheet({
  field,
  onClose,
  onWriteSupport,
}: {
  /** Bosilgan maydon nomi; null — oyna yopiq. */
  field: string | null;
  onClose: () => void;
  onWriteSupport: (field: string) => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const actionRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!field) return;
    const previous = document.activeElement as HTMLElement | null;
    actionRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [field]);

  if (!field) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0b0d1f]/55 backdrop-blur-[2px] motion-safe:animate-fade" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onClick={(e) => e.stopPropagation()}
        className="relative isolate w-full max-w-[520px] overflow-hidden rounded-t-[30px] bg-[linear-gradient(160deg,#262f5f,#151a39_70%)] px-6 pt-7 pb-[calc(var(--safe-bottom)+20px)] text-white shadow-[0_-18px_40px_-20px_rgba(11,13,31,0.8)] motion-safe:animate-rise"
      >
        <Snowfall density={0.5} />
        <span aria-hidden className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25" />
        <span className="grid size-12 place-items-center rounded-full bg-[linear-gradient(135deg,#f2583f,#df3425)] shadow-[0_8px_20px_-8px_rgba(223,52,37,0.8)]">
          <Lock className="size-6" aria-hidden />
        </span>
        <h2 id={titleId} className="mt-4 text-[21px] leading-tight font-bold tracking-tight">
          {t.lockedTitle(field)}
        </h2>
        <p id={bodyId} className="mt-2 text-[15px] leading-snug text-white/75">
          {t.lockedBody}
        </p>
        {/* Oddiy tugma (sovg'a bantigisiz): qorong'i oynada oq, yozuvi brend qizilida. */}
        <button
          ref={actionRef}
          type="button"
          onClick={() => onWriteSupport(field)}
          className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-[#c22a24] shadow-[0_12px_26px_-12px_rgba(0,0,0,0.6)] transition active:scale-[0.98]"
        >
          <MessageCircle className="size-5" aria-hidden />
          {t.lockedWriteSupport}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-12 w-full rounded-full text-[15px] font-semibold text-white/80 transition active:bg-white/10"
        >
          {t.lockedClose}
        </button>
      </div>
    </div>,
    document.body,
  );
}
