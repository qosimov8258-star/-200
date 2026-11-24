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
import { storyMime } from "./stories";
import { initData } from "./telegram";
import type {
  ApiErrorCode,
  AuthConfig,
  BotLoginStart,
  BotLoginStatus,
  ContestInfo,
  ContestPrizes,
  ContestRules,
  Me,
  MyReels,
  RatingEntry,
  RegisterRequest,
  StoryGroup,
  SupportThread,
  TargetReportRequest,
  TelegramLoginUser,
  WebRegisterRequest,
  Winner,
} from "./types";

const API_URL: string | undefined = import.meta.env.VITE_API_URL || undefined;

export const IS_MOCK_API = API_URL === undefined;

/** Dev boshqaruvlari — faqat mock rejimda. */
export const mockControls = IS_MOCK_API
  ? {
      reset: mock.resetMockStore,
      shareContact: mock.simulateContactShared,
      linkTelegram: mock.simulateTelegramLink,
      confirmBotLogin: mock.simulateBotLoginConfirm,
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
  // NestJS `null` qaytargan endpoint uchun 200 va bo'sh tana yuboradi (masalan,
  // GET /miniapp/winner — g'olib e'lon qilinmagan). Bo'sh tana — null;
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

/**
 * @endpoint GET /miniapp/rating — ommaviy reyting, telefon raqamlari va video linklarisiz. Har bir
 * qabul qilingan video — alohida qator: bir ism bir necha marta, `isMe` bir nechta qatorda bo'lishi mumkin.
 */
export const getRating = (): Promise<RatingEntry[]> =>
  IS_MOCK_API ? mock.getRating() : request("GET", "/miniapp/rating");

/**
 * @endpoint GET /miniapp/reels — o'z videolari (eng ko'p ko'rilgan qabul qilingani tepada —
 * tartib `MyReels.reels` izohida; har bir qabul qilinganida reytingdagi o'z o'rni — `rank`) va
 * natija: eng ko'p ko'rilgan bitta video bo'yicha (`bestViews`, `rank` — shu videoning o'rni;
 * videolar ko'rishlari qo'shilmaydi); video yo'q bo'lsa ham obyekt (`reels: []`).
 */
export const getMyReels = (): Promise<MyReels> =>
  IS_MOCK_API ? mock.getMyReels() : request("GET", "/miniapp/reels");

/**
 * @endpoint POST /miniapp/reels — yangi video qo'shiladi (PENDING); videolar soni cheklanmagan.
 * Server videoni Instagram'da fon rejimida tekshiradi; natija `getMyReels` va bot xabarida.
 * Javob — yangilangan ro'yxat. Xatolar: INVALID_LINK, REEL_ALREADY_SUBMITTED (o'zi yuborgan,
 * rad etilmagan video), REEL_TAKEN (boshqa ishtirokchining videosi).
 */
export const submitReel = (url: string): Promise<MyReels> =>
  IS_MOCK_API ? mock.submitReel(url) : request("POST", "/miniapp/reels", { url });

/**
 * @endpoint POST /miniapp/target-reports — "Reklamani ko'rdim": skrinshotli shikoyat.
 * Kim yuborgani faqat adminga ko'rinadi.
 */
export const reportTarget = (body: TargetReportRequest): Promise<void> =>
  IS_MOCK_API ? mock.reportTarget(body) : request("POST", "/miniapp/target-reports", body);

/** @endpoint GET /miniapp/support — support yozishmasi (ilova va sayt). */
export const getSupport = (): Promise<SupportThread> =>
  IS_MOCK_API ? mock.getSupport() : request("GET", "/miniapp/support");

/**
 * @endpoint POST /miniapp/support — support'ga yozish: murojaat operatorlar guruhiga boradi,
 * javob bot orqali ham keladi. Javob — yangilangan yozishma.
 */
export const sendSupport = (text: string): Promise<SupportThread> =>
  IS_MOCK_API ? mock.sendSupport(text) : request("POST", "/miniapp/support", { text });

/** @endpoint GET /miniapp/prizes — oylik voucherlar, bosqichlar va asosiy sovrin toifalari. */
export const getPrizes = (): Promise<ContestPrizes> =>
  IS_MOCK_API ? mock.getPrizes() : request("GET", "/miniapp/prizes");

/** @endpoint GET /miniapp/winner — e'lon qilinmagan bo'lsa null. */
export const getWinner = (): Promise<Winner | null> =>
  IS_MOCK_API ? mock.getWinner() : request("GET", "/miniapp/winner");

/** @endpoint DELETE /miniapp/me */
export const deleteAccount = (): Promise<void> =>
  IS_MOCK_API ? mock.deleteAccount() : request("DELETE", "/miniapp/me");

// --- Istoriyalar (24 soatlik videolar) ---------------------------------------

/**
 * @endpoint GET /miniapp/stories — ochiq (mehmon ham ko'radi); kirgan bo'lsa `isMe` to'ldiriladi.
 * Tartib: o'z guruhim birinchi (faol istoriyam bo'lsa), keyin boshqalar — eng yangi istoriyasi
 * bo'yicha, yangisi oldin. Har bir guruh ichida — eskisidan yangisiga.
 */
export const getStories = (): Promise<StoryGroup[]> =>
  IS_MOCK_API ? mock.getStories() : request("GET", "/miniapp/stories");

/**
 * @endpoint POST /miniapp/stories — so'rov tanasi videoning O'ZI (multipart ham, JSON ham emas),
 * `Content-Type` — fayl turi (`video/mp4` | `video/quicktime` | `video/webm`). Yuklanish foizini
 * ko'rsatish uchun XMLHttpRequest. Javob (201) — yangilangan ro'yxat.
 * Xatolar: UNAUTHORIZED (ro'yxatdan o'tmagan yoki faol emas), STORY_TOO_LARGE (har qanday 413 —
 * nginx HTML bilan javob berishi mumkin), STORY_INVALID_FILE, STORY_LIMIT (10 ta faol).
 *
 * @param onProgress 0..1 — yuborilgan qism.
 */
export function uploadStory(file: File, onProgress: (fraction: number) => void): Promise<StoryGroup[]> {
  if (IS_MOCK_API) return mock.uploadStory(file, onProgress);
  const mime = storyMime(file);
  if (!mime) return Promise.reject(new ApiError("STORY_INVALID_FILE"));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/miniapp/stories`);
    xhr.setRequestHeader("Content-Type", mime);
    if (initData) xhr.setRequestHeader("X-Telegram-Init-Data", initData);
    // Veb-saytda sessiya cookie'si (fetch'dagi `credentials: "include"` kabi).
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onerror = () => reject(new ApiError("SERVER", "Network error"));
    xhr.ontimeout = () => reject(new ApiError("SERVER", "Timeout"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as StoryGroup[]);
        } catch {
          reject(new ApiError("SERVER", "Invalid JSON"));
        }
        return;
      }
      // nginx `client_max_body_size` 413 ni HTML bilan qaytaradi — kodga qaramasdan "juda katta".
      if (xhr.status === 413) return reject(new ApiError("STORY_TOO_LARGE"));
      let code: ApiErrorCode = xhr.status === 401 ? "UNAUTHORIZED" : "SERVER";
      try {
        const data = JSON.parse(xhr.responseText) as { code?: ApiErrorCode };
        if (data.code) code = data.code;
      } catch {
        // Javob JSON emas — umumiy xato.
      }
      reject(new ApiError(code));
    };
    xhr.send(file);
  });
}

/** @endpoint DELETE /miniapp/stories/:id — faqat o'z istoriyasi (204); aks holda NOT_FOUND. */
export const deleteStory = (id: string): Promise<void> =>
  IS_MOCK_API
    ? mock.deleteStory(id)
    : request("DELETE", `/miniapp/stories/${encodeURIComponent(id)}`);

/**
 * @endpoint GET /miniapp/stories/:id/video — ochiq, HTTP Range bilan (`<video src>` iOS/Android'da
 * ishlaydi). Muddati tugagan yoki o'chirilgan bo'lsa — 404 (`<video>` da `error` hodisasi).
 */
/** @endpoint GET /miniapp/rules/video/:id — qoida videosi (ochiq, Range bilan). */
export const rulesVideoUrl = (id: string): string =>
  IS_MOCK_API ? mock.rulesVideoUrl() : `${API_URL}/miniapp/rules/video/${encodeURIComponent(id)}`;

export const storyVideoUrl = (id: string): string =>
  IS_MOCK_API ? mock.storyVideoUrl(id) : `${API_URL}/miniapp/stories/${encodeURIComponent(id)}/video`;

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

/**
 * @endpoint POST /auth/web-register — saytdan (Telegram'siz) ro'yxatdan o'tish: ism, telefon
 * raqam, yosh. Backend akkaunt yaratib, `HttpOnly` sessiya cookie'sini qo'yadi; keyin ilova
 * qoidalarga rozilik qadamiga o'tadi. Xatolar: INVALID_PROFILE, INVALID_PHONE, UNDER_AGE,
 * PHONE_TAKEN, TOO_MANY.
 */
export const webRegister = (body: WebRegisterRequest): Promise<void> =>
  IS_MOCK_API ? mock.webRegister(body) : request("POST", "/auth/web-register", body);

/**
 * @endpoint POST /auth/bot-login — "Hisobim bor": Telegram bot orqali kirish so'rovi (bot havolasi
 * va 4 xonali kod). Maxfiy kalitni backend shu brauzerning cookie'siga qo'yadi.
 * Xatolar: TOO_MANY (10 daqiqada 10 tadan ko'p), SERVER (bot sozlanmagan).
 */
export const startBotLogin = (): Promise<BotLoginStart> =>
  IS_MOCK_API ? mock.startBotLogin() : request("POST", "/auth/bot-login", {});

/**
 * @endpoint POST /auth/bot-login/poll — holat; CONFIRMED bo'lsa shu javob bilan sessiya cookie'si
 * qo'yiladi (keyin `me` va boshqa so'rovlar qayta yuklanadi).
 */
export const pollBotLogin = (id: string): Promise<{ status: BotLoginStatus }> =>
  IS_MOCK_API ? mock.pollBotLogin(id) : request("POST", "/auth/bot-login/poll", { id });

/** @endpoint POST /auth/logout */
export const logout = (): Promise<void> =>
  IS_MOCK_API ? mock.webLogout() : request("POST", "/auth/logout");
