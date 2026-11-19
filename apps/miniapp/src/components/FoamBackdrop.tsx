import type { CSSProperties } from "react";

/**
 * Reyting kartasi foni: tepada mayin sovun ko'pigi, undan yuqoriga suzib chiqayotgan kamalak
 * rangli pufakchalar, chuqur feruza fon pastga qarab to'qlashadi (oq yozuvlar o'qilishi uchun).
 * Rasm fayli emas — SVG va CSS, shuning uchun yengil va har qanday ekranda tiniq.
 */

/** Barqaror psevdotasodifiy sonlar — har safar bir xil ko'pik. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface Cell {
  cx: number;
  cy: number;
  r: number;
}

/** Ko'pik "bulut"i: katta katakchalar orqada, kichiklari old tomonda; o'ng tepada siyrak (kubok belgisi). */
const FOAM: Cell[] = (() => {
  const rand = seeded(7);
  const cells: Cell[] = [];
  // Orqa qator — katta katakchalar.
  for (let x = -30; x <= 330; x += 34) {
    const fade = x > 250 ? 0.6 : 1;
    cells.push({ cx: x + rand() * 14, cy: -4 + rand() * 18, r: (32 + rand() * 18) * fade });
  }
  // Pastki to'lqinli cheti — o'rtacha katakchalar.
  for (let x = -10; x <= 280; x += 24) {
    const drop = Math.sin((x / 280) * Math.PI) * 14;
    cells.push({ cx: x + rand() * 10, cy: 34 + drop + rand() * 10, r: 15 + rand() * 12 });
  }
  // Old tomondagi mayda katakchalar — ko'pik "tekstura"si.
  for (let i = 0; i < 26; i++) {
    const x = rand() * 290;
    const y = 4 + rand() * (40 + Math.sin((x / 290) * Math.PI) * 18);
    cells.push({ cx: x, cy: y, r: 4 + rand() * 9 });
  }
  return cells;
})();

/** Ko'pik ichidagi juda mayda pufakchalar (faqat chiziq). */
const MICRO: Cell[] = (() => {
  const rand = seeded(19);
  return Array.from({ length: 22 }, () => {
    const x = rand() * 280;
    return { cx: x, cy: 6 + rand() * (34 + Math.sin((x / 280) * Math.PI) * 16), r: 1.4 + rand() * 2.8 };
  });
})();

interface FloatingBubble {
  left: string;
  top: string;
  size: number;
  duration: number;
  delay: number;
  sway: number;
}

/** Ko'tarilayotgan pufakchalar: turli o'lcham, tezlik va chayqalish. */
const BUBBLES: FloatingBubble[] = (() => {
  const rand = seeded(42);
  return Array.from({ length: 13 }, (_, i) => {
    const size = i < 3 ? 26 + rand() * 12 : 9 + rand() * 16;
    return {
      left: `${6 + rand() * 84}%`,
      top: `${38 + rand() * 46}%`,
      size,
      duration: 7 + rand() * 7,
      delay: -rand() * 12,
      sway: (rand() - 0.5) * 22,
    };
  });
})();

export function FoamBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Chuqur feruza fon */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#3aa6b8_0%,#1f7391_32%,#123f5c_62%,#0a1a2a_100%)]" />
      {/* Yuqoridan tushayotgan studiya nuri */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_42%_0%,rgba(205,245,255,0.55),transparent_70%)]" />

      {/* Ko'pik ostidagi yumshoq soya — chuqurlik uchun */}
      <div className="absolute -top-6 -left-6 h-28 w-[82%] rounded-[50%] bg-[#0b3a52]/45 blur-xl" />

      {/* Ko'pik */}
      <svg
        className="absolute -top-1 left-0 w-full"
        viewBox="0 0 400 110"
        preserveAspectRatio="xMinYMin meet"
      >
        <defs>
          <radialGradient id="foam-cell" cx="38%" cy="32%" r="70%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#f2fbff" />
            <stop offset="1" stopColor="#c6e6f3" />
          </radialGradient>
        </defs>
        {FOAM.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill="url(#foam-cell)"
            stroke="rgba(110,175,205,0.35)"
            strokeWidth="0.6"
          />
        ))}
        {MICRO.map((c, i) => (
          <circle key={`m${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke="rgba(120,180,210,0.55)" strokeWidth="0.5" />
        ))}
      </svg>

      {/* Suzib chiqayotgan pufakchalar */}
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="absolute animate-bubble-rise rounded-full border border-white/35 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.92)_0_9%,rgba(255,255,255,0)_20%),radial-gradient(circle,rgba(255,255,255,0.05)_56%,rgba(255,255,255,0.12)_100%)] shadow-[inset_2px_2px_4px_rgba(120,225,255,0.5),inset_-2px_-3px_5px_rgba(255,140,210,0.45),inset_0_0_6px_rgba(255,236,160,0.2)]"
          style={
            {
              left: b.left,
              top: b.top,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration.toFixed(1)}s`,
              animationDelay: `${b.delay.toFixed(1)}s`,
              "--sway": `${b.sway.toFixed(1)}px`,
            } as CSSProperties
          }
        />
      ))}

      {/* Pastki qism to'q — "1-o'rin", ism va tugma aniq o'qiladi */}
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(6,16,26,0.88)_0%,rgba(6,16,26,0.5)_34%,transparent_62%)]" />
    </div>
  );
}
