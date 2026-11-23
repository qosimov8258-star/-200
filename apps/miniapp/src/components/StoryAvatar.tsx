import clsx from "clsx";

import { initials } from "../lib/format";

/** Bayramona ranglar: brend qizili, qishki tun, tilla, shafaq, archa yashili, qora. */
const PALETTES = [
  "bg-[linear-gradient(140deg,#f2583f,#df3425_55%,#ad1f2c)]",
  "bg-[linear-gradient(150deg,#3a4a94,#1a2050_60%,#10142f)]",
  "bg-[linear-gradient(140deg,#f3cf6b,#c8922a)]",
  "bg-[linear-gradient(135deg,#ff9a5a,#e2457a_55%,#7b4dff)]",
  "bg-[linear-gradient(140deg,#3fbf86,#1c9a5b_55%,#0e5a3a)]",
  "bg-[linear-gradient(140deg,#4b4d55,#1e1f22)]",
] as const;

function paletteFor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTES[hash % PALETTES.length];
}

/**
 * Istoriya muallifining aylanasi: bosh harflar, rangi `authorKey` dan (har kimniki har xil,
 * lekin bir odamniki doim bir xil). Rasm yo'q — ishtirokchilar surati saqlanmaydi.
 */
export function StoryAvatar({ name, seed, size = 58, className }: { name: string; seed: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      className={clsx(
        "grid shrink-0 place-items-center rounded-full font-bold tracking-tight text-white",
        paletteFor(seed),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
