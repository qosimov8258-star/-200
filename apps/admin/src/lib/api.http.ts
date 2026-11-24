/**
 * API qatlamining HAQIQIY implementatsiyasi — backendga `fetch` bilan murojaat qiladi.
 *
 * - Eksport qilingan funksiyalar nomi va imzosi `./api.mock.ts` dagi bilan bir xil
 *   (kontrakt — har bir funksiyaning JSDoc idagi `@endpoint`); qaysi biri ishlatilishini
 *   `./api.ts` tanlaydi. Komponentlar faqat `@/lib/api` dan import qiladi.
 * - So'rovlar shu domen ichida nisbiy yo'l bilan ketadi (`/api/v1/...`): prod'da admin panel
 *   va API bitta nginx ortida (`https://konkurs-olivia.uz/admin/` va `/api/v1`), lokal
 *   dev'da esa Next.js `rewrites` backendga uzatadi (`next.config.ts`).
 * - Sessiya — backend qo'yadigan `HttpOnly` cookie. JavaScript uni ko'rmaydi va saqlamaydi;
 *   brauzer uni `credentials: "same-origin"` bilan o'zi yuboradi.
 * - Xatolar `ApiError(status, message)` bo'lib tashlanadi; `message` — foydalanuvchiga
 *   ko'rsatiladigan o'zbekcha matn.
 */
import { ApiError } from "./api-error";
import { drawSettingsInputOf } from "./draw-rules";
import { apiUrl, requestJson, requestJsonOrNull, requestVoid, segment, uploadJson } from "./http-client";
import { rulesVideoMimeOf } from "./rules-video";
import type {
  AdminUser,
  AiApproveRequest,
  AiCandidate,
  AiDecisionRequest,
  AiDraftUpdate,
  AiReferenceInput,
  AiReferenceUpdate,
  AiReviewItem,
  AiReviewListQuery,
  AiReviewListResponse,
  AiState,
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
  DrawSettingsInput,
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
  ParticipantReels,
  RulesVideo,
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
  ViewsRefreshPreview,
  ViewsRefreshRequest,
  RatingPrizes,
  VoucherDraw,
  VoucherDrawSummary,
  WinnerManualCheckRequest,
  WinnerOverview,
  WinnerSkipRequest,
} from "./types";

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
 * "Ko'rishlarni yangilash" oynasi: oraliqda nechta video bor, oxirgi yig'ish va yangilash natijasi.
 * @endpoint GET /api/v1/admin/stats/refresh?minViews=&maxViews=&includeNear=
 */
export async function getViewsRefreshPreview(request: ViewsRefreshRequest): Promise<ViewsRefreshPreview> {
  return requestJson<ViewsRefreshPreview>("GET", "/admin/stats/refresh", {
    query: {
      minViews: request.minViews ?? undefined,
      maxViews: request.maxViews ?? undefined,
      includeNear: request.includeNear,
    },
  });
}

/**
 * Oraliqdagi videolarni hoziroq qayta o'qish (fonda; natija — `getViewsRefreshPreview` dagi `lastReport`).
 * @endpoint POST /api/v1/admin/stats/refresh
 * @throws ApiError 409 — yig'ish ketyapti; 422 — oraliqda video yo'q
 */
export async function startViewsRefresh(request: ViewsRefreshRequest): Promise<{ started: boolean; count: number }> {
  return requestJson<{ started: boolean; count: number }>("POST", "/admin/stats/refresh", { body: request });
}

/**
 * Ishtirokchining barcha yuborgan videolari va natijasi (`bestViews` — eng ko'p ko'rilgan qabul
 * qilingan videosi, ko'rishlar qo'shilmaydi). Tartib: qabul qilinganlar ko'rishlar bo'yicha
 * (birinchisi `best`), keyin tekshiruvdagilar, keyin rad etilganlar. Har bir videoning `rank` i —
 * uning reytingdagi o'rni (faqat qabul qilinganlarda).
 * @endpoint GET /api/v1/admin/participants/:id/reels
 * @throws ApiError 404 — ishtirokchi topilmadi
 */
export async function getParticipantReels(id: string): Promise<ParticipantReels> {
  return requestJson<ParticipantReels>("GET", `/admin/participants/${segment(id)}/reels`);
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
 * Tanlangan kunning reytingi va oldingi kunga nisbatan o'zgarish. Har bir qabul qilingan video —
 * alohida qator (kaliti `shortcode`): bir ishtirokchi bir necha marta uchrashi mumkin.
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

/**
 * Qoida videosi — Mini App'dagi "Qoidalar" bo'limida eng tepada ko'rsatiladi; yuklanmagan bo'lsa — null.
 * @endpoint GET /api/v1/admin/rules/video
 */
export async function getRulesVideo(): Promise<RulesVideo | null> {
  return requestJsonOrNull<RulesVideo>("GET", "/admin/rules/video");
}

/**
 * Qoida videosini yuklash yoki almashtirish (eskisi o'chiriladi, `id` yangilanadi). So'rov tanasi —
 * faylning o'zi (multipart emas), `Content-Type` — video turi. `onProgress` — yuborilgan qism (0–1).
 * Audit: `settings.rules_video`.
 * @endpoint PUT /api/v1/admin/rules/video
 * @throws ApiError 413 `RULES_VIDEO_TOO_LARGE` — 100 MB dan katta (nginx ham HTML bilan 413 qaytarishi
 *   mumkin); 422 `RULES_VIDEO_INVALID` — MP4 / MOV / WebM emas, bo'sh yoki buzilgan
 */
export async function uploadRulesVideo(file: File, onProgress?: (ratio: number) => void): Promise<RulesVideo> {
  return uploadJson<RulesVideo>("PUT", "/admin/rules/video", file, {
    // Brauzer turini bermasa — kengaytma bo'yicha; umuman tanilmasa — `video/mp4` (backend tekshiradi).
    contentType: rulesVideoMimeOf(file) ?? (file.type || "video/mp4"),
    onProgress,
  });
}

/**
 * Qoida videosini o'chirish (video bo'lmasa ham 204). Audit: `settings.rules_video_delete`.
 * @endpoint DELETE /api/v1/admin/rules/video
 */
export async function deleteRulesVideo(): Promise<void> {
  await requestVoid("DELETE", "/admin/rules/video");
}

/**
 * Qoida videosi — `<video src>` uchun manzil (ochiq endpoint, HTTP Range bilan). `id` joriy video
 * bo'lmasa (almashtirilgan yoki o'chirilgan) — 404.
 * @endpoint GET /api/v1/miniapp/rules/video/:id
 */
export function rulesVideoUrl(id: string): string {
  return apiUrl(`/miniapp/rules/video/${segment(id)}`);
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
 * Doimiy tanlov sozlamalarini tasdiqlash yoki o'zgartirish (har bir tanlovda faqat davr tanlanadi).
 * Oldingi g'oliblar har doim chetda — bu maydon yuborilmaydi. Javob — yangilangan `setup`.
 * @endpoint PUT /api/v1/admin/draws/settings
 * @throws ApiError 400 — sozlama noto'g'ri
 */
export async function saveDrawSettings(input: DrawSettingsInput): Promise<DrawSetup> {
  return requestJson<DrawSetup>("PUT", "/admin/draws/settings", { body: drawSettingsInputOf(input) });
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

/**
 * Backend noma'lum maydonlarni rad etadi — faqat `DrawSettings` maydonlari yuboriladi.
 * Oldingi g'oliblar har doim chetda (backend ham shunday majburlaydi).
 */
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
    excludePreviousWinners: true,
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
 * Bosqichni o'chirish: random tanlovda tanlab bo'lmaydi, voucherlar jami kamayadi, Mini App'da
 * ko'rinmaydi.
 * @endpoint DELETE /api/v1/admin/draws/stages/:index
 * @throws ApiError 409 — bosqichda tanlov o'tkazilgan yoki bu oxirgi bosqich
 */
export async function deleteDrawStage(index: number): Promise<void> {
  await requestVoid("DELETE", `/admin/draws/stages/${index}`);
}

/**
 * O'chirilgan bosqichni tiklash.
 * @endpoint POST /api/v1/admin/draws/stages/:index/restore
 */
export async function restoreDrawStage(index: number): Promise<void> {
  await requestVoid("POST", `/admin/draws/stages/${index}/restore`);
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
 * Asosiy sovrinlar (avtomobil, sayohat, iPhone, planshet) — random emas, reyting bo'yicha: har birining
 * ko'rishlar oralig'ida eng ko'p ko'rilgan videosi bor ishtirokchilar, joriy holat.
 * @endpoint GET /api/v1/admin/winner/prizes
 */
export async function getRatingPrizes(): Promise<RatingPrizes> {
  return requestJson<RatingPrizes>("GET", "/admin/winner/prizes");
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

// ---------------------------------------------------------------------------
// AI tekshiruvi (faqat ADMIN)
// ---------------------------------------------------------------------------

/**
 * AI bo'limi holati: qoralama, faol versiya, joriy ishga tushirish va uning sonlari, worker holati.
 * @endpoint GET /api/v1/admin/ai/state
 */
export async function getAiState(): Promise<AiState> {
  return requestJson<AiState>("GET", "/admin/ai/state");
}

/**
 * Qoralama yaratish (faol versiyadan nusxa yoki bo'sh); qoralama bor bo'lsa — o'zgarmaydi.
 * @endpoint POST /api/v1/admin/ai/draft
 */
export async function createAiDraft(): Promise<AiState> {
  return requestJson<AiState>("POST", "/admin/ai/draft");
}

/**
 * Qoralamadagi umumiy mezonlarni saqlash (0–5000 belgi). Audit: `ai.draft.update`.
 * @endpoint PUT /api/v1/admin/ai/draft
 * @throws ApiError 400 — juda uzun; 409 — qoralama yo'q
 */
export async function updateAiDraft(update: AiDraftUpdate): Promise<AiState> {
  return requestJson<AiState>("PUT", "/admin/ai/draft", { body: { criteria: update.criteria } });
}

/**
 * Qoralamaga namuna rasm qo'shish: `dataUrl` — `data:image/(jpeg|png|webp);base64,…`, ko'pi bilan 2 MB
 * (panel yuborishdan oldin uzun tomoni 1600 px gacha kichraytiradi, `src/lib/ai-image.ts`); 400 tagacha (Claude chegarasi).
 * Audit: `ai.reference.add`.
 * @endpoint POST /api/v1/admin/ai/draft/references
 * @throws ApiError 400 — rasm yoki izoh noto'g'ri; 409 — qoralama yo'q; 422 — 400 ta rasm bor; 413 — juda katta
 */
export async function addAiReference(input: AiReferenceInput): Promise<AiState> {
  return requestJson<AiState>("POST", "/admin/ai/draft/references", {
    body: { dataUrl: input.dataUrl, kind: input.kind, note: input.note },
    // nginx ham 413 ni HTML bilan qaytarishi mumkin.
    fallback: { 413: "Rasm juda katta: ko'pi bilan 2 MB." },
  });
}

/**
 * Namuna rasm turi yoki izohini o'zgartirish (faqat berilgan maydonlar yuboriladi).
 * @endpoint PATCH /api/v1/admin/ai/draft/references/:id
 * @throws ApiError 400; 404 — rasm topilmadi; 409 — qoralama yo'q
 */
export async function updateAiReference(id: string, update: AiReferenceUpdate): Promise<AiState> {
  const body: AiReferenceUpdate = {};
  if (update.kind !== undefined) body.kind = update.kind;
  if (update.note !== undefined) body.note = update.note;
  return requestJson<AiState>("PATCH", `/admin/ai/draft/references/${segment(id)}`, { body });
}

/**
 * Namuna rasmni qoralamadan o'chirish. Audit: `ai.reference.remove`.
 * @endpoint DELETE /api/v1/admin/ai/draft/references/:id
 * @throws ApiError 404; 409 — qoralama yo'q
 */
export async function deleteAiReference(id: string): Promise<AiState> {
  return requestJson<AiState>("DELETE", `/admin/ai/draft/references/${segment(id)}`);
}

/**
 * Namuna rasm — `<img src>` uchun manzil (sessiya cookie'si bilan ochiladi).
 * @endpoint GET /api/v1/admin/ai/references/:id/image
 */
export function aiReferenceImageUrl(id: string): string {
  return apiUrl(`/admin/ai/references/${segment(id)}/image`);
}

/**
 * Sinov uchun videolar: qabul qilinganlar, eng ko'p ko'rilgani birinchi, ko'pi bilan 50 ta.
 * @endpoint GET /api/v1/admin/ai/candidates?search=
 */
export async function getAiCandidates(search?: string): Promise<AiCandidate[]> {
  return requestJson<AiCandidate[]>("GET", "/admin/ai/candidates", { query: { search } });
}

/**
 * Qoralamani tasdiqlash: yangi versiya sifatida qulflanadi va videolar navbatga qo'yiladi
 * (`TRIAL` — tanlangan yoki eng ko'p ko'rilgan 20 ta, `FULL` — hammasi). Audit: `ai.approve`.
 * @endpoint POST /api/v1/admin/ai/approve
 * @throws ApiError 400 — mezon ham, rasm ham yo'q yoki sinov ro'yxati noto'g'ri; 409 — qoralama yo'q
 */
export async function approveAiDraft(request: AiApproveRequest): Promise<AiState> {
  const body: AiApproveRequest = { mode: request.mode };
  if (request.mode === "TRIAL" && request.trialShortcodes && request.trialShortcodes.length > 0) {
    body.trialShortcodes = request.trialShortcodes;
  }
  return requestJson<AiState>("POST", "/admin/ai/approve", { body });
}

/**
 * Sinovdan keyin: barcha qabul qilingan videolarni faol versiya bo'yicha navbatga qo'yish. Audit: `ai.run_all`.
 * @endpoint POST /api/v1/admin/ai/run-all
 * @throws ApiError 409 — tasdiqlangan versiya yo'q
 */
export async function runAiForAll(): Promise<AiState> {
  return requestJson<AiState>("POST", "/admin/ai/run-all");
}

/**
 * Joriy versiya natijalari, eng yangi o'zgargani yuqorida. `verdict` — yakuniy xulosa bo'yicha.
 * @endpoint GET /api/v1/admin/ai/reviews?verdict=&state=&search=&page=&pageSize=
 */
export async function getAiReviews(query: AiReviewListQuery): Promise<AiReviewListResponse> {
  return requestJson<AiReviewListResponse>("GET", "/admin/ai/reviews", { query });
}

/**
 * Dalil kadri (JPEG) — `<img src>` uchun manzil. `hasFrame: false` bo'lsa 404 bo'lishi mumkin.
 * @endpoint GET /api/v1/admin/ai/reviews/:id/frames/:second
 */
export function aiFrameUrl(reviewId: string, second: number): string {
  return apiUrl(`/admin/ai/reviews/${segment(reviewId)}/frames/${Math.round(second)}`);
}

/**
 * Qo'lda qaror (izoh 3–500 belgi). Faqat AI natijasida saqlanadi — videoning tanlovdagi holati o'zgarmaydi.
 * Audit: `ai.decision` (obyekt — `reel`).
 * @endpoint POST /api/v1/admin/ai/reviews/:id/decision
 * @throws ApiError 400 — izoh yoki qaror noto'g'ri; 404 — natija topilmadi
 */
export async function decideAiReview(id: string, request: AiDecisionRequest): Promise<AiReviewItem> {
  return requestJson<AiReviewItem>("POST", `/admin/ai/reviews/${segment(id)}/decision`, {
    body: { decision: request.decision, note: request.note },
  });
}
