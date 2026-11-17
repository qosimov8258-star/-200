import type { IsoDate } from "./types";

/** Tanlov kunlari shu vaqt zonasida hisoblanadi (PLAN.md, 3-bo'lim). */
export const CONTEST_TIME_ZONE = "Asia/Tashkent";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Qiymat haqiqiy "YYYY-MM-DD" sanami. */
export function isIsoDate(value: string | null | undefined): value is IsoDate {
  if (!value || !ISO_DATE_PATTERN.test(value)) {
    return false;
  }
  return toIsoDate(parseIsoDate(value)) === value;
}

/** Toshkent vaqti bo'yicha bugungi sana. */
export function todayIso(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CONTEST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Toshkent vaqti bo'yicha joriy soat (0–23). */
export function currentHourInTashkent(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONTEST_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number.parseInt(hour, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));
}

/** `to` sanasi `from` dan necha kun keyin (manfiy bo'lishi mumkin). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/** `from` dan `to` gacha (ikkalasi ham kiradi) barcha kunlar. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

export function clampDate(value: IsoDate, min: IsoDate, max: IsoDate): IsoDate {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
