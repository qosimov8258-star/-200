/**
 * Ega (tashkilot egasi) — yashirin bo'lim: API kontrakti.
 *
 * Admin panelda Olivia logotipi 7 marta bosilganda `/owner` sahifasi ochiladi. U alohida
 * login/parol bilan himoyalangan (`OWNER_USERS`), sessiya — `reels_owner` cookie'si
 * (`Path=/api/v1/owner`, HttpOnly, SameSite=Strict, 2 soat). Oddiy admin sessiyasi bu
 * endpointlarga kira olmaydi.
 *
 * Ega amallari audit log'ga YOZILMAYDI (egalar qarori bilan — maxfiy bo'lim). Ko'rishlarni
 * qo'lda o'zgartiruvchi endpoint bu yerda ham yo'q — ularni faqat worker yozadi.
 *
 * Backend: `apps/backend/src/owner/`. Barcha manzillar `/api/v1` prefiksi bilan.
 * Xato javobi — `{ message }` (o'zbekcha).
 */
import type { IsoDate, Paginated, TargetCaseStatus } from "./types";

// ---------------------------------------------------------------------------
// Kirish
//   POST /api/v1/owner/auth/login   { login, password } → OwnerUser (+ cookie); 401, 429
//   POST /api/v1/owner/auth/logout  → 204 (cookie o'chiriladi)
//   GET  /api/v1/owner/auth/me      → OwnerUser; 401 — sessiya yo'q
// ---------------------------------------------------------------------------

export interface OwnerUser {
  id: string;
  login: string;
  fullName: string;
}

export interface OwnerLoginRequest {
  login: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Ishtirokchilar
//   GET    /api/v1/owner/participants?search=&status=&page=&pageSize=  → OwnerParticipantListResponse
//   PATCH  /api/v1/owner/participants/:id   OwnerParticipantUpdate      → OwnerParticipant
//          400 — noma'lum maydon / bo'sh body; 404; 409 — telefon boshqa ishtirokchida; 422 — qiymat noto'g'ri
//   DELETE /api/v1/owner/participants/:id   → 204 (ishtirokchi va uning videosi butunlay o'chadi)
// ---------------------------------------------------------------------------

export type OwnerParticipantStatus = "ACTIVE" | "BLOCKED" | "DISQUALIFIED";

/** Ro'yxat filtri: holat yoki "INCOMPLETE" — ro'yxatdan to'liq o'tmaganlar (ism yo'q). */
export type OwnerParticipantFilter = OwnerParticipantStatus | "INCOMPLETE";

/** Backenddagi video holati (admin bo'limidan farqli — MANUAL_REVIEW alohida ko'rinadi). */
export type OwnerReelStatus = "PENDING" | "ACCEPTED" | "MANUAL_REVIEW" | "REJECTED";

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export interface OwnerParticipantListQuery {
  /** Ism, familiya, telefon, @instagram yoki Telegram ID bo'yicha. */
  search?: string;
  status?: OwnerParticipantFilter;
  page?: number;
  /** Standart 25, ko'pi bilan 100. */
  pageSize?: number;
}

export interface OwnerParticipant {
  /** `String(telegramId)`. */
  id: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  /** "+998901234567"; raqam ulashilmagan bo'lsa — null. */
  phone: string | null;
  status: OwnerParticipantStatus;
  /** Ism kiritilgan va joriy qoidalarga rozilik berilgan. */
  profileComplete: boolean;
  /** Botga birinchi kirgan vaqt (ISO). */
  registeredAt: string;
  instagramUsername: string | null;
  /** Asosiy video: eng ko'p ko'rishli qabul qilingani (bo'lmasa — oxirgi yuborilgani). */
  reel: { url: string; status: OwnerReelStatus; submittedAt: string } | null;
  /** Rad etilmagan videolar soni (cheksiz video). */
  reelCount: number;
  /**
   * Eng ko'p ko'rilgan qabul qilingan videosining oxirgi yig'ilgan ko'rishlari (videolar ko'rishlari
   * qo'shilmaydi); qabul qilingan video yo'q — 0.
   */
  views: number;
  /** Joriy reytingdagi o'rni; reytingda yo'q — null. */
  rank: number | null;
  /** Ochiq (NEW yoki WARNED) target holatlari. */
  openTargetCases: number;
  /** Xavf darajasi (pastdagi qoidalar bo'yicha); belgi yo'q — null. */
  riskLevel: RiskLevel | null;
}

export interface OwnerParticipantListResponse extends Paginated<OwnerParticipant> {
  /** Qidiruv hisobga olingan, holat filtri — yo'q. "ALL" — hammasi (to'liq o'tmaganlar ham). */
  counts: Record<OwnerParticipantFilter | "ALL", number>;
}

/**
 * Faqat berilgan maydonlar o'zgaradi (kamida bittasi). Ism/familiya — 2–40 belgi, yosh — 14–100,
 * telefon — "+998…" ko'rinishida (raqamlar normallashtiriladi), boshqa ishtirokchida bo'lmasin.
 * Holat: ACTIVE ↔ BLOCKED ↔ DISQUALIFIED — istalgan tomonga (chetlatishni bekor qilish ham).
 */
export interface OwnerParticipantUpdate {
  firstName?: string;
  lastName?: string;
  age?: number;
  phone?: string;
  status?: OwnerParticipantStatus;
}

// ---------------------------------------------------------------------------
// Target holatlari — istalgan holatga (admin bo'limidagi cheklovlarsiz, qaytarish ham mumkin)
//   GET   /api/v1/owner/targets?status=&search=&page=&pageSize=  → TargetCaseListResponse (./types)
//         `status` — TargetStatusFilter; berilmasa — hammasi (yopilganlari ham)
//   PATCH /api/v1/owner/targets/:id  { status, note? }  → TargetCaseListItem (./types)
//         DISQUALIFIED ga o'tsa — ishtirokchi ham DISQUALIFIED; DISQUALIFIED dan chiqsa va boshqa
//         DISQUALIFIED holati bo'lmasa — ishtirokchi ACTIVE ga qaytadi. Bot xabari yuborilmaydi.
// ---------------------------------------------------------------------------

export interface OwnerTargetUpdate {
  status: TargetCaseStatus;
  /** Holat tarixiga yoziladigan izoh (ixtiyoriy, 300 belgigacha). */
  note?: string;
}

// ---------------------------------------------------------------------------
// Xavfga yaqin hisoblar
//   GET  /api/v1/owner/risk?level=&includeSafe=&search=&page=&pageSize=  → RiskListResponse
//   POST /api/v1/owner/risk/:id/review  { verdict: "SAFE" | "WATCH" | null }  → RiskAccount
//        null — belgini olib tashlash
//
// Ball (backend va mock bir xil hisoblaydi), har bir signal bir marta:
//   ENGAGEMENT_GAP 40 · VIEW_SPIKE 35 · LOW_ENGAGEMENT 25 · VIEW_DROP 20  (videodagi nakrutka belgilari)
//   TARGET 40 (ochiq target holati; WARNED bo'lsa +10)
//   REPORTS 10 × shikoyatlar soni, ko'pi bilan 30
//   MANUAL_REVIEW 15 (video qo'lda tekshiruvda)  ·  NOT_FOUND 10 (oxirgi tekshiruvlarda topilmagan)
// Daraja: ≥ 60 — HIGH, ≥ 30 — MEDIUM, > 0 — LOW; 0 — ro'yxatda yo'q.
// Faqat ACTIVE va BLOCKED ishtirokchilar (DISQUALIFIED — allaqachon chetlatilgan, ko'rsatilmaydi).
// "SAFE" belgilanganlar ro'yxatdan yashiriladi (`includeSafe=true` bo'lsa ko'rinadi), lekin
// belgidan KEYIN yangi signal paydo bo'lsa (`signal.at` > `review.at`) — yana ko'rinadi.
// Tartib: ball bo'yicha kamayish, teng bo'lsa — ko'rishlar bo'yicha kamayish.
// ---------------------------------------------------------------------------

export type RiskSignalKind =
  | "ENGAGEMENT_GAP"
  | "VIEW_SPIKE"
  | "LOW_ENGAGEMENT"
  | "VIEW_DROP"
  | "TARGET"
  | "REPORTS"
  | "MANUAL_REVIEW"
  | "NOT_FOUND";

export interface RiskSignal {
  kind: RiskSignalKind;
  /** Odam o'qiydigan izoh, masalan "+48 000 ko'rish, +12 layk" yoki "2 ta shikoyat". */
  detail: string;
  /** Signal kuni (tanlov kuni); noma'lum — null. */
  at: IsoDate | null;
  points: number;
}

export type RiskVerdict = "SAFE" | "WATCH";

export interface RiskAccount {
  participant: OwnerParticipant;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  /** Ega belgisi: SAFE — tekshirildi, xavfsiz; WATCH — kuzatuvda. */
  review: { verdict: RiskVerdict; at: string; by: string } | null;
}

export interface RiskListQuery {
  level?: RiskLevel;
  includeSafe?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface RiskListResponse extends Paginated<RiskAccount> {
  /** Qidiruv hisobga olingan, daraja filtri — yo'q. SAFE — yashirilganlar soni. */
  counts: Record<RiskLevel | "ALL" | "SAFE", number>;
}
