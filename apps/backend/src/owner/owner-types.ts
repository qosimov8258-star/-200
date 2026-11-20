/**
 * Ega bo'limi API tiplari — `apps/admin/src/lib/owner-types.ts` (kontrakt) bilan bir xil.
 * Kontrakt o'zgarsa — shu fayl ham yangilanadi.
 */
import type { ReelStatus } from "../participants/participants.service";
import type { TargetCaseStatus } from "../targets/targets.service";

export type { OwnerUser } from "./auth/owner-accounts";

export type OwnerParticipantStatus = "ACTIVE" | "BLOCKED" | "DISQUALIFIED";
/** Ro'yxat filtri: holat yoki "INCOMPLETE" — ro'yxatdan to'liq o'tmaganlar (ism yo'q). */
export type OwnerParticipantFilter = OwnerParticipantStatus | "INCOMPLETE";
export type OwnerReelStatus = ReelStatus;
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export const OWNER_PARTICIPANT_STATUSES: readonly OwnerParticipantStatus[] = ["ACTIVE", "BLOCKED", "DISQUALIFIED"];
export const OWNER_PARTICIPANT_FILTERS: readonly OwnerParticipantFilter[] = [...OWNER_PARTICIPANT_STATUSES, "INCOMPLETE"];
export const RISK_LEVELS: readonly RiskLevel[] = ["HIGH", "MEDIUM", "LOW"];
export const TARGET_CASE_STATUSES: readonly TargetCaseStatus[] = ["NEW", "WARNED", "DISQUALIFIED", "DISMISSED"];

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OwnerParticipant {
  /** `String(telegramId)`. */
  id: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  phone: string | null;
  status: OwnerParticipantStatus;
  /** Ism kiritilgan va joriy qoidalarga rozilik berilgan. */
  profileComplete: boolean;
  /** Botga birinchi kirgan vaqt (ISO). */
  registeredAt: string;
  instagramUsername: string | null;
  reel: { url: string; status: OwnerReelStatus; submittedAt: string } | null;
  views: number;
  rank: number | null;
  /** Ochiq (NEW yoki WARNED) target holatlari. */
  openTargetCases: number;
  riskLevel: RiskLevel | null;
}

export interface OwnerParticipantListResponse extends Paginated<OwnerParticipant> {
  counts: Record<OwnerParticipantFilter | "ALL", number>;
}

/** Faqat berilgan maydonlar o'zgaradi (kamida bittasi). */
export interface OwnerParticipantUpdate {
  firstName?: string;
  lastName?: string;
  age?: number;
  phone?: string;
  status?: OwnerParticipantStatus;
}

export interface OwnerTargetUpdate {
  status: TargetCaseStatus;
  note?: string;
}

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
  detail: string;
  /** Signal kuni (tanlov kuni, "YYYY-MM-DD"); noma'lum — null. */
  at: string | null;
  points: number;
}

export type RiskVerdict = "SAFE" | "WATCH";

export interface RiskReview {
  verdict: RiskVerdict;
  /** ISO vaqt. */
  at: string;
  /** Belgilagan egasi (ism-familiya). */
  by: string;
}

export interface RiskAccount {
  participant: OwnerParticipant;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  review: RiskReview | null;
}

export interface RiskListResponse extends Paginated<RiskAccount> {
  counts: Record<RiskLevel | "ALL" | "SAFE", number>;
}
