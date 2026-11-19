/**
 * Mini App'ning backend bilan yagona aloqa nuqtasi. Komponentlar `fetch` ni
 * to'g'ridan-to'g'ri chaqirmaydi.
 *
 * `VITE_API_URL` berilmagan bo'lsa — mock rejim (`./mock/store.ts`).
 * Berilgan bo'lsa — har bir so'rov `X-Telegram-Init-Data` sarlavhasi bilan
 * yuboriladi; backend uni bot tokeni bilan HMAC orqali tekshiradi va foydalanuvchini
 * shu bo'yicha taniydi (parol, SMS yoki kod kerak emas).
 */
import { ApiError } from "./api-error";
import * as mock from "./mock/store";
import { initData } from "./telegram";
import type {
  ApiErrorCode,
  ContestInfo,
  ContestRules,
  Me,
  MyReel,
  RatingEntry,
  RegisterRequest,
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
        "X-Telegram-Init-Data": initData,
      },
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

/** @endpoint GET /miniapp/winner — e'lon qilinmagan bo'lsa null. */
export const getWinner = (): Promise<Winner | null> =>
  IS_MOCK_API ? mock.getWinner() : request("GET", "/miniapp/winner");

/** @endpoint DELETE /miniapp/me */
export const deleteAccount = (): Promise<void> =>
  IS_MOCK_API ? mock.deleteAccount() : request("DELETE", "/miniapp/me");
