/**
 * Backendga `fetch` bilan murojaat qilishning umumiy yordamchilari: nisbiy `/api/v1` yo'li,
 * `credentials: "same-origin"` (HttpOnly sessiya cookie'si), xatolarni o'zbekcha matnli
 * `ApiError` ga aylantirish.
 *
 * Admin panel API'si (`./api.http.ts`) va ega bo'limi API'si (`./owner-api.http.ts`) shu
 * yordamchilardan foydalanadi. Komponentlar bu faylni to'g'ridan-to'g'ri ishlatmaydi.
 */
import { ApiError } from "./api-error";

/** API prefiksi. Nisbiy yo'l — admin panel qaysi `basePath` da bo'lmasin, API domen ildizida. */
const API_BASE = "/api/v1";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Javob tanasini o'qib bo'lmaganda (masalan, HTML qaytgan bo'lsa). */
const INVALID_RESPONSE_MESSAGE = "Server javobini o'qib bo'lmadi. Birozdan keyin qaytadan urinib ko'ring.";

/** `fetch` ning o'zi muvaffaqiyatsiz bo'lganda (internet yo'q, server o'chiq, CORS). */
const NETWORK_ERROR_MESSAGE =
  "Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshirib, qaytadan urinib ko'ring.";

/** Backend tushunarli `message` bermaganda — status bo'yicha umumiy matn. */
function defaultMessage(status: number): string {
  switch (status) {
    case 0:
      return NETWORK_ERROR_MESSAGE;
    case 400:
    case 422:
      return "So'rov noto'g'ri. Kiritilgan ma'lumotlarni tekshirib, qaytadan urinib ko'ring.";
    case 401:
      return "Sessiya tugadi. Qaytadan kiring.";
    case 403:
      return "Bu amal uchun ruxsatingiz yo'q.";
    case 404:
      return "Ma'lumot topilmadi. U o'chirilgan yoki manzil noto'g'ri bo'lishi mumkin.";
    case 409:
      return "Amalni bajarib bo'lmadi: ma'lumot o'zgargan. Sahifani yangilab, qaytadan urinib ko'ring.";
    case 413:
      return "Yuborilgan ma'lumot juda katta.";
    case 429:
      return "Juda ko'p urinish. Birozdan keyin qaytadan urinib ko'ring.";
    case 502:
    case 503:
    case 504:
      return "Server vaqtincha javob bermayapti. Birozdan keyin qaytadan urinib ko'ring.";
    default:
      return status >= 500
        ? "Serverda xatolik yuz berdi. Birozdan keyin qaytadan urinib ko'ring."
        : `Kutilmagan xatolik yuz berdi (kod ${status}). Qaytadan urinib ko'ring.`;
  }
}

/**
 * NestJS va proksi (nginx) o'zi qo'yadigan inglizcha standart matnlar — ular foydalanuvchiga
 * hech narsa demaydi, shuning uchun o'rniga status bo'yicha o'zbekcha matn ko'rsatiladi.
 */
const GENERIC_MESSAGES = new Set([
  "bad request",
  "unauthorized",
  "forbidden",
  "forbidden resource",
  "not found",
  "conflict",
  "payload too large",
  "too many requests",
  "throttlerexception: too many requests",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "gateway timeout",
]);

function isGenericMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return GENERIC_MESSAGES.has(normalized) || /^cannot (get|post|put|patch|delete) /.test(normalized);
}

/**
 * Xato tanasidan matn va kodni ajratish. Qo'llab-quvvatlanadigan shakllar:
 * `{ message: string }`, `{ code: string }` va Nest standarti
 * `{ statusCode, message: string | string[] }`.
 */
function parseErrorBody(body: unknown): { message: string | null; code: string | null } {
  if (typeof body !== "object" || body === null) {
    return { message: null, code: null };
  }

  let message: string | null = null;
  if ("message" in body) {
    const raw = body.message;
    if (typeof raw === "string") {
      message = raw.trim();
    } else if (Array.isArray(raw)) {
      const parts = raw.filter((part): part is string => typeof part === "string" && part.trim() !== "");
      message = parts.map((part) => part.trim()).join("; ");
    }
  }

  const code = "code" in body && typeof body.code === "string" ? body.code : null;

  return {
    message: message && !isGenericMessage(message) ? message : null,
    code,
  };
}

/** Funksiyaga xos umumiy matnlar (masalan, login'dagi 401 "sessiya tugadi" emas). */
export type FallbackMessages = Partial<Record<number, string>>;

async function toApiError(response: Response, fallback: FallbackMessages): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Tana bo'sh yoki JSON emas (masalan, nginx'ning HTML xato sahifasi).
  }
  const { message, code } = parseErrorBody(body);
  return new ApiError(
    response.status,
    message ?? fallback[response.status] ?? defaultMessage(response.status),
    code,
  );
}

/** Query satri: `undefined`, `null` va bo'sh qiymatlar yuborilmaydi. */
function buildUrl(path: string, query?: object): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") {
        if (value.trim() !== "") params.set(key, value);
      } else if (typeof value === "number") {
        if (Number.isFinite(value)) params.set(key, String(value));
      } else if (typeof value === "boolean") {
        params.set(key, String(value));
      }
    }
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ""}`;
}

/** Yo'ldagi `:id` kabi qismlar uchun. */
export function segment(value: string): string {
  return encodeURIComponent(value);
}

export interface RequestOptions {
  query?: object;
  body?: unknown;
  fallback?: FallbackMessages;
}

async function send(method: HttpMethod, path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok) {
    throw await toApiError(response, options.fallback ?? {});
  }
  return response;
}

/** JSON javob qaytaradigan so'rov. */
export async function requestJson<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(method, path, options);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(response.status, INVALID_RESPONSE_MESSAGE);
  }
  // Tanani backend kontrakti (`./types.ts`) bo'yicha qaytaradi.
  return data as T;
}

/** Javob tanasi kerak bo'lmagan so'rov (odatda 204). */
export async function requestVoid(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<void> {
  const response = await send(method, path, options);
  // Tanani o'qib tugatamiz — ulanish qayta ishlatilsin.
  await response.text().catch(() => "");
}
