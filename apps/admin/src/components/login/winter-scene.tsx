import type { CSSProperties } from "react";

import { Snowfall } from "./snowfall";
import styles from "./winter-scene.module.css";

/**
 * Kirish sahifasining foni — qishki bayram kechasi: shimol yog'dusi, yulduzlar va oy, tepada
 * yonib-o'chayotgan girlyanda, pastda qorli tepaliklar (archalar, mo'ri tutayotgan kulba,
 * qorbobo) va ustidan qor yog'adi. Ota element `relative isolate overflow-hidden` bo'lishi kerak.
 *
 * Tasodifiy ko'rinadigan joylashuvlar urug'li generator bilan — server va brauzerda bir xil
 * (statik eksport va gidratsiya mos kelishi uchun).
 */

/** Urug'li tasodifiy sonlar (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20261125);

const STARS = Array.from({ length: 70 }, () => ({
  left: `${(rand() * 100).toFixed(2)}%`,
  top: `${(rand() * 58).toFixed(2)}%`,
  size: 1 + rand() * 2.2,
  t: `${(2.4 + rand() * 3.6).toFixed(2)}s`,
  d: `${(-rand() * 5).toFixed(2)}s`,
}));

// --- Girlyanda -----------------------------------------------------------------

const GARLAND_WIDTH = 1440;
const SWAG = 360;
const BULB_COLORS = ["#ff4d5e", "#ffd166", "#4ade80", "#60a5fa", "#f472b6"];

/** Sim egilib osilgan to'rt qism; har birida beshta lampochka. */
const BULBS = Array.from({ length: GARLAND_WIDTH / SWAG }, (_, swag) =>
  [0.14, 0.32, 0.5, 0.68, 0.86].map((t) => {
    const x0 = swag * SWAG;
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * (x0 + SWAG / 2) + t ** 2 * (x0 + SWAG);
    const y = (1 - t) ** 2 * 8 + 2 * (1 - t) * t * 92 + t ** 2 * 8;
    return { x, y };
  }),
)
  .flat()
  .map((p, i) => ({ ...p, color: BULB_COLORS[i % BULB_COLORS.length], delay: `${((i * 0.37) % 2.4).toFixed(2)}s` }));

const WIRE = Array.from(
  { length: GARLAND_WIDTH / SWAG },
  (_, i) => `M${i * SWAG} 8 Q${i * SWAG + SWAG / 2} 92 ${(i + 1) * SWAG} 8`,
).join(" ");

// --- Tepaliklar ------------------------------------------------------------------

type Point = [number, number];
/** Kubik Bezye bo'laklari: boshlanish, ikki boshqaruv nuqtasi, oxiri. */
type Hill = [Point, Point, Point, Point][];

const BACK_HILL: Hill = [
  [[0, 170], [220, 110], [420, 150], [640, 120]],
  [[640, 120], [860, 90], [1080, 150], [1440, 105]],
];
const MID_HILL: Hill = [
  [[0, 232], [260, 170], [520, 215], [780, 192]],
  [[780, 192], [1040, 168], [1240, 215], [1440, 182]],
];
const FRONT_HILL: Hill = [
  [[0, 292], [300, 246], [640, 300], [960, 272]],
  [[960, 272], [1180, 252], [1320, 292], [1440, 272]],
];

const bezier = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

/** Tepalik sirtining `x` dagi balandligi (bo'lak ichida `t` ni ikkiga bo'lib topamiz). */
function hillY(hill: Hill, x: number): number {
  const segment = hill.find(([start, , , end]) => x >= start[0] && x <= end[0]) ?? hill[hill.length - 1];
  const [p0, p1, p2, p3] = segment;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(p0[0], p1[0], p2[0], p3[0], mid) < x) lo = mid;
    else hi = mid;
  }
  return bezier(p0[1], p1[1], p2[1], p3[1], (lo + hi) / 2);
}

const hillPath = (hill: Hill) =>
  `M${hill[0][0][0]} ${hill[0][0][1]} ` +
  hill.map(([, c1, c2, end]) => `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`).join(" ") +
  " L1440 340 L0 340 Z";

/** Archa: uch qavat, har birining tepasida qor. */
function Pine({ x, base, h, color }: { x: number; base: number; h: number; color: string }) {
  const tiers = [0, 1, 2].map((i) => {
    const top = base - h + i * h * 0.24;
    const bottom = top + h * 0.42;
    const w = h * (0.2 + i * 0.07);
    return { top, bottom, w };
  });
  return (
    <g>
      <rect x={x - h * 0.03} y={base - h * 0.14} width={h * 0.06} height={h * 0.16} fill="#3b2a3f" />
      {tiers.map(({ top, bottom, w }) => (
        <g key={top}>
          <path d={`M${x} ${top} L${x - w} ${bottom} L${x + w} ${bottom} Z`} fill={color} />
          <path
            d={`M${x} ${top} L${x - w * 0.42} ${top + (bottom - top) * 0.42} Q${x} ${top + (bottom - top) * 0.3} ${x + w * 0.42} ${top + (bottom - top) * 0.42} Z`}
            fill="#ffffff"
            opacity={0.92}
          />
        </g>
      ))}
    </g>
  );
}

const BACK_PINES = [70, 130, 190, 930, 1170, 1235, 1310, 1385].map((x, i) => ({
  x,
  h: 46 + ((i * 17) % 22),
  base: hillY(BACK_HILL, x) + 6,
}));
const MID_PINES = [250, 320, 395, 1300, 1370].map((x, i) => ({
  x,
  h: 70 + ((i * 23) % 26),
  base: hillY(MID_HILL, x) + 8,
}));

const CABIN_X = 1060;
const CABIN_BASE = hillY(MID_HILL, CABIN_X) + 6;
const SNOWMAN_X = 170;
const SNOWMAN_BASE = hillY(FRONT_HILL, SNOWMAN_X) + 4;

const vars = (v: Record<string, string>) => v as CSSProperties;

export function WinterScene() {
  return (
    <>
      <div className={styles.sky} aria-hidden />
      <div className={`${styles.aurora} ${styles.auroraA}`} aria-hidden />
      <div className={`${styles.aurora} ${styles.auroraB}`} aria-hidden />
      <div className={`${styles.aurora} ${styles.auroraC}`} aria-hidden />
      {STARS.map((s) => (
        <span
          key={`${s.left}-${s.top}`}
          aria-hidden
          className={styles.star}
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, ...vars({ "--t": s.t, "--d": s.d }) }}
        />
      ))}
      <div className={styles.moon} aria-hidden />

      {/* Girlyanda */}
      <svg
        className={styles.garland}
        viewBox={`0 0 ${GARLAND_WIDTH} 120`}
        preserveAspectRatio="xMidYMin slice"
        aria-hidden
      >
        <defs>
          {BULB_COLORS.map((color) => (
            <radialGradient key={color} id={`glow-${color.slice(1)}`}>
              <stop offset="0" stopColor={color} stopOpacity="0.85" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <path d={WIRE} fill="none" stroke="#0b0a1f" strokeWidth="2.5" opacity="0.85" />
        {BULBS.map((b) => (
          <g key={`${b.x}-${b.y}`} className={styles.bulb} style={vars({ "--d": `-${b.delay}` })}>
            <circle cx={b.x} cy={b.y + 16} r="20" fill={`url(#glow-${b.color.slice(1)})`} />
            <rect x={b.x - 3.5} y={b.y} width="7" height="6" rx="1.5" fill="#2b2a3a" />
            <ellipse cx={b.x} cy={b.y + 15} rx="6.5" ry="10" fill={b.color} />
            <ellipse cx={b.x - 2} cy={b.y + 11} rx="1.8" ry="3.5" fill="#fff" opacity="0.7" />
          </g>
        ))}
      </svg>

      {/* Qorli tepaliklar */}
      <svg className={styles.hills} viewBox="0 0 1440 340" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <linearGradient id="hill-back" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#b8c1ee" />
            <stop offset="1" stopColor="#8e98d6" />
          </linearGradient>
          <linearGradient id="hill-mid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e6ebfd" />
            <stop offset="1" stopColor="#c5cdf2" />
          </linearGradient>
          <linearGradient id="hill-front" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e9edfc" />
          </linearGradient>
          <radialGradient id="window-glow">
            <stop offset="0" stopColor="#ffd88a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffd88a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path d={hillPath(BACK_HILL)} fill="url(#hill-back)" />
        {BACK_PINES.map((p) => (
          <Pine key={p.x} x={p.x} base={p.base} h={p.h} color="#2c4a6b" />
        ))}

        <path d={hillPath(MID_HILL)} fill="url(#hill-mid)" />

        {/* Kulba: derazasida chiroq, mo'risidan tutun */}
        <g>
          <circle cx={CABIN_X + 2} cy={CABIN_BASE - 30} r="46" fill="url(#window-glow)" className={styles.window} />
          <rect x={CABIN_X + 22} y={CABIN_BASE - 92} width="13" height="30" fill="#5b3a3a" />
          {[0, 1.6, 3.2].map((d) => (
            <circle
              key={d}
              className={styles.smoke}
              style={vars({ "--d": `${d}s` })}
              cx={CABIN_X + 28}
              cy={CABIN_BASE - 98}
              r="7"
              fill="#e8e6f5"
            />
          ))}
          <rect x={CABIN_X - 46} y={CABIN_BASE - 58} width="92" height="58" rx="3" fill="#7a4b45" />
          <path d={`M${CABIN_X - 58} ${CABIN_BASE - 54} L${CABIN_X} ${CABIN_BASE - 98} L${CABIN_X + 58} ${CABIN_BASE - 54} Z`} fill="#5b3a3a" />
          <path
            d={`M${CABIN_X - 62} ${CABIN_BASE - 52} L${CABIN_X} ${CABIN_BASE - 102} L${CABIN_X + 62} ${CABIN_BASE - 52} Q${CABIN_X + 40} ${CABIN_BASE - 62} ${CABIN_X + 20} ${CABIN_BASE - 58} Q${CABIN_X} ${CABIN_BASE - 66} ${CABIN_X - 22} ${CABIN_BASE - 58} Q${CABIN_X - 44} ${CABIN_BASE - 63} ${CABIN_X - 62} ${CABIN_BASE - 52} Z`}
            fill="#ffffff"
          />
          <rect x={CABIN_X - 30} y={CABIN_BASE - 40} width="22" height="20" rx="2" fill="#ffd27a" className={styles.window} />
          <path d={`M${CABIN_X - 19} ${CABIN_BASE - 40} V${CABIN_BASE - 20} M${CABIN_X - 30} ${CABIN_BASE - 30} H${CABIN_X - 8}`} stroke="#7a4b45" strokeWidth="2" />
          <rect x={CABIN_X + 8} y={CABIN_BASE - 34} width="20" height="34" rx="2" fill="#4a2e2c" />
          <circle cx={CABIN_X + 24} cy={CABIN_BASE - 17} r="1.6" fill="#ffd27a" />
          {/* Eshik tepasidagi bayram gulchambari */}
          <circle cx={CABIN_X + 18} cy={CABIN_BASE - 44} r="7" fill="none" stroke="#2f7d4f" strokeWidth="3.5" />
          <circle cx={CABIN_X + 18} cy={CABIN_BASE - 38} r="2" fill="#ff4d5e" />
        </g>

        {MID_PINES.map((p) => (
          <Pine key={p.x} x={p.x} base={p.base} h={p.h} color="#24425f" />
        ))}

        <path d={hillPath(FRONT_HILL)} fill="url(#hill-front)" />

        {/* Qorbobo (qordan odam) */}
        <g>
          <ellipse cx={SNOWMAN_X} cy={SNOWMAN_BASE} rx="30" ry="6" fill="#d7ddf6" />
          <circle cx={SNOWMAN_X} cy={SNOWMAN_BASE - 24} r="26" fill="#ffffff" />
          <circle cx={SNOWMAN_X} cy={SNOWMAN_BASE - 62} r="19" fill="#ffffff" />
          <circle cx={SNOWMAN_X} cy={SNOWMAN_BASE - 92} r="14" fill="#ffffff" />
          <path d={`M${SNOWMAN_X - 13} ${SNOWMAN_BASE - 80} Q${SNOWMAN_X} ${SNOWMAN_BASE - 74} ${SNOWMAN_X + 13} ${SNOWMAN_BASE - 80} L${SNOWMAN_X + 14} ${SNOWMAN_BASE - 74} Q${SNOWMAN_X} ${SNOWMAN_BASE - 68} ${SNOWMAN_X - 14} ${SNOWMAN_BASE - 74} Z`} fill="#df3425" />
          <path d={`M${SNOWMAN_X + 8} ${SNOWMAN_BASE - 76} L${SNOWMAN_X + 18} ${SNOWMAN_BASE - 56} L${SNOWMAN_X + 10} ${SNOWMAN_BASE - 55} Z`} fill="#c22a1d" />
          <rect x={SNOWMAN_X - 13} y={SNOWMAN_BASE - 112} width="26" height="5" rx="2" fill="#2b2a3a" />
          <rect x={SNOWMAN_X - 9} y={SNOWMAN_BASE - 128} width="18" height="17" rx="2" fill="#2b2a3a" />
          <rect x={SNOWMAN_X - 9} y={SNOWMAN_BASE - 116} width="18" height="3.5" fill="#df3425" />
          <circle cx={SNOWMAN_X - 5} cy={SNOWMAN_BASE - 95} r="1.8" fill="#2b2a3a" />
          <circle cx={SNOWMAN_X + 5} cy={SNOWMAN_BASE - 95} r="1.8" fill="#2b2a3a" />
          <path d={`M${SNOWMAN_X} ${SNOWMAN_BASE - 91} L${SNOWMAN_X + 14} ${SNOWMAN_BASE - 88} L${SNOWMAN_X} ${SNOWMAN_BASE - 86.5} Z`} fill="#f59e3b" />
          <circle cx={SNOWMAN_X} cy={SNOWMAN_BASE - 64} r="2" fill="#2b2a3a" />
          <circle cx={SNOWMAN_X} cy={SNOWMAN_BASE - 54} r="2" fill="#2b2a3a" />
          <path d={`M${SNOWMAN_X - 18} ${SNOWMAN_BASE - 64} L${SNOWMAN_X - 44} ${SNOWMAN_BASE - 84} M${SNOWMAN_X - 36} ${SNOWMAN_BASE - 78} L${SNOWMAN_X - 42} ${SNOWMAN_BASE - 70}`} stroke="#5b3a3a" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${SNOWMAN_X + 18} ${SNOWMAN_BASE - 64} L${SNOWMAN_X + 42} ${SNOWMAN_BASE - 76}`} stroke="#5b3a3a" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>

      <Snowfall density={1.1} />
    </>
  );
}
