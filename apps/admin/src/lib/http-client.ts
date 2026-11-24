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

function apiErrorOf(status: number, body: unknown, fallback: FallbackMessages): ApiError {
  const { message, code } = parseErrorBody(body);
  return new ApiError(status, message ?? fallback[status] ?? defaultMessage(status), code);
}

async function toApiError(response: Response, fallback: FallbackMessages): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Tana bo'sh yoki JSON emas (masalan, nginx'ning HTML xato sahifasi).
  }
  return apiErrorOf(response.status, body, fallback);
}

/** JSON matnni o'qish; bo'sh yoki JSON bo'lmasa — `undefined`. */
function parseJsonText(text: string): unknown {
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
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

/**
 * `fetch` dan tashqarida ishlatiladigan API manzili (masalan, `<video src>`): `/api/v1` + `path`.
 * Domen ildizida — admin panel `basePath` i (`/admin`) qo'shilmaydi.
 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
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

/**
 * JSON javob yoki `null`. NestJS kontrolleri `null` qaytarsa, tana bo'sh keladi (`200`, JSON emas) —
 * buni ham `null` deb olamiz. 204 ham — `null`.
 */
export async function requestJsonOrNull<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T | null> {
  const response = await send(method, path, options);
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new ApiError(response.status, INVALID_RESPONSE_MESSAGE);
  }
  if (text.trim() === "") return null;
  const data = parseJsonText(text);
  if (data === undefined) {
    throw new ApiError(response.status, INVALID_RESPONSE_MESSAGE);
  }
  // Tanani backend kontrakti (`./types.ts`) bo'yicha qaytaradi.
  return data as T | null;
}

export interface UploadOptions {
  /** Fayl turi — `Content-Type` sarlavhasi. */
  contentType: string;
  /** Yuborilgan qism, 0–1. */
  onProgress?: (ratio: number) => void;
  fallback?: FallbackMessages;
}

/**
 * Faylni so'rov tanasining o'zida (multipart emas) yuborib, JSON javobni olish. `fetch` yuborish
 * jarayonini bermaydi, shuning uchun `XMLHttpRequest`; sessiya cookie'si boshqa so'rovlardagi kabi
 * brauzer o'zi qo'shadi (`withCredentials`). Xatolar — `ApiError` (401 ham), `requestJson` dagi kabi.
 */
export function uploadJson<T>(method: HttpMethod, path: string, file: Blob, options: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, buildUrl(path));
    xhr.withCredentials = true;
    xhr.responseType = "text";
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Content-Type", options.contentType);

    const { onProgress } = options;
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
      };
    }

    xhr.onload = () => {
      const body = parseJsonText(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        if (body === undefined) {
          reject(new ApiError(xhr.status, INVALID_RESPONSE_MESSAGE));
        } else {
          // Tanani backend kontrakti (`./types.ts`) bo'yicha qaytaradi.
          resolve(body as T);
        }
        return;
      }
      // Tana JSON bo'lmasa (masalan, nginx'ning HTML sahifasi) — `body` undefined, status bo'yicha matn.
      reject(apiErrorOf(xhr.status, body ?? null, options.fallback ?? {}));
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_ERROR_MESSAGE));
    xhr.ontimeout = () => reject(new ApiError(0, NETWORK_ERROR_MESSAGE));
    xhr.onabort = () => reject(new ApiError(0, "Yuklash to'xtatildi."));

    xhr.send(file);
  });
}

/** Javob tanasi kerak bo'lmagan so'rov (odatda 204). */
export async function requestVoid(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<void> {
  const response = await send(method, path, options);
  // Tanani o'qib tugatamiz — ulanish qayta ishlatilsin.
  await response.text().catch(() => "");
}
