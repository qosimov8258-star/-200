import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { addDays, contestDay, daysBetween, tashkentAt } from "../common/time";
import { ReelStatsProvider, type ReelStats } from "../instagram/reel-stats";
import {
  ParticipantsService,
  type ManualReview,
  type Participant,
  type Reel,
  type ReelFlagType,
  type ReelRejectReason,
} from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { ParticipantNotifier, type TelegramMessageKind } from "../telegram/notifier";
import { texts } from "../telegram/texts";

export interface StatsOptions {
  /** Kunning qaysi vaqtida yig'iladi — Toshkent vaqti, "HH:MM". */
  syncTime: string;
  /** Tanlov boshidan necha kunda bir marta (10 — har 10 kunda); 0 — avtomatik yig'ish o'chiq. */
  everyDays: number;
  /** Yangi videolar shuncha kutib, bitta so'rovda tekshiriladi. */
  verifyDelayMs: number;
  /** Tanlov boshlangan kun "YYYY-MM-DD" (Toshkent) — yig'ish jadvali shundan sanaladi. */
  contestStartsOn: string;
  /** Tanlov tugashi: shundan keyin bitta yakuniy yig'ish, so'ng to'xtaydi. */
  contestEndsAt: Date;
  /** Testlar uchun soat. */
  clock?: () => Date;
}

export const STATS_OPTIONS = Symbol("STATS_OPTIONS");

export interface SyncReport {
  reason: "schedule" | "final" | "admin";
  startedAt: Date;
  finishedAt: Date | null;
  /** Tekshirilgan videolar. */
  total: number;
  /** Ko'rishlari yangilanganlar. */
  updated: number;
  /** Instagram'da topilmaganlar. */
  missing: number;
  /** Shu yig'ishda qo'lda tekshiruvga o'tganlar (3 marta ketma-ket topilmadi). */
  toManualReview: number;
  /** Qo'lda tekshiruvdagi, lekin Apify shu safar o'zi topgan videolar. */
  resolved: number;
  error: string | null;
}

/** Admin qarori (qo'lda tekshiruv). */
export type ManualDecision =
  | { approve: true; note: string }
  | { approve: false; reason: ReelRejectReason; note: string };

/** Apify o'zi topib, qo'lda tekshiruvni yopganda qaror muallifi. */
export const AUTO_REVIEWER = "Avtomatik";

export interface RankedEntry {
  participant: Participant;
  reel: Reel;
  rank: number;
  views: number;
  /** Oldingi yig'ishdagi o'ringa nisbatan: musbat — ko'tarilgan. */
  rankDelta: number;
}

/**
 * Apify videoni ketma-ket shuncha marta topa olmasa — ishtirokchiga xabar beriladi va
 * video admin paneldagi "Qo'lda tekshiruv" bo'limiga o'tadi (avtomatik rad etilmaydi).
 */
export const ATTEMPTS_BEFORE_MANUAL_REVIEW = 3;
/** Yangi video topilmasa — 2- va 3-urinishdan oldin shuncha kutiladi. */
const NOT_FOUND_RETRY_MS = [2 * 60_000, 10 * 60_000];
const VERIFY_RETRY_MS = 2 * 60_000;
const VERIFY_RETRY_MAX_MS = 60 * 60_000;
/** Yig'ish muvaffaqiyatsiz bo'lsa, shuncha vaqt o'tmaguncha qayta urinilmaydi. */
const SYNC_RETRY_MS = 30 * 60_000;
const SCHEDULER_TICK_MS = 60_000;

/** Nakrutka signallari chegaralari. Belgi faqat admin e'tibori uchun — avtomatik jazo yo'q. */
export const FLAG_RULES = {
  /** Shundan kam ko'rishda layk nisbati baholanmaydi. */
  lowEngagementMinViews: 10_000,
  /** Layk / ko'rish shundan past bo'lsa — LOW_ENGAGEMENT (odatda 1–5%). */
  lowEngagementRatio: 0.003,
  /** Kunlik o'sish kamida shuncha va oldingisidan `spikeFactor` barobar ko'p — VIEW_SPIKE. */
  spikeMinDailyGain: 50_000,
  spikeFactor: 10,
  /**
   * ENGAGEMENT_GAP: kunlik o'sish kamida `gapMinDailyGain` va oldingisidan `gapFactor` barobar
   * ko'p, shu kungi layk ulushi esa Reelning odatdagi ulushidan `gapLikeShare` martadan past.
   */
  gapMinDailyGain: 20_000,
  gapFactor: 3,
  gapLikeShare: 0.25,
  /** Ko'rishlar shuncha ulushga kamaysa — VIEW_DROP. */
  dropRatio: 0.1,
} as const;

/**
 * Worker: Reel'larni tekshiradi, ko'rishlarni yig'adi, reyting va nakrutka signallarini hisoblaydi.
 *
 * - Yangi video: bir necha soniyada (navbat bilan, bitta so'rovda) tekshiriladi — topildimi,
 *   Reel'mi, egasi boshqa ishtirokchida emasmi. Natija bot orqali xabar qilinadi.
 * - Ko'rishlar: har `everyDays` kunda soat `syncTime` da (Toshkent) hamma videolar uchun.
 * - Apify videoni ketma-ket 3 marta topa olmasa (yangi yoki avval qabul qilingan) — ishtirokchiga
 *   xabar beriladi va video admin paneldagi "Qo'lda tekshiruv" bo'limiga o'tadi; admin linkni
 *   ochib tasdiqlaydi yoki rad etadi. Avtomatik "topilmadi" rad etish yo'q.
 * - Ko'rishlarni faqat shu servis yozadi (CLAUDE.md) — qo'lda o'zgartiruvchi endpoint yo'q.
 *
 * VAQTINCHA jarayon ichida (setInterval). Redis paydo bo'lgach BullMQ navbatiga ko'chiriladi.
 */
@Injectable()
export class StatsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(StatsService.name);
  private readonly now: () => Date;

  private readonly queue = new Set<number>();
  private queueTimer: NodeJS.Timeout | null = null;
  private readonly retryTimers = new Set<NodeJS.Timeout>();
  private verifyChain: Promise<void> = Promise.resolve();
  private verifyFailures = 0;

  private syncing: Promise<SyncReport> | null = null;
  private lastSync: SyncReport | null = null;
  /** Oxirgi muvaffaqiyatli yig'ish vaqti. */
  private lastSuccessAt: Date | null = null;
  /** Oxirgi yig'ishdan oldingi o'rinlar (rankDelta uchun). */
  private previousRanks = new Map<number, number>();
  private scheduler: NodeJS.Timeout | null = null;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly provider: ReelStatsProvider,
    private readonly notifier: ParticipantNotifier,
    @Inject(STATS_OPTIONS) private readonly options: StatsOptions,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
  ) {
    this.now = options.clock ?? (() => new Date());
    const saved = store?.attach("stats", () => ({
      lastSync: this.lastSync,
      lastSuccessAt: this.lastSuccessAt,
      previousRanks: [...this.previousRanks],
    }));
    if (saved) {
      this.lastSync = saved.lastSync;
      this.lastSuccessAt = saved.lastSuccessAt;
      this.previousRanks = new Map(saved.previousRanks);
    }
  }

  onApplicationBootstrap(): void {
    // Qayta ishga tushganda: tekshiruvi chala qolgan videolar navbatga qaytadi (taymerlar saqlanmaydi).
    for (const p of this.participants.all()) {
      if (p.reel && (p.reel.status === "PENDING" || isRechecking(p.reel))) this.queueVerification(p.telegramId);
    }
    const { everyDays, syncTime } = this.options;
    if (this.provider.name === "mock") {
      this.logger.warn("STATS_PROVIDER=mock — ko'rishlar SOXTA, faqat lokal sinov uchun.");
    }
    if (this.provider.name === "unavailable") {
      this.logger.warn("APIFY_API_TOKEN berilmagan — videolar tekshirilmaydi va ko'rishlar yig'ilmaydi.");
    }
    if (everyDays <= 0) {
      this.logger.warn("STATS_SYNC_EVERY_DAYS=0 — avtomatik yig'ish o'chiq (faqat admin API orqali).");
      return;
    }
    const period = everyDays === 1 ? "har kuni" : `har ${everyDays} kunda`;
    const next = this.nextSyncAt();
    this.logger.log(
      `Ko'rishlar ${this.options.contestStartsOn} dan boshlab ${period} soat ${syncTime} da (Toshkent) ` +
        `yig'iladi${next ? `, keyingisi: ${next.toISOString()}` : ""}. Manba: ${this.provider.name}.`,
    );
    this.scheduler = setInterval(() => this.tick(), SCHEDULER_TICK_MS);
    this.scheduler.unref();
  }

  onApplicationShutdown(): void {
    if (this.scheduler) clearInterval(this.scheduler);
    if (this.queueTimer) clearTimeout(this.queueTimer);
    for (const timer of this.retryTimers) clearTimeout(timer);
  }

  // --- Yangi videolarni tekshirish -----------------------------------------

  /** Yangi videoni navbatga qo'yadi; `verifyDelayMs` ichida kelganlar bitta so'rovda tekshiriladi. */
  queueVerification(telegramId: number): void {
    this.queue.add(telegramId);
    if (this.queueTimer) return;
    this.queueTimer = setTimeout(() => {
      this.queueTimer = null;
      void this.flushVerification();
    }, this.options.verifyDelayMs);
    this.queueTimer.unref();
  }

  /** Navbatni hoziroq tekshiradi (oldingi tekshiruv tugashini kutib). */
  flushVerification(): Promise<void> {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }
    const ids = [...this.queue];
    this.queue.clear();
    if (ids.length > 0) this.verifyChain = this.verifyChain.then(() => this.verifyBatch(ids));
    return this.verifyChain;
  }

  private async verifyBatch(ids: number[]): Promise<void> {
    // Yangi videolar va yig'ishda topilmay qolgan (qayta tekshiriladigan) qabul qilinganlar.
    const targets = ids.flatMap((id) => {
      const p = this.participants.get(id);
      const reel = p?.reel;
      return p && reel && (reel.status === "PENDING" || isRechecking(reel)) ? [{ p, reel }] : [];
    });
    if (targets.length === 0) return;

    let stats: Map<string, ReelStats | null>;
    try {
      stats = await this.provider.fetch(targets.map((t) => t.reel.shortcode));
      this.verifyFailures = 0;
    } catch (err) {
      this.verifyFailures += 1;
      const delay = Math.min(VERIFY_RETRY_MS * 2 ** (this.verifyFailures - 1), VERIFY_RETRY_MAX_MS);
      this.logger.error(
        `${targets.length} ta videoni tekshirib bo'lmadi: ${(err as Error).message}. ` +
          `${Math.round(delay / 60_000)} daqiqadan keyin qayta urinamiz.`,
      );
      for (const t of targets) this.retryLater(t.p.telegramId, delay);
      return;
    }

    const now = this.now();
    for (const { p, reel } of targets) {
      // Kutish paytida ishtirokchi o'chirilgan yoki video almashtirilgan bo'lishi mumkin.
      if (!this.isCurrent(p, reel) || !stats.has(reel.shortcode)) continue;
      const s = stats.get(reel.shortcode) ?? null;
      if (reel.status === "PENDING") this.applyVerification(p, reel, s, now);
      else if (isRechecking(reel)) this.applyAcceptedResult(p, reel, s, now);
    }
  }

  /**
   * Qabul qilingan video natijasi (yig'ishda yoki qayta tekshiruvda). Topilmasa — 2 va 10 daqiqadan
   * keyin qayta tekshiriladi (yig'ish 10 kunda bir bo'lgani uchun keyingisini kutmaymiz);
   * 3 marta topilmasa — qo'lda tekshiruv.
   */
  private applyAcceptedResult(
    p: Participant,
    reel: Reel,
    s: ReelStats | null,
    now: Date,
  ): "updated" | "missing" | "manual" {
    if (s !== null && s.views !== null) {
      reel.misses = 0;
      reel.lastFoundAt = now;
      this.record(reel, s.views, s, now);
      return "updated";
    }
    reel.misses += 1;
    // Admin tasdiqlagan, Apify esa o'shandan beri o'qiy olmayotgan video — qayta tekshiruvga yubormaymiz.
    if (this.vouchedByAdmin(reel)) return "missing";
    if (reel.misses >= ATTEMPTS_BEFORE_MANUAL_REVIEW) {
      this.toManualReview(p, reel, "LOST_REEL");
      return "manual";
    }
    this.retryLater(p.telegramId, NOT_FOUND_RETRY_MS[reel.misses - 1] ?? VERIFY_RETRY_MS);
    return "missing";
  }

  private applyVerification(p: Participant, reel: Reel, s: ReelStats | null, now: Date): void {
    if (s === null) {
      reel.misses += 1;
      if (reel.misses < ATTEMPTS_BEFORE_MANUAL_REVIEW) {
        const delay = NOT_FOUND_RETRY_MS[reel.misses - 1] ?? VERIFY_RETRY_MS;
        this.retryLater(p.telegramId, delay);
        return;
      }
      this.toManualReview(p, reel, "NEW_REEL");
      return;
    }
    this.applyFound(p, reel, s, now);
  }

  /** Video topildi: Reel'mi, egasi bandmi — keyin qabul yoki rad. */
  private applyFound(p: Participant, reel: Reel, s: ReelStats, now: Date): void {
    reel.owner = s.owner;
    reel.postedAt = s.postedAt;
    reel.lastFoundAt = now;
    if (!s.isVideo) {
      this.reject(p, reel, "NOT_A_VIDEO");
      return;
    }
    if (s.owner && this.participants.ownerTakenByOther(s.owner, p.telegramId)) {
      this.reject(p, reel, "OWNER_TAKEN");
      return;
    }
    if (s.views === null) {
      // Manba ko'rishlar sonini bermadi — video PENDING qoladi, navbatdagi yig'ishda qayta tekshiriladi.
      this.logger.warn(`${reel.shortcode}: ko'rishlar soni kelmadi, keyingi yig'ishda qayta tekshiriladi.`);
      return;
    }
    reel.status = "ACCEPTED";
    reel.rejectReason = null;
    reel.misses = 0;
    this.record(reel, s.views, s, now);
    this.notify(p, texts.reelAccepted(formatCount(s.views)), "REEL_ACCEPTED");
  }

  private reject(p: Participant, reel: Reel, reason: ReelRejectReason): void {
    reel.status = "REJECTED";
    reel.rejectReason = reason;
    this.notify(p, texts.reelRejected[reason], "REEL_REJECTED");
  }

  /** Avval ishtirokchiga xabar, so'ng video admin paneldagi qo'lda tekshiruv ro'yxatiga tushadi. */
  private toManualReview(p: Participant, reel: Reel, kind: ManualReview["kind"]): void {
    this.notify(p, texts.reelManualReview[kind], "REEL_REVIEW");
    reel.status = "MANUAL_REVIEW";
    reel.review = { kind, requestedAt: this.now(), attempts: reel.misses, decision: null };
    this.logger.warn(
      `${reel.shortcode}: Apify ${reel.misses} marta topa olmadi — qo'lda tekshiruvga o'tdi (${kind}).`,
    );
  }

  /** Qo'lda tekshiruvdagi videoni Apify keyinroq o'zi topdi — admin kutilmaydi. */
  private resolveByProvider(p: Participant, reel: Reel, s: ReelStats, views: number, now: Date): void {
    const review = reel.review;
    reel.misses = 0;
    if (review?.kind === "LOST_REEL") {
      reel.status = "ACCEPTED";
      reel.lastFoundAt = now;
      this.record(reel, views, s, now);
      this.notify(p, texts.reelRestored, "REEL_REVIEW");
    } else {
      this.applyFound(p, reel, s, now);
    }
    if (review && reel.status !== "MANUAL_REVIEW") {
      review.decision = {
        approved: reel.status === "ACCEPTED",
        reason: reel.rejectReason,
        note: "Apify keyingi yig'ishda videoni topdi",
        by: AUTO_REVIEWER,
        at: now,
      };
    }
  }

  /**
   * Admin videoni qo'lda tasdiqlagan va Apify o'shandan beri uni topa olmagan — qayta-qayta
   * qo'lda tekshiruvga yubormaymiz (admin bir marta ko'rgan, natija o'zgarmaydi).
   */
  private vouchedByAdmin(reel: Reel): boolean {
    const d = reel.review?.decision;
    return (
      d !== undefined &&
      d !== null &&
      d.approved &&
      d.by !== AUTO_REVIEWER &&
      (reel.lastFoundAt === null || reel.lastFoundAt < d.at)
    );
  }

  // --- Qo'lda tekshiruv (admin) ---------------------------------------------

  /** Qo'lda tekshiruvga tushgan barcha videolar (ochiq va qaror qilinganlar). */
  manualReviews(): { participant: Participant; reel: Reel; review: ManualReview }[] {
    return this.participants
      .all()
      .flatMap((p) => (p.reel?.review ? [{ participant: p, reel: p.reel, review: p.reel.review }] : []));
  }

  /**
   * Admin qarori. Tasdiq — video reytingga qo'shiladi (ko'rishlar Apify topganda yangilanadi);
   * rad — sababi ishtirokchiga yuboriladi va u boshqa link yubora oladi.
   */
  decideManualReview(shortcode: string, decision: ManualDecision, actor: string): Reel {
    const found = this.participants.findByShortcode(shortcode);
    if (!found) throw new NotFoundException("Video topilmadi");
    const { participant: p, reel } = found;
    const review = reel.review;
    if (reel.status !== "MANUAL_REVIEW" || !review) {
      throw new ConflictException("Bu video qo'lda tekshiruvda emas (qaror allaqachon qabul qilingan)");
    }
    const now = this.now();
    if (decision.approve) {
      reel.status = "ACCEPTED";
      reel.rejectReason = null;
      reel.misses = 0;
      review.decision = { approved: true, reason: null, note: decision.note, by: actor, at: now };
      this.notify(p, texts.reelManualApproved, "REEL_REVIEW");
    } else {
      review.decision = { approved: false, reason: decision.reason, note: decision.note, by: actor, at: now };
      this.reject(p, reel, decision.reason);
    }
    // Admin login qurilgach — audit_logs jadvaliga yoziladi.
    this.logger.log(
      `Qo'lda tekshiruv: ${shortcode} — ${decision.approve ? "tasdiqlandi" : `rad etildi (${decision.reason})`}, ${actor}.`,
    );
    return reel;
  }

  private retryLater(telegramId: number, delayMs: number): void {
    const timer = setTimeout(() => {
      this.retryTimers.delete(timer);
      this.queueVerification(telegramId);
    }, delayMs);
    timer.unref();
    this.retryTimers.add(timer);
  }

  // --- Muntazam yig'ish -----------------------------------------------------

  get isSyncing(): boolean {
    return this.syncing !== null;
  }

  /** Necha kunda bir marta yig'iladi (0 — avtomatik yig'ish o'chiq). */
  get syncEveryDays(): number {
    return Math.max(0, this.options.everyDays);
  }

  /** Rejalashtiruvchi har daqiqada chaqiradi. */
  tick(): void {
    const reason = this.dueReason();
    if (reason) void this.syncAll(reason);
  }

  /**
   * k-chi rejadagi yig'ish (k ≥ 1): tanlov boshidan k × everyDays kun keyin, soat `syncTime` da.
   * 25-noyabr, har 10 kun → 5-dekabr, 15-dekabr, 25-dekabr …
   */
  private slot(k: number): Date {
    const { contestStartsOn, everyDays, syncTime } = this.options;
    return tashkentAt(addDays(contestStartsOn, k * everyDays), syncTime);
  }

  /** `at` gacha (shu jumladan) kelgan oxirgi rejadagi yig'ish; hali birinchisi kelmagan bo'lsa — null. */
  private lastSlotAtOrBefore(at: Date): Date | null {
    if (this.options.everyDays <= 0) return null;
    let found: Date | null = null;
    for (let k = 1; ; k++) {
      const s = this.slot(k);
      if (s > at || s >= this.options.contestEndsAt) return found;
      found = s;
    }
  }

  private get finalDone(): boolean {
    return this.lastSuccessAt !== null && this.lastSuccessAt >= this.options.contestEndsAt;
  }

  /** Hozir yig'ish vaqti keldimi; kelgan bo'lsa — sababi. */
  dueReason(): "schedule" | "final" | null {
    if (this.syncing) return null;
    const now = this.now();
    const last = this.lastSync;
    // Muvaffaqiyatsiz urinishdan keyin darrov qayta urinmaymiz (pul va limitlar).
    if (last?.error && last.finishedAt && now.getTime() - last.finishedAt.getTime() < SYNC_RETRY_MS) {
      return null;
    }
    if (now >= this.options.contestEndsAt) {
      // Tanlov tugagach — bitta yakuniy yig'ish (g'olib shu ko'rishlar bo'yicha), keyin to'xtaydi.
      return this.finalDone ? null : "final";
    }
    // Oxirgi rejadagi vaqtdan beri yig'ilmagan bo'lsa (server o'chiq turgan bo'lsa ham) — hozir.
    const slot = this.lastSlotAtOrBefore(now);
    if (!slot) return null;
    return this.lastSuccessAt === null || this.lastSuccessAt < slot ? "schedule" : null;
  }

  /**
   * Keyingi rejadagi yig'ish vaqti (Mini App'da "Keyingi yangilanish"). Oxirgi davrdan keyin —
   * tanlov tugash vaqtidagi yakuniy yig'ish. Hammasi tugagan yoki avtomatik yig'ish o'chiq — null.
   */
  nextSyncAt(): Date | null {
    if (this.options.everyDays <= 0) return null;
    const now = this.now();
    const end = this.options.contestEndsAt;
    if (now >= end) return this.finalDone ? null : end;
    for (let k = 1; ; k++) {
      const s = this.slot(k);
      if (s >= end) return end;
      if (s > now) return s;
    }
  }

  /** Barcha videolarning ko'rishlarini yig'adi. Bir vaqtda faqat bitta yig'ish ishlaydi. */
  syncAll(reason: SyncReport["reason"]): Promise<SyncReport> {
    this.syncing ??= this.runSync(reason).finally(() => {
      this.syncing = null;
    });
    return this.syncing;
  }

  private async runSync(reason: SyncReport["reason"]): Promise<SyncReport> {
    const report: SyncReport = {
      reason,
      startedAt: this.now(),
      finishedAt: null,
      total: 0,
      updated: 0,
      missing: 0,
      toManualReview: 0,
      resolved: 0,
      error: null,
    };
    // PENDING ham kiradi: tekshiruvi chala qolganlar shu yerda qayta tekshiriladi.
    // MANUAL_REVIEW ham: Apify o'zi topib qolsa, admin kutib o'tirmaydi.
    const targets = this.participants.all().flatMap((p) =>
      p.reel && p.reel.status !== "REJECTED" ? [{ p, reel: p.reel }] : [],
    );
    report.total = targets.length;

    try {
      const stats =
        targets.length > 0
          ? await this.provider.fetch(targets.map((t) => t.reel.shortcode))
          : new Map<string, ReelStats | null>();
      const now = this.now();
      this.previousRanks = new Map(this.ranking().map((e) => [e.participant.telegramId, e.rank]));

      for (const { p, reel } of targets) {
        if (!this.isCurrent(p, reel) || reel.status === "REJECTED" || !stats.has(reel.shortcode)) continue;
        const s = stats.get(reel.shortcode) ?? null;
        if (reel.status === "PENDING") {
          this.applyVerification(p, reel, s, now);
          continue;
        }
        if (reel.status === "MANUAL_REVIEW") {
          if (s !== null && s.views !== null) {
            this.resolveByProvider(p, reel, s, s.views, now);
            report.resolved += 1;
          }
          continue;
        }
        // ACCEPTED
        const result = this.applyAcceptedResult(p, reel, s, now);
        if (result === "updated") report.updated += 1;
        else report.missing += 1;
        if (result === "manual") report.toManualReview += 1;
      }
      this.lastSuccessAt = now;
    } catch (err) {
      report.error = (err as Error).message;
    }

    report.finishedAt = this.now();
    this.lastSync = report;
    const seconds = Math.round((report.finishedAt.getTime() - report.startedAt.getTime()) / 1000);
    if (report.error) {
      this.logger.error(`Ko'rishlarni yig'ib bo'lmadi (${report.reason}): ${report.error}`);
    } else {
      this.logger.log(
        `Ko'rishlar yig'ildi (${report.reason}, ${seconds} s): ${report.updated}/${report.total} yangilandi, ` +
          `${report.missing} topilmadi, ${report.toManualReview} qo'lda tekshiruvga o'tdi, ` +
          `${report.resolved} qo'lda tekshiruvdan o'zi qaytdi.`,
      );
    }
    return report;
  }

  // --- Reyting va holat -----------------------------------------------------

  /**
   * Reyting: qabul qilingan videolar, faol (bloklanmagan, chetlatilmagan) ishtirokchilar.
   * Teng ko'rishda — videoni oldinroq yuborgan yuqorida.
   */
  ranking(): RankedEntry[] {
    const rows = this.participants.all().flatMap((p) =>
      p.reel?.status === "ACCEPTED" && p.status === "ACTIVE" && p.firstName
        ? [{ participant: p, reel: p.reel, views: p.reel.history.at(-1)?.views ?? 0 }]
        : [],
    );
    rows.sort(
      (a, b) => b.views - a.views || a.reel.submittedAt.getTime() - b.reel.submittedAt.getTime(),
    );
    return rows.map((row, i) => {
      const previous = this.previousRanks.get(row.participant.telegramId);
      return { ...row, rank: i + 1, rankDelta: previous === undefined ? 0 : previous - (i + 1) };
    });
  }

  status() {
    const reels = this.participants.all().flatMap((p) => (p.reel ? [p.reel] : []));
    return {
      provider: this.provider.name,
      syncTime: this.options.syncTime,
      everyDays: this.options.everyDays,
      contestStartsOn: this.options.contestStartsOn,
      contestEndsAt: this.options.contestEndsAt.toISOString(),
      running: this.isSyncing,
      lastSync: this.lastSync,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      nextSyncAt: this.nextSyncAt()?.toISOString() ?? null,
      reels: {
        pending: reels.filter((r) => r.status === "PENDING").length,
        accepted: reels.filter((r) => r.status === "ACCEPTED").length,
        manualReview: reels.filter((r) => r.status === "MANUAL_REVIEW").length,
        rejected: reels.filter((r) => r.status === "REJECTED").length,
        flagged: reels.filter((r) => r.flags.length > 0).length,
      },
    };
  }

  // -------------------------------------------------------------------------

  /** Kunlik holatni yozadi (bir kunga bitta — kun ichidagi takroriy yig'ish oxirgisini almashtiradi). */
  private record(reel: Reel, views: number, s: ReelStats, now: Date): void {
    // Tanlov tugagandan keyingi yakuniy yig'ish oxirgi tanlov kuniga yoziladi — g'olib aniqlanadigan
    // ko'rishlar kunlik reyting va dashboard'da (ular tanlov muddati bilan cheklangan) ko'rinsin.
    const lastDay = contestDay(new Date(this.options.contestEndsAt.getTime() - 1));
    const today = contestDay(now);
    const date = today > lastDay ? lastDay : today;
    const snapshot = { date, at: now, views, likes: s.likes, comments: s.comments };
    const last = reel.history.at(-1);
    if (last?.date === snapshot.date) reel.history[reel.history.length - 1] = snapshot;
    else reel.history.push(snapshot);
    detectFlags(reel);
  }

  private isCurrent(p: Participant, reel: Reel): boolean {
    return this.participants.get(p.telegramId) === p && p.reel === reel;
  }

  private notify(p: Participant, text: string, kind: TelegramMessageKind): void {
    if (p.chatId === null) return;
    this.notifier.notify(p.chatId, text, kind).catch((err: Error) => {
      this.logger.warn(`Ishtirokchiga (${p.telegramId}) xabar yuborilmadi: ${err.message}`);
    });
  }
}

/** Oxirgi holat asosida nakrutka signallarini qo'shadi. */
/** Qabul qilingan, lekin oxirgi tekshiruvda topilmagan — qisqa vaqtda qayta tekshiriladi. */
const isRechecking = (reel: Reel): boolean => reel.status === "ACCEPTED" && reel.misses > 0;

export function detectFlags(reel: Reel): void {
  const h = reel.history;
  const cur = h.at(-1);
  if (!cur) return;
  const prev = h.length >= 2 ? h[h.length - 2] : null;
  const before = h.length >= 3 ? h[h.length - 3] : null;
  const R = FLAG_RULES;

  const add = (type: ReelFlagType, detail: string, once = false) => {
    const existing = reel.flags.find((f) => f.type === type && (once || f.date === cur.date));
    if (existing) {
      existing.date = cur.date;
      existing.detail = detail;
    } else {
      reel.flags.push({ type, date: cur.date, detail });
    }
  };

  if (cur.likes !== null && cur.views >= R.lowEngagementMinViews) {
    const ratio = cur.likes / cur.views;
    if (ratio < R.lowEngagementRatio) {
      add(
        "LOW_ENGAGEMENT",
        `${formatCount(cur.likes)} layk / ${formatCount(cur.views)} ko'rish (${(ratio * 100).toFixed(2)}%)`,
        true,
      );
    }
  }

  if (!prev) return;
  if (cur.views < prev.views * (1 - R.dropRatio)) {
    add("VIEW_DROP", `${formatCount(prev.views)} → ${formatCount(cur.views)}`);
  }
  if (!before) return;
  const rate = (cur.views - prev.views) / Math.max(1, daysBetween(prev.date, cur.date));
  const prevRate = (prev.views - before.views) / Math.max(1, daysBetween(before.date, prev.date));
  if (rate >= R.spikeMinDailyGain && rate > R.spikeFactor * Math.max(prevRate, 1)) {
    add("VIEW_SPIKE", `kuniga +${formatCount(Math.round(prevRate))} → +${formatCount(Math.round(rate))}`);
  }

  // Ko'rishlar oshgan, layklar o'smagan: reklama begona auditoriyaga ko'rsatiladi.
  if (cur.likes === null || prev.likes === null || prev.views <= 0 || prev.likes <= 0) return;
  const viewsGain = cur.views - prev.views;
  if (rate < R.gapMinDailyGain || rate <= R.gapFactor * Math.max(prevRate, 1)) return;
  const usualShare = prev.likes / prev.views;
  const dayShare = Math.max(0, cur.likes - prev.likes) / viewsGain;
  if (dayShare < R.gapLikeShare * usualShare) {
    add(
      "ENGAGEMENT_GAP",
      `+${formatCount(viewsGain)} ko'rish, +${formatCount(Math.max(0, cur.likes - prev.likes))} layk ` +
        `(layk ulushi ${percent(usualShare)} → ${percent(dayShare)})`,
    );
  }
}

const percent = (ratio: number): string => `${(ratio * 100).toFixed(ratio < 0.01 ? 2 : 1)}%`;

/** 156745 → "156 745". */
export const formatCount = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
