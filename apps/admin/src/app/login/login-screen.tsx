"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import { Snowflake } from "lucide-react";

import { OliviaIntro } from "@/components/login/olivia-intro";
import { OliviaWordmark } from "@/components/login/olivia-wordmark";
import { WinterScene } from "@/components/login/winter-scene";
import sceneStyles from "@/components/login/winter-scene.module.css";
import { cn } from "@/lib/utils";

import { LoginForm } from "./login-form";

/** Qor qalpog'i ostidagi muzchalar: chapdan joyi (%), uzunligi (px). */
const ICICLES = [
  { left: 12, h: 12, d: "0s" },
  { left: 21, h: 8, d: "-1.2s" },
  { left: 47, h: 14, d: "-2.1s" },
  { left: 58, h: 9, d: "-0.6s" },
  { left: 83, h: 11, d: "-3s" },
];

/** Kartaning tepasini qoplagan qor — chetlaridan biroz osilib turadi. */
function SnowCap() {
  return (
    <div aria-hidden className="pointer-events-none absolute -top-[13px] -right-[7px] -left-[7px] z-10 h-[34px]">
      <svg viewBox="0 0 414 34" preserveAspectRatio="none" className="absolute inset-0 size-full drop-shadow-[0_3px_4px_rgba(40,30,110,0.18)]">
        <path
          d="M10 30 C1 30 0 16 12 13 C34 4 70 12 104 7 C142 1 176 11 214 6 C252 1 296 10 334 6 C368 2 404 9 409 20 C412 28 404 31 396 30 C380 29 372 33 356 31 C320 27 300 32 268 30 C232 28 214 33 180 31 C140 28 122 33 90 30 C62 28 40 33 10 30 Z"
          fill="#ffffff"
        />
        <path d="M30 14 C70 8 110 12 150 8" fill="none" stroke="#e7ecfb" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {ICICLES.map((icicle) => (
        <span
          key={icicle.left}
          className={sceneStyles.icicle}
          style={
            {
              position: "absolute",
              top: 28,
              left: `${icicle.left}%`,
              width: 5,
              height: icicle.h,
              background: "linear-gradient(180deg, #ffffff, #dfe7fb)",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
              "--d": icicle.d,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Kartaning burchagiga osilgan qizil archa o'yinchog'i (Olivia rangida). */
function Ornament({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute z-20", className)}>
      <svg viewBox="0 0 40 92" className={cn("h-[92px] w-10", sceneStyles.ornament)}>
        <defs>
          <radialGradient id="ornament-ball" cx="0.36" cy="0.32" r="0.75">
            <stop offset="0" stopColor="#ff8a7a" />
            <stop offset="0.45" stopColor="#df3425" />
            <stop offset="1" stopColor="#8e140c" />
          </radialGradient>
        </defs>
        <line x1="20" y1="0" x2="20" y2="46" stroke="#c9a24a" strokeWidth="1.5" />
        <rect x="15" y="44" width="10" height="7" rx="1.5" fill="#d9b25c" />
        <circle cx="20" cy="68" r="18" fill="url(#ornament-ball)" />
        <path d="M5 64 Q20 72 35 64" fill="none" stroke="#ffd98a" strokeWidth="2" opacity="0.85" />
        <path d="M6 72 Q20 80 34 72" fill="none" stroke="#ffd98a" strokeWidth="1.2" opacity="0.6" />
        <ellipse cx="13" cy="60" rx="4" ry="6" fill="#fff" opacity="0.55" transform="rotate(25 13 60)" />
      </svg>
    </div>
  );
}

/**
 * Kirish sahifasi: qishki bayram kechasi foni, qor qalpoqli karta va Olivia logotipi.
 * Ochilganda "Olivia" yozuvi qo'lda yozilgandek chiziladi (Mini App'dagidek) va logotip o'rniga
 * uchib qo'nadi.
 */
export function LoginScreen() {
  const logoRef = useRef<SVGSVGElement>(null);
  const [intro, setIntro] = useState(true);
  const endIntro = useCallback(() => setIntro(false), []);

  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-40 sm:pb-48">
      <WinterScene />

      <div className="relative w-full max-w-[400px]">
        <Ornament className="-top-[6px] right-7" />
        <SnowCap />

        <div className="relative rounded-[28px] bg-white/95 px-6 pt-8 pb-7 shadow-[0_34px_90px_-24px_rgba(8,6,36,0.75)] ring-1 ring-white/70 backdrop-blur-xl sm:px-8">
          <div className="flex flex-col items-center">
            <OliviaWordmark
              ref={logoRef}
              className={cn("h-auto w-[172px] transition-opacity duration-200", intro ? "opacity-0" : "opacity-100")}
            />
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#fdecea] px-3 py-1 text-[11px] font-medium text-[#b42a1d]">
              <Snowflake className="size-3" aria-hidden />
              Reels tanlov · Admin panel
            </span>
          </div>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>

        <p className="mt-5 text-center">
          <span className="inline-block rounded-full bg-[#1a1550]/55 px-3.5 py-1.5 text-xs text-white/90 ring-1 ring-white/15 backdrop-blur-md">
            Yangi yil muborak! · Olivia qishki aksiyasi 2026–2027
          </span>
        </p>
      </div>

      {intro && <OliviaIntro targetRef={logoRef} onDone={endIntro} />}
    </main>
  );
}
