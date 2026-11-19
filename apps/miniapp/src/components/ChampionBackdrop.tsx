import type { CSSProperties } from "react";

/**
 * "1-o'rin" kartasi foni — qishki bayram kechasi sahnasi (G'olib sahifasidagi tungi uslubda).
 *
 * Syujet: tungi ko'k osmonda shimol shu'lasi (aurora) to'lqinlanadi, tepada rangli gulchambar
 * chiroqlari yonib-o'chadi. Qorli shohsupada qorbobo qalpog'i kiydirilgan oltin "Reels kubogi"
 * (▶ belgisi bilan) turibdi, pastda pomponli qishki shapkadagi tomoshabinlar uni telefoniga
 * olyapti, telefonlardan yurakcha va "ko'rish" belgilari ko'tariladi. Qor yog'ishi kartaning
 * o'zida (`Snowfall`) — matn oldidan ham o'tadi.
 *
 * Hammasi SVG/CSS — rasm fayli yo'q. Sahna qatlami o'zgarmas o'lchamda (640×300) va kubok o'qi
 * kartaning ~60% ida turadi: karta kengaysa (veb-sayt) rasm cho'zilmaydi, faqat chetlari ochiladi.
 * Harakatlanadigan qismlar transform/opacity bilan — telefon qiynalmaydi.
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
  { key: "gold", x: CX, y: -70, angle: 0, w: 210, h: 330, rgb: "255,232,180", sway: 3, dur: 12, delay: -6 },
];

/* ───────────────────────── Shimol shu'lasi (aurora) ───────────────────────── */

/** To'lqinsimon yorug' pardalar: pastki cheti yorqin, tepaga qarab so'nadi. */
const AURORA = [
  {
    key: "teal",
    d: "M-60 0 L700 0 L700 46 C640 30 600 74 540 58 C470 40 430 90 360 70 C300 52 250 26 190 52 C130 78 70 40 -60 64Z",
    color: "#58f0c2",
    opacity: 0.85,
    dur: 15,
    delay: 0,
  },
  {
    key: "violet",
    d: "M-60 0 L700 0 L700 78 C620 60 580 104 500 86 C430 70 380 112 300 92 C230 74 180 50 110 76 C60 94 10 70 -60 88Z",
    color: "#9a8cff",
    opacity: 0.7,
    dur: 19,
    delay: -7,
  },
];

/* ───────────────────────── Gulchambar chiroqlari ───────────────────────── */

const BULB_COLORS = ["#ff5a4f", "#ffd166", "#5be38c", "#62b6ff", "#ff8ad8"];

/** Ikki osilgan sim (kubok tepasini ochiq qoldiradi) va ular bo'ylab chiroqchalar. */
const GARLAND = (() => {
  const swags = [
    { x0: -24, y0: 4, x1: 238, y1: 8, sag: 26 },
    { x0: 402, y0: 8, x1: 664, y1: 4, sag: 26 },
  ];
  const wires: string[] = [];
  const bulbs: { key: string; x: number; y: number; angle: number; color: string; delay: number }[] = [];
  swags.forEach((w, si) => {
    const cx = (w.x0 + w.x1) / 2;
    const cy = (w.y0 + w.y1) / 2 + w.sag * 2;
    wires.push(`M${w.x0} ${w.y0} Q${cx} ${cy} ${w.x1} ${w.y1}`);
    const count = 11;
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const x = (1 - t) ** 2 * w.x0 + 2 * (1 - t) * t * cx + t ** 2 * w.x1;
      const y = (1 - t) ** 2 * w.y0 + 2 * (1 - t) * t * cy + t ** 2 * w.y1;
      const dx = 2 * (1 - t) * (cx - w.x0) + 2 * t * (w.x1 - cx);
      const dy = 2 * (1 - t) * (cy - w.y0) + 2 * t * (w.y1 - cy);
      const index = si * count + i;
      bulbs.push({
        key: `${si}-${i}`,
        x: n(x),
        y: n(y),
        angle: n((Math.atan2(dy, dx) * 180) / Math.PI),
        color: BULB_COLORS[index % BULB_COLORS.length],
        delay: n((index % 3) * 0.55),
      });
    }
  });
  return { wires, bulbs };
})();

/** Shohsupa ustidagi qor qatlami: orqa yoy biroz qalinroq, old yoy bo'ylab osilib turgan tomchilar. */
const SNOW_DRIFT = (() => {
  const rx = 81.5;
  const ry = 13.5;
  const steps = 40;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * Math.PI;
    pts.push(`${n(CX + rx * Math.cos(a))} ${n(PED_Y + ry * Math.sin(a) - 2.5)}`);
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    const drip = Math.max(0, Math.sin(i * 1.7 + 0.6)) ** 3 * 6 + Math.max(0, Math.sin(i * 0.9 + 2.1)) ** 4 * 4;
    pts.push(`${n(CX + rx * Math.cos(a))} ${n(PED_Y + (ry + 0.5) * Math.sin(a) + 2.5 + drip)}`);
  }
  return `M${pts.join(" L")}Z`;
})();

/* ───────────────────────── Yulduzlar ───────────────────────── */

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

/* ───────────────────────── Qishki shapkalar ───────────────────────── */

const BEANIE_COLORS = ["#a3262a", "#1f6b4a", "#c58a1f", "#3a56b0"];

/** Ba'zi tomoshabinlarda pomponli qishki shapka: old qatorda har ikkinchisi, orqada har uchinchisi. */
function beanieOf(fan: Fan): string | null {
  const index = Number(fan.key.split("-")[1]);
  if (index % (fan.row === 1 ? 2 : 3) !== 0) return null;
  return BEANIE_COLORS[(index + fan.row) % BEANIE_COLORS.length];
}

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

/** Pomponli qishki shapka: bosh ustida gumbaz, oq hoshiya va pompon. */
function Beanie({ fan, dim }: { fan: Fan; dim: number }) {
  const color = beanieOf(fan);
  if (!color) return null;
  const { x, y, r } = fan;
  return (
    <g opacity={dim}>
      <path d={`M${n(x - r * 1.02)} ${n(y - r * 0.2)} A${n(r * 1.02)} ${n(r * 1.05)} 0 0 1 ${n(x + r * 1.02)} ${n(y - r * 0.2)}Z`} fill={color} />
      <rect x={n(x - r * 1.08)} y={n(y - r * 0.44)} width={n(r * 2.16)} height={n(r * 0.48)} rx={n(r * 0.24)} fill="#e9eef8" />
      <circle cx={x} cy={n(y - r * 1.24)} r={n(r * 0.36)} fill="#f4f7fc" />
    </g>
  );
}

export function ChampionBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Qishki tun: kubok atrofi ko'kimtir yorug', chetlar qorong'i */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 95% at 60.5% 24%, #2f3a7a 0%, #1c2254 34%, #10132e 68%, #06071a 100%)",
        }}
      />

      {/* Sahna — o'lchami o'zgarmaydi, kubok o'qi kartaning ~60% ida */}
      <div
        className="absolute top-0"
        style={{ left: AXIS, marginLeft: -CX, width: STAGE_W, height: STAGE_H }}
      >
        {/* Yulduzlar */}
        <svg className="absolute inset-0" width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
          {ARENA_LIGHTS.map((light) => (
            <circle key={light.key} cx={light.x} cy={light.y} r={light.r} fill="#e8f0ff" opacity={light.o} />
          ))}
        </svg>

        {/* Shimol shu'lasi */}
        <svg
          className="absolute inset-0 mix-blend-screen"
          style={{ filter: "blur(7px)" }}
          width={STAGE_W}
          height={STAGE_H}
          viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        >
          <defs>
            {AURORA.map((band) => (
              <linearGradient key={band.key} id={`champ-aurora-${band.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={band.color} stopOpacity="0" />
                <stop offset="0.4" stopColor={band.color} stopOpacity="0.45" />
                <stop offset="0.75" stopColor={band.color} stopOpacity="1" />
              </linearGradient>
            ))}
          </defs>
          {AURORA.map((band) => (
            <path
              key={band.key}
              d={band.d}
              fill={`url(#champ-aurora-${band.key})`}
              opacity={band.opacity}
              className="[transform-box:fill-box] [transform-origin:50%_0] motion-safe:animate-aurora"
              style={{ animationDuration: `${band.dur}s`, animationDelay: `${band.delay}s` }}
            />
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

        {/* Gulchambar chiroqlari */}
        <svg className="absolute inset-0" width={STAGE_W} height={STAGE_H} viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}>
          {GARLAND.wires.map((d) => (
            <path key={d} d={d} fill="none" stroke="#0c1024" strokeWidth="1.6" opacity="0.9" />
          ))}
          {GARLAND.bulbs.map((bulb) => (
            <g key={bulb.key} transform={`translate(${bulb.x} ${bulb.y}) rotate(${bulb.angle})`}>
              <g
                className="motion-safe:animate-bulb"
                style={{ animationDelay: `${bulb.delay}s`, transformBox: "fill-box", transformOrigin: "center" }}
              >
                <circle cx="0" cy="9" r="7" fill={bulb.color} opacity="0.35" style={{ filter: "blur(3px)" }} />
                <ellipse cx="0" cy="8.5" rx="3" ry="4.4" fill={bulb.color} />
                <ellipse cx="-0.9" cy="7.2" rx="0.9" ry="1.6" fill="#ffffff" opacity="0.7" />
              </g>
              <rect x="-1.8" y="2.6" width="3.6" height="3" rx="0.8" fill="#2b3150" />
            </g>
          ))}
        </svg>

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
              <stop offset="0" stopColor="#e4ecf8" />
              <stop offset="0.45" stopColor="#bccde8" />
              <stop offset="1" stopColor="#7f97c4" />
            </radialGradient>
            <linearGradient id="champ-ped-body" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0a0e28" />
              <stop offset="0.3" stopColor="#2c3c80" />
              <stop offset="0.55" stopColor="#1a2356" />
              <stop offset="1" stopColor="#090c22" />
            </linearGradient>
            <linearGradient id="champ-ped-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#06071a" stopOpacity="0" />
              <stop offset="0.5" stopColor="#06071a" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="champ-snow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#d5e2f5" />
            </linearGradient>
            <linearGradient id="champ-drift" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d6e1f2" />
              <stop offset="1" stopColor="#8ea5cf" />
            </linearGradient>
            <linearGradient id="champ-hat" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6a55" />
              <stop offset="0.55" stopColor="#df3425" />
              <stop offset="1" stopColor="#a81d17" />
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
          {/* Qor qatlami va old tomondagi tomchilar */}
          <path d={SNOW_DRIFT} fill="#5f74a3" transform="translate(0 1.4)" />
          <path d={SNOW_DRIFT} fill="url(#champ-drift)" />
          {[
            { w: 7, o: 0.18 },
            { w: 3.5, o: 0.4 },
            { w: 1.4, o: 1 },
          ].map((glow) => (
            <path
              key={glow.w}
              d={`M${CX - 80} ${PED_Y} A80 12 0 0 0 ${CX + 80} ${PED_Y}`}
              fill="none"
              stroke="#f4f8ff"
              strokeWidth={glow.w}
              strokeLinecap="round"
              opacity={glow.o}
            />
          ))}
          <ellipse cx={CX} cy={PED_Y} rx="80" ry="12" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1" />
          <ellipse cx={CX} cy={PED_Y - 4} rx="38" ry="5" fill="#5d6f99" opacity="0.45" />

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

          {/* Qorbobo qalpog'i — kosa og'ziga chapga qiyshiq kiydirilgan, sekin chayqaladi */}
          <g transform="rotate(-9 306 33)">
            <g
              className="motion-safe:animate-hat-rock"
              style={{ transformBox: "view-box", transformOrigin: "306px 34px" }}
            >
              <path d="M285 31 C287 19 297 12 308 11 C318 10.5 326 18 327.5 31Z" fill="url(#champ-hat)" />
              <path d="M318 13 C324 17 327 23 327.5 31 L320 31 C320 24 319.5 18 318 13Z" fill="#8f1712" opacity="0.35" />
              <path d="M308 11.5 C299 7 287 9.5 280.5 18.5" fill="none" stroke="url(#champ-hat)" strokeWidth="7" strokeLinecap="round" />
              <path d="M300 11 C293 10.5 287 13 283.5 17" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity="0.4" />
              <rect x="281.5" y="28" width="49" height="10.5" rx="5.25" fill="url(#champ-snow)" />
              <rect x="283" y="34.5" width="46" height="3.4" rx="1.7" fill="#c7d6ee" opacity="0.8" />
              <circle cx="279.5" cy="20.5" r="6.2" fill="url(#champ-snow)" />
              <circle cx="277.6" cy="18.6" r="2" fill="#ffffff" />
            </g>
          </g>

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
              "radial-gradient(26% 46% at 50% 44%, rgba(255,214,150,0.45) 0%, rgba(255,214,150,0) 100%), radial-gradient(50% 50% at 50% 50%, rgba(150,190,255,0.45) 0%, rgba(110,150,230,0.2) 55%, rgba(110,150,230,0) 100%)",
          }}
        />

        {/* Tomoshabinlar: har qator alohida qatlam — sekin tebranib turadi */}
        <svg className="absolute" width="0" height="0">
          <defs>
            <radialGradient id="champ-phone-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#dfe8ff" stopOpacity="0.48" />
              <stop offset="1" stopColor="#8cb0ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="champ-screen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6f8cff" />
              <stop offset="0.6" stopColor="#3a4fb8" />
              <stop offset="1" stopColor="#141c50" />
            </linearGradient>
          </defs>
        </svg>
        {([0, 1] as const).map((row) => {
          const fill = row === 0 ? "#141a3f" : "#060818";
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
                    <Beanie fan={fan} dim={row === 0 ? 0.62 : 0.8} />
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

      {/* Matn o'qilishi uchun: chap-past va eng past qism to'qlashadi */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(72% 62% at 0% 62%, rgba(6,8,24,0.84) 0%, rgba(6,8,24,0.5) 46%, rgba(6,8,24,0) 86%), linear-gradient(to top, rgba(5,7,20,0.9) 0%, rgba(5,7,20,0.45) 20%, rgba(5,7,20,0) 44%)",
        }}
      />
    </div>
  );
}
