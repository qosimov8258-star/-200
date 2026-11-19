import { ApiException } from "../common/api-exception";
import { parseScreenshot } from "../targets/screenshot";
import type { TargetReportInput } from "../targets/targets.service";

/**
 * Kiruvchi ma'lumot tekshiruvi. CLAUDE.md: noma'lum maydonlar rad etiladi.
 * (Faza 0 da class-validator yoki zod tanlangach, shunga ko'chiriladi.)
 */

const NAME = /^[\p{L}'ʻʼ‘’\- ]{2,40}$/u;

function object(body: unknown, allowed: string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiException(400, "SERVER");
  }
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length > 0) throw new ApiException(400, "SERVER");
  return body as Record<string, unknown>;
}

export function parseRegister(body: unknown): { firstName: string; lastName: string; age: number } {
  const b = object(body, ["firstName", "lastName", "age"]);
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const age = b.age;
  if (!NAME.test(firstName) || !NAME.test(lastName)) {
    throw new ApiException(422, "INVALID_PROFILE");
  }
  if (typeof age !== "number" || !Number.isInteger(age) || age < 1 || age > 100) {
    throw new ApiException(422, "INVALID_PROFILE");
  }
  return { firstName, lastName, age };
}

export function parseVersion(body: unknown): number {
  const b = object(body, ["version"]);
  if (typeof b.version !== "number" || !Number.isInteger(b.version)) {
    throw new ApiException(400, "SERVER");
  }
  return b.version;
}

export function parseUrl(body: unknown): string {
  const b = object(body, ["url"]);
  if (typeof b.url !== "string" || b.url.length > 500) throw new ApiException(422, "INVALID_LINK");
  return b.url;
}

const MAX_REPORT_TARGET = 300;
const MAX_REPORT_COMMENT = 500;

/** Shikoyat: `{ target, screenshot, comment? }` — skrinshot `data:image/...;base64,...`. */
export function parseTargetReport(body: unknown): TargetReportInput {
  const b = object(body, ["target", "screenshot", "comment"]);
  if (typeof b.target !== "string" || !b.target.trim() || b.target.length > MAX_REPORT_TARGET) {
    throw new ApiException(422, "REPORT_TARGET_INVALID");
  }
  const screenshot = typeof b.screenshot === "string" ? parseScreenshot(b.screenshot) : null;
  if (!screenshot) throw new ApiException(422, "INVALID_IMAGE");
  if (b.comment !== undefined && b.comment !== null && typeof b.comment !== "string") {
    throw new ApiException(400, "SERVER");
  }
  const comment = typeof b.comment === "string" ? b.comment.trim().slice(0, MAX_REPORT_COMMENT) : "";
  return { target: b.target.trim(), screenshot, comment: comment || null };
}

/** Support xabari: 1–1000 belgi (bo'shliqlar olib tashlanadi), boshqa maydon yo'q. */
export const MAX_SUPPORT_TEXT = 1000;

export function parseSupportMessage(body: unknown): string {
  const b = object(body, ["text"]);
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text || text.length > MAX_SUPPORT_TEXT) throw new ApiException(422, "SUPPORT_INVALID");
  return text;
}
