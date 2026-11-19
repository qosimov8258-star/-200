const NBSP = " ";

/** 1234567 → "1 234 567". */
export function formatCount(value: number): string {
  const digits = Math.abs(value).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += NBSP;
    out += digits[i];
  }
  return value < 0 ? `-${out}` : out;
}

/** 120 → "+120", -5 → "-5", 0 → "0". */
export const formatSigned = (value: number) =>
  value > 0 ? `+${formatCount(value)}` : formatCount(value);

/** 3945 → "3.9k". Diagramma ustidagi qisqa yozuv uchun. */
export function formatShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

const two = (n: number) => String(n).padStart(2, "0");

/** "2026-11-17" yoki Date → "17.11". */
export function formatDayMonth(value: string | Date): string {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}`;
}

/** ISO vaqt → "17.11.2026 09:00" (qurilma vaqt mintaqasida). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Tanlov tugashigacha to'liq kunlar (manfiy bo'lmaydi). */
export function daysUntil(iso: string, now = new Date()): number {
  const diff = new Date(iso).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000);
}

/** "Dilnoza Rahimova" → "DR". */
export function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
