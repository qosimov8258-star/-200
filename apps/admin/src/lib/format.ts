/**
 * Raqam va sanalarni ko'rsatish. Brauzerlarda `uz-UZ` lokali har doim ham
 * bo'lmaydi (u holda inglizcha "1,234" chiqadi), shuning uchun formatlar
 * lokalga bog'liq bo'lmagan holda yozilgan.
 */
import { CONTEST_TIME_ZONE } from "./dates";
import type { IsoDate } from "./types";

/** Minglik ajratuvchi — bo'linmaydigan bo'sh joy. */
const GROUP_SEPARATOR = " ";
const MINUS = "−";

function groupDigits(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

/** Bitta kasr xonasi, vergul bilan: 1.25 -> "1,3", 12 -> "12". */
function shortDecimal(value: number): string {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return rounded.toString().replace(".", ",");
}

/** 1234567 -> "1 234 567" */
export function formatNumber(value: number): string {
  const grouped = groupDigits(Math.abs(value));
  return value < 0 ? `${MINUS}${grouped}` : grouped;
}

/** 1234 -> "+1 234", -5 -> "−5", 0 -> "0" */
export function formatSigned(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

/** 950 -> "950", 12000 -> "12 ming", 1250000 -> "1,3 mln" */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  if (abs >= 1_000_000) return `${sign}${shortDecimal(abs / 1_000_000)} mln`;
  if (abs >= 1_000) return `${sign}${shortDecimal(abs / 1_000)} ming`;
  return `${sign}${groupDigits(abs)}`;
}

/** 0.123 -> "12%" */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** "2026-11-17" -> "17.11.2026" */
export function formatDate(value: IsoDate): string {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

/** "2026-11-17" -> "17.11" */
export function formatDayMonth(value: IsoDate): string {
  const [, month, day] = value.split("-");
  return `${day}.${month}`;
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CONTEST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dateTimeParts(value: string) {
  const parts = dateTimeFormat.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    day: part("day"),
    month: part("month"),
    year: part("year"),
    hour: part("hour"),
    minute: part("minute"),
  };
}

/** ISO vaqt -> "17.11.2026, 00:00" (Toshkent vaqti) */
export function formatDateTime(value: string): string {
  const { day, month, year, hour, minute } = dateTimeParts(value);
  return `${day}.${month}.${year}, ${hour}:${minute}`;
}

/** ISO vaqt -> "17.11, 14:05" (Toshkent vaqti) — ro'yxat va xabarlar uchun. */
export function formatDayTime(value: string): string {
  const { day, month, hour, minute } = dateTimeParts(value);
  return `${day}.${month}, ${hour}:${minute}`;
}

/** 245760 -> "240 KB", 1572864 -> "1,5 MB" */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${shortDecimal(bytes / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
