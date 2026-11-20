import { contestDay } from "../common/time";
import type { ManualReview, ReelFlagType, ReelStatus } from "../participants/participants.service";
import type { TargetCaseStatus } from "../targets/targets.service";
import type { RiskLevel, RiskReview, RiskSignal, RiskSignalKind } from "./owner-types";

/**
 * Xavfga yaqin hisoblar — ball hisobi (sof funksiyalar). Qoidalar kontraktda
 * (`apps/admin/src/lib/owner-types.ts` → "Xavfga yaqin hisoblar"); admin paneldagi mock ham
 * aynan shunday hisoblaydi. Har bir signal turi bir marta hisoblanadi.
 *
 * Ball faqat egaga ko'rsatish uchun — hech kimni avtomatik jazolamaydi.
 */
export const RISK_POINTS = {
  ENGAGEMENT_GAP: 40,
  VIEW_SPIKE: 35,
  LOW_ENGAGEMENT: 25,
  VIEW_DROP: 20,
  /** Ochiq (NEW yoki WARNED) target holati. */
  TARGET: 40,
  /** Ochiq holatlardan biri WARNED bo'lsa — qo'shimcha. */
  TARGET_WARNED_BONUS: 10,
  /** Har bir shikoyat uchun, ko'pi bilan `REPORTS_MAX`. */
  REPORT: 10,
  REPORTS_MAX: 30,
  MANUAL_REVIEW: 15,
  NOT_FOUND: 10,
} as const;

/** Daraja: ≥ 60 — HIGH, ≥ 30 — MEDIUM, > 0 — LOW; 0 — xavf yo'q (ro'yxatda ko'rinmaydi). */
export const RISK_THRESHOLDS = { HIGH: 60, MEDIUM: 30 } as const;

/** Signallar tartibi (ball teng bo'lsa) — kontraktdagi tartib. */
const KIND_ORDER: readonly RiskSignalKind[] = [
  "ENGAGEMENT_GAP",
  "VIEW_SPIKE",
  "LOW_ENGAGEMENT",
  "VIEW_DROP",
  "TARGET",
  "REPORTS",
  "MANUAL_REVIEW",
  "NOT_FOUND",
];

const FLAG_KINDS: readonly ReelFlagType[] = ["ENGAGEMENT_GAP", "VIEW_SPIKE", "LOW_ENGAGEMENT", "VIEW_DROP"];
const OPEN_CASE: readonly TargetCaseStatus[] = ["NEW", "WARNED"];

type RiskFlag = { type: ReelFlagType; date: string; detail: string };

/** Hisob uchun kerakli ma'lumot: `Participant.reel` va `TargetsService.casesOf()` shunga mos keladi. */
export interface RiskInput {
  reel: {
    status: ReelStatus;
    flags: readonly RiskFlag[];
    /** Ketma-ket necha marta Instagram'da topilmadi. */
    misses: number;
    review: Pick<ManualReview, "kind" | "requestedAt"> | null;
  } | null;
  cases: readonly {
    status: TargetCaseStatus;
    /** Tanlov kuni "YYYY-MM-DD". */
    detectedOn: string;
    reports: readonly { day: string }[];
  }[];
}

export interface RiskAssessment {
  score: number;
  /** Ball 0 bo'lsa — null. */
  level: RiskLevel | null;
  signals: RiskSignal[];
}

/** Eng katta "YYYY-MM-DD" (bo'sh ro'yxat — null). */
const latestDay = (days: readonly string[]): string | null =>
  days.reduce<string | null>((max, d) => (max === null || d > max ? d : max), null);

export function riskSignals(input: RiskInput): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const { reel, cases } = input;

  if (reel) {
    // Videodagi nakrutka belgilari: tur bo'yicha bitta signal — eng oxirgi belgining kuni va izohi.
    for (const kind of FLAG_KINDS) {
      let latest: RiskFlag | undefined;
      for (const flag of reel.flags) {
        if (flag.type === kind && (latest === undefined || flag.date >= latest.date)) latest = flag;
      }
      if (latest !== undefined) signals.push({ kind, detail: latest.detail, at: latest.date, points: RISK_POINTS[kind] });
    }
  }

  const open = cases.filter((c) => OPEN_CASE.includes(c.status));
  if (open.length > 0) {
    const warned = open.some((c) => c.status === "WARNED");
    signals.push({
      kind: "TARGET",
      detail: `${open.length} ta ochiq target holati${warned ? " (ogohlantirilgan)" : ""}`,
      at: latestDay(open.map((c) => c.detectedOn)),
      points: RISK_POINTS.TARGET + (warned ? RISK_POINTS.TARGET_WARNED_BONUS : 0),
    });
  }

  const reports = cases.flatMap((c) => c.reports);
  if (reports.length > 0) {
    signals.push({
      kind: "REPORTS",
      detail: `${reports.length} ta shikoyat`,
      at: latestDay(reports.map((r) => r.day)),
      points: Math.min(RISK_POINTS.REPORTS_MAX, RISK_POINTS.REPORT * reports.length),
    });
  }

  if (reel?.status === "MANUAL_REVIEW") {
    signals.push({
      kind: "MANUAL_REVIEW",
      detail:
        reel.review?.kind === "LOST_REEL"
          ? "Qabul qilingan video endi topilmayapti — qo'lda tekshiruvda"
          : "Video Instagram'da topilmadi — qo'lda tekshiruvda",
      at: reel.review ? contestDay(reel.review.requestedAt) : null,
      points: RISK_POINTS.MANUAL_REVIEW,
    });
  }

  if (reel && reel.misses > 0) {
    signals.push({
      kind: "NOT_FOUND",
      detail: `Oxirgi ${reel.misses} ta tekshiruvda topilmadi`,
      // Qaysi kuni topilmagani saqlanmaydi.
      at: null,
      points: RISK_POINTS.NOT_FOUND,
    });
  }

  // Ball bo'yicha kamayish, teng bo'lsa — kontraktdagi tartib.
  return signals.sort((a, b) => b.points - a.points || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function riskLevel(score: number): RiskLevel | null {
  if (score >= RISK_THRESHOLDS.HIGH) return "HIGH";
  if (score >= RISK_THRESHOLDS.MEDIUM) return "MEDIUM";
  return score > 0 ? "LOW" : null;
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const signals = riskSignals(input);
  const score = signals.reduce((sum, s) => sum + s.points, 0);
  return { score, level: riskLevel(score), signals };
}

/**
 * "SAFE" belgisi hisobni ro'yxatdan yashiradimi. Belgidan KEYIN yangi signal paydo bo'lsa
 * (signal kuni belgi qo'yilgan tanlov kunidan keyin) — yashirmaydi. Kuni noma'lum signal
 * (`at: null`) yangi hisoblanmaydi. Solishtirish tanlov kuni bo'yicha (Asia/Tashkent).
 */
export function hiddenBySafe(signals: readonly RiskSignal[], review: RiskReview | null): boolean {
  if (review?.verdict !== "SAFE") return false;
  const reviewDay = contestDay(new Date(review.at));
  return !signals.some((s) => s.at !== null && s.at > reviewDay);
}
