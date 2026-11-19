/**
 * Mini App va veb-saytning backend bilan yagona aloqa nuqtasi. Komponentlar `fetch` ni
 * to'g'ridan-to'g'ri chaqirmaydi.
 *
 * `VITE_API_URL` berilmagan bo'lsa — mock rejim (`./mock/store.ts`).
 * Berilgan bo'lsa, foydalanuvchi ikki yo'l bilan tanilgan (parol, SMS yoki kod yo'q):
 * - Telegram ichida — har bir so'rovda `X-Telegram-Init-Data` (bot tokeni bilan HMAC);
 * - oddiy brauzerda (veb-sayt) — Telegram Login Widget orqali kirgandan keyingi
 *   `HttpOnly` sessiya cookie'si (`credentials: "include"`).
 */
import { ApiError } from "./api-error";
import * as mock from "./mock/store";
import { initData } from "./telegram";
import type {
  ApiErrorCode,
  AuthConfig,
  ContestInfo,
  ContestPrizes,
  ContestRules,
  Me,
  MyReel,
  RatingEntry,
  RegisterRequest,
  TelegramLoginUser,
  TargetReportRequest,
  Winner,
} from "./types";

const API_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;

export const IS_MOCK_API = API_URL === undefined;

/** Dev boshqaruvlari — faqat mock rejimda. */
export const mockControls = IS_MOCK_API
  ? {
      reset: mock.resetMockStore,
      shareContact: mock.simulateContactShared,
    }
  : null;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
      },
      // Veb-saytda sessiya cookie'si (Telegram ichida ishlatilmaydi, lekin zarari yo'q).
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("SERVER", "Network error");
  }
  if (!response.ok) {
    let code: ApiErrorCode = response.status === 401 ? "UNAUTHORIZED" : "SERVER";
    try {
      const data = (await response.json()) as { code?: ApiErrorCode };
      if (data.code) code = data.code;
    } catch {
      // Javob JSON emas — umumiy xato.
    }
    throw new ApiError(code);
  }
  if (response.status === 204) return undefined as T;
  // NestJS `null` qaytargan endpoint uchun 200 va bo'sh tana yuboradi (GET /miniapp/reel —
  // video hali yo'q, GET /miniapp/winner — g'olib e'lon qilinmagan). Bo'sh tana — null;
  // `response.json()` uni o'qiy olmay "Ma'lumotni yuklab bo'lmadi" ko'rsatardi.
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("SERVER", "Invalid JSON");
  }
}

/** @endpoint GET /miniapp/me */
export const getMe = (): Promise<Me> =>
  IS_MOCK_API ? mock.getMe() : request("GET", "/miniapp/me");

/** @endpoint POST /miniapp/register — ism, familiya, yosh bir marta yoziladi. */
export const register = (body: RegisterRequest): Promise<void> =>
  IS_MOCK_API ? mock.register(body) : request("POST", "/miniapp/register", body);

/** @endpoint GET /miniapp/contest */
export const getContest = (): Promise<ContestInfo> =>
  IS_MOCK_API ? mock.getContest() : request("GET", "/miniapp/contest");

/** @endpoint GET /miniapp/rules */
export const getRules = (): Promise<ContestRules> =>
  IS_MOCK_API ? mock.getRules() : request("GET", "/miniapp/rules");

/** @endpoint POST /miniapp/rules/accept */
export const acceptRules = (version: number): Promise<void> =>
  IS_MOCK_API
    ? mock.acceptRules(version)
    : request("POST", "/miniapp/rules/accept", { version });

/** @endpoint GET /miniapp/rating — ommaviy reyting, telefon raqamlarisiz. */
export const getRating = (): Promise<RatingEntry[]> =>
  IS_MOCK_API ? mock.getRating() : request("GET", "/miniapp/rating");

/** @endpoint GET /miniapp/reel — o'z videosi va statistikasi; yo'q bo'lsa null. */
export const getMyReel = (): Promise<MyReel | null> =>
  IS_MOCK_API ? mock.getMyReel() : request("GET", "/miniapp/reel");

/**
 * @endpoint POST /miniapp/reel — link qabul qilinadi (PENDING). Server videoni
 * Instagram'da fon rejimida tekshiradi; natija `getMyReel` va bot xabarida.
 */
export const submitReel = (url: string): Promise<MyReel> =>
  IS_MOCK_API ? mock.submitReel(url) : request("POST", "/miniapp/reel", { url });

/**
 * @endpoint POST /miniapp/target-reports — "Reklamani ko'rdim": skrinshotli shikoyat.
 * Kim yuborgani faqat adminga ko'rinadi.
 */
export const reportTarget = (body: TargetReportRequest): Promise<void> =>
  IS_MOCK_API ? mock.reportTarget(body) : request("POST", "/miniapp/target-reports", body);

/** @endpoint GET /miniapp/prizes — oylik voucherlar, bosqichlar va asosiy sovrin toifalari. */
export const getPrizes = (): Promise<ContestPrizes> =>
  IS_MOCK_API ? mock.getPrizes() : request("GET", "/miniapp/prizes");

/** @endpoint GET /miniapp/winner — e'lon qilinmagan bo'lsa null. */
export const getWinner = (): Promise<Winner | null> =>
  IS_MOCK_API ? mock.getWinner() : request("GET", "/miniapp/winner");

/** @endpoint DELETE /miniapp/me */
export const deleteAccount = (): Promise<void> =>
  IS_MOCK_API ? mock.deleteAccount() : request("DELETE", "/miniapp/me");

// --- Veb-sayt: kirish va chiqish ---------------------------------------------

/** @endpoint GET /auth/config — bot nomi (Login Widget uchun) va sovrin; ochiq. */
export const getAuthConfig = (): Promise<AuthConfig> =>
  IS_MOCK_API ? mock.getAuthConfig() : request("GET", "/auth/config");

/**
 * @endpoint POST /auth/telegram-login — Login Widget natijasi; backend imzoni tekshirib,
 * `HttpOnly` sessiya cookie'sini qo'yadi.
 */
export const telegramLogin = (user: TelegramLoginUser): Promise<void> =>
  IS_MOCK_API ? mock.webLogin() : request("POST", "/auth/telegram-login", user);

/** @endpoint POST /auth/logout */
export const logout = (): Promise<void> =>
  IS_MOCK_API ? mock.webLogout() : request("POST", "/auth/logout");
