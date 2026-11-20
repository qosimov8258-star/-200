import { Inject, Injectable, Optional } from "@nestjs/common";

import { adminError, paginate } from "../admin/admin-http";
import { ParticipantsService, type OwnerParticipantPatch, type Participant } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import { TargetsService, type TargetCase, type TargetCaseStatus, type TargetStatusFilter } from "../targets/targets.service";
import type { OwnerUser } from "./auth/owner-accounts";
import { participantId } from "./owner-validation";
import type {
  OwnerParticipant,
  OwnerParticipantFilter,
  OwnerParticipantListResponse,
  RiskAccount,
  RiskLevel,
  RiskListResponse,
  RiskReview,
  RiskVerdict,
} from "./owner-types";
import { assessRisk, hiddenBySafe, type RiskAssessment } from "./risk";

export interface OwnerOptions {
  clock?: () => Date;
}

export const OWNER_OPTIONS = Symbol("OWNER_OPTIONS");

const DEFAULT_PAGE_SIZE = 25;
const OPEN_CASE: readonly TargetCaseStatus[] = ["NEW", "WARNED"];

/** Xavf darajasi aniqlangan hisob (ball > 0). */
type RiskyAssessment = RiskAssessment & { level: RiskLevel };

/** Bir so'rov davomida bir marta hisoblanadigan ma'lumot. */
interface OwnerContext {
  rankById: ReadonlyMap<number, number>;
  casesById: ReadonlyMap<number, TargetCase[]>;
  rulesVersion: number;
}

export interface OwnerPageQuery {
  /** Kichik harfdagi qidiruv matni (`searchTerm`). */
  search: string;
  page?: string;
  pageSize?: string;
}

/** Qidiruv uchun: kichik harf, apostrof variantlari (o', oʻ, o`) bir xil. */
const normalize = (value: string): string => value.toLowerCase().replace(/[ʻʼ‘’`]/g, "'").trim();

/** Ism, familiya, telefon (kamida 3 raqam), @instagram yoki Telegram ID bo'yicha. */
function matchesSearch(p: Participant, search: string): boolean {
  const needle = normalize(search);
  if (!needle) return true;
  const first = p.firstName ?? "";
  const last = p.lastName ?? "";
  if (normalize(`${first} ${last} ${last} ${first}`).includes(needle)) return true;
  const username = needle.replace(/^@/, "");
  if (username && p.reel?.owner?.toLowerCase().includes(username)) return true;
  const digits = needle.replace(/\D/g, "");
  if (digits.length >= 3 && p.phone?.replace(/\D/g, "").includes(digits)) return true;
  return /^\d+$/.test(needle) && String(p.telegramId).includes(needle);
}

/**
 * Ro'yxat bo'limi (tablar bir-birini kesmaydi): ismi yo'q — INCOMPLETE, qolganlari — o'z holati.
 * Shunday qilib `counts.ALL` = qolgan to'rttasining yig'indisi.
 */
const bucket = (p: Participant): OwnerParticipantFilter => (p.firstName ? p.status : "INCOMPLETE");

const lastViews = (p: Participant): number => p.reel?.history.at(-1)?.views ?? 0;

/**
 * Tashkilot egalari — yashirin bo'lim: ishtirokchilar (ro'yxat, tahrir, o'chirish), target
 * holatlari (istalgan tomonga) va xavfga yaqin hisoblar. Kontrakt — `apps/admin/src/lib/owner-types.ts`.
 *
 * Egalar qarori bilan: amallar audit log'ga ham, server log'iga ham YOZILMAYDI; ishtirokchiga
 * bot xabari yuborilmaydi; ko'rishlarni (reel.history) o'zgartiruvchi hech narsa yo'q.
 *
 * Ega belgilari (SAFE / WATCH) `StateStore` orqali diskda ("owner" qismi).
 */
@Injectable()
export class OwnerService {
  private readonly reviews = new Map<number, RiskReview>();
  private readonly now: () => Date;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly rules: RulesService,
    private readonly stats: StatsService,
    private readonly targets: TargetsService,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
    @Optional() @Inject(OWNER_OPTIONS) options: OwnerOptions | null = null,
  ) {
    this.now = options?.clock ?? (() => new Date());
    const saved = store?.attach("owner", () => ({ reviews: [...this.reviews] }));
    for (const [telegramId, review] of saved?.reviews ?? []) this.reviews.set(telegramId, review);
  }

  // --- Ishtirokchilar -------------------------------------------------------------

  /**
   * Barcha ishtirokchilar (ro'yxatdan to'liq o'tmaganlar ham). `counts` qidiruvni hisobga oladi,
   * holat filtrini — yo'q. Tartib: reytingdagilar o'rni bo'yicha, qolganlari — eng yangi birinchi.
   */
  listParticipants(query: OwnerPageQuery & { status?: OwnerParticipantFilter }): OwnerParticipantListResponse {
    const ctx = this.context();
    const rows = this.participants.all().filter((p) => matchesSearch(p, query.search));
    const counts: OwnerParticipantListResponse["counts"] = {
      ALL: rows.length,
      ACTIVE: 0,
      BLOCKED: 0,
      DISQUALIFIED: 0,
      INCOMPLETE: 0,
    };
    for (const p of rows) counts[bucket(p)] += 1;

    const filtered = query.status ? rows.filter((p) => bucket(p) === query.status) : rows;
    filtered.sort((a, b) => {
      const ra = ctx.rankById.get(a.telegramId);
      const rb = ctx.rankById.get(b.telegramId);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime() || a.telegramId - b.telegramId;
    });
    const page = paginate(filtered, query.page, query.pageSize, DEFAULT_PAGE_SIZE);
    return { ...page, items: page.items.map((p) => this.toOwnerParticipant(p, ctx)), counts };
  }

  /** 404 — topilmadi; 409 — telefon boshqa ishtirokchida; 422 — ism bor-u familiya/yosh yo'q. */
  updateParticipant(id: string, patch: OwnerParticipantPatch): OwnerParticipant {
    const telegramId = participantId(id);
    const result = telegramId === null ? "NOT_FOUND" : this.participants.ownerUpdate(telegramId, patch);
    if (result === "NOT_FOUND") throw adminError(404, "Ishtirokchi topilmadi.");
    if (result === "PHONE_TAKEN") throw adminError(409, "Bu telefon raqami boshqa ishtirokchida.");
    if (result === "PROFILE_INCOMPLETE") {
      throw adminError(422, "Ro'yxatdan o'tmagan ishtirokchiga ism bilan birga familiya va yosh ham yoziladi.");
    }
    return this.toOwnerParticipant(result, this.context());
  }

  /** Ishtirokchi va uning videosi butunlay o'chadi (ega belgisi ham). */
  deleteParticipant(id: string): void {
    const telegramId = participantId(id);
    if (telegramId === null || !this.participants.get(telegramId)) throw adminError(404, "Ishtirokchi topilmadi.");
    this.participants.delete(telegramId);
    this.reviews.delete(telegramId);
  }

  // --- Target holatlari -----------------------------------------------------------

  /** `status` berilmasa — hammasi (yopilganlari ham). Javob — admin bo'limidagi ro'yxat bilan bir xil. */
  listTargets(query: { status?: TargetStatusFilter; search: string; page?: number; pageSize?: number }) {
    return this.targets.list(query);
  }

  updateTarget(id: string, update: { status: TargetCaseStatus; note: string | null }) {
    return this.targets.ownerSetStatus(id, update.status, update.note);
  }

  // --- Xavfga yaqin hisoblar -------------------------------------------------------

  /**
   * Faqat ACTIVE va BLOCKED, ball > 0. SAFE belgilanganlar (belgidan keyin yangi signal
   * bo'lmasa) yashiriladi, `includeSafe` bo'lsa — ko'rinadi. `counts` qidiruvni hisobga oladi,
   * daraja filtrini — yo'q; `SAFE` — yashirilganlar soni. Tartib: ball, so'ng ko'rishlar bo'yicha kamayish.
   */
  listRisk(query: OwnerPageQuery & { level?: RiskLevel; includeSafe: boolean }): RiskListResponse {
    const ctx = this.context();
    const rows: { p: Participant; risk: RiskyAssessment; hidden: boolean }[] = [];
    for (const p of this.participants.all()) {
      if (!matchesSearch(p, query.search)) continue;
      const risk = this.assess(p, ctx);
      if (risk) rows.push({ p, risk, hidden: hiddenBySafe(risk.signals, this.reviews.get(p.telegramId) ?? null) });
    }
    const visible = query.includeSafe ? rows : rows.filter((r) => !r.hidden);
    const counts: RiskListResponse["counts"] = {
      ALL: visible.length,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      SAFE: rows.filter((r) => r.hidden).length,
    };
    for (const r of visible) counts[r.risk.level] += 1;

    const filtered = query.level ? visible.filter((r) => r.risk.level === query.level) : visible;
    filtered.sort(
      (a, b) =>
        b.risk.score - a.risk.score || lastViews(b.p) - lastViews(a.p) || a.p.telegramId - b.p.telegramId,
    );
    const page = paginate(filtered, query.page, query.pageSize, DEFAULT_PAGE_SIZE);
    return { ...page, items: page.items.map((r) => this.toRiskAccount(r.p, r.risk, ctx)), counts };
  }

  /** Ega belgisi: SAFE — tekshirildi, xavfsiz; WATCH — kuzatuvda; null — belgini olib tashlash. */
  review(id: string, verdict: RiskVerdict | null, owner: OwnerUser): RiskAccount {
    const telegramId = participantId(id);
    const p = telegramId === null ? null : this.participants.get(telegramId);
    if (!p) throw adminError(404, "Ishtirokchi topilmadi.");
    const ctx = this.context();
    const risk = this.assess(p, ctx);
    if (!risk) throw adminError(404, "Bu ishtirokchi xavfga yaqin hisoblar ro'yxatida yo'q.");
    if (verdict === null) this.reviews.delete(p.telegramId);
    else this.reviews.set(p.telegramId, { verdict, at: this.now().toISOString(), by: owner.fullName });
    return this.toRiskAccount(p, risk, ctx);
  }

  // -------------------------------------------------------------------------------

  private context(): OwnerContext {
    const casesById = new Map<number, TargetCase[]>();
    for (const c of this.targets.allCases()) {
      const list = casesById.get(c.telegramId);
      if (list) list.push(c);
      else casesById.set(c.telegramId, [c]);
    }
    return {
      rankById: new Map(this.stats.ranking().map((e) => [e.participant.telegramId, e.rank])),
      casesById,
      rulesVersion: this.rules.version,
    };
  }

  /** Chetlatilganlar (DISQUALIFIED) va ball 0 — null. */
  private assess(p: Participant, ctx: OwnerContext): RiskyAssessment | null {
    if (p.status === "DISQUALIFIED") return null;
    const risk = assessRisk({ reel: p.reel, cases: ctx.casesById.get(p.telegramId) ?? [] });
    return risk.level ? { ...risk, level: risk.level } : null;
  }

  private toOwnerParticipant(p: Participant, ctx: OwnerContext, risk = this.assess(p, ctx)): OwnerParticipant {
    return {
      id: String(p.telegramId),
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      phone: p.phone,
      status: p.status,
      profileComplete: Boolean(p.firstName) && p.consentVersion === ctx.rulesVersion,
      registeredAt: p.createdAt.toISOString(),
      instagramUsername: p.reel?.owner ?? null,
      reel: p.reel ? { url: p.reel.url, status: p.reel.status, submittedAt: p.reel.submittedAt.toISOString() } : null,
      views: lastViews(p),
      rank: ctx.rankById.get(p.telegramId) ?? null,
      openTargetCases: (ctx.casesById.get(p.telegramId) ?? []).filter((c) => OPEN_CASE.includes(c.status)).length,
      riskLevel: risk?.level ?? null,
    };
  }

  private toRiskAccount(p: Participant, risk: RiskyAssessment, ctx: OwnerContext): RiskAccount {
    return {
      participant: this.toOwnerParticipant(p, ctx, risk),
      score: risk.score,
      level: risk.level,
      signals: risk.signals,
      review: this.reviews.get(p.telegramId) ?? null,
    };
  }
}
