import { LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { Garland } from "./ProfileFestive";
import { Snowfall } from "./Snowfall";

/**
 * Bayramona tasdiqlash oynasi: qishki tun kartasi, tepasida gulchambar, ichida qor yog'adi,
 * qorbola qo'l silkitib turadi. Asosiy (oq) tugma — "qolish", ikkinchisi — tasdiqlash.
 * Escape yoki fonni bosish — bekor qilish.
 */
export function FestiveConfirm({
  open,
  title,
  body,
  stayLabel,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  stayLabel: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  // Ota komponent har renderda yangi funksiya bersa ham, oyna effekti qayta ishga tushmasin.
  const latest = useRef({ busy, onCancel });
  useEffect(() => {
    latest.current = { busy, onCancel };
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !latest.current.busy) latest.current.onCancel();
    };
    window.addEventListener("keydown", onKey);
    // Oyna ochiq turganda orqadagi sahifa aylanmaydi.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center px-5">
      <button
        type="button"
        aria-label={stayLabel}
        tabIndex={-1}
        onClick={() => !busy && onCancel()}
        className="absolute inset-0 animate-fade bg-[#0b0f26]/55 backdrop-blur-[3px]"
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative isolate w-full max-w-[340px] animate-menu-pop overflow-hidden rounded-card bg-[linear-gradient(160deg,#2c3874_0%,#1a2050_58%,#10142f_100%)] px-6 pt-12 pb-6 text-center text-white shadow-[0_30px_60px_-20px_rgba(5,8,25,0.85)]"
      >
        <div aria-hidden className="absolute -top-16 left-1/2 -z-10 size-56 -translate-x-1/2 rounded-full bg-[#7f9cff]/25 blur-3xl" />
        <div aria-hidden className="absolute -bottom-24 -left-10 -z-10 size-56 rounded-full bg-[#df3425]/25 blur-3xl" />
        <Snowfall density={0.55} />
        <Garland className="absolute inset-x-0 top-0 h-10" />

        <WavingSnowman className="mx-auto h-[118px] w-auto" />
        <h2 id={titleId} className="mt-3 text-[22px] leading-tight font-extrabold tracking-tight">
          {title}
        </h2>
        <p id={bodyId} className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-snug text-white/75">
          {body}
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            ref={stayRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-13 w-full items-center justify-center rounded-full bg-white py-3.5 text-base font-bold text-[#c22a24] shadow-[0_12px_26px_-12px_rgba(0,0,0,0.6)] transition active:scale-[0.98] disabled:opacity-70"
          >
            {stayLabel} 🎄
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[15px] font-semibold text-white/90 ring-1 ring-white/25 transition active:scale-[0.98] disabled:opacity-70"
          >
            {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/** Qorbobo qalpoqli qorbola: bir qo'li bilan "xayr" deb silkitadi. */
function WavingSnowman({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 120 132" aria-hidden className={className}>
      <defs>
        <radialGradient id={`sm-snow-${uid}`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef3fc" />
          <stop offset="1" stopColor="#c9d8ef" />
        </radialGradient>
        <linearGradient id={`sm-hat-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f04637" />
          <stop offset="1" stopColor="#a8141d" />
        </linearGradient>
      </defs>

      {/* Qor ustidagi soya */}
      <ellipse cx="60" cy="126" rx="38" ry="5" fill="#0a0e26" opacity="0.35" />

      {/* Chap qo'l — qimirlamaydi */}
      <path d="M38 70 L18 60 M24 63 L18 55 M24 63 L15 64" stroke="#7a4b2a" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* O'ng qo'l — "xayr" deb silkitadi */}
      <g className="motion-safe:animate-wave" style={{ transformOrigin: "82px 70px" }}>
        <path d="M82 70 L101 52 M95 57 L96 47 M95 57 L104 58" stroke="#7a4b2a" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>

      {/* Tana */}
      <circle cx="60" cy="100" r="27" fill={`url(#sm-snow-${uid})`} />
      <circle cx="60" cy="64" r="20" fill={`url(#sm-snow-${uid})`} />
      {[94, 104, 114].map((y) => (
        <circle key={y} cx="60" cy={y} r="2.6" fill="#1b2038" />
      ))}
      <circle cx="60" cy="60" r="2.2" fill="#1b2038" />
      <circle cx="60" cy="69" r="2.2" fill="#1b2038" />

      {/* Bosh */}
      <circle cx="60" cy="34" r="16" fill={`url(#sm-snow-${uid})`} />
      <circle cx="54.5" cy="31" r="1.9" fill="#1b2038" />
      <circle cx="65.5" cy="31" r="1.9" fill="#1b2038" />
      <path d="M60 35 L72 38 L60 39 Z" fill="#f08a24" />
      <path d="M54 41 Q60 45.5 66 41" stroke="#1b2038" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <circle cx="51" cy="38" r="2.4" fill="#ff8a8a" opacity="0.45" />
      <circle cx="69" cy="38" r="2.4" fill="#ff8a8a" opacity="0.45" />

      {/* Sharf */}
      <path d="M43 47 Q60 54 77 47 L77 53 Q60 60 43 53 Z" fill="#df3425" />
      <path d="M67 52 L71 72 L64 71 L62 54 Z" fill="#c22a24" />
      <path d="M48 49.5 L48 54.5 M56 51.5 L56 56.5 M64 51.5 L64 56.5 M72 49.5 L72 54" stroke="#ffd25e" strokeWidth="1.4" opacity="0.85" />

      {/* Qorbobo qalpog'i — chapga egilgan */}
      <g transform="rotate(-12 60 22)">
        <path d="M45 25 C44 9 57 1 69 2 C80 3 88 11 91 22 C85 16 79 15 76.5 19 L76 25 Z" fill={`url(#sm-hat-${uid})`} />
        <path d="M43 22.5 Q60 18.5 77 22.5 Q78.5 26 77 29.5 Q60 25.5 43 29.5 Q41.5 26 43 22.5 Z" fill="#ffffff" />
        <circle cx="91.5" cy="24" r="5.5" fill="#ffffff" />
      </g>
    </svg>
  );
}
