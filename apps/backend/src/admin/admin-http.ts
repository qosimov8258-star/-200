import { HttpException } from "@nestjs/common";

/**
 * Admin API uchun umumiy yordamchilar. Xato javobi — `{ message }` (ixtiyoriy `code` bilan): admin
 * panel shu o'zbekcha matnni foydalanuvchiga ko'rsatadi (`apps/admin/src/lib/api.http.ts`).
 */
export const adminError = (status: number, message: string, code?: string) =>
  new HttpException(code ? { message, code } : { message }, status);

/** Body — oddiy obyekt va faqat ruxsat etilgan maydonlar (CLAUDE.md: noma'lum maydon rad etiladi). */
export function objectBody(body: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw adminError(400, "So'rov tanasi noto'g'ri.");
  const extra = Object.keys(body).find((key) => !allowed.includes(key));
  if (extra) throw adminError(400, `Noma'lum maydon: ${extra}`);
  return body as Record<string, unknown>;
}

/** Majburiy sabab/izoh matni: bo'sh joylarsiz `min`–`max` belgi. */
export function requiredText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw adminError(400, `${field} yozilmagan.`);
  const text = value.trim();
  if (text.length < min) throw adminError(422, `${field} kamida ${min} belgi bo'lsin.`);
  if (text.length > max) throw adminError(422, `${field} ${max} belgidan oshmasin.`);
  return text;
}

/** Query'dagi ixtiyoriy qiymat ro'yxatdagilardan biri bo'lishi kerak. */
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], field: string): T | undefined {
  if (value === undefined || value === "") return undefined;
  const found = allowed.find((v) => v === value);
  if (!found) throw adminError(400, `${field} noto'g'ri.`);
  return found;
}

/** Query'dagi "YYYY-MM-DD" sana (ixtiyoriy). */
export function optionalDay(value: string | undefined, field: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw adminError(400, `${field} YYYY-MM-DD ko'rinishida bo'lishi kerak.`);
  }
  return value;
}

/** Qidiruv matni: kichik harf, 100 belgigacha. */
export const searchTerm = (value: string | undefined): string => (value ?? "").trim().toLowerCase().slice(0, 100);

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Sahifalash: `page` 1 dan; noto'g'ri qiymat — standartga, oxirgi sahifadan oshsa — oxirgisiga. */
export function paginate<T>(rows: T[], page: string | undefined, pageSize: string | undefined, defaultSize = 25): Page<T> {
  const size = clampInt(pageSize, defaultSize, 1, 100);
  const lastPage = Math.max(1, Math.ceil(rows.length / size));
  const current = clampInt(page, 1, 1, lastPage);
  return { items: rows.slice((current - 1) * size, current * size), total: rows.length, page: current, pageSize: size };
}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}
