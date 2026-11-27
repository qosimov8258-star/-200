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

import { AiReviewService, type AiGateOutcome } from "../ai-review/ai-review.service";
import { addDays, contestDay, daysBetween, tashkentAt } from "../common/time";
import { ReelStatsProvider, type ReelStats } from "../instagram/reel-stats";
import {
  acceptedReels,
  participantViews,
  ParticipantsService,
  reelViews,
  type ManualReview,
  type ManualReviewAi,
  type Participant,
  type Reel,
  type ReelFlagType,
  type ReelRejectReason,
} from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { ParticipantNotifier, type TelegramMessageKind } from "../telegram/notifier";
import { textsFor } from "../telegram/bot-texts";

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

/** Tanlangan videolarni navbatdan tashqari yangilash (admin: "Ko'rishlarni yangilash"). */
export interface RefreshReport {
  startedAt: Date;
  finishedAt: Date | null;
  /** So'ralgan videolar (ishtirokchilarning barcha qabul qilingan videolari). */
  requested: number;
  updated: number;
  /** Instagram'da topilmaganlar (odatdagidek qayta tekshiriladi / qo'lda tekshiruvga o'tadi). */
  missing: number;
  error: string | null;
  /** Kim va qaysi oraliq uchun (log va admin panel uchun). */
  label: string;
}

/** Admin qarori (qo'lda tekshiruv). */
export type ManualDecision =
  | { approve: true; note: string }
  | { approve: false; reason: ReelRejectReason; note: string };

/** Apify o'zi topib, qo'lda tekshiruvni yopganda qaror muallifi. */
export const AUTO_REVIEWER = "Avtomatik";

/** Ishtirokchi reytingi (g'olib, sovrinlar, target tekshiruvi — bitta ishtirokchi bitta qator). */
export interface RankedEntry {
  participant: Participant;
  /** Reytingga kirgan (ACCEPTED) videolari — yuborilish tartibida, kamida bittasi. */
  reels: Reel[];
  /** Ishtirokchilar reytingidagi o'rni: 1..N (umumiy ko'rishlar bo'yicha). */
  rank: number;
  /** Barcha qabul qilingan videolari ko'rishlarining yig'indisi (oferta 7.1). */
  views: number;
  /** Oldingi yig'ishdagi o'ringa nisbatan: musbat — ko'tarilgan. */
  rankDelta: number;
}

/** Videolar reytingi (ommaviy reyting): har bir qabul qilingan video — alohida qator. */
export interface RankedReel {
  participant: Participant;
  reel: Reel;
  /** Shu videoning oxirgi ko'rishlari. */
  views: number;
  /** 1 dan boshlab, har bir videoga alohida. */
  rank: number;
  /** Shu videoning oldingi yig'ishdagi o'rniga nisbatan: musbat — ko'tarilgan; yangi video — 0. */
  rankDelta: number;
}

/**
 * Apify videoni ketma-ket shuncha marta topa olmasa (yoki tekshira olmasa) — ishtirokchiga xabar
 * beriladi va video admin paneldagi "Qo'lda tekshiruv" bo'limiga o'tadi (avtomatik rad etilmaydi).
 */
export const ATTEMPTS_BEFORE_MANUAL_REVIEW = 3;
/** AI shuncha vaqtda natija bermasa — video "Qo'lda tekshiruv"ga o'tadi (cheksiz kutib qolmasin). */
export const AI_CHECK_MAX_MS = 2 * 60 * 60_000;
/** AI worker ishlamayotgan bo'lsa — shuncha kutgan video adminga o'tadi. */
export const AI_WORKER_GRACE_MS = 10 * 60_000;
const AI_WATCHDOG_MS = 60_000;
/** Bir vaqtda nechta yangi-video tekshiruvi (Apify ishi) ishlashi mumkin. */
const MAX_PARALLEL_VERIFY = 3;
/** Yangi video topilmasa — 2- va 3-urinishdan oldin shuncha kutiladi. */
const NOT_FOUND_RETRY_MS = [2 * 60_000, 10 * 60_000];
/**
 * Admin qo'lda tasdiqlagan, ko'rishlari hali o'qilmagan video — Apify shu oraliqlarda qayta so'raladi
 * (keyin — rejadagi yig'ishda). Tasdiqlangan zahoti ham bir marta so'raladi.
 */
const APPROVED_VIEWS_RETRY_MS = [2 * 60_000, 10 * 60_000, 30 * 60_000, 60 * 60_000, 3 * 60 * 60_000, 6 * 60 * 60_000];
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
 * Ishtirokchida videolar soni cheklanmagan — har bir video alohida tekshiriladi, yig'iladi,
 * qayta tekshiriladi va kerak bo'lsa qo'lda tekshiruvga o'tadi (urinishlar har videoda o'zicha).
 *
 * - Yangi video: bir necha soniyada (navbat bilan, bitta so'rovda) tekshiriladi — topildimi,
 *   Reel'mi, egasi boshqa ishtirokchida emasmi. Natija bot orqali xabar qilinadi.
 * - Ko'rishlar: har `everyDays` kunda soat `syncTime` da (Toshkent) rad etilmagan hamma videolar uchun.
 * - Reyting: ishtirokchining barcha qabul qilingan videolari ko'rishlarining yig'indisi bo'yicha
 *   (oferta 7.1); faqat ma'lumot uchun — g'oliblar oraliqlar ichida random aniqlanadi.
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

  /**
   * Tekshiruv navbati: ishtirokchi va video (shortcode); `shortcode: null` — ishtirokchining
   * tekshirilishi kerak bo'lgan barcha videolari. Kalit takrorlarni birlashtiradi.
   */
  private readonly queue = new Map<string, { telegramId: number; shortcode: string | null }>();
  private queueTimer: NodeJS.Timeout | null = null;
  private readonly retryTimers = new Set<NodeJS.Timeout>();
  /** Hozir ishlayotgan tekshiruvlar (bir vaqtda `MAX_PARALLEL_VERIFY` tagacha). */
  private readonly verifying = new Set<Promise<void>>();
  /** Navbatini kutayotgan tekshiruvlar (parallel chegara to'lganda). */
  private readonly verifyWaiting: (() => void)[] = [];
  /** Hozir tekshirilayotgan videolar — ikki tekshiruvga bir xil video tushmasin. */
  private readonly inFlight = new Set<string>();
  private verifyFailures = 0;

  private syncing: Promise<SyncReport> | null = null;
  private refreshing: Promise<RefreshReport> | null = null;
  private lastRefresh: RefreshReport | null = null;
  private lastSync: SyncReport | null = null;
  /** Oxirgi muvaffaqiyatli yig'ish vaqti. */
  private lastSuccessAt: Date | null = null;
  /** Oxirgi yig'ishdan oldingi o'rinlar (rankDelta uchun): ishtirokchi → eng yaxshi videosi o'rni. */
  private previousRanks = new Map<number, number>();
  /** Oxirgi yig'ishdan oldingi videolar o'rni: shortcode → o'rin. */
  private previousReelRanks = new Map<string, number>();
  private scheduler: NodeJS.Timeout | null = null;
  private aiWatchdog: NodeJS.Timeout | null = null;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly provider: ReelStatsProvider,
    private readonly notifier: ParticipantNotifier,
    @Inject(STATS_OPTIONS) private readonly options: StatsOptions,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
    /** Yangi videolar mazmuni (mahsulot bormi) — avval AI, keyin qabul. Yo'q bo'lsa — faqat Apify. */
    @Optional() @Inject(AiReviewService) private readonly ai: AiReviewService | null = null,
  ) {
    this.now = options.clock ?? (() => new Date());
    this.ai?.setGateListener((outcome) => this.applyAiOutcome(outcome));
    const saved = store?.attach("stats", () => ({
      lastSync: this.lastSync,
      lastSuccessAt: this.lastSuccessAt,
      previousRanks: [...this.previousRanks],
      previousReelRanks: [...this.previousReelRanks],
      rankBasis: "sum" as const,
    }));
    if (saved) {
      this.lastSync = saved.lastSync;
      this.lastSuccessAt = saved.lastSuccessAt;
      // Eski holatda o'rinlar eng ko'p ko'rilgan video bo'yicha edi — yig'indi bo'yicha reyting bilan
      // solishtirib bo'lmaydi: birinchi yig'ishgacha o'rin o'zgarishi 0 ko'rinadi.
      this.previousRanks = saved.rankBasis === "sum" ? new Map(saved.previousRanks) : new Map();
      // Eski holat faylida bo'lmaydi — birinchi yig'ishgacha videolar o'rni o'zgarishi 0.
      this.previousReelRanks = new Map(saved.previousReelRanks ?? []);
    }
  }

  onApplicationBootstrap(): void {
    // Qayta ishga tushganda: tekshiruvi chala qolgan videolar navbatga qaytadi (taymerlar saqlanmaydi).
    for (const p of this.participants.all()) {
      for (const reel of p.reels) if (needsCheck(reel)) this.queueVerification(p.telegramId, reel.shortcode);
    }
    // AI natijasini kutayotgan videolar cheksiz kutib qolmasin (worker o'chiq yoki javob bermasa — adminga;
    // AI o'chirilgan bo'lsa — qabul).
    this.checkAiWaits();
    this.aiWatchdog = setInterval(() => this.checkAiWaits(), AI_WATCHDOG_MS);
    this.aiWatchdog.unref();
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
    if (this.aiWatchdog) clearInterval(this.aiWatchdog);
    if (this.queueTimer) clearTimeout(this.queueTimer);
    for (const timer of this.retryTimers) clearTimeout(timer);
  }

  // --- Yangi videolarni tekshirish -----------------------------------------

  /**
   * Videoni navbatga qo'yadi; `verifyDelayMs` ichida kelganlar bitta so'rovda tekshiriladi.
   * `shortcode` berilmasa — ishtirokchining tekshirilishi kerak bo'lgan barcha videolari.
   */
  queueVerification(telegramId: number, shortcode: string | null = null): void {
    this.queue.set(`${telegramId}:${shortcode ?? "*"}`, { telegramId, shortcode });
    if (this.queueTimer) return;
    this.queueTimer = setTimeout(() => {
      this.queueTimer = null;
      void this.flushVerification();
    }, this.options.verifyDelayMs);
    this.queueTimer.unref();
  }

  /**
   * Navbatni hoziroq tekshiradi. Oldingi tekshiruv tugashini kutmaydi — bir vaqtda
   * `MAX_PARALLEL_VERIFY` tagacha Apify ishi (natija boshiga to'lanadi — narx oshmaydi), shunda
   * ko'p odam birdan link yuborsa ham har biri tez javob oladi. Natija — hamma tekshiruvlar tugashi.
   */
  flushVerification(): Promise<void> {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }
    const entries = [...this.queue.values()];
    this.queue.clear();
    if (entries.length > 0) {
      const run: Promise<void> = this.verifySlot()
        .then(() => this.verifyBatch(entries))
        .finally(() => {
          this.verifying.delete(run);
          this.verifyWaiting.shift()?.();
        });
      this.verifying.add(run);
    }
    return Promise.all([...this.verifying]).then(() => undefined);
  }

  /** Parallel tekshiruvlar chegarasi: joy bo'lsa — darhol, aks holda biri tugashini kutadi. */
  private verifySlot(): Promise<void> {
    if (this.verifying.size < MAX_PARALLEL_VERIFY) return Promise.resolve();
    return new Promise((resolve) => this.verifyWaiting.push(resolve));
  }

  private async verifyBatch(entries: { telegramId: number; shortcode: string | null }[]): Promise<void> {
    // Yangi videolar va yig'ishda topilmay qolgan (qayta tekshiriladigan) qabul qilinganlar.
    const seen = new Set<Reel>();
    const targets: { p: Participant; reel: Reel }[] = [];
    for (const { telegramId, shortcode } of entries) {
      const p = this.participants.get(telegramId);
      if (!p) continue;
      for (const reel of p.reels) {
        if ((shortcode !== null && reel.shortcode !== shortcode) || !needsCheck(reel) || seen.has(reel)) continue;
        // Shu video boshqa (parallel) tekshiruvda — natijasi o'sha yerda yoziladi.
        if (this.inFlight.has(reel.shortcode)) continue;
        seen.add(reel);
        targets.push({ p, reel });
      }
    }
    if (targets.length === 0) return;
    const codes = targets.map((t) => t.reel.shortcode);
    for (const code of codes) this.inFlight.add(code);
    try {
      await this.verifyTargets(targets);
    } finally {
      for (const code of codes) this.inFlight.delete(code);
    }
  }

  private async verifyTargets(targets: { p: Participant; reel: Reel }[]): Promise<void> {

    let stats: Map<string, ReelStats | null>;
    try {
      stats = await this.provider.fetch(shortcodesOf(targets));
      this.verifyFailures = 0;
    } catch (err) {
      this.verifyFailures += 1;
      const delay = Math.min(VERIFY_RETRY_MS * 2 ** (this.verifyFailures - 1), VERIFY_RETRY_MAX_MS);
      this.logger.error(
        `${targets.length} ta videoni tekshirib bo'lmadi: ${(err as Error).message}. ` +
          `${Math.round(delay / 60_000)} daqiqadan keyin qayta urinamiz.`,
      );
      for (const { p, reel } of targets) {
        if (!this.isCurrent(p, reel)) continue;
        // Yangi video "tekshirilmoqda"da cheksiz qolib ketmasin: Apify 3 marta tekshira olmasa — adminga.
        if (reel.status === "PENDING") {
          reel.misses += 1;
          if (reel.misses >= ATTEMPTS_BEFORE_MANUAL_REVIEW) {
            this.toManualReview(p, reel, "NEW_REEL");
            continue;
          }
        }
        this.retryLater(p.telegramId, reel.shortcode, delay);
      }
      return;
    }

    const now = this.now();
    for (const { p, reel } of targets) {
      // Kutish paytida ishtirokchi o'chirilgan yoki video qayta yuborilib almashtirilgan bo'lishi mumkin.
      if (!this.isCurrent(p, reel) || !stats.has(reel.shortcode)) continue;
      const s = stats.get(reel.shortcode) ?? null;
      if (reel.status === "PENDING") this.applyVerification(p, reel, s, now);
      else if (isRechecking(reel)) this.applyAcceptedResult(p, reel, s, now);
    }
  }

  /**
   * Qabul qilingan video natijasi (yig'ishda yoki qayta tekshiruvda). Topilmasa — 2 va 10 daqiqadan
   * keyin qayta tekshiriladi (keyingi rejadagi yig'ishni kutmaymiz);
   * 3 marta topilmasa — qo'lda tekshiruv.
   */
  private applyAcceptedResult(
    p: Participant,
    reel: Reel,
    s: ReelStats | null,
    now: Date,
  ): "updated" | "missing" | "manual" {
    if (s !== null) {
      // Video bor: egasi va sanasi (admin qo'lda tasdiqlagan yangi videoda hali yo'q) — birinchi o'qishda.
      if (reel.owner === null) reel.owner = s.owner;
      if (reel.postedAt === null) reel.postedAt = s.postedAt;
      const views = readableViews(reel, s);
      if (views !== null) {
        reel.misses = 0;
        reel.lastFoundAt = now;
        this.record(reel, views, s, now);
        return "updated";
      }
      // Video topildi, lekin ko'rishlari o'qilmadi (yoki 0 bo'lib keldi) — video yo'qolgani yo'q:
      // oxirgi ma'lum ko'rishlar qoladi, qo'lda tekshiruvga yuborilmaydi.
      this.logger.warn(`${reel.shortcode}: ko'rishlar o'qilmadi (${s.views ?? "yo'q"}), oxirgi ma'lumi qoldi.`);
      if (!awaitingViews(reel)) return "missing";
    }
    reel.misses += 1;
    // Admin tasdiqlagan, Apify esa o'shandan beri o'qiy olmayotgan video — qayta tekshiruvga yubormaymiz,
    // lekin ko'rishlari hali umuman o'qilmagan bo'lsa — tez-tez qayta urinamiz (0 bo'lib turmasin).
    if (this.vouchedByAdmin(reel)) {
      if (awaitingViews(reel)) this.retryApprovedLater(p, reel);
      return "missing";
    }
    if (reel.misses >= ATTEMPTS_BEFORE_MANUAL_REVIEW) {
      this.toManualReview(p, reel, "LOST_REEL");
      return "manual";
    }
    this.retryLater(p.telegramId, reel.shortcode, NOT_FOUND_RETRY_MS[reel.misses - 1] ?? VERIFY_RETRY_MS);
    return "missing";
  }

  private applyVerification(p: Participant, reel: Reel, s: ReelStats | null, now: Date): void {
    // AI natijasini kutayotgan video: Apify o'z ishini qilgan — faqat ko'rishlari yangilanadi.
    if (reel.aiCheck) {
      const views = s === null ? null : readableViews(reel, s);
      if (s !== null && views !== null) this.record(reel, views, s, now);
      return;
    }
    if (s === null) {
      this.missNewReel(p, reel);
      return;
    }
    this.applyFound(p, reel, s, now);
  }

  /** Yangi video topilmadi (yoki ma'lumoti chala keldi): 2 va 10 daqiqadan keyin qayta; 3-marta — adminga. */
  private missNewReel(p: Participant, reel: Reel): void {
    reel.misses += 1;
    if (reel.misses < ATTEMPTS_BEFORE_MANUAL_REVIEW) {
      const delay = NOT_FOUND_RETRY_MS[reel.misses - 1] ?? VERIFY_RETRY_MS;
      this.retryLater(p.telegramId, reel.shortcode, delay);
      return;
    }
    this.toManualReview(p, reel, "NEW_REEL");
  }

  /**
   * Video topildi: Reel'mi, egasi bandmi — keyin AI tekshiruvi (mezonlar tasdiqlangan bo'lsa) yoki
   * darhol qabul. AI tasdiqlasa — `applyAiOutcome` qabul qiladi.
   */
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
      // Manba ko'rishlar sonini bermadi — qisqa vaqtda qayta so'raymiz (3-marta ham bo'lmasa — adminga),
      // video "tekshirilmoqda"da kunlik yig'ishgacha kutib qolmasin.
      this.logger.warn(`${reel.shortcode}: ko'rishlar soni kelmadi, qayta tekshiriladi.`);
      this.missNewReel(p, reel);
      return;
    }
    reel.status = "PENDING";
    reel.misses = 0;
    this.record(reel, s.views, s, now);
    if (this.ai?.submitForAcceptance(p.telegramId, reel.shortcode, s.videoUrl ?? null)) {
      reel.aiCheck = { requestedAt: now };
      this.logger.log(`${reel.shortcode}: Apify topdi (${formatCount(s.views)} ko'rish) — AI tekshiruviga yuborildi.`);
      return;
    }
    this.accept(p, reel, textsFor(p.lang).reelAccepted(formatCount(s.views)));
  }

  private accept(p: Participant, reel: Reel, text: string): void {
    reel.status = "ACCEPTED";
    reel.rejectReason = null;
    reel.misses = 0;
    reel.aiCheck = null;
    this.notifyAbout(p, reel, text, "REEL_ACCEPTED");
    // Ko'rishlari hali o'qilmagan bo'lsa — Apify'dan hoziroq (reytingda 0 bo'lib turmasin).
    if (awaitingViews(reel)) this.queueVerification(p.telegramId, reel.shortcode);
  }

  /** AI natijasi: tasdiqlandi — qabul; topmadi, shubhali yoki ko'ra olmadi — adminga (qo'lda tekshiruv). */
  private applyAiOutcome(o: AiGateOutcome): void {
    const p = this.participants.get(o.telegramId);
    const reel = p?.reels.find((r) => r.shortcode === o.shortcode && r.status === "PENDING" && r.aiCheck);
    if (!p || !reel) return;
    if (o.verdict === "APPROVED") {
      this.logger.log(`${reel.shortcode}: AI tasdiqladi — video qabul qilindi.`);
      this.accept(p, reel, textsFor(p.lang).reelAccepted(formatCount(reelViews(reel))));
      return;
    }
    this.toManualReview(p, reel, "AI_CHECK", { verdict: o.verdict, reason: o.reason, confidence: o.confidence });
  }

  /**
   * AI natijasini juda uzoq kutayotgan videolar — adminga (worker o'chiq yoki javob bermadi).
   * AI tekshiruvi o'chirilgan bo'lsa — kutayotganlar qabul qilinadi (Apify ularni allaqachon topgan).
   */
  checkAiWaits(): void {
    const now = this.now().getTime();
    const gate = this.ai?.gateEnabled() ?? false;
    const alive = this.ai?.workerAlive() ?? false;
    for (const p of this.participants.all()) {
      for (const reel of p.reels) {
        if (reel.status !== "PENDING" || !reel.aiCheck) continue;
        if (!gate) {
          this.accept(p, reel, textsFor(p.lang).reelAccepted(formatCount(reelViews(reel))));
          continue;
        }
        const waited = now - new Date(reel.aiCheck.requestedAt).getTime();
        if (waited >= AI_CHECK_MAX_MS) {
          this.toManualReview(p, reel, "AI_CHECK", {
            verdict: "FAILED",
            reason: `AI ${Math.round(AI_CHECK_MAX_MS / 3_600_000)} soat ichida natija bermadi.`,
            confidence: null,
          });
        } else if (!alive && waited >= AI_WORKER_GRACE_MS) {
          this.toManualReview(p, reel, "AI_CHECK", {
            verdict: "FAILED",
            reason: "AI tekshiruvi ishlamayapti (worker o'chiq) — video avtomatik tekshirilmadi.",
            confidence: null,
          });
        }
      }
    }
  }

  private reject(p: Participant, reel: Reel, reason: ReelRejectReason): void {
    reel.status = "REJECTED";
    reel.rejectReason = reason;
    this.notifyAbout(p, reel, textsFor(p.lang).reelRejected[reason], "REEL_REJECTED");
  }

  /** Avval ishtirokchiga xabar, so'ng video admin paneldagi qo'lda tekshiruv ro'yxatiga tushadi. */
  private toManualReview(p: Participant, reel: Reel, kind: ManualReview["kind"], ai: ManualReviewAi | null = null): void {
    this.notifyAbout(p, reel, textsFor(p.lang).reelManualReview[kind], "REEL_REVIEW");
    reel.status = "MANUAL_REVIEW";
    reel.aiCheck = null;
    reel.review = { kind, requestedAt: this.now(), attempts: reel.misses, ai, decision: null };
    this.logger.warn(
      kind === "AI_CHECK"
        ? `${reel.shortcode}: AI mahsulotni tasdiqlamadi (${ai?.verdict ?? "—"}) — qo'lda tekshiruvga o'tdi.`
        : `${reel.shortcode}: Apify ${reel.misses} marta topa olmadi — qo'lda tekshiruvga o'tdi (${kind}).`,
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
      this.notifyAbout(p, reel, textsFor(p.lang).reelRestored, "REEL_REVIEW");
    } else {
      this.applyFound(p, reel, s, now);
    }
    if (review && reel.status !== "MANUAL_REVIEW") {
      // PENDING — Apify topdi, endi AI tekshiradi (topmasa, yangi qo'lda tekshiruv ochiladi).
      review.decision = {
        approved: reel.status !== "REJECTED",
        reason: reel.rejectReason,
        note: reel.aiCheck
          ? "Apify keyingi yig'ishda videoni topdi — AI tekshiruviga yuborildi"
          : "Apify keyingi yig'ishda videoni topdi",
        by: AUTO_REVIEWER,
        at: now,
      };
    }
  }

  /** Tasdiqlangan, ko'rishlari hali o'qilmagan video: `misses` — tasdiqdan keyingi urinishlar. */
  private retryApprovedLater(p: Participant, reel: Reel): void {
    const delay = APPROVED_VIEWS_RETRY_MS[reel.misses - 1];
    if (delay !== undefined) this.retryLater(p.telegramId, reel.shortcode, delay);
  }

  /**
   * Admin videoni qo'lda tasdiqlagan va Apify o'shandan beri uni topa olmagan — qayta-qayta
   * qo'lda tekshiruvga yubormaymiz (admin bir marta ko'rgan, natija o'zgarmaydi). AI tekshiruvidan
   * keyin tasdiqlangan video bunga kirmaydi: uni Apify topgan edi, yo'qolsa — odatdagidek adminga.
   */
  private vouchedByAdmin(reel: Reel): boolean {
    const d = reel.review?.decision;
    return (
      reel.review?.kind !== "AI_CHECK" &&
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
      .flatMap((p) => p.reels.flatMap((reel) => (reel.review ? [{ participant: p, reel, review: reel.review }] : [])));
  }

  /**
   * Admin qarori. Tasdiq — video reytingga qo'shiladi; ko'rishlari hali o'qilmagan bo'lsa, Apify'dan
   * hoziroq so'raladi (topilmasa — `APPROVED_VIEWS_RETRY_MS` oraliqlarida qayta);
   * rad — sababi ishtirokchiga yuboriladi. Shortcode bo'yicha rad etilmagan (band) video olinadi —
   * u barcha ishtirokchilar orasida bitta.
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
    reel.aiCheck = null;
    if (review.kind === "AI_CHECK") this.ai?.noteManualDecision(reel.shortcode, decision.approve, decision.note, actor);
    if (decision.approve) {
      reel.status = "ACCEPTED";
      reel.rejectReason = null;
      reel.misses = 0;
      review.decision = { approved: true, reason: null, note: decision.note, by: actor, at: now };
      this.notifyAbout(p, reel, textsFor(p.lang).reelManualApproved, "REEL_REVIEW");
      // Yangi video ko'rishlari hali o'qilmagan — kunlik yig'ishni kutmay, Apify'dan hoziroq so'raymiz
      // (aks holda reyting va admin panelda 0 bo'lib turadi).
      if (awaitingViews(reel)) this.queueVerification(p.telegramId, reel.shortcode);
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

  private retryLater(telegramId: number, shortcode: string, delayMs: number): void {
    const timer = setTimeout(() => {
      this.retryTimers.delete(timer);
      this.queueVerification(telegramId, shortcode);
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
    // Qisman yangilash tugashini kutamiz — ikkita so'rov bir vaqtda Apify'ga ketmasin.
    if (this.syncing || this.refreshing) return null;
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

  get isRefreshing(): boolean {
    return this.refreshing !== null;
  }

  get lastRefreshReport(): RefreshReport | null {
    return this.lastRefresh;
  }

  /**
   * Tanlangan ishtirokchilarning qabul qilingan videolarini hoziroq qayta o'qiydi (masalan,
   * sovg'a topshirishdan oldin). Rejadagi yig'ish jadvaliga ta'sir qilmaydi. Bir vaqtda faqat
   * bitta yig'ish yoki yangilash ishlaydi — band bo'lsa `null`.
   */
  refreshReels(telegramIds: readonly number[], label: string): Promise<RefreshReport> | null {
    if (this.syncing || this.refreshing) return null;
    this.refreshing = this.runRefresh(telegramIds, label).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async runRefresh(telegramIds: readonly number[], label: string): Promise<RefreshReport> {
    // Har bir ishtirokchining barcha qabul qilingan videolari (cheksiz video).
    const targets = telegramIds.flatMap((id) => {
      const p = this.participants.get(id);
      return p ? acceptedReels(p).map((reel) => ({ p, reel })) : [];
    });
    const report: RefreshReport = {
      startedAt: this.now(),
      finishedAt: null,
      requested: targets.length,
      updated: 0,
      missing: 0,
      error: null,
      label,
    };
    try {
      const stats = targets.length > 0 ? await this.provider.fetch(targets.map((t) => t.reel.shortcode)) : new Map();
      const now = this.now();
      for (const { p, reel } of targets) {
        if (!this.isCurrent(p, reel) || reel.status !== "ACCEPTED" || !stats.has(reel.shortcode)) continue;
        const result = this.applyAcceptedResult(p, reel, stats.get(reel.shortcode) ?? null, now);
        if (result === "updated") report.updated += 1;
        else report.missing += 1;
      }
    } catch (err) {
      report.error = (err as Error).message;
    }
    report.finishedAt = this.now();
    this.lastRefresh = report;
    if (report.error) this.logger.error(`Ko'rishlarni yangilab bo'lmadi (${label}): ${report.error}`);
    else this.logger.log(`Ko'rishlar yangilandi (${label}): ${report.updated}/${report.requested}, ${report.missing} topilmadi.`);
    return report;
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
    const targets = this.participants
      .all()
      .flatMap((p) => p.reels.filter((reel) => reel.status !== "REJECTED").map((reel) => ({ p, reel })));
    report.total = targets.length;

    try {
      const stats =
        targets.length > 0
          ? await this.provider.fetch(shortcodesOf(targets))
          : new Map<string, ReelStats | null>();
      const now = this.now();
      this.previousRanks = new Map(this.ranking().map((e) => [e.participant.telegramId, e.rank]));
      this.previousReelRanks = new Map(this.reelRanking().map((e) => [e.reel.shortcode, e.rank]));

      for (const { p, reel } of targets) {
        if (!this.isCurrent(p, reel) || reel.status === "REJECTED" || !stats.has(reel.shortcode)) continue;
        const s = stats.get(reel.shortcode) ?? null;
        if (reel.status === "PENDING") {
          this.applyVerification(p, reel, s, now);
          continue;
        }
        if (reel.status === "MANUAL_REVIEW") {
          const views = s === null ? null : readableViews(reel, s);
          if (s === null || views === null) continue;
          // AI mahsulotni topmagan video — Apify topgani yetarli emas, admin hal qiladi (ko'rishlari yangilanadi).
          if (reel.review?.kind === "AI_CHECK") {
            this.record(reel, views, s, now);
            continue;
          }
          this.resolveByProvider(p, reel, s, views, now);
          report.resolved += 1;
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
   * Videolar reytingi (ommaviy reyting): faol (bloklanmagan, chetlatilmagan) ishtirokchilarning
   * har bir qabul qilingan videosi — alohida qator; 4 ta videosi bo'lsa — 4 joyda. Ko'rishlar
   * kamayishi bo'yicha; teng bo'lsa — oldinroq yuborilgan video yuqorida.
   */
  reelRanking(): RankedReel[] {
    const rows = this.participants
      .all()
      .filter((p) => p.status === "ACTIVE" && p.firstName)
      .flatMap((p) => acceptedReels(p).map((reel) => ({ participant: p, reel, views: reelViews(reel) })));
    rows.sort(
      (a, b) =>
        b.views - a.views ||
        a.reel.submittedAt.getTime() - b.reel.submittedAt.getTime() ||
        a.participant.telegramId - b.participant.telegramId ||
        a.reel.shortcode.localeCompare(b.reel.shortcode),
    );
    return rows.map((row, i) => {
      const previous = this.previousReelRanks.get(row.reel.shortcode);
      return { ...row, rank: i + 1, rankDelta: previous === undefined ? 0 : previous - (i + 1) };
    });
  }

  /**
   * Ishtirokchilar reytingi (Mini App reytingi, sovrin oraliqlari, target tekshiruvi): kamida bitta
   * qabul qilingan videosi bor faol ishtirokchilar, umumiy ko'rishlari (yig'indi) kamayishi bo'yicha;
   * teng bo'lsa — oldinroq qatnashgan yuqorida.
   */
  ranking(): RankedEntry[] {
    // Oferta 7.1: ishtirokchining natijasi — barcha qabul qilingan videolari ko'rishlarining yig'indisi.
    // Reyting faqat ma'lumot uchun: g'oliblar o'rin bo'yicha emas, oraliqlar ichida random aniqlanadi (9.1).
    const rows = this.participants
      .all()
      .filter((p) => p.status === "ACTIVE" && p.firstName)
      .map((p) => ({ p, reels: acceptedReels(p) }))
      .filter((row) => row.reels.length > 0)
      .map((row) => ({ ...row, views: participantViews(row.p), first: firstSubmitted(row.reels) }));
    rows.sort((a, b) => b.views - a.views || a.first - b.first || a.p.telegramId - b.p.telegramId);
    return rows.map((row, i) => {
      const previous = this.previousRanks.get(row.p.telegramId);
      return {
        participant: row.p,
        reels: row.reels,
        views: row.views,
        rank: i + 1,
        rankDelta: previous === undefined ? 0 : previous - (i + 1),
      };
    });
  }

  status() {
    const reels = this.participants.all().flatMap((p) => p.reels);
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
    return this.participants.get(p.telegramId) === p && p.reels.includes(reel);
  }

  /** Video haqidagi xabar: ishtirokchida bir nechta video bo'lishi mumkin — oxiriga qaysi biri ekani (link). */
  private notifyAbout(p: Participant, reel: Reel, text: string, kind: TelegramMessageKind): void {
    this.notify(p, `${text}\n\n${textsFor(p.lang).reelLink(reel.url)}`, kind);
  }

  private notify(p: Participant, text: string, kind: TelegramMessageKind): void {
    if (p.chatId === null) return;
    this.notifier.notify(p.chatId, text, kind).catch((err: Error) => {
      this.logger.warn(`Ishtirokchiga (${p.telegramId}) xabar yuborilmadi: ${err.message}`);
    });
  }
}

/**
 * Qabul qilingan, lekin oxirgi tekshiruvda topilmagan yoki ko'rishlari hali bir marta ham
 * o'qilmagan (admin qo'lda tasdiqlagan yangi video) — qisqa vaqtda qayta tekshiriladi.
 */
const isRechecking = (reel: Reel): boolean => reel.status === "ACCEPTED" && (reel.misses > 0 || awaitingViews(reel));

/** Admin qo'lda tasdiqlagan, lekin Apify ko'rishlarini hali bir marta ham o'qimagan video. */
const awaitingViews = (reel: Reel): boolean => reel.status === "ACCEPTED" && reel.history.length === 0;

/**
 * Navbatdagi tekshiruvga tegishli video: yangi (PENDING, AI natijasini kutmayotgan) yoki qayta
 * tekshiriladigan qabul qilingan.
 */
const needsCheck = (reel: Reel): boolean => (reel.status === "PENDING" && !reel.aiCheck) || isRechecking(reel);

/**
 * Apify o'qigan ko'rishlar — ishonchli bo'lsa. Ilgari ko'rishlari bo'lgan videoda 0 — Instagram/Apify
 * nosozligi (ko'rishlar o'qilmadi yoki yashirildi), haqiqiy video ko'rishlari 0 ga tushmaydi:
 * bunday natija yozilmaydi, oxirgi ma'lum ko'rishlar qoladi.
 */
function readableViews(reel: Reel, s: ReelStats): number | null {
  if (s.views === null) return null;
  return s.views === 0 && reelViews(reel) > 0 ? null : s.views;
}

/** Videolardan eng birinchi yuborilganining vaqti (teng ko'rishda oldinroq qatnashgan yuqorida). */
const firstSubmitted = (reels: readonly Reel[]): number => Math.min(...reels.map((r) => r.submittedAt.getTime()));

/** Apify so'rovi uchun shortcode'lar — takrorlarsiz (band link bitta bo'ladi, lekin eski holatda ham). */
const shortcodesOf = (targets: readonly { reel: Reel }[]): string[] => [...new Set(targets.map((t) => t.reel.shortcode))];

/** Oxirgi holat asosida nakrutka signallarini qo'shadi. */
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
