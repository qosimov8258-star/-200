import type { CSSProperties } from "react";

/**
 * "1-o'rin" kartasi foni — tungi zal sahnasi.
 *
 * Syujet: sahnada projektor nurlari ostida katta oltin "Reels kubogi" (ustida ▶ belgisi) turibdi,
 * pastda tomoshabinlar uni telefoniga olyapti (ekranlarida kichkina kubok ko'rinadi), telefonlardan
 * yurakcha va "ko'rish" belgilari ko'tariladi, tepadan oltin konfetti tushadi.
 *
 * Hammasi SVG/CSS — rasm fayli yo'q. Sahna qatlami o'zgarmas o'lchamda (640×300) va kubok o'qi
 * kartaning ~60% ida turadi: karta kengaysa (veb-sayt) rasm cho'zilmaydi, faqat chetlari ochiladi.
 * Harakatlanadigan qismlar alohida HTML qatlamlarda (transform/opacity) — telefon qiynalmaydi.
 * `prefers-reduced-motion` yoqilgan bo'lsa — hammasi harakatsiz.
 */

const STAGE_W = 640;
const STAGE_H = 300;
/** Kubok o'qi (sahna koordinatasida). */
const CX = 320;
/** Kubok kosasining markazi — nur va shu'la shu yerdan taraladi. */
const GLOW_Y = 73;
/** Kubok turgan sahna doirasining markazi. */
const PED_Y = 166;
/** Kubok va shohsupa shuncha px tepaga suriladi — ism yozuvi tagligiga tegmasin. */
const LIFT = 9;
/** Kubok o'qi kartaning shu qismida turadi. */
const AXIS = "60.5%";

const n = (value: number) => Math.round(value * 10) / 10;

/** Barqaror "tasodifiy" sonlar — har safar bir xil sahna. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** CSS o'zgaruvchilarini `style` ga tip bilan berish uchun. */
const cssVars = (vars: Record<`--${string}`, string>) => vars as CSSProperties;

/* ───────────────────────── Projektor nurlari ───────────────────────── */

const BEAMS = [
  { key: "pink", x: 138, y: -36, angle: -51, w: 150, h: 390, rgb: "255,86,168", sway: 5, dur: 8, delay: 0 },
  { key: "blue", x: 512, y: -36, angle: 54, w: 150, h: 390, rgb: "86,196,255", sway: -5, dur: 9.5, delay: -3 },
  { key: "gold", x: CX, y: -70, angle: 0, w: 210, h: 330, rgb: "255,232,180", sway: 3, dur: 12, delay: -6 },
];

/* ───────────────────────── Zal chiroqlari ───────────────────────── */

const ARENA_LIGHTS = (() => {
  const rnd = seeded(41);
  return [0, 1].flatMap((row) =>
    Array.from({ length: 40 }, (_, i) => {
      const x = i * 16.5 + (row ? 8 : 0);
      const y = (row ? 12 : 31) + (row ? 0.0003 : 0.00036) * (x - CX) ** 2;
      return { key: `${row}-${i}`, x: n(x), y: n(y), r: n(0.8 + rnd() * 0.6), o: n(0.18 + rnd() * 0.42) };
    }),
  );
})();

/* ───────────────────────── Tomoshabinlar ───────────────────────── */

interface Arm {
  /** Yelka. */
  sx: number;
  sy: number;
  /** Kaft. */
  hx: number;
  hy: number;
}

interface Fan {
  key: string;
  row: 0 | 1;
  x: number;
  y: number;
  r: number;
  body: string;
  /** Sahna yorug'i tushgan chekka (bosh atrofidagi yoy). */
  rim: string;
  arm: Arm | null;
  /** Qo'lida telefon bormi (bo'lmasa — shunchaki qo'l ko'targan). */
  phone: { w: number; h: number; tilt: number } | null;
}

function bodyPath(x: number, y: number, r: number): string {
  const half = r * 1.75;
  const neck = y + r * 0.85;
  const shoulder = y + r * 2;
  const bottom = STAGE_H + 6;
  return [
    `M${n(x - half)} ${bottom}`,
    `L${n(x - half)} ${n(shoulder)}`,
    `Q${n(x - half)} ${n(neck + r * 0.2)} ${n(x - r * 0.6)} ${n(neck)}`,
    `L${n(x + r * 0.6)} ${n(neck)}`,
    `Q${n(x + half)} ${n(neck + r * 0.2)} ${n(x + half)} ${n(shoulder)}`,
    `L${n(x + half)} ${bottom}Z`,
  ].join(" ");
}

function rimPath(x: number, y: number, r: number): string {
  const toLight = Math.atan2(GLOW_Y + 30 - y, CX - x);
  const radius = r - 0.7;
  const from = toLight - 0.95;
  const to = toLight + 0.95;
  return `M${n(x + radius * Math.cos(from))} ${n(y + radius * Math.sin(from))} A${n(radius)} ${n(radius)} 0 0 1 ${n(
    x + radius * Math.cos(to),
  )} ${n(y + radius * Math.sin(to))}`;
}

const CROWD: Fan[] = (() => {
  const rnd = seeded(23);
  const rows = [
    { row: 0, y: 198, r: 8.6, step: 27, jx: 6, jy: 4.5, offset: -12 },
    { row: 1, y: 226, r: 12.8, step: 39, jx: 8, jy: 5, offset: 2 },
  ] as const;
  const fans: Fan[] = [];

  for (const cfg of rows) {
    for (let base = cfg.offset, i = 0; base < STAGE_W + 24; base += cfg.step, i += 1) {
      const x = base + (rnd() - 0.5) * 2 * cfg.jx;
      const y = cfg.y + (rnd() - 0.5) * 2 * cfg.jy;
      const r = cfg.r * (0.92 + rnd() * 0.2);
      const roll = rnd();
      const sideRoll = rnd();
      const liftRoll = rnd();
      const tiltRoll = rnd();

      // Matn chap tomonda — u yerda ekranlar yonmaydi, faqat ba'zilari qo'l ko'targan.
      const nearStage = x > CX - 78;
      const raises = roll < (nearStage ? 0.6 : 0.3);
      const side = sideRoll < 0.5 ? -1 : 1;

      let arm: Arm | null = null;
      let phone: Fan["phone"] = null;
      if (raises) {
        const sx = x + side * r * 1.25;
        const sy = y + r * 1.35;
        // Kaft kubok tomonga biroz og'adi.
        const lean = Math.sign(CX - x) * r * 0.35;
        const hx = x + side * r * (1 + sideRoll * 0.5) + lean;
        const hy = y - r * (1.25 + liftRoll * 0.75);
        arm = { sx: n(sx), sy: n(sy), hx: n(hx), hy: n(hy) };
        if (nearStage) {
          phone = { w: n(r * 0.92), h: n(r * 1.62), tilt: n((tiltRoll - 0.5) * 22) };
        }
      }

      fans.push({
        key: `${cfg.row}-${i}`,
        row: cfg.row,
        x: n(x),
        y: n(y),
        r: n(r),
        body: bodyPath(x, y, r),
        rim: rimPath(x, y, r),
        arm,
        phone,
      });
    }
  }
  return fans;
})();

/** Telefon markazi (kaftdan biroz tepada). */
const phoneCenter = (fan: Fan) =>
  fan.arm && fan.phone ? { x: fan.arm.hx, y: n(fan.arm.hy - fan.phone.h * 0.3) } : null;

/** Ba'zi telefonlar ustida "chaqnash" — har uchinchisi. */
const FLASHES = CROWD.filter((fan) => fan.phone)
  .filter((_, i) => i % 3 === 1)
  .map((fan, i) => {
    const center = phoneCenter(fan);
    return center ? { key: fan.key, x: center.x, y: center.y - 6, size: 12 + (i % 3) * 3, delay: i * 0.9 } : null;
  })
  .filter((flash) => flash !== null);

/* ───────────────────────── Ko'tarilayotgan belgilar ───────────────────────── */

type ReactionKind = "heart" | "eye" | "play";

const REACTIONS: {
  key: string;
  kind: ReactionKind;
  x: number;
  y: number;
  size: number;
  dx: number;
  dur: number;
  delay: number;
}[] = [
  { key: "a", kind: "heart", x: 356, y: 176, size: 15, dx: 10, dur: 4.6, delay: 0 },
  { key: "b", kind: "eye", x: 384, y: 182, size: 16, dx: -8, dur: 5.4, delay: -1.6 },
  { key: "c", kind: "play", x: 408, y: 172, size: 13, dx: 12, dur: 5, delay: -3.1 },
  { key: "d", kind: "heart", x: 430, y: 184, size: 12, dx: -6, dur: 4.2, delay: -2.3 },
  { key: "e", kind: "eye", x: 452, y: 176, size: 13, dx: 9, dur: 5.8, delay: -4.4 },
  { key: "f", kind: "heart", x: 486, y: 180, size: 16, dx: -10, dur: 4.9, delay: -0.8 },
  { key: "g", kind: "play", x: 520, y: 174, size: 14, dx: 8, dur: 5.2, delay: -3.7 },
  { key: "h", kind: "heart", x: 262, y: 118, size: 11, dx: -8, dur: 5.6, delay: -2.8 },
];

function ReactionIcon({ kind }: { kind: ReactionKind }) {
  if (kind === "heart") {
    return (
      <svg viewBox="0 0 24 24" className="size-full">
        <path
          d="M12 21s-7.6-4.7-9.7-9.4C.8 8.1 2.9 4.4 6.6 4.4c2.1 0 3.7 1.1 5.4 3.1 1.7-2 3.3-3.1 5.4-3.1 3.7 0 5.8 3.7 4.3 7.2C19.6 16.3 12 21 12 21z"
          fill="#ff4f86"
        />
        <path d="M6.9 7.2c-1.5.2-2.5 1.6-2.3 3.2" fill="none" stroke="#ffd0de" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "eye") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="size-full"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12s3.7-6.6 10-6.6S22 12 22 12s-3.7 6.6-10 6.6S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="size-full">
      <path
        d="M7.5 5.3v13.4a1.1 1.1 0 0 0 1.7.9l10.9-6.7a1.1 1.1 0 0 0 0-1.8L9.2 4.4a1.1 1.1 0 0 0-1.7.9z"
        fill="#ffd166"
      />
    </svg>
  );
}

/* ───────────────────────── Konfetti ───────────────────────── */

const CONFETTI_COLORS = ["#ffd166", "#fff1b8", "#f5b83d", "#ff7aa8", "#ffffff", "#6fd6ff", "#ffd166", "#e9a528"];

const CONFETTI = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 20 }, (_, i) => {
    const ribbon = i % 3 !== 1;
    return {
      key: i,
      left: n(rnd() * 100),
      top: n(rnd() * 46 - 10),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      width: ribbon ? n(6 + rnd() * 5) : 5,
      height: ribbon ? 3 : 5,
      rotate: n(rnd() * 180),
      duration: n(6 + rnd() * 5),
      delay: n(-rnd() * 11),
      opacity: n(0.5 + rnd() * 0.45),
    };
  });
})();

/* ───────────────────────── Kubok atrofidagi uchqunlar ───────────────────────── */

const SPARKLES = [
  { x: 286, y: 42, s: 10, d: 0 },
  { x: 356, y: 62, s: 4.5, d: 1.3 },
  { x: 258, y: 22, s: 5.5, d: 2.1 },
  { x: 388, y: 28, s: 4.5, d: 0.7 },
  { x: 396, y: 104, s: 4, d: 1.8 },
  { x: 240, y: 112, s: 3.5, d: 2.6 },
];

/** To'rt uchli yulduzcha. */
const star = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.16} ${y - s * 0.16} ${x + s} ${y} Q${x + s * 0.16} ${y + s * 0.16} ${x} ${y + s} Q${x - s * 0.16} ${y + s * 0.16} ${x - s} ${y} Q${x - s * 0.16} ${y - s * 0.16} ${x} ${y - s}Z`;

/** Kubok kosasi — yaltiroq chiziq shu shakl ichida yuradi. */
const BOWL = `M274 40 C274 78 292 104 312 113 L328 113 C348 104 366 78 366 40Z`;
const HANDLE = `M278 49 C257 44 245 60 252 77 C258 91 275 97 291 95`;
const PLAY = `M314.5 68.5 L314.5 87.5 L331 78Z`;

export function ChampionBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Zal: kubok atrofi binafsha, chetlar qorong'i */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 95% at 60.5% 24%, #43207c 0%, #24124f 34%, #0e0826 68%, #05040f 100%)",
        }}
      />

      {/* Sahna — o'lchami o'zgarmaydi, kubok o'qi kartaning ~60% ida */}
      <div
        className="absolute top-0"
        style={{ left: AXIS, marginLeft: -CX, width: STAGE_W, height: STAGE_H }}
      >
        {/* Zal chiroqlari */}
        <svg className="absolute inset-0" width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
          {ARENA_LIGHTS.map((light) => (
            <circle key={light.key} cx={light.x} cy={light.y} r={light.r} fill="#ffe7b0" opacity={light.o} />
          ))}
        </svg>

        {/* Kubok ortidagi aylanuvchi nurlar */}
        <div
          className="absolute rounded-full motion-safe:animate-champ-spin"
          style={{
            left: CX - 270,
            top: GLOW_Y - 270,
            width: 540,
            height: 540,
            background:
              "repeating-conic-gradient(from 0deg, rgba(255,214,128,0.3) 0deg, rgba(255,214,128,0.3) 5deg, rgba(255,214,128,0) 8deg, rgba(255,214,128,0) 17deg, rgba(255,214,128,0.3) 20deg)",
            maskImage: "radial-gradient(circle, #000 6%, rgba(0,0,0,0.55) 30%, transparent 62%)",
            WebkitMaskImage: "radial-gradient(circle, #000 6%, rgba(0,0,0,0.55) 30%, transparent 62%)",
          }}
        />

        {/* Oltin shu'la */}
        <div
          className="absolute rounded-full motion-safe:animate-champ-pulse"
          style={{
            left: CX - 175,
            top: GLOW_Y - 175,
            width: 350,
            height: 350,
            background:
              "radial-gradient(circle, rgba(255,222,150,0.72) 0%, rgba(255,176,80,0.3) 30%, rgba(255,150,60,0) 64%)",
          }}
        />

        {/* Projektorlar */}
        {BEAMS.map((beam) => (
          <div
            key={beam.key}
            className="absolute mix-blend-screen motion-safe:animate-champ-beam"
            style={{
              left: beam.x - beam.w / 2,
              top: beam.y,
              width: beam.w,
              height: beam.h,
              transformOrigin: "50% 0",
              rotate: `${beam.angle}deg`,
              filter: "blur(5px)",
              animationDuration: `${beam.dur}s`,
              animationDelay: `${beam.delay}s`,
              ...cssVars({ "--beam-sway": `${beam.sway}deg` }),
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                clipPath: "polygon(45% 0, 55% 0, 100% 100%, 0 100%)",
                background: `linear-gradient(to bottom, rgba(${beam.rgb},0.5) 0%, rgba(${beam.rgb},0.16) 52%, rgba(${beam.rgb},0) 100%)`,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                clipPath: "polygon(47.5% 0, 52.5% 0, 70% 100%, 30% 100%)",
                background: `linear-gradient(to bottom, rgba(${beam.rgb},0.75) 0%, rgba(${beam.rgb},0.3) 46%, rgba(${beam.rgb},0) 92%)`,
              }}
            />
          </div>
        ))}

        {/* Sahna doirasi va kubok — karta ochilganda pastdan ko'tarilib chiqadi */}
        <svg className="absolute inset-0 motion-safe:animate-champ-enter" width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
          <defs>
            <linearGradient id="champ-gold" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#6b3f07" />
              <stop offset="0.07" stopColor="#b87a17" />
              <stop offset="0.18" stopColor="#f6cf62" />
              <stop offset="0.27" stopColor="#fff7d6" />
              <stop offset="0.36" stopColor="#fbd768" />
              <stop offset="0.52" stopColor="#dd9f24" />
              <stop offset="0.68" stopColor="#a8690f" />
              <stop offset="0.8" stopColor="#c98a1c" />
              <stop offset="0.91" stopColor="#f7d36a" />
              <stop offset="1" stopColor="#8a560c" />
            </linearGradient>
            <linearGradient id="champ-gold-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5a3200" stopOpacity="0.32" />
              <stop offset="0.16" stopColor="#5a3200" stopOpacity="0" />
              <stop offset="0.6" stopColor="#5a3200" stopOpacity="0" />
              <stop offset="1" stopColor="#4a2800" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="champ-inner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a2003" />
              <stop offset="0.6" stopColor="#8a5810" />
              <stop offset="1" stopColor="#d49b2c" />
            </linearGradient>
            <linearGradient id="champ-rim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#a8690f" />
              <stop offset="0.25" stopColor="#fff6cf" />
              <stop offset="0.55" stopColor="#f0be48" />
              <stop offset="0.82" stopColor="#fff1b8" />
              <stop offset="1" stopColor="#9a5f0d" />
            </linearGradient>
            <linearGradient id="champ-handle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff1b8" />
              <stop offset="0.45" stopColor="#e3a52a" />
              <stop offset="1" stopColor="#8a560c" />
            </linearGradient>
            <linearGradient id="champ-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="champ-ped-top" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fff4cc" stopOpacity="0.98" />
              <stop offset="0.34" stopColor="#f6c25a" stopOpacity="0.8" />
              <stop offset="0.72" stopColor="#7a4bd6" stopOpacity="0.9" />
              <stop offset="1" stopColor="#35208a" stopOpacity="0.96" />
            </radialGradient>
            <linearGradient id="champ-ped-body" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0d0728" />
              <stop offset="0.3" stopColor="#4a2c9a" />
              <stop offset="0.55" stopColor="#2b1866" />
              <stop offset="1" stopColor="#0b0622" />
            </linearGradient>
            <linearGradient id="champ-ped-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#05040f" stopOpacity="0" />
              <stop offset="0.5" stopColor="#05040f" stopOpacity="0.85" />
            </linearGradient>
            <clipPath id="champ-bowl-clip">
              <path d={BOWL} />
            </clipPath>
          </defs>

          <g transform={`translate(0 ${-LIFT})`}>
          {/* Sahna doirasi (shohsupa) */}
          <path
            d={`M${CX - 80} ${PED_Y} A80 12 0 0 0 ${CX + 80} ${PED_Y} L${CX + 88} ${STAGE_H + 20} L${CX - 88} ${STAGE_H + 20}Z`}
            fill="url(#champ-ped-body)"
          />
          {[-58, -30, 0, 30, 58].map((dx) => (
            <rect key={dx} x={CX + dx - 1} y={PED_Y + 14 - Math.abs(dx) * 0.05} width="2" height="60" fill="#ffd98a" opacity={0.22 - Math.abs(dx) * 0.0018} />
          ))}
          <path
            d={`M${CX - 80} ${PED_Y} A80 12 0 0 0 ${CX + 80} ${PED_Y} L${CX + 88} ${STAGE_H + 20} L${CX - 88} ${STAGE_H + 20}Z`}
            fill="url(#champ-ped-fade)"
          />
          <ellipse cx={CX} cy={PED_Y} rx="80" ry="12" fill="url(#champ-ped-top)" />
          {[
            { w: 7, o: 0.18 },
            { w: 3.5, o: 0.4 },
            { w: 1.4, o: 1 },
          ].map((glow) => (
            <path
              key={glow.w}
              d={`M${CX - 80} ${PED_Y} A80 12 0 0 0 ${CX + 80} ${PED_Y}`}
              fill="none"
              stroke="#ffe9b0"
              strokeWidth={glow.w}
              strokeLinecap="round"
              opacity={glow.o}
            />
          ))}
          <ellipse cx={CX} cy={PED_Y} rx="80" ry="12" fill="none" stroke="#ffe9b0" strokeOpacity="0.45" strokeWidth="1" />
          <ellipse cx={CX} cy={PED_Y - 4} rx="38" ry="5" fill="#2a1200" opacity="0.5" />

          {/* Kubok tagligi */}
          <rect x={CX - 31} y="146" width="62" height="14" rx="3.5" fill="url(#champ-gold)" />
          <rect x={CX - 31} y="146" width="62" height="14" rx="3.5" fill="url(#champ-gold-shade)" />
          <rect x={CX - 16} y="149.5" width="32" height="7" rx="2" fill="#7a4a08" opacity="0.45" />
          <rect x={CX - 16} y="149.5" width="32" height="1.2" rx="0.6" fill="#fff1b8" opacity="0.5" />
          <path d={`M${CX - 17} 136 L${CX + 17} 136 L${CX + 23} 146 L${CX - 23} 146Z`} fill="url(#champ-gold)" />
          <path d={`M${CX - 17} 136 L${CX + 17} 136 L${CX + 23} 146 L${CX - 23} 146Z`} fill="url(#champ-gold-shade)" />

          {/* Oyoqcha */}
          <path d={`M${CX - 7} 113 C${CX - 5} 122 ${CX - 4} 127 ${CX - 9} 136 L${CX + 9} 136 C${CX + 4} 127 ${CX + 5} 122 ${CX + 7} 113Z`} fill="url(#champ-gold)" />
          <ellipse cx={CX} cy="123.5" rx="9" ry="3.2" fill="url(#champ-rim)" />
          <ellipse cx={CX} cy="114" rx="11" ry="3.4" fill="url(#champ-rim)" />

          {/* Tutqichlar */}
          {[1, -1].map((dir) => (
            <g key={dir} transform={dir === 1 ? undefined : `translate(${STAGE_W} 0) scale(-1 1)`}>
              <path d={HANDLE} fill="none" stroke="#6b3f07" strokeWidth="8.4" strokeLinecap="round" opacity="0.55" />
              <path d={HANDLE} fill="none" stroke="url(#champ-handle)" strokeWidth="6.4" strokeLinecap="round" />
              <path d={HANDLE} fill="none" stroke="#fff8dc" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" transform="translate(-1.2 -1.2)" />
            </g>
          ))}

          {/* Kosa */}
          <path d={BOWL} fill="url(#champ-gold)" />
          <path d={BOWL} fill="url(#champ-gold-shade)" />
          <path d="M285 52 C286 76 295 93 305 103" fill="none" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" opacity="0.6" />
          <path d="M357 54 C356 73 349 88 339 100" fill="none" stroke="#fff3c4" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

          {/* ▶ — Reels belgisi (o'yib ishlangan) */}
          <g transform="translate(0.9 1)" opacity="0.65">
            <circle cx={CX} cy="78" r="17" fill="none" stroke="#fff1b8" strokeWidth="1.2" />
            <path d={PLAY} fill="#fff1b8" stroke="#fff1b8" strokeWidth="3" strokeLinejoin="round" />
          </g>
          <circle cx={CX} cy="78" r="17" fill="none" stroke="#7a4608" strokeWidth="1.7" opacity="0.7" />
          <path d={PLAY} fill="#7a4608" stroke="#7a4608" strokeWidth="3" strokeLinejoin="round" opacity="0.9" />

          {/* Kosa ustidan o'tadigan yaltiroq chiziq */}
          <g clipPath="url(#champ-bowl-clip)">
            <g transform="skewX(-18)">
              <rect className="motion-safe:animate-champ-sheen" x="250" y="30" width="24" height="96" fill="url(#champ-sheen)" />
            </g>
          </g>

          {/* Kosa og'zi */}
          <ellipse cx={CX} cy="40" rx="46" ry="9.5" fill="url(#champ-rim)" />
          <ellipse cx={CX} cy="40.6" rx="41" ry="6.9" fill="url(#champ-inner)" />
          <path d={`M${CX - 38} 43 A41 6.9 0 0 0 ${CX + 38} 43`} fill="none" stroke="#fff3c4" strokeWidth="1" opacity="0.5" />

          {/* Uchqunlar */}
          {SPARKLES.map((s) => (
            <path
              key={`${s.x}-${s.y}`}
              d={star(s.x, s.y, s.s)}
              fill="#fffdf2"
              className="origin-center [transform-box:fill-box] motion-safe:animate-twinkle"
              style={{ animationDelay: `${s.d}s` }}
            />
          ))}
          </g>
        </svg>

        {/* Sahna tumani — tomoshabinlar siluetini ajratib turadi */}
        <div
          className="absolute"
          style={{
            left: -60,
            top: 122,
            width: STAGE_W + 120,
            height: 150,
            background:
              "radial-gradient(26% 46% at 50% 44%, rgba(255,206,130,0.5) 0%, rgba(255,206,130,0) 100%), radial-gradient(50% 50% at 50% 50%, rgba(176,116,255,0.5) 0%, rgba(124,74,226,0.22) 55%, rgba(124,74,226,0) 100%)",
          }}
        />

        {/* Tomoshabinlar: har qator alohida qatlam — sekin tebranib turadi */}
        <svg className="absolute" width="0" height="0">
          <defs>
            <radialGradient id="champ-phone-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#e9dcff" stopOpacity="0.48" />
              <stop offset="1" stopColor="#b68cff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="champ-screen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8a5cf0" />
              <stop offset="0.6" stopColor="#4a2aa8" />
              <stop offset="1" stopColor="#1c1150" />
            </linearGradient>
          </defs>
        </svg>
        {([0, 1] as const).map((row) => {
          const fill = row === 0 ? "#170f3d" : "#07051a";
          return (
            <svg
              key={row}
              className="absolute inset-0 motion-safe:animate-champ-bob"
              style={{ animationDuration: row === 0 ? "3.4s" : "2.7s", animationDelay: row === 0 ? "0s" : "-1.1s" }}
              width={STAGE_W}
              height={STAGE_H}
              viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            >
              <g>
                {CROWD.filter((fan) => fan.row === row).map((fan) => (
                  <g key={fan.key}>
                    <path d={fan.body} fill={fill} />
                    <circle cx={fan.x} cy={fan.y} r={fan.r} fill={fill} />
                    <path
                      d={fan.rim}
                      fill="none"
                      stroke="#ffcf8f"
                      strokeWidth={row === 0 ? 1.2 : 1.5}
                      strokeLinecap="round"
                      opacity={row === 0 ? 0.6 : 0.42}
                    />
                  </g>
                ))}
                {CROWD.filter((fan) => fan.row === row && fan.arm).map((fan) => {
                  const arm = fan.arm;
                  if (!arm) return null;
                  const center = phoneCenter(fan);
                  return (
                    <g key={fan.key}>
                      <line
                        x1={arm.sx}
                        y1={arm.sy}
                        x2={arm.hx}
                        y2={arm.hy}
                        stroke={fill}
                        strokeWidth={n(fan.r * 0.72)}
                        strokeLinecap="round"
                      />
                      {fan.phone && center ? (
                        <>
                          <circle cx={center.x} cy={center.y} r={n(fan.phone.h * 1.05)} fill="url(#champ-phone-glow)" />
                          <g transform={`translate(${center.x} ${center.y}) rotate(${fan.phone.tilt})`}>
                            <rect
                              x={n(-fan.phone.w / 2)}
                              y={n(-fan.phone.h / 2)}
                              width={fan.phone.w}
                              height={fan.phone.h}
                              rx={n(fan.phone.w * 0.24)}
                              fill="#05040f"
                              stroke="#ffffff"
                              strokeOpacity="0.4"
                              strokeWidth="0.6"
                            />
                            <rect
                              x={n(-fan.phone.w / 2 + 1)}
                              y={n(-fan.phone.h / 2 + 1)}
                              width={n(fan.phone.w - 2)}
                              height={n(fan.phone.h - 2)}
                              rx={n(fan.phone.w * 0.16)}
                              fill="url(#champ-screen)"
                            />
                            {/* Ekrandagi kichkina kubok */}
                            <circle cx="0" cy={n(-fan.phone.h * 0.06)} r={n(fan.phone.w * 0.34)} fill="#ffd98a" opacity="0.45" />
                            <circle cx="0" cy={n(-fan.phone.h * 0.08)} r={n(fan.phone.w * 0.2)} fill="#fff1b8" />
                            <rect
                              x={n(-fan.phone.w * 0.07)}
                              y={n(fan.phone.h * 0.04)}
                              width={n(fan.phone.w * 0.14)}
                              height={n(fan.phone.h * 0.16)}
                              fill="#ffd98a"
                            />
                            <rect
                              x={n(-fan.phone.w * 0.24)}
                              y={n(fan.phone.h * 0.2)}
                              width={n(fan.phone.w * 0.48)}
                              height={n(fan.phone.h * 0.07)}
                              rx="0.5"
                              fill="#ffd98a"
                            />
                            {row === 1 && (
                              <circle cx={n(-fan.phone.w / 2 + 2.6)} cy={n(-fan.phone.h / 2 + 2.8)} r="0.9" fill="#ff4d5e" />
                            )}
                          </g>
                        </>
                      ) : (
                        <circle cx={arm.hx} cy={arm.hy} r={n(fan.r * 0.5)} fill={fill} />
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          );
        })}

        {/* Telefon chaqnashlari */}
        {FLASHES.map((flash) => (
          <span
            key={flash.key}
            className="absolute block bg-white motion-safe:animate-twinkle"
            style={{
              left: flash.x - flash.size / 2,
              top: flash.y - flash.size / 2,
              width: flash.size,
              height: flash.size,
              clipPath:
                "polygon(50% 0, 57% 43%, 100% 50%, 57% 57%, 50% 100%, 43% 57%, 0 50%, 43% 43%)",
              animationDelay: `${flash.delay}s`,
              animationDuration: "2.2s",
            }}
          />
        ))}

        {/* Telefonlardan ko'tarilayotgan yurakcha, "ko'rish" va ▶ belgilari */}
        {REACTIONS.map((reaction) => (
          <span
            key={reaction.key}
            className="absolute block opacity-80 drop-shadow-[0_2px_5px_rgba(0,0,0,0.45)] motion-safe:animate-champ-rise"
            style={{
              left: reaction.x - reaction.size / 2,
              top: reaction.y - reaction.size / 2 - 40,
              width: reaction.size,
              height: reaction.size,
              animationDuration: `${reaction.dur}s`,
              animationDelay: `${reaction.delay}s`,
              ...cssVars({ "--rise-dx": `${reaction.dx}px` }),
            }}
          >
            <ReactionIcon kind={reaction.kind} />
          </span>
        ))}
      </div>

      {/* Oltin konfetti */}
      {CONFETTI.map((c) => (
        <span
          key={c.key}
          className="absolute block rounded-[1.5px] motion-safe:animate-confetti-fall"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: c.width,
            height: c.height,
            background: c.color,
            opacity: c.opacity,
            rotate: `${c.rotate}deg`,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}

      {/* Matn o'qilishi uchun: chap-past va eng past qism to'qlashadi */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(72% 62% at 0% 62%, rgba(6,5,18,0.84) 0%, rgba(6,5,18,0.5) 46%, rgba(6,5,18,0) 86%), linear-gradient(to top, rgba(5,4,14,0.9) 0%, rgba(5,4,14,0.45) 20%, rgba(5,4,14,0) 44%)",
        }}
      />
    </div>
  );
}
