/**
 * Admin panelning YAGONA API qatlami — komponentlar faqat shu fayldan import qiladi
 * va backendga to'g'ridan-to'g'ri `fetch` qilmaydi.
 *
 * Ikki implementatsiyadan biri tanlanadi:
 *   - `./api.http.ts` — haqiqiy backend (`/api/v1/...`, `HttpOnly` cookie sessiyasi);
 *   - `./api.mock.ts` — soxta ma'lumotlar (`./mock/`), backendsiz lokal ishlash uchun.
 *
 * Rejim `NEXT_PUBLIC_API_MODE` (`http` | `mock`) bilan beriladi; berilmasa — production
 * build'da `http`, dev'da `mock`. Qiymat build vaqtida kodga yoziladi.
 *
 * Kontrakt: funksiyalar nomi va imzosi ikkala faylda bir xil (buni pastdagi `impl` tipi
 * tekshiradi), har bir funksiyaning JSDoc idagi `@endpoint` — backenddagi manzil,
 * tiplar `./types.ts` da, xatolar `./api-error.ts` dagi `ApiError` bilan.
 */
import * as http from "./api.http";
import * as mock from "./api.mock";
import type { MockControls } from "./api.mock";

export type { MockControls } from "./api.mock";

/** Qaysi implementatsiya ishlatiladi. */
export type ApiMode = "http" | "mock";

// `next.config.ts` `NEXT_PUBLIC_API_MODE` ni har doim build vaqtida kodga yozadi — ifoda
// o'zgarmasga aylanadi va keraksiz implementatsiya bundle'dan tushib qoladi (prod build'da
// mock ma'lumotlar va mock parollar bo'lmaydi).
const mode = process.env.NEXT_PUBLIC_API_MODE ?? (process.env.NODE_ENV === "production" ? "http" : "mock");

export const API_MODE: ApiMode = mode === "mock" ? "mock" : "http";

/** Mock implementatsiya ham haqiqiysi bilan bir xil tipda bo'lishi shart (TS tekshiradi). */
const impl: typeof http = API_MODE === "mock" ? mock : http;

/** Mock rejim belgisi (login sahifasida yo'riqnoma ko'rsatish uchun). */
export const IS_MOCK_API: boolean = API_MODE === "mock";

/** Faqat mock rejimdagi sinov boshqaruvlari (UI ularni faqat `null` bo'lmasa ko'rsatadi). */
export const mockControls: MockControls | null = API_MODE === "mock" ? mock.mockControls : null;

// Auth
export const login = impl.login;
export const logout = impl.logout;
export const getMe = impl.getMe;

// Dashboard
export const getDashboardStats = impl.getDashboardStats;

// Ishtirokchilar
export const getParticipants = impl.getParticipants;
export const getViewsRefreshPreview = impl.getViewsRefreshPreview;
export const startViewsRefresh = impl.startViewsRefresh;
export const getParticipantReels = impl.getParticipantReels;
export const blockParticipant = impl.blockParticipant;
export const unblockParticipant = impl.unblockParticipant;
export const disqualifyParticipant = impl.disqualifyParticipant;

// Reyting
export const getDailyRating = impl.getDailyRating;

// Qo'lda tekshiruv
export const getManualReviews = impl.getManualReviews;
export const decideManualReview = impl.decideManualReview;

// Istoriyalar
export const getStories = impl.getStories;
export const removeStory = impl.removeStory;
export const storyVideoUrl = impl.storyVideoUrl;

// Target yoqqanlar
export const getTargetCases = impl.getTargetCases;
export const getTargetCase = impl.getTargetCase;
export const resolveTargetCase = impl.resolveTargetCase;
export const getTargetCheckStatus = impl.getTargetCheckStatus;
export const checkTargetsNow = impl.checkTargetsNow;

// Sozlamalar va qoidalar
export const getContestSettings = impl.getContestSettings;
export const updateContestSettings = impl.updateContestSettings;
export const getContestRules = impl.getContestRules;
export const updateContestRules = impl.updateContestRules;

// Random tanlov
export const getDrawSetup = impl.getDrawSetup;
export const previewDraw = impl.previewDraw;
export const runDraw = impl.runDraw;
export const createDrawPeriod = impl.createDrawPeriod;
export const updateDrawPeriod = impl.updateDrawPeriod;
export const deleteDrawPeriod = impl.deleteDrawPeriod;
export const deleteDrawStage = impl.deleteDrawStage;
export const restoreDrawStage = impl.restoreDrawStage;
export const getDrawStock = impl.getDrawStock;
export const getDraws = impl.getDraws;
export const getDraw = impl.getDraw;
export const replaceDrawWinner = impl.replaceDrawWinner;
export const confirmDraw = impl.confirmDraw;
export const cancelDraw = impl.cancelDraw;
export const sendDraw = impl.sendDraw;

// Audit log
export const getAuditLog = impl.getAuditLog;

// G'olib
export const getWinnerOverview = impl.getWinnerOverview;
export const setWinnerManualCheck = impl.setWinnerManualCheck;
export const skipWinnerCandidate = impl.skipWinnerCandidate;
export const confirmWinner = impl.confirmWinner;
export const cancelWinnerConfirmation = impl.cancelWinnerConfirmation;
export const announceWinner = impl.announceWinner;

// Telegram
export const getTelegramMessages = impl.getTelegramMessages;
export const resendTelegramMessage = impl.resendTelegramMessage;
export const resendUnreadTelegram = impl.resendUnreadTelegram;

// Support
export const getSupportTickets = impl.getSupportTickets;
export const getSupportTicket = impl.getSupportTicket;
export const replyToSupportTicket = impl.replyToSupportTicket;
export const updateSupportTicketStatus = impl.updateSupportTicketStatus;
