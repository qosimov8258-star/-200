/**
 * API qatlamining MOCK (soxta) implementatsiyasi — backendsiz lokal ishlash uchun.
 *
 * Barcha funksiyalar `./mock/` papkasidagi ma'lumotlarni qaytaradi va tarmoq
 * kechikishini taqlid qiladi. Haqiqiy backend bilan ishlaydigan versiyasi —
 * `./api.http.ts`; qaysi biri ishlatilishini `./api.ts` tanlaydi
 * (`NEXT_PUBLIC_API_MODE`).
 *
 * Eksport qilingan funksiyalar nomi va imzosi `./api.http.ts` dagi bilan bir xil
 * bo'lishi shart — buni `./api.ts` dagi tip tekshiruvi kafolatlaydi. Har bir
 * funksiyaning JSDoc idagi `@endpoint` — backenddagi manzil (kontrakt).
 *
 * Komponentlar bu faylni to'g'ridan-to'g'ri import qilmaydi — faqat `@/lib/api` orqali.
 */
import { ApiError } from "./api-error";
import { listAuditLog, recordAudit } from "./mock/audit";
import { buildDailyRating } from "./mock/daily-rating";
import {
  cancelDraw as mockCancelDraw,
  createDrawPeriod as mockCreateDrawPeriod,
  deleteDrawPeriod as mockDeleteDrawPeriod,
  deleteDrawStage as mockDeleteDrawStage,
  restoreDrawStage as mockRestoreDrawStage,
  confirmDraw as mockConfirmDraw,
  getDraw as mockGetDraw,
  getDrawSetup as mockGetDrawSetup,
  getDrawStock as mockGetDrawStock,
  listDraws,
  previewDraw as mockPreviewDraw,
  replaceDrawWinner as mockReplaceDrawWinner,
  runDraw as mockRunDraw,
  updateDrawPeriod as mockUpdateDrawPeriod,
  sendDraw as mockSendDraw,
} from "./mock/draws";
import { computeDashboardStats } from "./mock/dashboard";
import { mockAdmins } from "./mock/db";
import {
  decideManualReview as mockDecideManualReview,
  listManualReviews,
} from "./mock/manual-review";
import {
  applyParticipantAction,
  getParticipantReels as mockGetParticipantReels,
  listParticipants,
  startMockViewsRefresh,
  viewsRefreshPreview,
} from "./mock/participants";
import {
  getContestRules as mockGetContestRules,
  updateContestRules as mockUpdateContestRules,
} from "./mock/rules";
import {
  getContestSettings as mockGetContestSettings,
  updateContestSettings as mockUpdateContestSettings,
} from "./mock/settings";
import {
  addSupportReply,
  getSupportTicketDetail,
  listSupportTickets,
  setSupportTicketStatus,
} from "./mock/support";
import {
  applyTargetAction,
  getTargetCaseDetail,
  getTargetCheckStatus as mockGetTargetCheckStatus,
  listTargetCases,
  runTargetCheck,
} from "./mock/targets";
import {
  listTelegramMessages,
  resendTelegramMessage as mockResendTelegramMessage,
  resendUnreadTelegramMessages,
} from "./mock/telegram";
import {
  announceWinner as mockAnnounceWinner,
  cancelWinnerConfirmation as mockCancelWinnerConfirmation,
  confirmWinner as mockConfirmWinner,
  getWinnerOverview as mockGetWinnerOverview,
  setMockContestEnded,
  setManualCheck,
  skipCandidate,
} from "./mock/winner";
import type {
  AdminRole,
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
  DrawPreview,
  DrawReplaceRequest,
  DrawSettings,
  DrawPeriod,
  DrawPeriodInput,
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
  WinnerOverview,
  VoucherDraw,
  VoucherDrawSummary,
  WinnerManualCheckRequest,
  WinnerSkipRequest,
} from "./types";

/** Mock rejim belgisi (login sahifasida yo'riqnoma ko'rsatish uchun). */
export const IS_MOCK_API = true;

/**
 * Faqat mock rejimdagi sinov boshqaruvlari (UI ularni faqat `null` bo'lmasa ko'rsatadi).
 * Haqiqiy API faylida: `export const mockControls: MockControls | null = null;`
 */
export interface MockControls {
  /** Tanlovni tugagan deb hisoblash — g'olib oqimini sinash uchun. */
  setContestEnded: (ended: boolean) => Promise<void>;
}

export const mockControls: MockControls | null = {
  async setContestEnded(ended) {
    await delay(200);
    setMockContestEnded(ended);
  },
};

// ---------------------------------------------------------------------------
// Mock yordamchilari
// ---------------------------------------------------------------------------

const MOCK_SESSION_KEY = "reels-admin:mock-session";

/** Tarmoq kechikishini taqlid qilish. */
function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock sessiya brauzer xotirasida saqlanadi. Haqiqiy backendda sessiya
 * httpOnly cookie da bo'ladi va JavaScript uni ko'rmaydi.
 */
function readMockSession(): string | null {
  try {
    return window.localStorage.getItem(MOCK_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeMockSession(adminId: string | null): void {
  try {
    if (adminId) {
      window.localStorage.setItem(MOCK_SESSION_KEY, adminId);
    } else {
      window.localStorage.removeItem(MOCK_SESSION_KEY);
    }
  } catch {
    // Xotira yopiq bo'lsa (private rejim) — sessiya saqlanmaydi.
  }
}

function toAdminUser(record: AdminUser): AdminUser {
  return {
    id: record.id,
    login: record.login,
    fullName: record.fullName,
    role: record.role,
  };
}

/**
 * Backenddagi RBAC ni taqlid qilish: sessiya bo'lmasa — 401, rol mos
 * kelmasa — 403. Haqiqiy backendda bu tekshiruv serverda bo'ladi.
 */
function requireRole(...roles: AdminRole[]): AdminUser {
  const record = mockAdmins.find((admin) => admin.id === readMockSession());
  if (!record) {
    throw new ApiError(401, "Sessiya topilmadi. Qaytadan kiring.");
  }
  if (!roles.includes(record.role)) {
    throw new ApiError(403, "Bu amal uchun ruxsatingiz yo'q.");
  }
  return toAdminUser(record);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Login va parol bilan kirish.
 * @endpoint POST /api/v1/admin/auth/login
 * @throws ApiError 401 — login yoki parol noto'g'ri
 */
export async function login(request: LoginRequest): Promise<AdminUser> {
  await delay(600);

  const record = mockAdmins.find(
    (admin) => admin.login === request.login.trim() && admin.password === request.password,
  );

  if (!record) {
    throw new ApiError(401, "Login yoki parol noto'g'ri.");
  }

  writeMockSession(record.id);
  recordAuthEvent(record, "auth.login");
  return toAdminUser(record);
}

/** Kirish va chiqish ham audit logga yoziladi. */
function recordAuthEvent(admin: AdminUser, action: "auth.login" | "auth.logout"): void {
  recordAudit({
    actorId: admin.id,
    actorName: admin.fullName,
    action,
    entity: "auth",
    entityId: admin.id,
    before: "",
    after: "",
    reason: "",
  });
}

/**
 * Tizimdan chiqish.
 * @endpoint POST /api/v1/admin/auth/logout
 */
export async function logout(): Promise<void> {
  await delay(200);
  const record = mockAdmins.find((admin) => admin.id === readMockSession());
  if (record) {
    recordAuthEvent(record, "auth.logout");
  }
  writeMockSession(null);
}

/**
 * Joriy xodim ma'lumotlari (sessiyani tekshirish).
 * @endpoint GET /api/v1/admin/auth/me
 * @throws ApiError 401 — sessiya yo'q yoki muddati tugagan
 */
export async function getMe(): Promise<AdminUser> {
  await delay(200);

  const adminId = readMockSession();
  const record = mockAdmins.find((admin) => admin.id === adminId);

  if (!record) {
    throw new ApiError(401, "Sessiya topilmadi. Qaytadan kiring.");
  }

  return toAdminUser(record);
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
  await delay(500);
  requireRole("ADMIN");
  return computeDashboardStats(query);
}

// ---------------------------------------------------------------------------
// Ishtirokchilar (Foydalanuvchilar bo'limi)
// ---------------------------------------------------------------------------

/**
 * Ishtirokchilar ro'yxati: qidiruv, filtr, saralash, sahifalash.
 * @endpoint GET /api/v1/admin/participants?search=&status=&reel=&sort=&order=&page=&pageSize=
 */
export async function getParticipants(query: ParticipantListQuery): Promise<ParticipantListResponse> {
  await delay(350);
  requireRole("ADMIN");
  return listParticipants(query);
}

/**
 * "Ko'rishlarni yangilash" oynasi.
 * @endpoint GET /api/v1/admin/stats/refresh?minViews=&maxViews=&includeNear=
 */
export async function getViewsRefreshPreview(request: ViewsRefreshRequest): Promise<ViewsRefreshPreview> {
  await delay(200);
  requireRole("ADMIN");
  return viewsRefreshPreview(request);
}

/**
 * Oraliqdagi videolarni qayta o'qish (mock — taqlid).
 * @endpoint POST /api/v1/admin/stats/refresh
 */
export async function startViewsRefresh(request: ViewsRefreshRequest): Promise<{ started: boolean; count: number }> {
  await delay(400);
  requireRole("ADMIN");
  return startMockViewsRefresh(request);
}

/**
 * Ishtirokchining barcha yuborgan videolari va natijasi (`bestViews` — eng ko'p ko'rilgan qabul
 * qilingan videosi, ko'rishlar qo'shilmaydi). Tartib: qabul qilinganlar ko'rishlar bo'yicha
 * (birinchisi `best`), keyin tekshiruvdagilar, keyin rad etilganlar.
 * @endpoint GET /api/v1/admin/participants/:id/reels
 * @throws ApiError 404 — ishtirokchi topilmadi
 */
export async function getParticipantReels(id: string): Promise<ParticipantReels> {
  await delay(300);
  requireRole("ADMIN");
  return mockGetParticipantReels(id);
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
  await delay(500);
  return applyParticipantAction(id, "block", request.reason, requireRole("ADMIN"));
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
  await delay(500);
  return applyParticipantAction(id, "unblock", request.reason, requireRole("ADMIN"));
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
  await delay(500);
  return applyParticipantAction(id, "disqualify", request.reason, requireRole("ADMIN"));
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
  await delay(400);
  requireRole("ADMIN");
  return buildDailyRating(query);
}

// ---------------------------------------------------------------------------
// Qo'lda tekshiruv
// ---------------------------------------------------------------------------

/**
 * Apify ketma-ket 3 marta topa olmagan videolar. Ochiqlari navbat bo'yicha (eng eskisi yuqorida).
 * @endpoint GET /api/v1/admin/manual-reviews?status=&search=&page=&pageSize=
 */
export async function getManualReviews(query: ManualReviewListQuery): Promise<ManualReviewListResponse> {
  await delay(350);
  requireRole("ADMIN");
  return listManualReviews(query);
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
  await delay(450);
  return mockDecideManualReview(id, request, requireRole("ADMIN"));
}

// ---------------------------------------------------------------------------
// Target yoqqanlar
// ---------------------------------------------------------------------------

/**
 * Target (pullik reklama) aniqlangan ishtirokchilar ro'yxati, eng yangilari yuqorida.
 * @endpoint GET /api/v1/admin/targets?status=&search=&page=&pageSize=
 */
export async function getTargetCases(query: TargetCaseListQuery): Promise<TargetCaseListResponse> {
  await delay(350);
  requireRole("ADMIN");
  return listTargetCases(query);
}

/**
 * Target holati: dalil, kunlik o'sish va target holati tarixi.
 * @endpoint GET /api/v1/admin/targets/:id
 * @throws ApiError 404 — topilmadi
 */
export async function getTargetCase(id: string): Promise<TargetCaseDetail> {
  await delay(300);
  requireRole("ADMIN");
  return getTargetCaseDetail(id);
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
  await delay(500);
  return applyTargetAction(id, request.action, request.reason, requireRole("ADMIN"));
}

/**
 * Meta reklama kutubxonasi tekshiruvining holati, oxirgi natijasi va keyingi rejadagi kun.
 * Backend reyting yetakchilarini oyiga bir marta o'zi tekshiradi (tanlov boshidan har 30 kunda).
 * @endpoint GET /api/v1/admin/targets/check
 */
export async function getTargetCheckStatus(): Promise<TargetCheckStatus> {
  await delay(250);
  requireRole("ADMIN");
  return mockGetTargetCheckStatus();
}

/**
 * Reklama kutubxonasini hoziroq tekshirish (reytingning yetakchilari, Apify orqali).
 * Tekshiruv tugaguncha javob kutadi (odatda 1–3 daqiqa); yangi topilganlar ro'yxatga qo'shiladi.
 * @endpoint POST /api/v1/admin/targets/check
 */
export async function checkTargetsNow(): Promise<TargetAdsCheckReport> {
  await delay(1500);
  return runTargetCheck(requireRole("ADMIN"));
}

// ---------------------------------------------------------------------------
// Sozlamalar
// ---------------------------------------------------------------------------

/**
 * Tanlov sozlamalari: muddat, ko'rishlar yig'iladigan vaqt, minimal yosh, qoidalar matni.
 * @endpoint GET /api/v1/admin/settings
 */
export async function getContestSettings(): Promise<ContestSettingsResponse> {
  await delay(300);
  requireRole("ADMIN");
  return mockGetContestSettings();
}

/**
 * Sozlamalarni saqlash. Qoidalar matni o'zgarsa, qoidalar versiyasi oshadi.
 * @endpoint PUT /api/v1/admin/settings
 * @throws ApiError 400 — qiymat noto'g'ri (sana, vaqt, yosh, qoidalar matni)
 */
export async function updateContestSettings(
  update: ContestSettingsUpdate,
): Promise<ContestSettingsResponse> {
  await delay(500);
  return mockUpdateContestSettings(update, requireRole("ADMIN"));
}

// ---------------------------------------------------------------------------
// Tanlov qoidalari
// ---------------------------------------------------------------------------

/**
 * Ishtirokchilar Mini App'da ko'radigan qoidalar (bo'limlar ko'rinishida).
 * @endpoint GET /api/v1/admin/rules
 */
export async function getContestRules(): Promise<ContestRules> {
  await delay(300);
  requireRole("ADMIN");
  return mockGetContestRules();
}

/**
 * Qoidalarni saqlash. `requireReconsent` — versiya oshadi va barcha ishtirokchilar
 * Mini App ochilganda yangilangan qoidalarga qaytadan rozilik beradi.
 * @endpoint PUT /api/v1/admin/rules
 * @throws ApiError 400 — bo'limlar soni yoki matn uzunligi noto'g'ri
 */
export async function updateContestRules(update: ContestRulesUpdate): Promise<ContestRules> {
  await delay(500);
  return mockUpdateContestRules(update, requireRole("ADMIN"));
}

// ---------------------------------------------------------------------------
// Random tanlov (oylik voucherlar)
// ---------------------------------------------------------------------------

/**
 * Bosqichlar, oylik sovg'alar va boshlang'ich sozlamalar.
 * @endpoint GET /api/v1/admin/draws/setup
 */
export async function getDrawSetup(): Promise<DrawSetup> {
  await delay(300);
  requireRole("ADMIN");
  return mockGetDrawSetup();
}

/**
 * Sozlamalar bo'yicha nomzodlar: soni, chetda qolganlar sababi, namuna. Hech narsa saqlanmaydi.
 * @endpoint POST /api/v1/admin/draws/preview
 * @throws ApiError 400 — sozlama noto'g'ri
 */
export async function previewDraw(settings: DrawSettings): Promise<DrawPreview> {
  await delay(350);
  requireRole("ADMIN");
  return mockPreviewDraw(settings);
}

/**
 * Random tanlovni o'tkazish: server tasodifiy kalit (seed) yaratadi va nomzodlarni aralashtiradi.
 * Natija qoralama (DRAFT) holatida saqlanadi.
 * @endpoint POST /api/v1/admin/draws
 * @throws ApiError 400 — sozlama noto'g'ri yoki nomzod yo'q; 409 — shu davr uchun tanlov bor
 */
export async function runDraw(settings: DrawSettings): Promise<VoucherDraw> {
  await delay(900);
  return mockRunDraw(settings, requireRole("ADMIN"));
}

/**
 * Kalendardan yangi davr yaratish (masalan, bayram bonusi). Tanlov muddati ichida bo'lishi shart.
 * @endpoint POST /api/v1/admin/draws/periods
 * @throws ApiError 400 — nom yoki sanalar noto'g'ri; 409 — shu sanalar uchun bosqich yoki davr bor
 */
export async function createDrawPeriod(input: DrawPeriodInput): Promise<DrawPeriod> {
  await delay(400);
  return mockCreateDrawPeriod(input, requireRole("ADMIN"));
}

/**
 * Davr nomi yoki sanalarini o'zgartirish. O'tkazilgan tanlovlar o'z sanalarini saqlaydi.
 * @endpoint PUT /api/v1/admin/draws/periods/:periodId
 * @throws ApiError 400; 404 — davr topilmadi; 409 — shu sanalar uchun bosqich yoki davr bor
 */
export async function updateDrawPeriod(id: string, input: DrawPeriodInput): Promise<DrawPeriod> {
  await delay(400);
  return mockUpdateDrawPeriod(id, input, requireRole("ADMIN"));
}

/**
 * Davrni o'chirish. Unda o'tkazilgan tanlovlar o'zgarmaydi.
 * @endpoint DELETE /api/v1/admin/draws/periods/:periodId
 * @throws ApiError 404 — davr topilmadi
 */
export async function deleteDrawPeriod(id: string): Promise<void> {
  await delay(300);
  mockDeleteDrawPeriod(id, requireRole("ADMIN"));
}

/**
 * Bosqichni o'chirish.
 * @endpoint DELETE /api/v1/admin/draws/stages/:index
 */
export async function deleteDrawStage(index: number): Promise<void> {
  await delay(300);
  mockDeleteDrawStage(index, requireRole("ADMIN"));
}

/**
 * O'chirilgan bosqichni tiklash.
 * @endpoint POST /api/v1/admin/draws/stages/:index/restore
 */
export async function restoreDrawStage(index: number): Promise<void> {
  await delay(300);
  mockRestoreDrawStage(index, requireRole("ADMIN"));
}

/**
 * Oylik voucherlar qoldig'i: aksiya davomida jami, yuborilgan, tasdiqlangan, qoralamada va qolgani
 * (bosqichlar bo'yicha ham). Bekor qilingan tanlovlar hisobga olinmaydi.
 * @endpoint GET /api/v1/admin/draws/stock
 */
export async function getDrawStock(): Promise<DrawStock[]> {
  await delay(200);
  requireRole("ADMIN");
  return mockGetDrawStock();
}

/**
 * O'tkazilgan tanlovlar, eng yangisi yuqorida.
 * @endpoint GET /api/v1/admin/draws
 */
export async function getDraws(): Promise<VoucherDrawSummary[]> {
  await delay(250);
  requireRole("ADMIN");
  return listDraws();
}

/**
 * Tanlov natijasi: g'oliblar, zaxira, yuborish holati.
 * @endpoint GET /api/v1/admin/draws/:id
 * @throws ApiError 404
 */
export async function getDraw(id: string): Promise<VoucherDraw> {
  await delay(300);
  requireRole("ADMIN");
  return mockGetDraw(id);
}

/**
 * G'olibni chetlatish: o'rniga navbatdagi zaxira g'olib bo'ladi. Sabab audit logga yoziladi.
 * @endpoint POST /api/v1/admin/draws/:id/replace
 * @throws ApiError 400 | 404; 409 — zaxira qolmagan yoki tanlov bekor qilingan
 */
export async function replaceDrawWinner(id: string, request: DrawReplaceRequest): Promise<VoucherDraw> {
  await delay(400);
  return mockReplaceDrawWinner(id, request, requireRole("ADMIN"));
}

/**
 * Natijani tasdiqlash (shundan keyin g'oliblarga yuborish mumkin).
 * @endpoint POST /api/v1/admin/draws/:id/confirm
 * @throws ApiError 404 | 409
 */
export async function confirmDraw(id: string): Promise<VoucherDraw> {
  await delay(400);
  return mockConfirmDraw(id, requireRole("ADMIN"));
}

/**
 * Tanlovni bekor qilish (xabar yuborilmagan bo'lsa). Shu davr uchun yangi tanlov o'tkazish mumkin bo'ladi.
 * @endpoint POST /api/v1/admin/draws/:id/cancel
 * @throws ApiError 400 | 404 | 409
 */
export async function cancelDraw(id: string, request: DrawCancelRequest): Promise<VoucherDraw> {
  await delay(400);
  return mockCancelDraw(id, request, requireRole("ADMIN"));
}

/**
 * Faol g'oliblarga Telegram bot orqali xabar (hali yuborilmagan va xato bo'lganlarga).
 * @endpoint POST /api/v1/admin/draws/:id/send
 * @throws ApiError 404; 409 — tasdiqlanmagan yoki yuboriladigan xabar yo'q
 */
export async function sendDraw(id: string): Promise<VoucherDraw> {
  await delay(1200);
  return mockSendDraw(id, requireRole("ADMIN"));
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

/**
 * Admin va Support harakatlari (faqat o'qish), eng yangilari yuqorida.
 * @endpoint GET /api/v1/admin/audit-log?search=&entity=&actorRole=&page=&pageSize=
 */
export async function getAuditLog(query: AuditLogQuery): Promise<AuditLogResponse> {
  await delay(350);
  requireRole("ADMIN");
  return listAuditLog(query);
}

// ---------------------------------------------------------------------------
// G'olib
// ---------------------------------------------------------------------------

/**
 * G'olib bo'limi: tanlov holati, nomzod va tekshiruv ro'yxati, zaxira nomzodlar.
 * @endpoint GET /api/v1/admin/winner
 */
export async function getWinnerOverview(): Promise<WinnerOverview> {
  await delay(400);
  requireRole("ADMIN");
  return mockGetWinnerOverview();
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
  await delay(400);
  return setManualCheck(request, requireRole("ADMIN"));
}

/**
 * Nomzodni rad etish — keyingi o'rindagi ishtirokchi nomzod bo'ladi.
 * @endpoint POST /api/v1/admin/winner/skip
 * @throws ApiError 400 — sabab yo'q; 409 — tanlov tugamagan yoki nomzod o'zgargan
 */
export async function skipWinnerCandidate(request: WinnerSkipRequest): Promise<WinnerOverview> {
  await delay(500);
  return skipCandidate(request, requireRole("ADMIN"));
}

/**
 * G'olibni tasdiqlash (barcha tekshiruvlar o'tgan bo'lishi shart).
 * @endpoint POST /api/v1/admin/winner/confirm
 * @throws ApiError 409 — tanlov tugamagan, tekshiruv o'tmagan yoki nomzod o'zgargan
 */
export async function confirmWinner(participantId: string): Promise<WinnerOverview> {
  await delay(500);
  return mockConfirmWinner(participantId, requireRole("ADMIN"));
}

/**
 * Tasdiqni bekor qilish (faqat e'lon qilinmagan bo'lsa).
 * @endpoint DELETE /api/v1/admin/winner/confirm
 */
export async function cancelWinnerConfirmation(): Promise<WinnerOverview> {
  await delay(400);
  return mockCancelWinnerConfirmation(requireRole("ADMIN"));
}

/**
 * G'olibni e'lon qilish: ilovada "G'olib e'loni" ekrani ochiladi. Qaytarilmaydi.
 * @endpoint POST /api/v1/admin/winner/announce
 * @throws ApiError 409 — g'olib tasdiqlanmagan
 */
export async function announceWinner(): Promise<WinnerOverview> {
  await delay(600);
  return mockAnnounceWinner(requireRole("ADMIN"));
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
  await delay(350);
  requireRole("ADMIN");
  return listTelegramMessages(query);
}

/**
 * Bitta xabarni qayta yuborish (o'qilmagan yoki vaqtinchalik xato bo'lgan).
 * @endpoint POST /api/v1/admin/telegram/messages/:id/resend
 * @throws ApiError 404; 409 — qayta yuborib bo'lmaydi (masalan, bot bloklangan)
 */
export async function resendTelegramMessage(id: string): Promise<TelegramMessageListItem> {
  await delay(400);
  return mockResendTelegramMessage(id, requireRole("ADMIN"));
}

/**
 * O'qilmaganlarning hammasiga qayta yuborish (joriy tur va qidiruv filtri bo'yicha).
 * @endpoint POST /api/v1/admin/telegram/messages/resend-unread
 */
export async function resendUnreadTelegram(
  request: TelegramResendUnreadRequest,
): Promise<{ resent: number }> {
  await delay(600);
  return resendUnreadTelegramMessages(request, requireRole("ADMIN"));
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
  await delay(350);
  requireRole("ADMIN", "SUPPORT");
  return listSupportTickets(query);
}

/**
 * Murojaat va uning to'liq yozishmasi.
 * @endpoint GET /api/v1/admin/support/tickets/:id
 * @throws ApiError 404 — topilmadi
 */
export async function getSupportTicket(id: string): Promise<SupportTicketDetail> {
  await delay(300);
  requireRole("ADMIN", "SUPPORT");
  return getSupportTicketDetail(id);
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
  await delay(500);
  return addSupportReply(id, request.text, requireRole("ADMIN", "SUPPORT"));
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
  await delay(400);
  return setSupportTicketStatus(id, request.status, requireRole("ADMIN", "SUPPORT"));
}
