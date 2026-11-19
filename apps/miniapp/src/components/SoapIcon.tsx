/**
 * Ko'pikli sovun: tepasida ko'pik bo'lgan sovun bo'lagi va yuqoriga suzib chiqadigan
 * pufakchalar. lucide'da sovun belgisi yo'q, shuning uchun o'zimiz chizamiz.
 */
const FOAM: [number, number, number][] = [
  [14, 22, 6],
  [21.5, 18.5, 7.5],
  [30, 20.5, 6],
  [36, 24, 4.5],
];

const BUBBLES: { cx: number; cy: number; r: number; delay: string }[] = [
  { cx: 38, cy: 13, r: 2.8, delay: "0s" },
  { cx: 30, cy: 8, r: 2, delay: "0.9s" },
  { cx: 43, cy: 6, r: 1.6, delay: "1.7s" },
];

export function SoapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="soap-bar" x1="8" y1="22" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9fe0fb" />
          <stop offset="1" stopColor="#2f8fd8" />
        </linearGradient>
      </defs>

      {/* Soya */}
      <ellipse cx="24" cy="43.5" rx="15" ry="2" fill="#1e1f22" opacity="0.08" />

      {/* Sovun bo'lagi */}
      <g transform="rotate(-7 24 32)">
        <rect x="7" y="24" width="34" height="17" rx="7" fill="url(#soap-bar)" />
        <rect x="11" y="33" width="13" height="2.6" rx="1.3" fill="#fff" opacity="0.55" />
        <rect x="27" y="33" width="4" height="2.6" rx="1.3" fill="#fff" opacity="0.35" />
      </g>

      {/* Ko'pik: avval hoshiya (kattaroq doiralar), keyin oq to'ldirish — bitta bulutdek */}
      {FOAM.map(([cx, cy, r]) => (
        <circle key={`o${cx}`} cx={cx} cy={cy} r={r + 1.4} fill="#9ed7f3" />
      ))}
      {FOAM.map(([cx, cy, r]) => (
        <circle key={`f${cx}`} cx={cx} cy={cy} r={r} fill="#fff" />
      ))}
      <circle cx="18.5" cy="16.5" r="1.6" fill="#d6f0fc" />
      <circle cx="27.5" cy="19" r="1.1" fill="#d6f0fc" />

      {/* Suzuvchi pufakchalar */}
      {BUBBLES.map((b) => (
        <circle
          key={b.cx}
          cx={b.cx}
          cy={b.cy}
          r={b.r}
          fill="#fff"
          stroke="#6cc2ee"
          strokeWidth="1.2"
          className="animate-bubble"
          style={{ animationDelay: b.delay, transformBox: "fill-box", transformOrigin: "center" }}
        />
      ))}
    </svg>
  );
}
