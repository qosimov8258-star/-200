import clsx from "clsx";
import { useId } from "react";

import { SANTA_HAT } from "../assets/olivia-vector";
import { initials } from "../lib/format";

/** Gulchambar chiroqlari ranglari (navbat bilan). */
const BULB_COLORS = ["#ff5a4a", "#ffd25e", "#5fe0a3", "#6fb8ff", "#ff8ad8"] as const;
const BULBS = 11;
const GARLAND_W = 320;

/**
 * Archa gulchambari: karta tepasidan osilgan sim va navbat bilan yonib-o'chadigan rangli chiroqlar.
 * Eni karta bo'yicha cho'ziladi (`preserveAspectRatio="none"`), chiroqlar esa yumaloq qoladi.
 */
export function Garland({ className }: { className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Sim — uchta yengil osilgan yoy.
  const wire = "M-4 4 Q 53 20 107 6 Q 160 22 213 6 Q 267 20 324 4";
  const sag = (x: number) => {
    // Yoy bo'ylab balandlik (taxminiy): har 107 px da bitta "osilish".
    const phase = ((x + 4) % 107) / 107;
    return 5 + 11 * Math.sin(Math.PI * phase);
  };
  const bulbs = Array.from({ length: BULBS }, (_, i) => {
    const x = 14 + (i * (GARLAND_W - 28)) / (BULBS - 1);
    return { x, y: sag(x), color: BULB_COLORS[i % BULB_COLORS.length], tilt: (i % 2 ? 1 : -1) * 8 };
  });

  return (
    <div aria-hidden className={clsx("pointer-events-none", className)}>
      <svg viewBox={`0 0 ${GARLAND_W} 40`} preserveAspectRatio="xMidYMin slice" className="block size-full overflow-visible">
        <defs>
          <filter id={`glow-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.2" />
          </filter>
        </defs>
        <path d={wire} fill="none" stroke="#0d1230" strokeWidth="1.6" opacity="0.85" />
        {bulbs.map((b, i) => (
          <g key={b.x} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.tilt})`}>
            {/* Yorug'lik — navbat bilan kuchayib-susayadi. */}
            <circle
              cx="0"
              cy="9"
              r="7"
              fill={b.color}
              filter={`url(#glow-${uid})`}
              className="motion-safe:animate-twinkle"
              style={{ animationDelay: `${(i % 5) * 0.55}s`, transformBox: "fill-box", transformOrigin: "center" }}
            />
            <rect x="-2.2" y="0" width="4.4" height="3.6" rx="1" fill="#c9a24a" />
            <ellipse cx="0" cy="8.2" rx="3.6" ry="5.2" fill={b.color} />
            <ellipse cx="-1.1" cy="6.6" rx="1" ry="1.8" fill="#ffffff" opacity="0.7" />
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * Qorbobo qalpoqli avatar: brend ranglaridagi halqa ichida bosh harflar, tepasida chapga
 * egilgan qalpoq (logodagi bilan bir xil shakl), pomponi tebranib turadi.
 */
export function SantaAvatar({ name, size = 76 }: { name: string; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [minX, minY, maxX, maxY] = SANTA_HAT.bounds;
  const hatW = maxX - minX;
  const hatH = maxY - minY;
  const [brimX, brimY] = SANTA_HAT.brimCenter;
  const [pomX, pomY] = SANTA_HAT.pomPivot;
  const hatWidth = size * 0.98;

  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="block size-full rounded-full bg-[linear-gradient(140deg,#ffd25e,#f2583f_45%,#df3425)] p-[3px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)]">
        <span
          className="grid size-full place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#e9eef8)] font-extrabold text-[#c22a24]"
          style={{ fontSize: size * 0.34 }}
        >
          {initials(name)}
        </span>
      </span>
      <svg
        viewBox={`${minX} ${minY} ${hatW} ${hatH}`}
        aria-hidden
        className="pointer-events-none absolute overflow-visible drop-shadow-[0_3px_4px_rgba(0,0,0,0.35)]"
        style={{
          width: hatWidth,
          height: (hatWidth * hatH) / hatW,
          left: -size * 0.24,
          top: -size * 0.4,
          transform: "rotate(-4deg)",
        }}
      >
        <defs>
          <linearGradient id={`ava-hat-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stopColor="#f04637" />
            <stop offset="1" stopColor="#b1161f" />
          </linearGradient>
          <linearGradient id={`ava-fur-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e3eefb" />
          </linearGradient>
        </defs>
        <g className="motion-safe:animate-hat-rock" style={{ transformOrigin: `${brimX}px ${brimY}px` }}>
          <path d={SANTA_HAT.body} fill={`url(#ava-hat-${uid})`} />
          <path d={SANTA_HAT.fold} fill="#8a0d18" opacity="0.42" />
          <g className="motion-safe:animate-pom-swing" style={{ transformOrigin: `${pomX}px ${pomY}px` }}>
            <path d={SANTA_HAT.pom} fill="#b4cdec" transform="translate(0 3)" />
            <path d={SANTA_HAT.pom} fill={`url(#ava-fur-${uid})`} />
          </g>
          <path d={SANTA_HAT.brim} fill="#b4cdec" transform="translate(0 3.5)" />
          <path d={SANTA_HAT.brim} fill={`url(#ava-fur-${uid})`} />
        </g>
      </svg>
    </span>
  );
}
