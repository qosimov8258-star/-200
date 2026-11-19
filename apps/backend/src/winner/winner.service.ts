import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { adminError, objectBody, requiredText } from "../admin/admin-http";
import { AuditService, type AuditActor } from "../audit/audit.service";
import { contestDay } from "../common/time";
import { ContestSettingsService } from "../contest/contest-settings.service";
import {
  ParticipantsService,
  type Participant,
  type Reel,
  type ReelFlagType,
} from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { AUTO_REVIEWER, formatCount, StatsService, type RankedEntry } from "../stats/stats.service";
import { TargetsService, type TargetCaseStatus, type TargetMethod } from "../targets/targets.service";
import { ParticipantNotifier } from "../telegram/notifier";

// ---------------------------------------------------------------------------
// Kontrakt: `apps/admin/src/lib/types.ts` → "G'olib" bo'limi bilan bir xil
// ---------------------------------------------------------------------------

/**
 * NOT_STARTED — tanlov hali tugamagan (joriy yetakchi faqat oldindan ko'rish uchun);
 * CANDIDATE — nomzod tekshirilmoqda; CONFIRMED — Admin tasdiqlagan; ANNOUNCED — e'lon qilingan.
 */
export type WinnerStage = "NOT_STARTED" | "CANDIDATE" | "CONFIRMED" | "ANNOUNCED";

/** TZ 5.3 tekshiruv ro'yxati. */
export type WinnerCheckKey =
  | "NO_TARGET"
  | "REEL_AVAILABLE"
  | "NO_FAKE_VIEWS"
  | "PURCHASE_CONFIRMED"
  | "AD_TOOLS_REVIEWED";

/** Admin qo'lda belgilaydigan bandlar: mahsulot xaridi va "Reklama vositalari" bo'limi. */
export type WinnerManualCheckKey = "PURCHASE_CONFIRMED" | "AD_TOOLS_REVIEWED";

/** PENDING — Admin qo'lda tekshirishi kerak. */
export type WinnerCheckStatus = "PASSED" | "FAILED" | "PENDING";

export interface WinnerCheck {
  key: WinnerCheckKey;
  status: WinnerCheckStatus;
  detail: string;
  manual: boolean;
}

export interface WinnerCandidate {
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    age: number;
    phone: string;
    instagramUsername: string | null;
  };
  rank: number;
  views: number;
  reelUrl: string;
  checks: WinnerCheck[];
}

export interface WinnerOverview {
  contest: {
    startsOn: string;
    endsOn: string;
    ended: boolean;
    /** Tugashiga qolgan kunlar (tugagan bo'lsa — 0). */
    daysLeft: number;
    /** G'olib qaysi kunning reytingi bo'yicha aniqlanadi. */
    ratingDate: string;
  };
  stage: WinnerStage;
  candidate: WinnerCandidate | null;
  runnersUp: Array<{ rank: number; participantId: string; name: string; views: number; issues: string[] }>;
  skipped: Array<{ participantId: string; name: string; reason: string; at: string; by: string }>;
  confirmed: { at: string; by: string } | null;
  announced: { at: string; by: string } | null;
}

export interface WinnerManualCheckRequest {
  participantId: string;
  check: WinnerManualCheckKey;
  passed: boolean;
  note: string;
}

export interface WinnerSkipRequest {
  participantId: string;
  reason: string;
}

/** Mini App "G'olib e'loni" ekrani (`apps/miniapp/src/lib/types.ts` → Winner). Telefon va yosh yo'q. */
export interface PublicWinner {
  fullName: string;
  finalViews: number;
  announcedAt: string;
}

// ---------------------------------------------------------------------------
// Holat (StateStore → "winner")
// ---------------------------------------------------------------------------

interface ManualCheckResult {
  passed: boolean;
  note: string;
  at: Date;
  by: string;
}

interface WinnerState {
  /** Qo'lda belgilangan bandlar: ishtirokchi → band → natija. Nomzod almashsa ham saqlanadi. */
  manualChecks: Record<string, Partial<Record<WinnerManualCheckKey, ManualCheckResult>>>;
  /** Rad etilgan nomzodlar — reytingdan chetlatiladi, keyingi o'rindagi nomzod bo'ladi. */
  skipped: Array<{ participantId: string; name: string; reason: string; at: Date; by: string }>;
  /** Tasdiq paytidagi nomzod (o'rni va ko'rishlari keyin o'zgarmaydi). */
  confirmed: { participantId: string; at: Date; by: string; candidate: WinnerCandidate } | null;
  /** E'lon paytidagi holat — tekshiruv natijalari bilan birga muzlatiladi. */
  announced: { at: Date; by: string; candidate: WinnerCandidate } | null;
}

const emptyState = (): WinnerState => ({ manualChecks: {}, skipped: [], confirmed: null, announced: null });

export interface WinnerOptions {
  /** Testlar uchun soat. */
  clock?: () => Date;
}
export const WINNER_OPTIONS = Symbol("WINNER_OPTIONS");

const RUNNERS_UP_COUNT = 5;
const TEXT_MIN = 5;
const TEXT_MAX = 500;
const DAY_MS = 86_400_000;
const PARTICIPANT_ID = /^\d{1,20}$/;

const MANUAL_KEYS: readonly WinnerManualCheckKey[] = ["PURCHASE_CONFIRMED", "AD_TOOLS_REVIEWED"];

/** Audit log amallari — admin panel mock'idagi nomlar. */
const MANUAL_AUDIT_ACTION: Record<WinnerManualCheckKey, string> = {
  PURCHASE_CONFIRMED: "winner.purchase_check",
  AD_TOOLS_REVIEWED: "winner.ad_tools_check",
};

/** `apps/admin/src/lib/labels.ts` dagi nomlar — xato matnida qaysi band o'tmagani ko'rinadi. */
const CHECK_LABELS: Record<WinnerCheckKey, string> = {
  NO_TARGET: "Target yoqilmagan",
  REEL_AVAILABLE: "Reel o'chirilmagan",
  NO_FAKE_VIEWS: "Soxta ko'rish belgisi yo'q",
  PURCHASE_CONFIRMED: "Mahsulot sotib olingan",
  AD_TOOLS_REVIEWED: "Reklama tarixi yuzma-yuz ko'rilgan",
};

const MANUAL_PENDING: Record<WinnerManualCheckKey, string> = {
  PURCHASE_CONFIRMED: "Chek yoki xarid hujjatini qo'lda tekshiring",
  AD_TOOLS_REVIEWED:
    "Uchrashuvda g'olib telefonida Instagram → Professional panel → \"Reklama vositalari\" (reklama tarixi) bo'limini ko'ring",
};

const FLAG_LABELS: Record<ReelFlagType, string> = {
  LOW_ENGAGEMENT: "Ko'rishlarga nisbatan layklar juda kam",
  VIEW_SPIKE: "Ko'rishlar keskin oshgan",
  ENGAGEMENT_GAP: "Ko'rishlar oshgan, layklar o'smagan",
  VIEW_DROP: "Ko'rishlar kamaygan",
};

const TARGET_METHOD_LABELS: Record<TargetMethod, string> = {
  AD_LIBRARY: "Meta reklama kutubxonasi",
  GROWTH_ANALYSIS: "o'sish tahlili",
  REPORT: "ishtirokchi shikoyati",
};

const TARGET_STATUS_LABELS: Record<TargetCaseStatus, string> = {
  NEW: "ko'rib chiqilmagan",
  WARNED: "ogohlantirilgan",
  DISQUALIFIED: "chetlatilgan",
  DISMISSED: "ro'yxatdan chiqarilgan",
};

const statusOf = (result: ManualCheckResult | undefined): WinnerCheckStatus =>
  result ? (result.passed ? "PASSED" : "FAILED") : "PENDING";

const fullName = (p: Pick<Participant, "firstName" | "lastName" | "telegramId">): string =>
  p.firstName ? `${p.firstName} ${p.lastName ?? ""}`.trim() : `ID ${p.telegramId}`;

const candidateName = (c: WinnerCandidate): string => `${c.participant.firstName} ${c.participant.lastName}`.trim();

// ---------------------------------------------------------------------------
// So'rov tanasini tekshirish (CLAUDE.md: noma'lum maydon rad etiladi)
// ---------------------------------------------------------------------------

function participantIdOf(value: unknown): string {
  if (typeof value !== "string" || !PARTICIPANT_ID.test(value)) throw adminError(400, "Ishtirokchi ko'rsatilmagan.");
  return value;
}

export function parseManualCheck(body: unknown): WinnerManualCheckRequest {
  const b = objectBody(body, ["participantId", "check", "passed", "note"]);
  const participantId = participantIdOf(b.participantId);
  const check = MANUAL_KEYS.find((key) => key === b.check);
  if (!check) throw adminError(400, "Tekshiruv bandi noto'g'ri.");
  if (typeof b.passed !== "boolean") throw adminError(400, "Natija (o'tdi / o'tmadi) ko'rsatilmagan.");
  return { participantId, check, passed: b.passed, note: requiredText(b.note, "Izoh", TEXT_MIN, TEXT_MAX) };
}

export function parseSkip(body: unknown): WinnerSkipRequest {
  const b = objectBody(body, ["participantId", "reason"]);
  return { participantId: participantIdOf(b.participantId), reason: requiredText(b.reason, "Sabab", TEXT_MIN, TEXT_MAX) };
}

export function parseConfirm(body: unknown): string {
  return participantIdOf(objectBody(body, ["participantId"]).participantId);
}

// ---------------------------------------------------------------------------

/**
 * G'olibni aniqlash (TZ 5.3): tanlov tugagach reytingdagi 1-o'rin nomzod bo'ladi, Admin tekshiruv
 * ro'yxatini ko'rib chiqadi (3 ta avtomatik, 2 ta qo'lda band), nomzodni tasdiqlaydi yoki rad
 * etadi (keyingi o'rindagi nomzod bo'ladi), so'ng g'olibni e'lon qiladi — Mini App'da "G'olib
 * e'loni" ekrani ochiladi va g'olibga bot orqali xabar boradi.
 *
 * Bosqichlar: NOT_STARTED → CANDIDATE → CONFIRMED → ANNOUNCED. E'lon qaytarilmaydi.
 * Har bir o'zgartiruvchi amal audit logga yoziladi. `StateStore` orqali diskda saqlanadi;
 * Faza 1 da `winner_decisions` jadvaliga ko'chadi.
 */
@Injectable()
export class WinnerService {
  private readonly logger = new Logger(WinnerService.name);
  private readonly now: () => Date;
  private state: WinnerState = emptyState();

  constructor(
    private readonly participants: ParticipantsService,
    private readonly stats: StatsService,
    private readonly targets: TargetsService,
    private readonly contest: ContestSettingsService,
    private readonly audit: AuditService,
    private readonly notifier: ParticipantNotifier,
    @Optional() @Inject(WINNER_OPTIONS) options: WinnerOptions | null = null,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
  ) {
    this.now = options?.clock ?? (() => new Date());
    const saved = store?.attach("winner", () => this.state);
    if (saved) this.state = { ...emptyState(), ...saved };
  }

  // --- O'qish ----------------------------------------------------------------

  overview(): WinnerOverview {
    const now = this.now();
    const ended = this.ended(now);
    const ranking = this.ranking();
    const candidate = this.candidate(ranking);
    const settings = this.contest.get();
    const today = contestDay(now);
    const { skipped, confirmed, announced } = this.state;

    return {
      contest: {
        startsOn: settings.startsOn,
        endsOn: settings.endsOn,
        ended,
        daysLeft: ended ? 0 : Math.max(0, Math.ceil((this.contest.endsAt.getTime() - now.getTime()) / DAY_MS)),
        ratingDate: ended || today > settings.endsOn ? settings.endsOn : today,
      },
      stage: announced ? "ANNOUNCED" : !ended ? "NOT_STARTED" : confirmed ? "CONFIRMED" : "CANDIDATE",
      candidate,
      runnersUp: ranking
        .filter((e) => String(e.participant.telegramId) !== candidate?.participant.id)
        .slice(0, RUNNERS_UP_COUNT)
        .map((e) => ({
          rank: e.rank,
          participantId: String(e.participant.telegramId),
          name: fullName(e.participant),
          views: e.views,
          issues: this.automaticChecks(e.participant)
            .filter((check) => check.status !== "PASSED")
            .map((check) => check.detail),
        })),
      skipped: skipped.map((s) => ({ ...s, at: s.at.toISOString() })),
      confirmed: confirmed ? { at: confirmed.at.toISOString(), by: confirmed.by } : null,
      announced: announced ? { at: announced.at.toISOString(), by: announced.by } : null,
    };
  }

  /** Mini App uchun ommaviy ma'lumot: e'lon qilinmagan bo'lsa — null. Telefon, yosh chiqmaydi. */
  publicWinner(): PublicWinner | null {
    const announced = this.state.announced;
    if (!announced) return null;
    return {
      fullName: candidateName(announced.candidate),
      finalViews: announced.candidate.views,
      announcedAt: announced.at.toISOString(),
    };
  }

  // --- Amallar -----------------------------------------------------------------

  /** Qo'lda tekshiriladigan band (mahsulot xaridi, "Reklama vositalari"). Izoh majburiy. */
  setManualCheck(request: WinnerManualCheckRequest, actor: AuditActor): WinnerOverview {
    const p = this.requireParticipant(request.participantId);
    if (this.state.announced) throw adminError(409, "G'olib allaqachon e'lon qilingan.");
    if (this.state.confirmed) {
      throw adminError(409, "G'olib tasdiqlangan — bandni o'zgartirish uchun avval tasdiqni bekor qiling.");
    }
    const results = (this.state.manualChecks[request.participantId] ??= {});
    const before = statusOf(results[request.check]);
    results[request.check] = { passed: request.passed, note: request.note, at: this.now(), by: actor.name };
    this.record(actor, MANUAL_AUDIT_ACTION[request.check], p, before, request.passed ? "PASSED" : "FAILED", request.note);
    return this.overview();
  }

  /** Nomzodni rad etish — keyingi o'rindagi ishtirokchi nomzod bo'ladi. */
  skip(request: WinnerSkipRequest, actor: AuditActor): WinnerOverview {
    const p = this.requireParticipant(request.participantId);
    this.requireOpenCandidate(request.participantId);
    if (this.state.confirmed) {
      throw adminError(409, "Tasdiqlangan nomzodni rad etib bo'lmaydi — avval tasdiqni bekor qiling.");
    }
    this.state.skipped.push({
      participantId: request.participantId,
      name: fullName(p),
      reason: request.reason,
      at: this.now(),
      by: actor.name,
    });
    this.record(actor, "winner.skip", p, "CANDIDATE", "SKIPPED", request.reason);
    return this.overview();
  }

  /** G'olibni tasdiqlash: tanlov tugagan, yakuniy ko'rishlar yig'ilgan va barcha bandlar o'tgan bo'lishi shart. */
  confirm(participantId: string, actor: AuditActor): WinnerOverview {
    const p = this.requireParticipant(participantId);
    const candidate = this.requireOpenCandidate(participantId);
    if (this.state.confirmed) throw adminError(409, "G'olib allaqachon tasdiqlangan.");
    if (!this.finalSyncDone()) {
      throw adminError(
        409,
        "Yakuniy ko'rishlar hali yig'ilmagan — tanlov tugagandan keyingi yig'ishni kuting yoki uni qo'lda ishga tushiring.",
      );
    }
    const failed = candidate.checks.filter((check) => check.status !== "PASSED");
    if (failed.length > 0) {
      throw adminError(
        422,
        `Tekshiruv ro'yxatidagi barcha bandlar o'tishi kerak. O'tmagan: ${failed.map((c) => CHECK_LABELS[c.key]).join(", ")}.`,
      );
    }
    this.state.confirmed = { participantId, at: this.now(), by: actor.name, candidate };
    this.record(actor, "winner.confirm", p, "CANDIDATE", "CONFIRMED", "");
    return this.overview();
  }

  /** Tasdiqni bekor qilish (faqat e'lon qilinmagan bo'lsa). */
  unconfirm(actor: AuditActor): WinnerOverview {
    if (this.state.announced) throw adminError(409, "G'olib e'lon qilingan — tasdiqni bekor qilib bo'lmaydi.");
    const confirmed = this.state.confirmed;
    if (!confirmed) throw adminError(409, "Bekor qilinadigan tasdiq yo'q.");
    this.state.confirmed = null;
    this.audit.record({
      actor,
      action: "winner.unconfirm",
      entity: "winner",
      entityId: confirmed.participantId,
      entityLabel: candidateName(confirmed.candidate),
      before: "CONFIRMED",
      after: "CANDIDATE",
      reason: "",
    });
    return this.overview();
  }

  /**
   * G'olibni e'lon qilish — bir marta, qaytarilmaydi. Tasdiqdan keyin tekshiruv natijasi o'zgargan
   * bo'lsa (masalan, target aniqlangan) — e'lon qilinmaydi. G'olibga bot orqali xabar boradi.
   */
  announce(actor: AuditActor): WinnerOverview {
    if (this.state.announced) throw adminError(409, "G'olib allaqachon e'lon qilingan.");
    const confirmed = this.state.confirmed;
    if (!confirmed) throw adminError(409, "Avval g'olibni tasdiqlang.");
    if (!this.ended(this.now())) throw adminError(409, "Tanlov hali tugamagan.");
    const p = this.participants.get(Number(confirmed.participantId));
    if (!p) throw adminError(409, "Tasdiqlangan ishtirokchi tanlovdan chiqib ketgan — tasdiqni bekor qiling.");
    if (p.status !== "ACTIVE") {
      throw adminError(409, "Tasdiqlangan ishtirokchi bloklangan yoki chetlatilgan — tasdiqni bekor qiling.");
    }
    const checks = this.checks(p);
    const failed = checks.filter((check) => check.status !== "PASSED");
    if (failed.length > 0) {
      throw adminError(
        422,
        `Tasdiqdan keyin tekshiruv natijasi o'zgargan: ${failed.map((c) => CHECK_LABELS[c.key]).join(", ")}. ` +
          "Tasdiqni bekor qilib, nomzodni qayta ko'rib chiqing.",
      );
    }
    const at = this.now();
    this.state.announced = { at, by: actor.name, candidate: { ...confirmed.candidate, checks } };
    this.record(actor, "winner.announce", p, "CONFIRMED", "ANNOUNCED", "");
    this.congratulate(p, confirmed.candidate.views);
    return this.overview();
  }

  // --- Ichki ---------------------------------------------------------------------

  private ended(now: Date): boolean {
    return now.getTime() >= this.contest.endsAt.getTime();
  }

  /** Tanlov tugagandan keyin kamida bitta muvaffaqiyatli yig'ish bo'lganmi (g'olib shu ko'rishlar bo'yicha). */
  private finalSyncDone(): boolean {
    const last = this.stats.status().lastSuccessAt;
    return last !== null && Date.parse(last) >= this.contest.endsAt.getTime();
  }

  /** Reyting (faqat ACCEPTED va ACTIVE), rad etilgan nomzodlarsiz. */
  private ranking(): RankedEntry[] {
    const skipped = new Set(this.state.skipped.map((s) => s.participantId));
    return this.stats.ranking().filter((e) => !skipped.has(String(e.participant.telegramId)));
  }

  /**
   * E'lon qilingan — muzlatilgan holat; tasdiqlangan — tasdiq paytidagi o'rin va ko'rishlar,
   * tekshiruv bandlari esa joriy (e'lon oldidan o'zgarish ko'rinsin); aks holda — reytingdagi birinchi.
   */
  private candidate(ranking: RankedEntry[]): WinnerCandidate | null {
    const { announced, confirmed } = this.state;
    if (announced) return announced.candidate;
    if (confirmed) {
      const p = this.participants.get(Number(confirmed.participantId));
      return p ? { ...confirmed.candidate, checks: this.checks(p) } : confirmed.candidate;
    }
    const top = ranking[0];
    if (!top) return null;
    const p = top.participant;
    return {
      participant: {
        id: String(p.telegramId),
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        age: p.age ?? 0,
        phone: p.phone ?? "",
        instagramUsername: top.reel.owner,
      },
      rank: top.rank,
      views: top.views,
      reelUrl: top.reel.url,
      checks: this.checks(p),
    };
  }

  /** Amal joriy nomzod uchun va tanlov tugagan, e'lon qilinmagan holatda bajarilayotganini tekshiradi. */
  private requireOpenCandidate(participantId: string): WinnerCandidate {
    if (!this.ended(this.now())) throw adminError(409, "Tanlov hali tugamagan.");
    if (this.state.announced) throw adminError(409, "G'olib allaqachon e'lon qilingan.");
    const candidate = this.candidate(this.ranking());
    if (candidate?.participant.id !== participantId) throw adminError(409, "Nomzod o'zgargan. Sahifani yangilang.");
    return candidate;
  }

  private requireParticipant(participantId: string): Participant {
    const p = this.participants.get(Number(participantId));
    if (!p) throw adminError(404, "Ishtirokchi topilmadi.");
    return p;
  }

  private checks(p: Participant): WinnerCheck[] {
    const results = this.state.manualChecks[String(p.telegramId)] ?? {};
    const manual = MANUAL_KEYS.map((key): WinnerCheck => {
      const result = results[key];
      return {
        key,
        status: statusOf(result),
        detail: result ? `${result.note} — ${result.by}` : MANUAL_PENDING[key],
        manual: true,
      };
    });
    return [...this.automaticChecks(p), ...manual];
  }

  private automaticChecks(p: Participant): WinnerCheck[] {
    const target = this.targetIssue(p);
    const reel = reelIssue(p.reel);
    const fake = fakeViewsIssue(p.reel);
    return [
      {
        key: "NO_TARGET",
        status: target ? "FAILED" : "PASSED",
        detail: target ?? "Target (pullik reklama) aniqlanmagan",
        manual: false,
      },
      {
        key: "REEL_AVAILABLE",
        status: reel ? "FAILED" : "PASSED",
        detail: reel ?? "Reel Instagramda mavjud va ochiq",
        manual: false,
      },
      {
        key: "NO_FAKE_VIEWS",
        status: fake ? "FAILED" : "PASSED",
        detail: fake ?? "Nakrutka belgilari yo'q",
        manual: false,
      },
    ];
  }

  /** Ro'yxatdan chiqarilmagan (DISMISSED bo'lmagan) target holatlari — ochiq yoki chetlatish bilan yopilgan. */
  private targetIssue(p: Participant): string | null {
    const cases = this.targets.casesOf(p.telegramId).filter((c) => c.status !== "DISMISSED");
    if (cases.length === 0) return null;
    return cases
      .map((c) => `Target aniqlangan: ${c.detectedOn} (${TARGET_METHOD_LABELS[c.method]}, ${TARGET_STATUS_LABELS[c.status]})`)
      .join("; ");
  }

  private record(
    actor: AuditActor,
    action: string,
    p: Participant,
    before: string,
    after: string,
    reason: string,
  ): void {
    this.audit.record({
      actor,
      action,
      entity: "winner",
      entityId: String(p.telegramId),
      entityLabel: fullName(p),
      before,
      after,
      reason,
    });
  }

  /** G'olibga tabrik. Yetib bormasa — faqat logga yoziladi (e'lon bekor bo'lmaydi). */
  private congratulate(p: Participant, views: number): void {
    if (p.chatId === null) {
      this.logger.warn(`G'olib (${p.telegramId}) bilan bot chati yo'q — tabrik yuborilmadi.`);
      return;
    }
    const text =
      `🏆 Tabriklaymiz, ${p.firstName ?? "hurmatli ishtirokchi"}!\n\n` +
      `Siz Reels tanlovining g'olibi deb e'lon qilindingiz: Reelingiz ${formatCount(views)} ko'rish to'pladi. ` +
      `Sovrin — ${this.contest.prizeName}.\n\n` +
      "Tez orada tashkilotchilar siz bilan bog'lanib, sovrinni topshirish tartibini aytishadi.";
    this.notifier.notify(p.chatId, text, "WINNER").catch((err: Error) => {
      this.logger.warn(`G'olibga (${p.telegramId}) tabrik yuborilmadi: ${err.message}`);
    });
  }
}

function reelIssue(reel: Reel | null): string | null {
  if (!reel) return "Reel yuborilmagan";
  switch (reel.status) {
    case "REJECTED":
      return "Reel rad etilgan";
    case "PENDING":
      return "Reel hali tekshirilmagan";
    case "MANUAL_REVIEW":
      return "Reel Instagramda topilmayapti — qo'lda tekshiruvda";
    case "ACCEPTED":
      if (reel.misses === 0 || vouchedByAdmin(reel)) return null;
      return `Oxirgi tekshiruvlarda Reel Instagramda topilmadi (${reel.misses} marta ketma-ket)`;
  }
}

/**
 * Admin videoni qo'lda tekshirib tasdiqlagan, Apify esa o'shandan beri uni o'qiy olmayapti —
 * band o'tgan hisoblanadi (aks holda bunday nomzodni hech qachon tasdiqlab bo'lmasdi).
 */
function vouchedByAdmin(reel: Reel): boolean {
  const d = reel.review?.decision;
  return !!d && d.approved && d.by !== AUTO_REVIEWER && (reel.lastFoundAt === null || reel.lastFoundAt < d.at);
}

function fakeViewsIssue(reel: Reel | null): string | null {
  if (!reel || reel.flags.length === 0) return null;
  return reel.flags.map((f) => `${FLAG_LABELS[f.type]} (${f.date}): ${f.detail}`).join("; ");
}
