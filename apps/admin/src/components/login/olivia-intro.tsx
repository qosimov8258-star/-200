"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Snowflake } from "lucide-react";

import { cn } from "@/lib/utils";

import styles from "./olivia-intro.module.css";
import { OLIVIA_DOT_1, OLIVIA_DOT_2, OLIVIA_LIVIA, OLIVIA_O, OLIVIA_VIEWBOX } from "./olivia-paths";

/** Yozuv shuncha vaqtda tugaydi (yaltirash bilan) — keyin uchish boshlanadi. */
const WRITE_MS = 4450;
const FLY_MS = 900;

type Phase = "write" | "fly";

const BUBBLES = [
  { x: "6%", s: "14px", t: "3.4s", d: "0s", sway: "10px" },
  { x: "18%", s: "22px", t: "3.9s", d: "0.9s", sway: "-14px" },
  { x: "31%", s: "10px", t: "3s", d: "1.6s", sway: "8px" },
  { x: "46%", s: "18px", t: "3.6s", d: "0.4s", sway: "12px" },
  { x: "60%", s: "12px", t: "3.2s", d: "1.2s", sway: "-10px" },
  { x: "73%", s: "24px", t: "4.1s", d: "0.2s", sway: "14px" },
  { x: "86%", s: "11px", t: "3.1s", d: "1.8s", sway: "-8px" },
  { x: "96%", s: "16px", t: "3.7s", d: "0.7s", sway: "10px" },
];

const FLAKES = [
  { x: "8%", s: "14px", t: "7.5s", d: "0s", sway: "40px" },
  { x: "22%", s: "10px", t: "9s", d: "1.2s", sway: "-30px" },
  { x: "37%", s: "16px", t: "8s", d: "2.4s", sway: "50px" },
  { x: "55%", s: "11px", t: "10s", d: "0.6s", sway: "-40px" },
  { x: "68%", s: "15px", t: "7s", d: "1.8s", sway: "30px" },
  { x: "81%", s: "9px", t: "9.5s", d: "0.3s", sway: "-20px" },
  { x: "93%", s: "13px", t: "8.5s", d: "2s", sway: "35px" },
];

/** CSS o'zgaruvchilari bilan uslub (`--x` va h.k.). */
const vars = (v: Record<string, string>) => v as CSSProperties;

/**
 * Kirish sahifasining ochilish animatsiyasi: oq fonda "Olivia" qo'lda yozilgandek chiziladi
 * (Mini App'dagidek), so'ng yozuv `targetRef` dagi logotip o'rniga uchib boradi va fon eriydi.
 * Bosilsa yoki tugma bosilsa — yozuv darhol tugaydi. "Harakatni kamaytirish" yoqilgan bo'lsa —
 * umuman ko'rsatilmaydi.
 */
export function OliviaIntro({
  targetRef,
  onDone,
}: {
  targetRef: RefObject<SVGSVGElement | null>;
  onDone: () => void;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const backdropRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("write");
  const [skipped, setSkipped] = useState(false);
  const finished = useRef(false);
  const flying = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  const fly = useCallback(() => {
    if (flying.current) return;
    flying.current = true;
    setPhase("fly");
    // Ikki kadr kutamiz: "o'tkazib yuborilgan" yozuv oxirgi holatiga sakrab ulgursin.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const stage = stageRef.current;
        const backdrop = backdropRef.current;
        if (!stage || !backdrop) {
          finish();
          return;
        }
        const from = stage.getBoundingClientRect();
        const to = targetRef.current?.getBoundingClientRect();
        const fade = backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: FLY_MS,
          easing: "ease-in-out",
          fill: "forwards",
        });
        if (!to || to.width === 0) {
          stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FLY_MS / 2, fill: "forwards" });
          fade.onfinish = finish;
          return;
        }
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const scale = to.width / from.width;
        const move = stage.animate(
          [
            { transform: "translate(0, 0) scale(1)" },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          ],
          { duration: FLY_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" },
        );
        move.onfinish = finish;
      }),
    );
  }, [finish, targetRef]);

  const skip = useCallback(() => {
    if (flying.current) return;
    setSkipped(true);
    fly();
  }, [fly]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    const timer = window.setTimeout(fly, WRITE_MS);
    return () => window.clearTimeout(timer);
  }, [finish, fly]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " " || event.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  return (
    <div
      className={cn(styles.overlay, skipped && styles.skip, phase === "fly" && styles.flying)}
      onPointerDown={skip}
      aria-hidden
    >
      <div ref={backdropRef} className={styles.backdrop}>
        {FLAKES.map((f) => (
          <Snowflake
            key={f.x}
            className={styles.flake}
            style={vars({ "--x": f.x, "--s": f.s, "--t": f.t, "--d": f.d, "--sway": f.sway })}
          />
        ))}
      </div>

      <div ref={stageRef} className={styles.stage}>
        {BUBBLES.map((b) => (
          <span
            key={b.x}
            className={styles.bubble}
            style={vars({ "--x": b.x, "--s": b.s, "--t": b.t, "--d": b.d, "--sway": b.sway })}
          />
        ))}
        <svg viewBox={OLIVIA_VIEWBOX}>
          <defs>
            <path id={id("o")} fillRule="evenodd" d={OLIVIA_O} />
            <path id={id("l")} fillRule="evenodd" d={OLIVIA_LIVIA} />
            <path id={id("d1")} d={OLIVIA_DOT_1} />
            <path id={id("d2")} d={OLIVIA_DOT_2} />
            {/* "O" qalami: markazdan qalin halqa — tepadan boshlab teskari aylanadi. */}
            <mask id={id("o-mask")} maskUnits="userSpaceOnUse" x="-20" y="-20" width="800" height="356">
              <g transform="translate(119.1 157.6) scale(1 1.336)">
                <circle
                  className={styles.oPen}
                  r="88"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="176"
                  pathLength={100}
                  transform="rotate(-75) scale(1 -1)"
                />
              </g>
            </mask>
            <mask id={id("o-head-mask")} maskUnits="userSpaceOnUse" x="-20" y="-20" width="800" height="356">
              <g transform="translate(119.1 157.6) scale(1 1.336)">
                <circle
                  className={styles.oHead}
                  r="88"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="176"
                  pathLength={100}
                  transform="rotate(-75) scale(1 -1)"
                />
              </g>
            </mask>
            {/* "livia" qalami: qiya chiziq chapdan o'ngga siljiydi. */}
            <mask id={id("l-mask")} maskUnits="userSpaceOnUse" x="-20" y="-20" width="800" height="356">
              <rect className={styles.pen} x="-1000" y="-20" width="1070" height="356" fill={url("pen-fade")} />
            </mask>
            <mask id={id("l-shape")} maskUnits="userSpaceOnUse" x="-20" y="-20" width="800" height="356">
              <use href={`#${id("l")}`} fill="#fff" />
            </mask>
            <mask id={id("all-shape")} maskUnits="userSpaceOnUse" x="-20" y="-20" width="800" height="356">
              <use href={`#${id("o")}`} fill="#fff" />
              <use href={`#${id("l")}`} fill="#fff" />
              <use href={`#${id("d1")}`} fill="#fff" />
              <use href={`#${id("d2")}`} fill="#fff" />
            </mask>
            <linearGradient id={id("pen-fade")} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.9346" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={id("ink-glow")} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.8" stopColor="#fff" stopOpacity="0.75" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={id("shine-grad")} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g className={styles.camera}>
            <use href={`#${id("o")}`} fill="#df3425" mask={url("o-mask")} />
            <use href={`#${id("o")}`} fill="#fff" fillOpacity="0.6" mask={url("o-head-mask")} />
            <use href={`#${id("l")}`} fill="#df3425" mask={url("l-mask")} />
            <g mask={url("l-shape")}>
              <rect className={styles.lHead} x="-30" y="-20" width="90" height="356" fill={url("ink-glow")} />
            </g>
            <g className={styles.dot}>
              <use href={`#${id("d1")}`} fill="#df3425" />
            </g>
            <g className={cn(styles.dot, styles.dotLate)}>
              <use href={`#${id("d2")}`} fill="#df3425" />
            </g>
            <g mask={url("all-shape")}>
              <rect className={styles.shine} x="-70" y="-20" width="70" height="356" fill={url("shine-grad")} />
            </g>
          </g>
        </svg>
      </div>

      <p className={styles.hint}>Davom etish uchun bosing</p>
    </div>
  );
}
