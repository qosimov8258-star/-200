/**
 * Admin panelning YAGONA API qatlami.
 *
 * HOZIR: backend tayyor emas — barcha funksiyalar mock (soxta) ma'lumot
 * qaytaradi (`./mock/` papkasi) va tarmoq kechikishini taqlid qiladi.
 *
 * KEYIN: backend tayyor bo'lganda faqat shu fayl almashtiriladi:
 *   - eksport qilingan funksiyalar nomi va imzosi saqlanadi;
 *   - tiplar `./types.ts` da, xatolar `./api-error.ts` dagi `ApiError` bilan;
 *   - har bir funksiyaning JSDoc idagi `@endpoint` — backenddagi manzil;
 *   - `IS_MOCK_API` false, `mockControls` null qilinadi, `./mock/` papkasi o'chiriladi.
 *
 * Komponentlar backendga to'g'ridan-to'g'ri `fetch` qilmaydi — faqat shu fayl orqali.
 */
import { ApiError } from "./api-error";
import { listAuditLog, recordAudit } from "./mock/audit";
import { buildDailyRating } from "./mock/daily-rating";
import { computeDashboardStats } from "./mock/dashboard";
import { mockAdmins } from "./mock/db";
import { applyParticipantAction, listParticipants } from "./mock/participants";
import {
  createPrize as mockCreatePrize,
  deletePrize as mockDeletePrize,
  listPrizes,
  movePrize as mockMovePrize,
  updatePrize as mockUpdatePrize,
  uploadPrizeImage as mockUploadPrizeImage,
} from "./mock/prizes";
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
import { applyTargetAction, getTargetCaseDetail, listTargetCases } from "./mock/targets";
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
  setPurchaseCheck,
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
  LoginRequest,
  ParticipantActionRequest,
  ParticipantListItem,
  ParticipantListQuery,
  ParticipantListResponse,
  Prize,
  PrizeImageUpload,
  PrizeInput,
  PrizeMoveRequest,
  SupportReplyRequest,
  SupportStatusRequest,
  SupportTicketDetail,
  SupportTicketListQuery,
  SupportTicketListResponse,
  TargetActionRequest,
  TargetCaseDetail,
  TargetCaseListQuery,
  TargetCaseListResponse,
  TelegramMessageListItem,
  TelegramMessageListQuery,
  TelegramMessageListResponse,
  TelegramResendUnreadRequest,
  WinnerOverview,
  WinnerPurchaseCheckRequest,
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
// Sovg'alar (ilova va Telegram botda shu ro'yxat, shu tartibda ko'rsatiladi)
// ---------------------------------------------------------------------------

/**
 * Aksiya sovg'alari, ko'rsatish tartibi bo'yicha.
 * @endpoint GET /api/v1/admin/prizes
 */
export async function getPrizes(): Promise<Prize[]> {
  await delay(300);
  requireRole("ADMIN");
  return listPrizes();
}

/**
 * Sovg'a rasmini yuklash (oldin brauzerda kichraytiriladi — `lib/image.ts`).
 * Qaytgan `url` sovg'ani saqlashda `imageUrl` ga yoziladi.
 * @endpoint POST /api/v1/admin/uploads/prize-image (multipart/form-data, maydon: `file`)
 * @throws ApiError 400 — rasm turi noto'g'ri; 413 — hajmi katta
 */
export async function uploadPrizeImage(file: Blob): Promise<PrizeImageUpload> {
  await delay(500);
  requireRole("ADMIN");
  return mockUploadPrizeImage(file);
}

/**
 * Yangi sovg'a qo'shish (ro'yxat oxiriga).
 * @endpoint POST /api/v1/admin/prizes
 * @throws ApiError 400 — maydon noto'g'ri (nom, soni, ko'rishlar oralig'i)
 */
export async function createPrize(input: PrizeInput): Promise<Prize> {
  await delay(500);
  return mockCreatePrize(input, requireRole("ADMIN"));
}

/**
 * Sovg'ani tahrirlash.
 * @endpoint PUT /api/v1/admin/prizes/:id
 * @throws ApiError 400 | 404
 */
export async function updatePrize(id: string, input: PrizeInput): Promise<Prize> {
  await delay(500);
  return mockUpdatePrize(id, input, requireRole("ADMIN"));
}

/**
 * Sovg'ani o'chirish.
 * @endpoint DELETE /api/v1/admin/prizes/:id
 * @throws ApiError 404
 */
export async function deletePrize(id: string): Promise<void> {
  await delay(400);
  mockDeletePrize(id, requireRole("ADMIN"));
}

/**
 * Sovg'ani o'z turi (asosiy/oylik) ichida yuqoriga yoki pastga surish.
 * @endpoint POST /api/v1/admin/prizes/:id/move
 * @throws ApiError 404; 409 — allaqachon eng yuqorida/pastda
 */
export async function movePrize(id: string, request: PrizeMoveRequest): Promise<Prize[]> {
  await delay(250);
  return mockMovePrize(id, request.direction, requireRole("ADMIN"));
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
 * Mahsulot xaridini qo'lda tekshirish natijasi (chek, buyurtma raqami — PLAN.md Q4).
 * @endpoint PUT /api/v1/admin/winner/purchase-check
 * @throws ApiError 400 — izoh yo'q; 404; 409 — g'olib e'lon qilingan
 */
export async function setWinnerPurchaseCheck(
  request: WinnerPurchaseCheckRequest,
): Promise<WinnerOverview> {
  await delay(400);
  return setPurchaseCheck(request, requireRole("ADMIN"));
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
