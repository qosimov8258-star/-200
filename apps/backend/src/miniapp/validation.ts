import { ApiException } from "../common/api-exception";

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
