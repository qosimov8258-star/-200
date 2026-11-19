/**
 * "Tanlov kuni" — Asia/Tashkent bo'yicha (CLAUDE.md). DB va obyektlarda vaqt UTC
 * (`Date`) holida saqlanadi; kun va soat faqat shu funksiyalar orqali hisoblanadi.
 */
export const CONTEST_TIME_ZONE = "Asia/Tashkent";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CONTEST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CONTEST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Tanlov kuni: "YYYY-MM-DD". */
export const contestDay = (at: Date): string => dayFormat.format(at);

/** Toshkent vaqti: "HH:MM" (satr sifatida solishtirish mumkin). */
export const contestTime = (at: Date): string => timeFormat.format(at);

/** Ikki tanlov kuni orasidagi kunlar soni (`to` − `from`). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** "2026-11-25" + 10 → "2026-12-05". */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Toshkent vaqtidagi kun va soat → `Date` (UTC). O'zbekistonda yozgi vaqt yo'q,
 * shuning uchun siljish doim +05:00.
 */
export const tashkentAt = (day: string, time: string): Date => new Date(`${day}T${time}:00+05:00`);
