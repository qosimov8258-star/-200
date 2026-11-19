import clsx from "clsx";
import { LoaderCircle } from "lucide-react";
import { useId, type ComponentProps, type CSSProperties, type ReactNode } from "react";

/** Oltin atlas lenta rangi (o'rtasi yaltiroq). */
const RIBBON_V = "linear-gradient(90deg,#a8690f,#f3c656 30%,#fff1b8 50%,#f3c656 70%,#a8690f)";
const RIBBON_H = "linear-gradient(180deg,#a8690f,#f3c656 30%,#fff1b8 50%,#f3c656 70%,#a8690f)";

/**
 * Sovg'a qutisi ko'rinishidagi asosiy tugma: qizil "quti" o'rtasidan tikka va ko'ndalang oltin
 * atlas lenta o'tadi (quti o'ralgandek), tepasining o'rtasida oltin bantik. Yozuv lentalar
 * kesishgan joyda — qizil yorliq ichida. Bantik tugmadan yuqoriga chiqadi — ustida ~30px joy qoldiring.
 */
export function GiftButton({
  children,
  loading = false,
  icon,
  disabled,
  className,
  ...props
}: ComponentProps<"button"> & { loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={clsx(
        "group relative isolate flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white",
        "bg-[linear-gradient(180deg,#f45a42_0%,#df3425_55%,#b51f2b_100%)] shadow-[0_14px_26px_-12px_rgba(181,31,43,0.75),inset_0_1px_0_rgba(255,255,255,0.28)]",
        "transition active:scale-[0.98] disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {/* Quti ichi: ikki lenta tugma shakli bilan kesiladi — quti o'ralgandek */}
      <span aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-full">
        <span
          className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 shadow-[0_0_6px_rgba(90,40,0,0.35)]"
          style={{ background: RIBBON_H }}
        />
        <span
          className="absolute inset-y-0 left-1/2 w-[18px] -translate-x-1/2 shadow-[0_0_6px_rgba(90,40,0,0.35)]"
          style={{ background: RIBBON_V }}
        />
        {/* Yaltiroq: tugma ustidan vaqti-vaqti bilan o'tadi */}
        <span className="absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)] motion-safe:animate-sheen" />
      </span>

      <Bow className="pointer-events-none absolute -top-[30px] left-1/2 w-[70px] -translate-x-1/2" />

      {/* Yozuv — lentalar kesishgan joyda, oltin hoshiyali qizil yorliqda */}
      <span className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,#ea4632,#c8262a)] px-5 py-2 shadow-[0_4px_10px_-4px_rgba(90,10,10,0.6)] ring-[1.5px] ring-[#f3c656]">
        {loading ? <LoaderCircle className="size-5 animate-spin" /> : children}
        {!loading && icon}
      </span>
    </button>
  );
}

/** Oltin atlas bantik: ikki katta, ikki yuqori va ikki kichik halqa, tugun va uchlari. */
function Bow({ className, style }: { className?: string; style?: CSSProperties }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const light = `gift-bow-light-${id}`;
  const dark = `gift-bow-dark-${id}`;
  const knot = `gift-bow-knot-${id}`;

  return (
    <svg viewBox="0 -6 120 90" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id={light} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.45" stopColor="#f3c656" />
          <stop offset="1" stopColor="#b47716" />
        </linearGradient>
        <linearGradient id={dark} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2a93a" />
          <stop offset="1" stopColor="#8a560c" />
        </linearGradient>
        <radialGradient id={knot} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff4cc" />
          <stop offset="0.55" stopColor="#efbd4c" />
          <stop offset="1" stopColor="#9a6110" />
        </radialGradient>
      </defs>

      {/* Uchlari */}
      <path d="M57 46 C52 58 46 70 38 82 L45 78 L49 84 C55 70 60 58 61 48 Z" fill={`url(#${dark})`} />
      <path d="M63 46 C68 58 74 70 82 82 L75 78 L71 84 C65 70 60 58 59 48 Z" fill={`url(#${dark})`} />

      {/* Katta halqalar */}
      <path d="M60 44 C46 26 22 8 9 16 C-1 23 6 44 26 48 C38 50 50 47 60 44 Z" fill={`url(#${light})`} />
      <path d="M60 44 C74 26 98 8 111 16 C121 23 114 44 94 48 C82 50 70 47 60 44 Z" fill={`url(#${light})`} />
      <path d="M60 44 C46 30 26 18 15 22 C26 22 44 32 60 44 Z" fill="#8a560c" opacity="0.45" />
      <path d="M60 44 C74 30 94 18 105 22 C94 22 76 32 60 44 Z" fill="#8a560c" opacity="0.45" />

      {/* Yuqori halqalar */}
      <path d="M60 44 C50 30 36 8 44 0 C52 -6 64 18 60 44 Z" fill={`url(#${light})`} />
      <path d="M60 44 C70 30 84 8 76 0 C68 -6 56 18 60 44 Z" fill={`url(#${light})`} />
      <path d="M60 42 C54 30 46 14 46 6" fill="none" stroke="#8a560c" strokeOpacity="0.4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M60 42 C66 30 74 14 74 6" fill="none" stroke="#8a560c" strokeOpacity="0.4" strokeWidth="2.2" strokeLinecap="round" />

      {/* Kichik old halqalar */}
      <path d="M60 44 C50 34 34 28 28 34 C23 40 32 50 44 50 C50 50 56 47 60 44 Z" fill={`url(#${light})`} />
      <path d="M60 44 C70 34 86 28 92 34 C97 40 88 50 76 50 C70 50 64 47 60 44 Z" fill={`url(#${light})`} />

      {/* Yaltiroq chiziqlar */}
      <path d="M14 20 C24 16 40 24 52 36" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
      <path d="M45 2 C49 0 52 6 54 14" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" />

      {/* Tugun */}
      <ellipse cx="60" cy="45" rx="9" ry="8" fill={`url(#${knot})`} />
      <path d="M54 41 C57 39 62 39 65 41" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
