import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { contestDay, contestTime, daysBetween } from "../common/time";
import { ReelStatsProvider, type ReelStats } from "../instagram/reel-stats";
import {
  ParticipantsService,
  type Participant,
  type Reel,
  type ReelFlagType,
  type ReelRejectReason,
} from "../participants/participants.service";
import { ParticipantNotifier } from "../telegram/notifier";
import { texts } from "../telegram/texts";

export interface StatsOptions {
  /** Kunning qaysi vaqtida yig'iladi — Toshkent vaqti, "HH:MM". */
  syncTime: string;
  /** Necha kunda bir marta (1 — har kuni); 0 — avtomatik yig'ish o'chiq. */
  everyDays: number;
  /** Yangi videolar shuncha kutib, bitta so'rovda tekshiriladi. */
  verifyDelayMs: number;
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
  /** Shu yig'ishda reytingdan chiqarilganlar (REMOVED). */
  removed: number;
  /** Yana topilib, reytingga qaytganlar. */
  restored: number;
  error: string | null;
}

export interface RankedEntry {
  participant: Participant;
  reel: Reel;
  rank: number;
  views: number;
  /** Oldingi yig'ishdagi o'ringa nisbatan: musbat — ko'tarilgan. */
  rankDelta: number;
}

/** Yangi video necha marta topilmasa — rad etiladi (bir martalik nosozlikdan himoya). */
const MISSES_BEFORE_REJECT = 2;
/** Qabul qilingan video necha marta ketma-ket topilmasa — reytingdan chiqariladi. */
const MISSES_BEFORE_REMOVED = 2;
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
  /** Ko'rishlar shuncha ulushga kamaysa — VIEW_DROP. */
  dropRatio: 0.1,
} as const;

/**
 * Worker: Reel'larni tekshiradi, ko'rishlarni yig'adi, reyting va nakrutka signallarini hisoblaydi.
 *
 * - Yangi video: bir necha soniyada (navbat bilan, bitta so'rovda) tekshiriladi — topildimi,
 *   Reel'mi, egasi boshqa ishtirokchida emasmi. Natija bot orqali xabar qilinadi.
 * - Ko'rishlar: har `everyDays` kunda soat `syncTime` da (Toshkent) hamma videolar uchun.
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
  /** Oxirgi muvaffaqiyatli yig'ish: tanlov kuni va vaqti. */
  private lastSyncDay: string | null = null;
  private lastSuccessAt: Date | null = null;
  /** Oxirgi yig'ishdan oldingi o'rinlar (rankDelta uchun). */
  private previousRanks = new Map<number, number>();
  private scheduler: NodeJS.Timeout | null = null;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly provider: ReelStatsProvider,
    private readonly notifier: ParticipantNotifier,
    @Inject(STATS_OPTIONS) private readonly options: StatsOptions,
  ) {
    this.now = options.clock ?? (() => new Date());
  }

  onApplicationBootstrap(): void {
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
    this.logger.log(`Ko'rishlar ${period} soat ${syncTime} da (Toshkent) yig'iladi. Manba: ${this.provider.name}.`);
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
    const targets = ids.flatMap((id) => {
      const p = this.participants.get(id);
      return p?.reel?.status === "PENDING" ? [{ p, reel: p.reel }] : [];
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
      if (!this.isCurrent(p, reel) || reel.status !== "PENDING" || !stats.has(reel.shortcode)) continue;
      this.applyVerification(p, reel, stats.get(reel.shortcode) ?? null, now);
    }
  }

  private applyVerification(p: Participant, reel: Reel, s: ReelStats | null, now: Date): void {
    if (s === null) {
      reel.misses += 1;
      if (reel.misses < MISSES_BEFORE_REJECT) {
        this.retryLater(p.telegramId, VERIFY_RETRY_MS);
        return;
      }
      this.reject(p, reel, "NOT_FOUND");
      return;
    }
    reel.owner = s.owner;
    reel.postedAt = s.postedAt;
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
    this.notify(p, texts.reelAccepted(formatCount(s.views)));
  }

  private reject(p: Participant, reel: Reel, reason: ReelRejectReason): void {
    reel.status = "REJECTED";
    reel.rejectReason = reason;
    this.notify(p, texts.reelRejected[reason]);
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

  /** Rejalashtiruvchi har daqiqada chaqiradi. */
  tick(): void {
    const reason = this.dueReason();
    if (reason) void this.syncAll(reason);
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
      const finalDone = this.lastSuccessAt !== null && this.lastSuccessAt >= this.options.contestEndsAt;
      return finalDone ? null : "final";
    }
    if (this.options.everyDays <= 0 || contestTime(now) < this.options.syncTime) return null;
    if (this.lastSyncDay === null) return "schedule";
    return daysBetween(this.lastSyncDay, contestDay(now)) >= this.options.everyDays ? "schedule" : null;
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
      removed: 0,
      restored: 0,
      error: null,
    };
    // PENDING ham kiradi: tekshiruvi chala qolganlar shu yerda qayta tekshiriladi.
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
        if (s === null || s.views === null) {
          reel.misses += 1;
          report.missing += 1;
          if (reel.status === "ACCEPTED" && reel.misses >= MISSES_BEFORE_REMOVED) {
            reel.status = "REMOVED";
            report.removed += 1;
            this.notify(p, texts.reelRemoved);
          }
          continue;
        }
        if (reel.status === "REMOVED") {
          reel.status = "ACCEPTED";
          report.restored += 1;
          this.notify(p, texts.reelRestored);
        }
        reel.misses = 0;
        this.record(reel, s.views, s, now);
        report.updated += 1;
      }
      this.lastSyncDay = contestDay(now);
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
          `${report.missing} topilmadi, ${report.removed} chiqarildi, ${report.restored} qaytdi.`,
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
      contestEndsAt: this.options.contestEndsAt.toISOString(),
      running: this.isSyncing,
      lastSync: this.lastSync,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      reels: {
        pending: reels.filter((r) => r.status === "PENDING").length,
        accepted: reels.filter((r) => r.status === "ACCEPTED").length,
        rejected: reels.filter((r) => r.status === "REJECTED").length,
        removed: reels.filter((r) => r.status === "REMOVED").length,
        flagged: reels.filter((r) => r.flags.length > 0).length,
      },
    };
  }

  // -------------------------------------------------------------------------

  /** Kunlik holatni yozadi (bir kunga bitta — kun ichidagi takroriy yig'ish oxirgisini almashtiradi). */
  private record(reel: Reel, views: number, s: ReelStats, now: Date): void {
    const snapshot = { date: contestDay(now), at: now, views, likes: s.likes, comments: s.comments };
    const last = reel.history.at(-1);
    if (last?.date === snapshot.date) reel.history[reel.history.length - 1] = snapshot;
    else reel.history.push(snapshot);
    detectFlags(reel);
  }

  private isCurrent(p: Participant, reel: Reel): boolean {
    return this.participants.get(p.telegramId) === p && p.reel === reel;
  }

  private notify(p: Participant, text: string): void {
    if (p.chatId === null) return;
    this.notifier.notify(p.chatId, text).catch((err: Error) => {
      this.logger.warn(`Ishtirokchiga (${p.telegramId}) xabar yuborilmadi: ${err.message}`);
    });
  }
}

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
}

/** 156745 → "156 745". */
export const formatCount = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
