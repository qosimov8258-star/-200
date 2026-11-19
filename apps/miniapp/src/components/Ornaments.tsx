import clsx from "clsx";
import { useId } from "react";

/**
 * Yangi yil bezaklari (Reyting sahifasi uchun): ipga osilgan archa o'yinchog'i, top-3 uchun
 * o'yinchoq-medallar va karta tepasiga qo'ngan qor. Hammasi bezak — `aria-hidden`.
 */

/** Ipga osilgan qizil archa o'yinchog'i: tilla qopqoq, oq naqsh, yaltiroq; sekin tebranadi. */
export function HangingOrnament({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 48 76"
      aria-hidden
      className={clsx("overflow-visible", className)}
    >
      <defs>
        <radialGradient id={`orn-ball-${uid}`} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ff8a73" />
          <stop offset="0.45" stopColor="#df3425" />
          <stop offset="1" stopColor="#8f1712" />
        </radialGradient>
        <linearGradient id={`orn-cap-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#a8690f" />
          <stop offset="0.35" stopColor="#fff1b8" />
          <stop offset="0.7" stopColor="#e3a52a" />
          <stop offset="1" stopColor="#8a560c" />
        </linearGradient>
      </defs>
      <g className="origin-[24px_0px] motion-safe:animate-ornament">
        <line x1="24" y1="0" x2="24" y2="30" stroke="#c9a24a" strokeWidth="1.2" />
        <circle cx="24" cy="30.5" r="2.6" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
        <rect x="18.5" y="32" width="11" height="7" rx="1.6" fill={`url(#orn-cap-${uid})`} />
        <circle cx="24" cy="56" r="17" fill={`url(#orn-ball-${uid})`} />
        {/* Oq qorli naqsh */}
        <path
          d="M8.2 52.5 C14 49 19 55 24 52 C29 49 34 55 39.8 52.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M9.5 61 C15 58.5 19.5 63.5 24 61 C28.5 58.5 33 63.5 38.5 61"
          fill="none"
          stroke="#ffd98a"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.9"
        />
        {[12.5, 19, 29, 35.5].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 66.5 : 67.5} r="1.3" fill="#ffffff" opacity="0.8" />
        ))}
        <ellipse cx="17.5" cy="47" rx="4.2" ry="2.6" fill="#ffffff" opacity="0.55" transform="rotate(-35 17.5 47)" />
      </g>
    </svg>
  );
}

const RANK_STYLES = {
  1: { from: "#fff1b8", mid: "#f3c656", to: "#b47716", ink: "#6b3f07" },
  2: { from: "#ffffff", mid: "#d6dde8", to: "#8c97a8", ink: "#3d4656" },
  3: { from: "#ffd8bd", mid: "#e0965f", to: "#9b5528", ink: "#5b2c0e" },
} as const;

/** 1–3-o'rin uchun archa o'yinchog'i ko'rinishidagi medal: tilla/kumush/bronza shar va raqam. */
export function RankOrnament({ rank }: { rank: 1 | 2 | 3 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style = RANK_STYLES[rank];
  return (
    <svg viewBox="0 0 30 34" aria-hidden className="h-[34px] w-[30px] shrink-0 overflow-visible">
      <defs>
        <radialGradient id={`rank-${uid}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={style.from} />
          <stop offset="0.5" stopColor={style.mid} />
          <stop offset="1" stopColor={style.to} />
        </radialGradient>
      </defs>
      <circle cx="15" cy="2.4" r="1.8" fill="none" stroke="#c9a24a" strokeWidth="1" />
      <rect x="11" y="3.6" width="8" height="4.4" rx="1.1" fill="#c9a24a" />
      <circle cx="15" cy="20" r="13" fill={`url(#rank-${uid})`} />
      <ellipse cx="10.5" cy="14" rx="3.4" ry="2" fill="#ffffff" opacity="0.6" transform="rotate(-35 10.5 14)" />
      <text
        x="15"
        y="25"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
        fill={style.ink}
      >
        {rank}
      </text>
    </svg>
  );
}

/**
 * Karta tepasiga qo'ngan qor: notekis do'ngliklar, ostida ko'kimtir soya. Kartaning ichida,
 * `absolute` holda tepaga qo'yiladi; eni kartaga cho'ziladi.
 */
export function SnowCap({ className }: { className?: string }) {
  const d =
    "M0 13 C6 13 8 6 16 6.5 C22 7 24 3 32 3.5 C40 4 42 8.5 50 8 C58 7.5 60 2.5 70 3 C80 3.5 82 9 90 8.5 C96 8 98 5 104 5.5 C110 6 112 10 120 10 L120 13 C114 14.5 110 12 104 13.5 C96 15.5 92 12 84 13.5 C76 15 72 12.5 64 14 C56 15.5 52 12 44 13.5 C36 15 32 12 24 13.5 C16 15 10 12.5 0 14Z";
  return (
    <svg viewBox="0 0 120 16" preserveAspectRatio="none" aria-hidden className={clsx("pointer-events-none", className)}>
      <path d={d} fill="#b4cdec" transform="translate(0 1.6)" />
      <path d={d} fill="#ffffff" />
    </svg>
  );
}
