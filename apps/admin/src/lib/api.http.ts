/**
 * API qatlamining HAQIQIY implementatsiyasi — backendga `fetch` bilan murojaat qiladi.
 *
 * - Eksport qilingan funksiyalar nomi va imzosi `./api.mock.ts` dagi bilan bir xil
 *   (kontrakt — har bir funksiyaning JSDoc idagi `@endpoint`); qaysi biri ishlatilishini
 *   `./api.ts` tanlaydi. Komponentlar faqat `@/lib/api` dan import qiladi.
 * - So'rovlar shu domen ichida nisbiy yo'l bilan ketadi (`/api/v1/...`): prod'da admin panel
 *   va API bitta nginx ortida (`https://konkurs.mezon.site/admin/` va `/api/v1`), lokal
 *   dev'da esa Next.js `rewrites` backendga uzatadi (`next.config.ts`).
 * - Sessiya — backend qo'yadigan `HttpOnly` cookie. JavaScript uni ko'rmaydi va saqlamaydi;
 *   brauzer uni `credentials: "same-origin"` bilan o'zi yuboradi.
 * - Xatolar `ApiError(status, message)` bo'lib tashlanadi; `message` — foydalanuvchiga
 *   ko'rsatiladigan o'zbekcha matn.
 */
import { ApiError } from "./api-error";
import type {
  AdminUser,
  AuditLogQuery,
  AuditLogResponse,
  ContestRules,
  ContestRulesUpdate,
  ContestSettingsResponse,
  ContestSettingsUpdate,
  DailyRatingQuery,
  DailyRatingResponse,
  DashboardQuery,
  DashboardStats,
  DrawCancelRequest,
  DrawPeriod,
  DrawPeriodInput,
  DrawPreview,
  DrawReplaceRequest,
  DrawSettings,
  DrawSetup,
  DrawStock,
  LoginRequest,
  ManualReviewDecisionRequest,
  ManualReviewItem,
  ManualReviewListQuery,
  ManualReviewListResponse,
  ParticipantActionRequest,
  ParticipantListItem,
  ParticipantListQuery,
  ParticipantListResponse,
  SupportReplyRequest,
  SupportStatusRequest,
  SupportTicketDetail,
  SupportTicketListQuery,
  SupportTicketListResponse,
  TargetActionRequest,
  TargetAdsCheckReport,
  TargetCaseDetail,
  TargetCaseListQuery,
  TargetCaseListResponse,
  TargetCheckStatus,
  TelegramMessageListItem,
  TelegramMessageListQuery,
  TelegramMessageListResponse,
  TelegramResendUnreadRequest,
  VoucherDraw,
  VoucherDrawSummary,
  WinnerManualCheckRequest,
  WinnerOverview,
  WinnerSkipRequest,
} from "./types";

// ---------------------------------------------------------------------------
// HTTP yordamchilari
// ---------------------------------------------------------------------------

/** API prefiksi. Nisbiy yo'l — admin panel qaysi `basePath` da bo'lmasin, API domen ildizida. */
const API_BASE = "/api/v1";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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
type FallbackMessages = Partial<Record<number, string>>;

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
function segment(value: string): string {
  return encodeURIComponent(value);
}

interface RequestOptions {
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
async function requestJson<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
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
async function requestVoid(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<void> {
  const response = await send(method, path, options);
  // Tanani o'qib tugatamiz — ulanish qayta ishlatilsin.
  await response.text().catch(() => "");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Login va parol bilan kirish. Backend `HttpOnly` sessiya cookie'sini qo'yadi.
 * @endpoint POST /api/v1/admin/auth/login
 * @throws ApiError 401 — login yoki parol noto'g'ri; 429 — juda ko'p urinish
 */
export async function login(request: LoginRequest): Promise<AdminUser> {
  return requestJson<AdminUser>("POST", "/admin/auth/login", {
    body: { login: request.login, password: request.password },
    fallback: { 401: "Login yoki parol noto'g'ri." },
  });
}

/**
 * Tizimdan chiqish. Sessiya allaqachon tugagan bo'lsa (401) ham chiqildi deb hisoblanadi.
 * @endpoint POST /api/v1/admin/auth/logout
 */
export async function logout(): Promise<void> {
  try {
    await requestVoid("POST", "/admin/auth/logout");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return;
    }
    throw error;
  }
}

/**
 * Joriy xodim ma'lumotlari (sessiyani tekshirish).
 * @endpoint GET /api/v1/admin/auth/me
 * @throws ApiError 401 — sessiya yo'q yoki muddati tugagan
 */
export async function getMe(): Promise<AdminUser> {
  return requestJson<AdminUser>("GET", "/admin/auth/me");
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Dashboard ko'rsatkichlari tanlangan davr uchun.
 * @endpoint GET /api/v1/admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD
 * @throws ApiError 400 — sana noto'g'ri yoki `from` > `to`
 */
export async function getDashboardStats(query: DashboardQuery): Promise<DashboardStats> {
  return requestJson<DashboardStats>("GET", "/admin/dashboard", { query });
}

// ---------------------------------------------------------------------------
// Ishtirokchilar (Foydalanuvchilar bo'limi)
// ---------------------------------------------------------------------------

/**
 * Ishtirokchilar ro'yxati: qidiruv, filtr, saralash, sahifalash.
 * @endpoint GET /api/v1/admin/participants?search=&status=&reel=&sort=&order=&page=&pageSize=
 */
export async function getParticipants(query: ParticipantListQuery): Promise<ParticipantListResponse> {
  return requestJson<ParticipantListResponse>("GET", "/admin/participants", { query });
}

/**
 * Ishtirokchini bloklash (ilovaga kira olmaydi, reytingdan chiqariladi).
 * @endpoint POST /api/v1/admin/participants/:id/block
 * @throws ApiError 400 — sabab yozilmagan; 404 — topilmadi; 409 — holat mos emas
 */
export async function blockParticipant(
  id: string,
  request: ParticipantActionRequest,
): Promise<ParticipantListItem> {
  return requestJson<ParticipantListItem>("POST", `/admin/participants/${segment(id)}/block`, {
    body: { reason: request.reason },
  });
}

/**
 * Blokdan chiqarish.
 * @endpoint POST /api/v1/admin/participants/:id/unblock
 * @throws ApiError 400 | 404 | 409
 */
export async function unblockParticipant(
  id: string,
  request: ParticipantActionRequest,
): Promise<ParticipantListItem> {
  return requestJson<ParticipantListItem>("POST", `/admin/participants/${segment(id)}/unblock`, {
    body: { reason: request.reason },
  });
}

/**
 * Diskvalifikatsiya qilish (tanlovdan chetlatish). Qarorni faqat Admin qabul qiladi.
 * @endpoint POST /api/v1/admin/participants/:id/disqualify
 * @throws ApiError 400 | 404 | 409
 */
export async function disqualifyParticipant(
  id: string,
  request: ParticipantActionRequest,
): Promise<ParticipantListItem> {
  return requestJson<ParticipantListItem>("POST", `/admin/participants/${segment(id)}/disqualify`, {
    body: { reason: request.reason },
  });
}

// ---------------------------------------------------------------------------
// Reyting
// ---------------------------------------------------------------------------

/**
 * Tanlangan kunning reytingi va oldingi kunga nisbatan o'zgarish.
 * @endpoint GET /api/v1/admin/ratings/daily?date=YYYY-MM-DD&page=&pageSize=
 * @throws ApiError 400 — sana noto'g'ri formatda
 */
export async function getDailyRating(query: DailyRatingQuery): Promise<DailyRatingResponse> {
  return requestJson<DailyRatingResponse>("GET", "/admin/ratings/daily", { query });
}

// ---------------------------------------------------------------------------
// Qo'lda tekshiruv
// ---------------------------------------------------------------------------

/**
 * Apify ketma-ket 3 marta topa olmagan videolar. Ochiqlari navbat bo'yicha (eng eskisi yuqorida).
 * @endpoint GET /api/v1/admin/manual-reviews?status=&search=&page=&pageSize=
 */
export async function getManualReviews(query: ManualReviewListQuery): Promise<ManualReviewListResponse> {
  return requestJson<ManualReviewListResponse>("GET", "/admin/manual-reviews", { query });
}

/**
 * Admin qarori. Tasdiq — video reytingga qo'shiladi; rad — sababi ishtirokchiga bot orqali
 * yuboriladi va u boshqa link yubora oladi. Ikkalasida ham ishtirokchi xabar oladi.
 * @endpoint POST /api/v1/admin/manual-reviews/:id/decision
 * @throws ApiError 400 — sabab tanlanmagan; 404; 409 — qaror allaqachon qabul qilingan
 */
export async function decideManualReview(
  id: string,
  request: ManualReviewDecisionRequest,
): Promise<ManualReviewItem> {
  return requestJson<ManualReviewItem>("POST", `/admin/manual-reviews/${segment(id)}/decision`, {
    body: request,
  });
}

// ---------------------------------------------------------------------------
// Target yoqqanlar
// ---------------------------------------------------------------------------

/**
 * Target (pullik reklama) aniqlangan ishtirokchilar ro'yxati, eng yangilari yuqorida.
 * @endpoint GET /api/v1/admin/targets?status=&search=&page=&pageSize=
 */
export async function getTargetCases(query: TargetCaseListQuery): Promise<TargetCaseListResponse> {
  return requestJson<TargetCaseListResponse>("GET", "/admin/targets", { query });
}

/**
 * Target holati: dalil, kunlik o'sish va target holati tarixi. Shikoyat skrinshotlari
 * `attachments[].url` da nisbiy manzil bilan keladi
 * (`/api/v1/admin/targets/:caseId/attachments/:attachmentId`, cookie bilan ochiladi).
 * @endpoint GET /api/v1/admin/targets/:id
 * @throws ApiError 404 — topilmadi
 */
export async function getTargetCase(id: string): Promise<TargetCaseDetail> {
  return requestJson<TargetCaseDetail>("GET", `/admin/targets/${segment(id)}`);
}

/**
 * Admin qarori: ogohlantirish, diskvalifikatsiya yoki ro'yxatdan chiqarish
 * (yolg'on signal). Ishtirokchi holati ham shunga qarab o'zgaradi.
 * @endpoint POST /api/v1/admin/targets/:id/resolve
 * @throws ApiError 400 — sabab yozilmagan; 404; 409 — holat mos emas
 */
export async function resolveTargetCase(
  id: string,
  request: TargetActionRequest,
): Promise<TargetCaseDetail> {
  return requestJson<TargetCaseDetail>("POST", `/admin/targets/${segment(id)}/resolve`, {
    body: { action: request.action, reason: request.reason },
  });
}

/**
 * Meta reklama kutubxonasi tekshiruvining holati, oxirgi natijasi va keyingi rejadagi kun.
 * Backend reyting yetakchilarini oyiga bir marta o'zi tekshiradi (tanlov boshidan har 30 kunda).
 * @endpoint GET /api/v1/admin/targets/check
 */
export async function getTargetCheckStatus(): Promise<TargetCheckStatus> {
  return requestJson<TargetCheckStatus>("GET", "/admin/targets/check");
}

/**
 * Reklama kutubxonasini hoziroq tekshirish (reytingning yetakchilari, Apify orqali).
 * Tekshiruv tugaguncha javob kutadi (odatda 1–3 daqiqa); yangi topilganlar ro'yxatga qo'shiladi.
 * @endpoint POST /api/v1/admin/targets/check
 */
export async function checkTargetsNow(): Promise<TargetAdsCheckReport> {
  return requestJson<TargetAdsCheckReport>("POST", "/admin/targets/check");
}

// ---------------------------------------------------------------------------
// Sozlamalar
// ---------------------------------------------------------------------------

/**
 * Tanlov sozlamalari: muddat, ko'rishlar yig'iladigan vaqt, minimal yosh, qoidalar matni.
 * @endpoint GET /api/v1/admin/settings
 */
export async function getContestSettings(): Promise<ContestSettingsResponse> {
  return requestJson<ContestSettingsResponse>("GET", "/admin/settings");
}

/**
 * Sozlamalarni saqlash. Qoidalar matni o'zgarsa, qoidalar versiyasi oshadi.
 * @endpoint PUT /api/v1/admin/settings
 * @throws ApiError 400 — qiymat noto'g'ri (sana, vaqt, yosh, qoidalar matni)
 */
export async function updateContestSettings(
  update: ContestSettingsUpdate,
): Promise<ContestSettingsResponse> {
  return requestJson<ContestSettingsResponse>("PUT", "/admin/settings", {
    body: {
      startsOn: update.startsOn,
      endsOn: update.endsOn,
      syncTime: update.syncTime,
      minAge: update.minAge,
    },
  });
}

// ---------------------------------------------------------------------------
// Tanlov qoidalari
// ---------------------------------------------------------------------------

/**
 * Ishtirokchilar Mini App'da ko'radigan qoidalar (bo'limlar ko'rinishida).
 * @endpoint GET /api/v1/admin/rules
 */
export async function getContestRules(): Promise<ContestRules> {
  return requestJson<ContestRules>("GET", "/admin/rules");
}

/**
 * Qoidalarni saqlash. `requireReconsent` — versiya oshadi va barcha ishtirokchilar
 * Mini App ochilganda yangilangan qoidalarga qaytadan rozilik beradi.
 * @endpoint PUT /api/v1/admin/rules
 * @throws ApiError 400 — bo'limlar soni yoki matn uzunligi noto'g'ri
 */
export async function updateContestRules(update: ContestRulesUpdate): Promise<ContestRules> {
  return requestJson<ContestRules>("PUT", "/admin/rules", {
    body: {
      sections: update.sections.map((section) => ({ title: section.title, body: section.body })),
      requireReconsent: update.requireReconsent,
    },
  });
}

// ---------------------------------------------------------------------------
// Random tanlov (oylik voucherlar)
// ---------------------------------------------------------------------------

/**
 * Bosqichlar, oylik sovg'alar va boshlang'ich sozlamalar.
 * @endpoint GET /api/v1/admin/draws/setup
 */
export async function getDrawSetup(): Promise<DrawSetup> {
  return requestJson<DrawSetup>("GET", "/admin/draws/setup");
}

/**
 * Sozlamalar bo'yicha nomzodlar: soni, chetda qolganlar sababi, namuna. Hech narsa saqlanmaydi.
 * @endpoint POST /api/v1/admin/draws/preview
 * @throws ApiError 400 — sozlama noto'g'ri
 */
export async function previewDraw(settings: DrawSettings): Promise<DrawPreview> {
  return requestJson<DrawPreview>("POST", "/admin/draws/preview", { body: drawSettingsBody(settings) });
}

/**
 * Random tanlovni o'tkazish: server tasodifiy kalit (seed) yaratadi va nomzodlarni aralashtiradi.
 * Natija qoralama (DRAFT) holatida saqlanadi.
 * @endpoint POST /api/v1/admin/draws
 * @throws ApiError 400 — sozlama noto'g'ri yoki nomzod yo'q; 409 — shu davr uchun tanlov bor
 */
export async function runDraw(settings: DrawSettings): Promise<VoucherDraw> {
  return requestJson<VoucherDraw>("POST", "/admin/draws", { body: drawSettingsBody(settings) });
}

/** Backend noma'lum maydonlarni rad etadi — faqat `DrawSettings` maydonlari yuboriladi. */
function drawSettingsBody(settings: DrawSettings): DrawSettings {
  return {
    prizeId: settings.prizeId,
    stage: settings.stage,
    periodFrom: settings.periodFrom,
    periodTo: settings.periodTo,
    dateBasis: settings.dateBasis,
    minViews: settings.minViews,
    maxViews: settings.maxViews,
    winnersCount: settings.winnersCount,
    reservesCount: settings.reservesCount,
    excludeWarned: settings.excludeWarned,
    excludeTargets: settings.excludeTargets,
    excludePreviousWinners: settings.excludePreviousWinners,
    messageTemplate: settings.messageTemplate,
  };
}

/** Davr: faqat `title`, `startsOn`, `endsOn`. */
function drawPeriodBody(input: DrawPeriodInput): DrawPeriodInput {
  return { title: input.title, startsOn: input.startsOn, endsOn: input.endsOn };
}

/**
 * Kalendardan yangi davr yaratish (masalan, bayram bonusi). Tanlov muddati ichida bo'lishi shart.
 * @endpoint POST /api/v1/admin/draws/periods
 * @throws ApiError 400 — nom yoki sanalar noto'g'ri; 409 — shu sanalar uchun bosqich yoki davr bor
 */
export async function createDrawPeriod(input: DrawPeriodInput): Promise<DrawPeriod> {
  return requestJson<DrawPeriod>("POST", "/admin/draws/periods", { body: drawPeriodBody(input) });
}

/**
 * Davr nomi yoki sanalarini o'zgartirish. O'tkazilgan tanlovlar o'z sanalarini saqlaydi.
 * @endpoint PUT /api/v1/admin/draws/periods/:periodId
 * @throws ApiError 400; 404 — davr topilmadi; 409 — shu sanalar uchun bosqich yoki davr bor
 */
export async function updateDrawPeriod(id: string, input: DrawPeriodInput): Promise<DrawPeriod> {
  return requestJson<DrawPeriod>("PUT", `/admin/draws/periods/${segment(id)}`, {
    body: drawPeriodBody(input),
  });
}

/**
 * Davrni o'chirish. Unda o'tkazilgan tanlovlar o'zgarmaydi.
 * @endpoint DELETE /api/v1/admin/draws/periods/:periodId
 * @throws ApiError 404 — davr topilmadi
 */
export async function deleteDrawPeriod(id: string): Promise<void> {
  await requestVoid("DELETE", `/admin/draws/periods/${segment(id)}`);
}

/**
 * Oylik voucherlar qoldig'i: aksiya davomida jami, yuborilgan, tasdiqlangan, qoralamada va qolgani
 * (bosqichlar bo'yicha ham). Bekor qilingan tanlovlar hisobga olinmaydi.
 * @endpoint GET /api/v1/admin/draws/stock
 */
export async function getDrawStock(): Promise<DrawStock[]> {
  return requestJson<DrawStock[]>("GET", "/admin/draws/stock");
}

/**
 * O'tkazilgan tanlovlar, eng yangisi yuqorida.
 * @endpoint GET /api/v1/admin/draws
 */
export async function getDraws(): Promise<VoucherDrawSummary[]> {
  return requestJson<VoucherDrawSummary[]>("GET", "/admin/draws");
}

/**
 * Tanlov natijasi: g'oliblar, zaxira, yuborish holati.
 * @endpoint GET /api/v1/admin/draws/:id
 * @throws ApiError 404
 */
export async function getDraw(id: string): Promise<VoucherDraw> {
  return requestJson<VoucherDraw>("GET", `/admin/draws/${segment(id)}`);
}

/**
 * G'olibni chetlatish: o'rniga navbatdagi zaxira g'olib bo'ladi. Sabab audit logga yoziladi.
 * @endpoint POST /api/v1/admin/draws/:id/replace
 * @throws ApiError 400 | 404; 409 — zaxira qolmagan yoki tanlov bekor qilingan
 */
export async function replaceDrawWinner(id: string, request: DrawReplaceRequest): Promise<VoucherDraw> {
  return requestJson<VoucherDraw>("POST", `/admin/draws/${segment(id)}/replace`, {
    body: { participantId: request.participantId, reason: request.reason },
  });
}

/**
 * Natijani tasdiqlash (shundan keyin g'oliblarga yuborish mumkin).
 * @endpoint POST /api/v1/admin/draws/:id/confirm
 * @throws ApiError 404 | 409
 */
export async function confirmDraw(id: string): Promise<VoucherDraw> {
  return requestJson<VoucherDraw>("POST", `/admin/draws/${segment(id)}/confirm`);
}

/**
 * Tanlovni bekor qilish (xabar yuborilmagan bo'lsa). Shu davr uchun yangi tanlov o'tkazish mumkin bo'ladi.
 * @endpoint POST /api/v1/admin/draws/:id/cancel
 * @throws ApiError 400 | 404 | 409
 */
export async function cancelDraw(id: string, request: DrawCancelRequest): Promise<VoucherDraw> {
  return requestJson<VoucherDraw>("POST", `/admin/draws/${segment(id)}/cancel`, {
    body: { reason: request.reason },
  });
}

/**
 * Faol g'oliblarga Telegram bot orqali xabar (hali yuborilmagan va xato bo'lganlarga).
 * @endpoint POST /api/v1/admin/draws/:id/send
 * @throws ApiError 404; 409 — tasdiqlanmagan yoki yuboriladigan xabar yo'q
 */
export async function sendDraw(id: string): Promise<VoucherDraw> {
  return requestJson<VoucherDraw>("POST", `/admin/draws/${segment(id)}/send`);
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/**
 * Admin va Support harakatlari (faqat o'qish), eng yangilari yuqorida.
 * @endpoint GET /api/v1/admin/audit-log?search=&entity=&actorRole=&page=&pageSize=
 */
export async function getAuditLog(query: AuditLogQuery): Promise<AuditLogResponse> {
  return requestJson<AuditLogResponse>("GET", "/admin/audit-log", { query });
}

// ---------------------------------------------------------------------------
// G'olib
// ---------------------------------------------------------------------------

/**
 * G'olib bo'limi: tanlov holati, nomzod va tekshiruv ro'yxati, zaxira nomzodlar.
 * @endpoint GET /api/v1/admin/winner
 */
export async function getWinnerOverview(): Promise<WinnerOverview> {
  return requestJson<WinnerOverview>("GET", "/admin/winner");
}

/**
 * Qo'lda tekshiriladigan band natijasi: mahsulot xaridi (chek, buyurtma raqami — PLAN.md Q4)
 * yoki yuzma-yuz uchrashuvda Instagram "Reklama vositalari" (reklama tarixi) ko'rilgani.
 * @endpoint PUT /api/v1/admin/winner/manual-check
 * @throws ApiError 400 — izoh yo'q yoki band noto'g'ri; 404; 409 — g'olib e'lon qilingan
 */
export async function setWinnerManualCheck(
  request: WinnerManualCheckRequest,
): Promise<WinnerOverview> {
  return requestJson<WinnerOverview>("PUT", "/admin/winner/manual-check", {
    body: {
      participantId: request.participantId,
      check: request.check,
      passed: request.passed,
      note: request.note,
    },
  });
}

/**
 * Nomzodni rad etish — keyingi o'rindagi ishtirokchi nomzod bo'ladi.
 * @endpoint POST /api/v1/admin/winner/skip
 * @throws ApiError 400 — sabab yo'q; 409 — tanlov tugamagan yoki nomzod o'zgargan
 */
export async function skipWinnerCandidate(request: WinnerSkipRequest): Promise<WinnerOverview> {
  return requestJson<WinnerOverview>("POST", "/admin/winner/skip", {
    body: { participantId: request.participantId, reason: request.reason },
  });
}

/**
 * G'olibni tasdiqlash (barcha tekshiruvlar o'tgan bo'lishi shart).
 * Body: `{ participantId }` — nomzod shu orada o'zgarmaganini backend tekshiradi.
 * @endpoint POST /api/v1/admin/winner/confirm
 * @throws ApiError 409 — tanlov tugamagan, tekshiruv o'tmagan yoki nomzod o'zgargan
 */
export async function confirmWinner(participantId: string): Promise<WinnerOverview> {
  return requestJson<WinnerOverview>("POST", "/admin/winner/confirm", { body: { participantId } });
}

/**
 * Tasdiqni bekor qilish (faqat e'lon qilinmagan bo'lsa).
 * @endpoint DELETE /api/v1/admin/winner/confirm
 */
export async function cancelWinnerConfirmation(): Promise<WinnerOverview> {
  return requestJson<WinnerOverview>("DELETE", "/admin/winner/confirm");
}

/**
 * G'olibni e'lon qilish: ilovada "G'olib e'loni" ekrani ochiladi. Qaytarilmaydi.
 * @endpoint POST /api/v1/admin/winner/announce
 * @throws ApiError 409 — g'olib tasdiqlanmagan
 */
export async function announceWinner(): Promise<WinnerOverview> {
  return requestJson<WinnerOverview>("POST", "/admin/winner/announce");
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

/**
 * Telegram orqali yuborilgan xabarnomalar va ularning holati
 * (yuborildi, yetkazildi, o'qildi, o'qilmadi, yuborilmadi).
 * @endpoint GET /api/v1/admin/telegram/messages?status=&kind=&search=&page=&pageSize=
 */
export async function getTelegramMessages(
  query: TelegramMessageListQuery,
): Promise<TelegramMessageListResponse> {
  return requestJson<TelegramMessageListResponse>("GET", "/admin/telegram/messages", { query });
}

/**
 * Bitta xabarni qayta yuborish (o'qilmagan yoki vaqtinchalik xato bo'lgan).
 * @endpoint POST /api/v1/admin/telegram/messages/:id/resend
 * @throws ApiError 404; 409 — qayta yuborib bo'lmaydi (masalan, bot bloklangan)
 */
export async function resendTelegramMessage(id: string): Promise<TelegramMessageListItem> {
  return requestJson<TelegramMessageListItem>("POST", `/admin/telegram/messages/${segment(id)}/resend`);
}

/**
 * O'qilmaganlarning hammasiga qayta yuborish (joriy tur va qidiruv filtri bo'yicha).
 * Bo'sh filtrlar body'ga qo'shilmaydi.
 * @endpoint POST /api/v1/admin/telegram/messages/resend-unread
 */
export async function resendUnreadTelegram(
  request: TelegramResendUnreadRequest,
): Promise<{ resent: number }> {
  const body: TelegramResendUnreadRequest = {};
  if (request.kind) body.kind = request.kind;
  if (request.search?.trim()) body.search = request.search.trim();
  return requestJson<{ resent: number }>("POST", "/admin/telegram/messages/resend-unread", { body });
}

// ---------------------------------------------------------------------------
// Support (Admin va Support operatori)
// ---------------------------------------------------------------------------

/**
 * Murojaatlar ro'yxati, eng so'nggi faollik yuqorida.
 * @endpoint GET /api/v1/admin/support/tickets?status=&search=&page=&pageSize=
 */
export async function getSupportTickets(
  query: SupportTicketListQuery,
): Promise<SupportTicketListResponse> {
  return requestJson<SupportTicketListResponse>("GET", "/admin/support/tickets", { query });
}

/**
 * Murojaat va uning to'liq yozishmasi. Ilovalar `attachments[].url` da nisbiy manzil bilan
 * keladi (`/api/v1/admin/support/tickets/:id/attachments/:attachmentId`, cookie bilan ochiladi).
 * @endpoint GET /api/v1/admin/support/tickets/:id
 * @throws ApiError 404 — topilmadi
 */
export async function getSupportTicket(id: string): Promise<SupportTicketDetail> {
  return requestJson<SupportTicketDetail>("GET", `/admin/support/tickets/${segment(id)}`);
}

/**
 * Murojaatga javob yozish. Javob ishtirokchiga ilovada va Telegramda ko'rinadi.
 * "Yangi" murojaat birinchi javobdan keyin "Ko'rilmoqda" holatiga o'tadi.
 * @endpoint POST /api/v1/admin/support/tickets/:id/messages
 * @throws ApiError 400 — matn bo'sh yoki juda uzun; 404; 409 — murojaat yopilgan
 */
export async function replyToSupportTicket(
  id: string,
  request: SupportReplyRequest,
): Promise<SupportTicketDetail> {
  return requestJson<SupportTicketDetail>("POST", `/admin/support/tickets/${segment(id)}/messages`, {
    body: { text: request.text },
  });
}

/**
 * Murojaat holatini o'zgartirish (yangi, ko'rilmoqda, yopildi).
 * @endpoint PATCH /api/v1/admin/support/tickets/:id/status
 * @throws ApiError 404
 */
export async function updateSupportTicketStatus(
  id: string,
  request: SupportStatusRequest,
): Promise<SupportTicketDetail> {
  return requestJson<SupportTicketDetail>("PATCH", `/admin/support/tickets/${segment(id)}/status`, {
    body: { status: request.status },
  });
}
