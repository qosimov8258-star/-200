import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { addDays, contestDay, daysBetween } from "../common/time";
import { AdLibraryProvider, type AdHit } from "../instagram/ad-library";
import { canonicalReelUrl, parseReelShortcode } from "../miniapp/reel-url";
import {
  instagramUsernames,
  participantViews,
  ParticipantsService,
  type Participant,
  type Reel,
  type ReelFlag,
  type ReelFlagType,
} from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { StatsService } from "../stats/stats.service";
import { ParticipantNotifier, type TelegramMessageKind } from "../telegram/notifier";
import { texts } from "../telegram/texts";
import { screenshotExtension, type Screenshot, type ScreenshotMime } from "./screenshot";

/** Admin paneldagi `apps/admin/src/lib/types.ts` (Target yoqqanlar) bilan bir xil. */
export type TargetMethod = "AD_LIBRARY" | "GROWTH_ANALYSIS" | "REPORT";
export type TargetCaseStatus = "NEW" | "WARNED" | "DISQUALIFIED" | "DISMISSED";
export type TargetStatusFilter = TargetCaseStatus | "OPEN";
export type TargetAction = "warn" | "disqualify" | "dismiss";
type TargetState = "ON" | "OFF";

export interface TargetCase {
  id: string;
  telegramId: number;
  shortcode: string;
  method: TargetMethod;
  /** Tanlov kuni "YYYY-MM-DD". */
  detectedOn: string;
  evidence: string;
  /** Dalil havolasi (reklama kutubxonasidagi reklama); bo'lmasa — null. */
  evidenceUrl: string | null;
  /** Oxirgi tekshiruvda reklama faolmi. */
  currentState: TargetState;
  status: TargetCaseStatus;
  history: Array<{ date: string; state: TargetState; note: string }>;
  /** REPORT usulida — ishtirokchilar yuborgan shikoyatlar (boshqalarida bo'sh). */
  reports: TargetReport[];
}

/** Ishtirokchi shikoyati: lentasida "Reklama" belgisi bilan ko'rgan postning skrinshoti. */
export interface TargetReport {
  id: string;
  reporterId: number;
  at: string;
  /** Tanlov kuni "YYYY-MM-DD" — kunlik chegara shu bo'yicha. */
  day: string;
  comment: string | null;
  attachmentId: string;
  mime: ScreenshotMime;
  sizeBytes: number;
}

export interface TargetReportInput {
  /** Reel linki, profil linki yoki @username. */
  target: string;
  screenshot: Screenshot;
  comment: string | null;
}

export interface AdsCheckReport {
  reason: "schedule" | "admin";
  at: string;
  checked: number;
  found: number;
  error: string | null;
}

export interface TargetsOptions {
  /** Reytingning nechta yetakchisi reklama kutubxonasida tekshiriladi. */
  checkTop: number;
  /**
   * Tanlov boshidan necha kunda bir tekshiriladi: k × everyDays-kun (30 — oyiga bir marta);
   * 0 — avtomatik tekshiruv o'chiq (faqat admin qo'lda).
   */
  everyDays: number;
  /** Tanlov boshlangan kun "YYYY-MM-DD" (Toshkent) — jadval shundan sanaladi. */
  contestStartsOn: string;
  /** Tanlov tugagach avtomatik tekshiruv to'xtaydi. */
  contestEndsAt: Date;
  clock?: () => Date;
}

export const TARGETS_OPTIONS = Symbol("TARGETS_OPTIONS");

const OPEN: TargetCaseStatus[] = ["NEW", "WARNED"];
const MIN_REASON_LENGTH = 5;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const GROWTH_WINDOW_DAYS = 7;
const TICK_MS = 60_000;
/** Reklama kutubxonasi tekshiruvi xato bilan tugasa — keyingi urinishgacha kutish. */
const ADS_RETRY_MS = 60 * 60_000;
/** Bitta ishtirokchi bir kunda ko'pi bilan nechta shikoyat yubora oladi. */
const REPORTS_PER_DAY = 5;
/** Saqlanadigan skrinshotlar chegarasi (MinIO ulanguncha; diskda ~1 GB). */
const MAX_STORED_SCREENSHOTS = 2_000;
const GROWTH_FLAGS = new Set<ReelFlagType>(["VIEW_SPIKE", "ENGAGEMENT_GAP"]);
const USERNAME = /^[a-z0-9._]{1,30}$/;
const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

const TRANSITIONS: Record<TargetAction, { from: TargetCaseStatus[]; to: TargetCaseStatus; label: string }> = {
  warn: { from: ["NEW"], to: "WARNED", label: "Ogohlantirildi" },
  disqualify: { from: ["NEW", "WARNED"], to: "DISQUALIFIED", label: "Diskvalifikatsiya qilindi" },
  dismiss: { from: ["NEW", "WARNED"], to: "DISMISSED", label: "Ro'yxatdan chiqarildi" },
};

const fail = (status: number, message: string) => new HttpException({ message }, status);

/**
 * Target (pullik reklama) holatlari:
 *
 * 1. **Meta reklama kutubxonasi** — tanlov boshidan har `everyDays` kunda (standart 30 — oyiga
 *    bir marta; ko'rishlar yig'ishidan qat'i nazar, oxirgi reyting bo'yicha) `checkTop` yetakchi
 *    Apify orqali tekshiriladi (faqat faol reklamalar ko'rinadi). Admin istalgan vaqtda qo'lda ham
 *    tekshira oladi.
 * 2. **O'sish tahlili** — StatsService qo'ygan belgilar holatga aylanadi: keskin o'sish
 *    (VIEW_SPIKE) va "ko'rishlar oshgan, layklar o'smagan" (ENGAGEMENT_GAP).
 * 3. **Shikoyatlar** — ishtirokchilar lentasida "Reklama" belgisi bilan ko'rgan postning
 *    skrinshotini Mini App orqali yuboradi. Kim yuborgani faqat adminga ko'rinadi.
 *
 * To'rtinchisi — g'olibni yuzma-yuz tekshirish ("Reklama vositalari" bo'limi) — admin panelning
 * G'olib bo'limida. Holatlar avtomatik jazolamaydi: ogohlantirish va chetlatishni admin qiladi.
 *
 * VAQTINCHA xotirada; Faza 1 da `target_cases` jadvaliga ko'chadi.
 */
@Injectable()
export class TargetsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TargetsService.name);
  private readonly cases: TargetCase[] = [];
  /** Shikoyat skrinshotlari diskda (`StateStore` fayllari); store bo'lmasa (testlar) — shu yerda. */
  private readonly screenshots = new Map<string, Screenshot>();
  private readonly now: () => Date;
  private timer: NodeJS.Timeout | null = null;
  private processedSync: string | null = null;
  private lastAdsDay: string | null = null;
  private adsRetryAt = 0;
  private checking: Promise<AdsCheckReport> | null = null;
  lastCheck: AdsCheckReport | null = null;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly stats: StatsService,
    private readonly ads: AdLibraryProvider,
    private readonly notifier: ParticipantNotifier,
    @Inject(TARGETS_OPTIONS) private readonly options: TargetsOptions,
    @Optional() @Inject(StateStore) private readonly store: StateStore | null = null,
  ) {
    this.now = options.clock ?? (() => new Date());
    const saved = store?.attach("targets", () => ({
      cases: this.cases,
      processedSync: this.processedSync,
      lastAdsDay: this.lastAdsDay,
      lastCheck: this.lastCheck,
    }));
    if (saved) {
      this.cases.push(...saved.cases);
      this.processedSync = saved.processedSync;
      this.lastAdsDay = saved.lastAdsDay;
      this.lastCheck = saved.lastCheck;
    }
  }

  onApplicationBootstrap(): void {
    const next = this.nextCheckOn();
    const period =
      this.options.everyDays <= 0
        ? "o'chiq (faqat qo'lda)"
        : `har ${this.options.everyDays} kunda top-${this.options.checkTop}${next ? `, keyingisi ${next}` : ""}`;
    this.logger.log(`Reklama kutubxonasi tekshiruvi: ${period} (manba: ${this.ads.name}).`);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Har daqiqa: ko'rishlar yangi yig'ilgan bo'lsa — o'sish belgilarini ko'chiradi. Reklama
   * kutubxonasi esa yig'ishdan qat'i nazar o'z jadvali bilan (tanlov boshidan har `everyDays`
   * kunda) tekshiriladi.
   */
  tick(): void {
    const syncAt = this.stats.status().lastSuccessAt;
    if (syncAt && syncAt !== this.processedSync) {
      this.processedSync = syncAt;
      this.scanGrowth();
    }
    if (this.adsDue()) void this.checkAds("schedule");
  }

  /** Rejadagi oxirgi tekshiruv kuni (bugun yoki undan oldingi); hali kelmagan bo'lsa — null. */
  private currentSlot(): string | null {
    const { everyDays, contestStartsOn } = this.options;
    if (everyDays <= 0) return null;
    const k = Math.floor(daysBetween(contestStartsOn, contestDay(this.now())) / everyDays);
    return k >= 1 ? addDays(contestStartsOn, k * everyDays) : null;
  }

  /** Keyingi rejadagi tekshiruv kuni; tanlov tugagan yoki avtomatik tekshiruv o'chiq — null. */
  nextCheckOn(): string | null {
    const { everyDays, contestStartsOn, contestEndsAt } = this.options;
    if (everyDays <= 0) return null;
    const today = contestDay(this.now());
    const slot = this.currentSlot();
    const next =
      slot !== null && slot === today && (this.lastAdsDay === null || this.lastAdsDay < slot)
        ? slot
        : addDays(contestStartsOn, (Math.floor(daysBetween(contestStartsOn, today) / everyDays) + 1) * everyDays);
    return next <= contestDay(contestEndsAt) ? next : null;
  }

  private adsDue(): boolean {
    if (this.checking !== null || this.now() >= this.options.contestEndsAt) return false;
    if (this.now().getTime() < this.adsRetryAt) return false;
    const slot = this.currentSlot();
    if (slot === null || (this.lastAdsDay !== null && this.lastAdsDay >= slot)) return false;
    // Reyting bo'sh — tekshiradigan akkaunt yo'q.
    return this.stats.ranking().length > 0;
  }

  /**
   * O'sish tahlili: har bir videoning belgi qo'yilgan har bir kuni — alohida holat (bir marta).
   * Bir kunda ikkala belgi ham bo'lsa — bitta holat, dalilda ikkalasi.
   */
  scanGrowth(): number {
    let created = 0;
    for (const p of this.participants.all()) {
      for (const reel of p.reels) created += this.scanReelGrowth(p, reel);
    }
    return created;
  }

  private scanReelGrowth(p: Participant, reel: Reel): number {
    let created = 0;
    const byDate = new Map<string, ReelFlag[]>();
    for (const flag of reel.flags) {
      if (GROWTH_FLAGS.has(flag.type)) byDate.set(flag.date, [...(byDate.get(flag.date) ?? []), flag]);
    }
    for (const [date, flags] of byDate) {
      const evidence = growthEvidence(flags);
      const existing = this.cases.find(
        (c) =>
          c.method === "GROWTH_ANALYSIS" &&
          c.telegramId === p.telegramId &&
          c.shortcode === reel.shortcode &&
          c.detectedOn === date,
      );
      if (existing) {
        // Shu kun qayta yig'ilganda ikkinchi belgi qo'shilgan bo'lishi mumkin.
        if (OPEN.includes(existing.status)) existing.evidence = evidence;
        continue;
      }
      this.cases.push({
        id: this.nextId(),
        telegramId: p.telegramId,
        shortcode: reel.shortcode,
        method: "GROWTH_ANALYSIS",
        detectedOn: date,
        evidence,
        evidenceUrl: null,
        currentState: "ON",
        status: "NEW",
        history: [{ date, state: "ON", note: evidence }],
        reports: [],
      });
      created += 1;
    }
    return created;
  }

  // --- Shikoyatlar (Mini App) ---------------------------------------------

  /**
   * Ishtirokchi boshqa ishtirokchining reklamasini ko'rgan: skrinshot va kimligi (Reel linki
   * yoki @username). Bitta ishtirokchiga ochiq holat bitta — yangi shikoyatlar unga qo'shiladi.
   */
  report(reporterId: number, input: TargetReportInput): void {
    const reporter = this.participants.get(reporterId);
    if (!reporter || this.participants.stage(reporter) !== "ACTIVE") throw new ApiException(403, "UNAUTHORIZED");

    const found = this.resolveReported(input.target);
    if (found === "INVALID") throw new ApiException(422, "REPORT_TARGET_INVALID");
    if (!found) throw new ApiException(404, "REPORT_NOT_FOUND");
    const { participant: reported, reel: reportedReel } = found;
    if (reported.telegramId === reporterId) throw new ApiException(422, "REPORT_SELF");

    const today = contestDay(this.now());
    const sentToday = this.cases
      .flatMap((c) => c.reports)
      .filter((r) => r.reporterId === reporterId && r.day === today).length;
    const stored = this.cases.reduce((sum, c) => sum + c.reports.length, 0);
    if (sentToday >= REPORTS_PER_DAY || stored >= MAX_STORED_SCREENSHOTS) {
      throw new ApiException(429, "REPORT_LIMIT");
    }
    const open = this.cases.find(
      (c) => c.method === "REPORT" && c.telegramId === reported.telegramId && OPEN.includes(c.status),
    );
    if (open?.reports.some((r) => r.reporterId === reporterId && r.day === today)) {
      throw new ApiException(409, "REPORT_DUPLICATE");
    }

    const attachmentId = `att_${stored + 1}_${Date.now().toString(36)}`;
    // Diskda saqlanadi; xotiraga faqat store bo'lmaganda (testlar) — 2 MB lik rasmlar RAM'ni to'ldirmasin.
    if (this.store) this.store.putFile(`${attachmentId}.${screenshotExtension(input.screenshot.mime)}`, input.screenshot.data);
    else this.screenshots.set(attachmentId, input.screenshot);
    const entry: TargetReport = {
      id: `rep_${attachmentId.slice(4)}`,
      reporterId,
      at: this.now().toISOString(),
      day: today,
      comment: input.comment,
      attachmentId,
      mime: input.screenshot.mime,
      sizeBytes: input.screenshot.data.length,
    };

    if (open) {
      open.reports.push(entry);
      open.evidence = reportEvidence(open.reports);
      open.currentState = "ON";
      open.history.push({ date: today, state: "ON", note: `Yana bir shikoyat (jami ${open.reports.length})` });
    } else {
      const evidence = reportEvidence([entry]);
      this.cases.push({
        id: this.nextId(),
        telegramId: reported.telegramId,
        shortcode: reportedReel.shortcode,
        method: "REPORT",
        detectedOn: today,
        evidence,
        evidenceUrl: null,
        currentState: "ON",
        status: "NEW",
        history: [{ date: today, state: "ON", note: "Shikoyat: lentada reklama sifatida ko'rilgan" }],
        reports: [entry],
      });
    }
    this.logger.log(`Shikoyat: ${reporterId} → ${reported.telegramId} (@${reportedReel.owner ?? "?"}).`);
  }

  /** Shikoyat skrinshoti (admin ko'rishi uchun). */
  attachment(caseId: string, attachmentId: string): Screenshot {
    const c = this.find(caseId);
    const report = c.reports.find((r) => r.attachmentId === attachmentId);
    if (!report) throw fail(404, "Fayl topilmadi.");
    const cached = this.screenshots.get(attachmentId);
    if (cached) return cached;
    const data = this.store?.getFile(`${attachmentId}.${screenshotExtension(report.mime)}`);
    if (!data) throw fail(404, "Fayl topilmadi.");
    return { mime: report.mime, data };
  }

  /**
   * Reel linki → shu Reel egasi; profil linki yoki @username → shu akkauntdagi qabul qilingan
   * video egasi. Natija — ishtirokchi va shikoyat qilingan (topilgan) video.
   */
  private resolveReported(input: string): { participant: Participant; reel: Reel } | null | "INVALID" {
    const raw = input.trim();
    const shortcode = parseReelShortcode(raw);
    let username: string | null = null;
    if (!shortcode) {
      try {
        const url = new URL(raw);
        username = INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())
          ? (url.pathname.split("/").filter(Boolean)[0] ?? "")
          : "";
      } catch {
        username = raw.replace(/^@/, "");
      }
      username = username.toLowerCase();
      if (!USERNAME.test(username)) return "INVALID";
    }
    for (const participant of this.participants.all()) {
      if (participant.status === "DISQUALIFIED") continue;
      const reel = participant.reels.find(
        (r) =>
          r.status === "ACCEPTED" &&
          (shortcode ? r.shortcode === shortcode : r.owner?.toLowerCase() === username),
      );
      if (reel) return { participant, reel };
    }
    return null;
  }

  /** Reklama kutubxonasi: reyting yetakchilari akkauntlarida faol reklama bormi. Bir vaqtda bittasi. */
  checkAds(reason: AdsCheckReport["reason"]): Promise<AdsCheckReport> {
    this.checking ??= this.runAdsCheck(reason).finally(() => {
      this.checking = null;
    });
    return this.checking;
  }

  get isChecking(): boolean {
    return this.checking !== null;
  }

  /**
   * Har bir yetakchining barcha akkauntlari (rad etilmagan videolari egalari) tekshiriladi.
   * Holat ishtirokchi bo'yicha bitta: bir nechta akkauntda reklama bo'lsa — dalilda jami.
   * `checked` va `found` — akkauntlar soni.
   */
  private async runAdsCheck(reason: AdsCheckReport["reason"]): Promise<AdsCheckReport> {
    const today = contestDay(this.now());
    const leaders = this.stats
      .ranking()
      .slice(0, this.options.checkTop)
      .map((e) => ({ participant: e.participant, accounts: accountsOf(e.participant) }))
      .filter((e) => e.accounts.length > 0);
    const usernames = leaders.flatMap((e) => e.accounts.map((a) => a.username));
    const report: AdsCheckReport = { reason, at: this.now().toISOString(), checked: usernames.length, found: 0, error: null };
    try {
      const hits = usernames.length > 0 ? await this.ads.check(usernames) : new Map<string, AdHit[]>();
      for (const { participant, accounts } of leaders) {
        const withAds = accounts
          .map((a) => ({ ...a, ads: hits.get(a.username.toLowerCase()) ?? [] }))
          .filter((a) => a.ads.length > 0);
        const found = withAds.flatMap((a) => a.ads);
        const open = this.cases.find(
          (c) => c.method === "AD_LIBRARY" && c.telegramId === participant.telegramId && OPEN.includes(c.status),
        );
        if (found.length > 0) {
          report.found += withAds.length;
          const reel = withAds[0].reel;
          const since = found.map((h) => h.startedOn).filter((d): d is string => d !== null).sort()[0];
          // Bir nechta akkauntida reklama topilsa — qaysilarida ekani ham.
          const where = withAds.length > 1 ? ` — ${withAds.map((a) => `@${a.username}`).join(", ")}` : "";
          const evidence = `Meta reklama kutubxonasi: ${found.length} ta faol reklama${since ? ` (${since.split("-").reverse().join(".")} dan)` : ""}${where}`;
          if (open) {
            if (open.currentState === "OFF") open.history.push({ date: today, state: "ON", note: "Reklama yana faol" });
            open.currentState = "ON";
            open.evidence = evidence;
            open.evidenceUrl = found[0].url;
          } else {
            this.cases.push({
              id: this.nextId(),
              telegramId: participant.telegramId,
              shortcode: reel.shortcode,
              method: "AD_LIBRARY",
              detectedOn: today,
              evidence,
              evidenceUrl: found[0].url,
              currentState: "ON",
              status: "NEW",
              history: [{ date: today, state: "ON", note: evidence }],
              reports: [],
            });
          }
        } else if (open && open.currentState === "ON") {
          open.currentState = "OFF";
          open.history.push({ date: today, state: "OFF", note: "Reklama kutubxonada endi ko'rinmaydi (to'xtatilgan)" });
        }
      }
      this.lastAdsDay = today;
      this.adsRetryAt = 0;
    } catch (err) {
      report.error = (err as Error).message;
      this.adsRetryAt = this.now().getTime() + ADS_RETRY_MS;
    }
    this.lastCheck = report;
    if (report.error) this.logger.error(`Reklama kutubxonasini tekshirib bo'lmadi: ${report.error}`);
    else this.logger.log(`Reklama kutubxonasi (${reason}): ${report.checked} ta akkaunt, ${report.found} tasida faol reklama.`);
    return report;
  }

  // --- Admin --------------------------------------------------------------

  /** Barcha holatlar (o'qish uchun: ishtirokchilar ro'yxati, dashboard, g'olib tekshiruvi). */
  allCases(): readonly TargetCase[] {
    return this.cases;
  }

  /** Ishtirokchining holatlari. */
  casesOf(telegramId: number): TargetCase[] {
    return this.cases.filter((c) => c.telegramId === telegramId);
  }

  list(query: { status?: TargetStatusFilter; search?: string; page?: number; pageSize?: number }) {
    const needle = (query.search ?? "").trim().toLowerCase();
    const ranks = this.rankMap();
    const rows = this.cases
      .map((c) => ({ c, p: this.participants.get(c.telegramId) }))
      .filter((row): row is { c: TargetCase; p: Participant } => row.p !== null)
      .filter(({ c, p }) =>
        !needle
          ? true
          : `${p.firstName ?? ""} ${p.lastName ?? ""} ${p.phone ?? ""} ${instagramUsernames(p).join(" ")} ${c.evidence}`
              .toLowerCase()
              .includes(needle),
      );
    const counts: Record<TargetStatusFilter | "ALL", number> = {
      ALL: rows.length,
      OPEN: rows.filter(({ c }) => OPEN.includes(c.status)).length,
      NEW: 0,
      WARNED: 0,
      DISQUALIFIED: 0,
      DISMISSED: 0,
    };
    for (const { c } of rows) counts[c.status] += 1;

    const filtered = rows
      .filter(({ c }) =>
        !query.status ? true : query.status === "OPEN" ? OPEN.includes(c.status) : c.status === query.status,
      )
      .sort((a, b) => b.c.detectedOn.localeCompare(a.c.detectedOn) || b.c.id.localeCompare(a.c.id));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(lastPage, Math.max(1, query.page ?? 1));
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(({ c, p }) => this.toItem(c, p, ranks)),
      total: filtered.length,
      page,
      pageSize,
      statusCounts: counts,
    };
  }

  get(id: string) {
    const c = this.find(id);
    const p = this.participants.get(c.telegramId);
    if (!p) throw fail(404, "Ishtirokchi topilmadi.");
    // Kunlik o'sish — holat qaysi video bo'yicha ochilgan bo'lsa, o'shaniki.
    const history = reelOf(p, c)?.history ?? [];
    const dailyGrowth = history
      .slice(1)
      .map((s, i) => ({ date: s.date, viewsGrowth: Math.max(0, s.views - history[i].views), flagged: s.date === c.detectedOn }))
      .filter((d) => Math.abs(daysBetween(c.detectedOn, d.date)) <= GROWTH_WINDOW_DAYS);
    return {
      ...this.toItem(c, p, this.rankMap()),
      dailyGrowth,
      history: c.history,
      attachments: c.reports.map((r, i) => ({
        id: r.attachmentId,
        fileName: `shikoyat-${i + 1}.${screenshotExtension(r.mime)}`,
        sizeBytes: r.sizeBytes,
        url: `/api/v1/admin/targets/${c.id}/attachments/${r.attachmentId}`,
      })),
      evidenceUrl: c.evidenceUrl,
      reports: c.reports.map((r) => {
        const who = this.participants.get(r.reporterId);
        return {
          id: r.id,
          at: r.at,
          comment: r.comment,
          attachmentId: r.attachmentId,
          reporter: {
            id: String(r.reporterId),
            fullName: who ? `${who.firstName ?? ""} ${who.lastName ?? ""}`.trim() : "O'chirilgan foydalanuvchi",
            phone: who?.phone ?? "",
          },
        };
      }),
    };
  }

  act(id: string, action: TargetAction, reason: string, actor: string) {
    const c = this.find(id);
    const rule = TRANSITIONS[action];
    const why = reason.trim();
    if (why.length < MIN_REASON_LENGTH) throw fail(400, "Sababni yozing (kamida 5 belgi).");
    if (!rule.from.includes(c.status)) throw fail(409, "Bu holatda bunday amal bajarilmaydi.");
    const p = this.participants.get(c.telegramId);
    if (!p) throw fail(404, "Ishtirokchi topilmadi.");

    c.status = rule.to;
    c.history.push({ date: contestDay(this.now()), state: c.currentState, note: `${rule.label}: ${why}` });
    if (action === "disqualify") this.participants.disqualify(p.telegramId);
    if (action === "warn") {
      const url = reelOf(p, c)?.url ?? canonicalReelUrl(c.shortcode);
      this.notify(p, `${texts.targetWarning}\n\n${texts.reelLink(url)}`, "WARNING");
    }
    if (action === "disqualify") this.notify(p, texts.targetDisqualified, "WARNING");
    this.logger.log(`${actor}: target ${c.id} (${p.firstName} ${p.lastName}) — ${rule.label}: ${why}`);
    return this.get(id);
  }

  // -------------------------------------------------------------------------

  private toItem(c: TargetCase, p: Participant, ranks: Map<number, { rank: number; views: number }>) {
    const r = ranks.get(p.telegramId);
    const reel = reelOf(p, c);
    return {
      id: c.id,
      participant: {
        id: String(p.telegramId),
        firstName: p.firstName ?? "",
        lastName: p.lastName ?? "",
        phone: p.phone ?? "",
        instagramUsername: reel?.owner ?? instagramUsernames(p)[0] ?? null,
        status: p.status,
      },
      reelUrl: reel?.url ?? canonicalReelUrl(c.shortcode),
      detectedOn: c.detectedOn,
      method: c.method,
      evidence: c.evidence,
      currentState: c.currentState,
      status: c.status,
      views: r?.views ?? participantViews(p),
      rank: r?.rank ?? null,
    };
  }

  private rankMap() {
    return new Map(this.stats.ranking().map((e) => [e.participant.telegramId, { rank: e.rank, views: e.views }]));
  }

  private find(id: string): TargetCase {
    const c = this.cases.find((item) => item.id === id);
    if (!c) throw fail(404, "Holat topilmadi.");
    return c;
  }

  private nextId(): string {
    return `tgt_${String(this.cases.length + 1).padStart(4, "0")}`;
  }

  private notify(p: Participant, text: string, kind: TelegramMessageKind): void {
    if (p.chatId === null) return;
    this.notifier.notify(p.chatId, text, kind).catch((err: Error) => {
      this.logger.warn(`Ishtirokchiga (${p.telegramId}) xabar yuborilmadi: ${err.message}`);
    });
  }
}

/** Holat ochilgan video (ishtirokchi uni qayta yuborgan yoki o'chirilgan bo'lsa — null). */
const reelOf = (p: Participant, c: TargetCase): Reel | null => p.reels.find((r) => r.shortcode === c.shortcode) ?? null;

/** Reklama kutubxonasida tekshiriladigan akkauntlar: rad etilmagan videolar egalari va har birining birinchi videosi. */
function accountsOf(p: Participant): { username: string; reel: Reel }[] {
  return instagramUsernames(p).flatMap((username) => {
    const reel = p.reels.find((r) => r.status !== "REJECTED" && r.owner === username);
    return reel ? [{ username, reel }] : [];
  });
}

/** O'sish tahlili dalili: bir kundagi belgilar. */
function growthEvidence(flags: ReelFlag[]): string {
  const spike = flags.find((f) => f.type === "VIEW_SPIKE");
  const gap = flags.find((f) => f.type === "ENGAGEMENT_GAP");
  if (spike && gap) return `Keskin o'sish (${spike.detail}), layklar esa o'smagan: ${gap.detail}`;
  if (spike) return `Kunlik o'sish keskin oshgan: ${spike.detail}`;
  return `Ko'rishlar oshgan, layklar o'smagan: ${gap?.detail ?? ""}`;
}

/** Shikoyatlar dalili: nechta skrinshot, nechta kishidan. */
function reportEvidence(reports: TargetReport[]): string {
  const people = new Set(reports.map((r) => r.reporterId)).size;
  return `Ishtirokchilar shikoyati: ${reports.length} ta skrinshot (${people} kishidan)`;
}
