import { t } from "../i18n/uz";

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

/** ISO vaqt → "5-dekabr, 06:00" (qurilma vaqt mintaqasida). */
export function formatDayMonthTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}-${t.months[d.getMonth()]}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** ISO vaqt → "hozirgina", "12 daqiqa oldin", "5 soat oldin" (istoriyalar 24 soat yashaydi). */
export function formatAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return t.agoJustNow;
  if (minutes < 60) return t.agoMinutes(minutes);
  return t.agoHours(Math.floor(minutes / 60));
}

/** Bugundan necha kalendar kun keyin (bugun — 0, ertaga — 1). */
export function calendarDaysUntil(iso: string, now = new Date()): number {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(iso);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
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

const tashkentDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tashkent",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Bugungi tanlov kuni "YYYY-MM-DD" (Asia/Tashkent). */
export const tashkentToday = (now = new Date()): string => tashkentDay.format(now);

/** Ikki "YYYY-MM-DD" sana orasidagi kunlar (`to` − `from`). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/**
 * Faqat ko'rsatish uchun: butunlay BOSH HARFLARDA yozilgan ism ("QUVONCHBEK UMARALIYEV") odatiy
 * ko'rinishga keltiriladi ("Quvonchbek Umaraliyev"). Saqlangan ism o'zgarmaydi.
 */
export function displayName(name: string): string {
  const isShouting =
    name.length > 1 && name === name.toLocaleUpperCase("uz") && name !== name.toLocaleLowerCase("uz");
  if (!isShouting) return name;
  return name
    .toLocaleLowerCase("uz")
    .replace(/(^|[\s-])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toLocaleUpperCase("uz"));
}
