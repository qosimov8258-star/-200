import clsx from "clsx";
import { useId } from "react";

import { OLIVIA_DOTS, OLIVIA_LIVIA, OLIVIA_O, OLIVIA_SIZE, OLIVIA_SNOW, SANTA_HAT } from "../assets/olivia-vector";

const { width: W, height: H } = OLIVIA_SIZE;
const BRAND_RED = "#df3425";
/** Qorning soya tomoni — do'nglik ostidagi ingichka ko'kimtir chiziq. */
const SNOW_SHADE = "#b4cdec";

/** To'rt qirrali uchqun: markazi (0, 0), radiusi 1. */
const SPARK =
  "M0-1C.12-.32.32-.12 1 0C.32.12.12.32 0 1C-.12.32-.32.12-1 0C-.32-.12-.12-.32 0-1Z";

/** Logo atrofidagi tilla uchqunlar (logo koordinatalarida). */
const SPARKS = [
  { x: 236, y: -22, r: 11, delay: "0.5s" },
  { x: 452, y: 54, r: 15, delay: "0s" },
  { x: 612, y: 40, r: 11, delay: "1.1s" },
  { x: 744, y: 104, r: 9, delay: "1.9s" },
] as const;

/**
 * Bayramona "Olivia" logosi (vektor).
 *
 * - `brand` — brend qizilida: "O" ga chapga egilgan qorbobo qalpog'i kiydirilgan, qolgan
 *   harflar ustida qor, atrofida tilla uchqunlar. Och fon uchun.
 * - `snow` — oq harflar, hamma harflar ustida qor to'plangan. Rangli karta uchun.
 *
 * Balandlik `className` bilan beriladi (`h-16 w-auto`); nisbat viewBox'dan olinadi.
 */
export function OliviaFestive({ variant, className }: { variant: "brand" | "snow"; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const snowFill = `url(#snow-${uid})`;
  const withHat = variant === "brand";
  const ink = withHat ? BRAND_RED : "#ffffff";

  // Qalpoq va qor harflardan yuqoriga chiqadi — viewBox shunga yarasha kengaytirilgan.
  const [hatLeft, hatTop] = SANTA_HAT.bounds;
  const box = withHat
    ? { x: hatLeft - 8, y: hatTop - 8, w: W - hatLeft + 14, h: H - hatTop + 12 }
    : { x: 0, y: -30, w: W, h: H + 34 };

  const caps = OLIVIA_SNOW.filter((cap) => !(withHat && cap.underHat));
  const [brimX, brimY] = SANTA_HAT.brimCenter;
  const [pomX, pomY] = SANTA_HAT.pomPivot;

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      role="img"
      aria-label="Olivia"
      className={clsx("block overflow-visible", className)}
      style={{ aspectRatio: `${box.w} / ${box.h}` }}
    >
      <defs>
        <linearGradient id={`snow-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e3eefb" />
        </linearGradient>
        <linearGradient id={`hat-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#f04637" />
          <stop offset="1" stopColor="#b1161f" />
        </linearGradient>
      </defs>

      <g fill={ink} fillRule="evenodd">
        <path d={OLIVIA_O} />
        <path d={OLIVIA_LIVIA} />
        {OLIVIA_DOTS.map((d) => (
          <path key={d.slice(0, 24)} d={d} />
        ))}
      </g>

      {/* Harflar ustiga "qo'ngan" qor: har bir do'nglik navbat bilan paydo bo'ladi. */}
      {caps.map((cap, i) => (
        <g
          key={cap.d.slice(0, 24)}
          className="origin-bottom [transform-box:fill-box] motion-safe:animate-snow-settle"
          style={{ animationDelay: `${250 + i * 110}ms` }}
        >
          <path d={cap.d} fill={SNOW_SHADE} transform="translate(0 2.6)" />
          <path d={cap.d} fill={snowFill} />
        </g>
      ))}

      {withHat && (
        <>
          <g className="motion-safe:animate-hat-rock" style={{ transformOrigin: `${brimX}px ${brimY}px` }}>
            <path d={SANTA_HAT.body} fill={`url(#hat-${uid})`} />
            <path d={SANTA_HAT.fold} fill="#8a0d18" opacity="0.42" />
            <g className="motion-safe:animate-pom-swing" style={{ transformOrigin: `${pomX}px ${pomY}px` }}>
              <path d={SANTA_HAT.pom} fill={SNOW_SHADE} transform="translate(0 3)" />
              <path d={SANTA_HAT.pom} fill={snowFill} />
            </g>
            <path d={SANTA_HAT.brim} fill={SNOW_SHADE} transform="translate(0 3.5)" />
            <path d={SANTA_HAT.brim} fill={snowFill} />
          </g>
          {SPARKS.map((s) => (
            <g key={s.x} transform={`translate(${s.x} ${s.y}) scale(${s.r})`}>
              <path
                d={SPARK}
                fill="#f2b33a"
                className="origin-center [transform-box:fill-box] motion-safe:animate-twinkle"
                style={{ animationDelay: s.delay }}
              />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
