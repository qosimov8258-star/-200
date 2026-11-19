import { addDays } from "../common/time";

/**
 * Hisobotlar uchun kunlar bilan ishlash. Kunlar — tanlov kuni "YYYY-MM-DD" (Asia/Tashkent);
 * bu ko'rinishdagi satrlarni oddiy leksik solishtirish sana tartibiga mos keladi.
 */

/** `day` ni [min, max] oralig'iga qisadi. */
export function clampDay(day: string, min: string, max: string): string {
  if (day < min) return min;
  if (day > max) return max;
  return day;
}

/** `from` dan `to` gacha (ikkalasi ham kiradi) barcha kunlar; `from > to` bo'lsa — bo'sh. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * Hisobotda tanlash mumkin bo'lgan kunlar: tanlov boshidan bugungacha, tugash kunidan oshmaydi.
 * Tanlov hali boshlanmagan bo'lsa — faqat boshlanish kuni (ma'lumot bo'sh bo'ladi).
 */
export function reportWindow(startsOn: string, endsOn: string, today: string): { from: string; to: string } {
  const last = today < endsOn ? today : endsOn;
  return { from: startsOn, to: last < startsOn ? startsOn : last };
}
