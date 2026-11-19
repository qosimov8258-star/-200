/**
 * MOCK backend "bazasi"ning o'zgaradigan qismi: admin amallari natijasi
 * (ishtirokchi holati, murojaat holati va javoblar) va audit log. Sahifa
 * yangilanganda yo'qolmasligi uchun brauzer `localStorage` ida saqlanadi.
 *
 * Haqiqiy backendda bular `users.status`, `support_tickets`,
 * `support_messages` va `audit_logs` jadvallari bo'ladi.
 */
import type {
  AuditEntity,
  ContestRules,
  ContestSettingsUpdate,
  ManualReviewRejectReason,
  ParticipantStatus,
  Prize,
  SupportTicketStatus,
  DrawPeriod,
  VoucherDraw,
  TargetAdsCheckReport,
  TargetCaseStatus,
} from "../types";
import type { MockSupportMessage } from "./contest";

const STORE_KEY = "reels-admin:mock-store";
const STORE_VERSION = 1;

export interface MockAuditEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  before: string;
  after: string;
  reason: string;
}

export interface MockStore {
  version: number;
  /** Ishtirokchi id -> admin o'rnatgan holat. */
  statusOverrides: Record<string, ParticipantStatus>;
  /** Murojaat id -> xodim o'rnatgan holat. */
  ticketStatus: Record<string, SupportTicketStatus>;
  /** Murojaat id -> holat oxirgi marta o'zgargan vaqt. */
  ticketStatusChangedAt: Record<string, string>;
  /** Murojaat id -> xodimlar yozgan javoblar. */
  ticketReplies: Record<string, MockSupportMessage[]>;
  /** Target holati id -> admin qarori. */
  targetCaseStatus: Record<string, TargetCaseStatus>;
  /** Qo'lda tekshiruv (Reel shortcode) -> admin qarori. */
  manualReviews: Record<string, MockManualDecision>;
  /** Oxirgi reklama kutubxonasi tekshiruvi; null — hali tekshirilmagan. */
  targetCheck: TargetAdsCheckReport | null;
  /** Telegram xabari id -> qayta yuborishlar. */
  telegramResends: Record<string, { attempts: number; lastSentAt: string }>;
  winner: MockWinnerState;
  /** Admin o'zgartirgan sozlamalar; null — boshlang'ich qiymatlar. */
  settings: MockSettingsOverride | null;
  /** Admin tahrirlagan tanlov qoidalari; null — boshlang'ich matn. */
  rules: ContestRules | null;
  /** Admin o'zgartirgan sovg'alar ro'yxati; null — boshlang'ich ro'yxat (`prizes.ts`). */
  prizes: Prize[] | null;
  /** Oylik voucherlar uchun o'tkazilgan random tanlovlar. */
  draws: VoucherDraw[];
  /** Admin kalendardan yaratgan davrlar (Random tanlov). */
  drawPeriods: DrawPeriod[];
  audit: MockAuditEntry[];
}

export interface MockManualDecision {
  approved: boolean;
  reason: ManualReviewRejectReason | null;
  note: string;
  at: string;
  by: string;
}

export interface MockSettingsOverride extends ContestSettingsUpdate {
  updatedAt: string;
  updatedBy: string;
}

export interface MockManualCheck {
  passed: boolean;
  note: string;
  at: string;
  by: string;
}

export interface MockWinnerState {
  /** Faqat mock: tanlovni tugagan deb hisoblash (oqimni sinash uchun). */
  contestEnded: boolean;
  /** Ishtirokchi id -> mahsulot xaridi tekshiruvi. */
  purchaseChecks: Record<string, MockManualCheck>;
  /**
   * Ishtirokchi id -> yuzma-yuz uchrashuvda Instagram "Reklama vositalari" ko'rildi.
   * Keyin qo'shilgan — eski yozuvlarda bo'lmasligi mumkin.
   */
  adToolsChecks?: Record<string, MockManualCheck>;
  skipped: Array<{ participantId: string; reason: string; at: string; by: string }>;
  confirmed: { participantId: string; at: string; by: string } | null;
  announced: { at: string; by: string } | null;
}

/** `localStorage` yopiq bo'lsa (private rejim) — sahifa ochiq turganda shu nusxa ishlaydi. */
let memoryStore: MockStore | null = null;

function emptyStore(): MockStore {
  return {
    version: STORE_VERSION,
    statusOverrides: {},
    ticketStatus: {},
    ticketStatusChangedAt: {},
    ticketReplies: {},
    targetCaseStatus: {},
    manualReviews: {},
    targetCheck: null,
    telegramResends: {},
    winner: {
      contestEnded: false,
      purchaseChecks: {},
      adToolsChecks: {},
      skipped: [],
      confirmed: null,
      announced: null,
    },
    settings: null,
    rules: null,
    prizes: null,
    draws: [],
    drawPeriods: [],
    audit: [],
  };
}

export function readStore(): MockStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return memoryStore ?? emptyStore();
    const parsed = JSON.parse(raw) as Partial<MockStore>;
    if (parsed.version !== STORE_VERSION) return emptyStore();
    // Keyin qo'shilgan maydonlar eski yozuvlarda bo'lmasligi mumkin.
    return { ...emptyStore(), ...parsed, version: STORE_VERSION };
  } catch {
    return memoryStore ?? emptyStore();
  }
}

export function writeStore(store: MockStore): void {
  memoryStore = store;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Xotira yopiq — o'zgarish faqat `memoryStore` da, sahifa yangilanguncha qoladi.
  }
}

/**
 * Brauzer xotirasi (`localStorage`) odatda ~5 MB. Rasmlar ham shu yerda saqlangani uchun
 * yozishdan oldin hajm tekshiriladi — aks holda o'zgarish jimgina yo'qolardi.
 */
const MAX_STORE_CHARS = 4_500_000;

export function storeFits(store: MockStore): boolean {
  return JSON.stringify(store).length <= MAX_STORE_CHARS;
}

/** Audit yozuvi uchun noyob id. */
export function auditId(): string {
  return `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
