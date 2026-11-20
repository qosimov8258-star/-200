import { createHash, randomBytes } from "node:crypto";

import { HttpException, Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { contestDay } from "../common/time";
import { contestPrizes, type ContestPrizes } from "../miniapp/prizes";
import { StateStore } from "../persistence/state-store";
import { ParticipantsService, topReel, type Participant, type Reel } from "../participants/participants.service";
import { ParticipantNotifier } from "../telegram/notifier";
import {
  DEFAULT_DRAW_MESSAGE,
  DRAW_PLACEHOLDERS,
  periodLabel,
  renderDrawMessage,
  seededShuffle,
  stageLabel,
  validateDrawPeriod,
  validateDrawSettings,
  type DrawPeriodInput,
  type DrawSettings,
} from "./draw-rules";

/** Javob shakllari admin paneldagi `apps/admin/src/lib/types.ts` (Random tanlov) bilan bir xil. */
export type DrawExclusion =
  | "NOT_ACCEPTED"
  | "OUT_OF_PERIOD"
  | "VIEWS_LOW"
  | "VIEWS_HIGH"
  | "STATUS"
  | "WARNED"
  | "TARGET"
  | "PREVIOUS_WINNER";

export interface DrawCandidate {
  participantId: string;
  firstName: string;
  lastName: string;
  phone: string;
  instagramUsername: string | null;
  reelUrl: string;
  views: number;
  postedOn: string;
  submittedOn: string;
}

export type DrawStatus = "DRAFT" | "CONFIRMED" | "SENT" | "CANCELLED";

export interface DrawEntry {
  position: number;
  state: "ACTIVE" | "REPLACED" | "PROMOTED";
  candidate: DrawCandidate;
  replaced: { at: string; by: string; reason: string; replacementId: string } | null;
  promotedFor: string | null;
  notify: { status: "NOT_SENT" | "SENT" | "FAILED"; at: string | null; error: string | null };
}

export interface VoucherDraw {
  id: string;
  number: number;
  prizeTitle: string;
  stage: number | null;
  periodFrom: string;
  periodTo: string;
  status: DrawStatus;
  winners: number;
  reserves: number;
  poolSize: number;
  createdAt: string;
  createdBy: string;
  delivery: { sent: number; failed: number; notSent: number };
  settings: DrawSettings;
  viewsAsOf: string;
  seed: string;
  poolHash: string;
  winnerEntries: DrawEntry[];
  reserveEntries: DrawEntry[];
  confirmed: { at: string; by: string } | null;
  sent: { at: string; by: string } | null;
  cancelled: { at: string; by: string; reason: string } | null;
}

export type VoucherDrawSummary = Omit<
  VoucherDraw,
  "settings" | "viewsAsOf" | "seed" | "poolHash" | "winnerEntries" | "reserveEntries" | "confirmed" | "sent" | "cancelled"
>;

/** Admin yaratgan davr — "Random tanlov" da bosqichlar yonida tanlanadi. */
export interface DrawPeriod {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** Bosqich bo'yicha voucherlar: kvota va tanlovlar holati. */
export interface DrawStockStage {
  index: number;
  startsOn: string;
  endsOn: string;
  finished: boolean;
  /** Shu bosqichga ajratilgan voucherlar (oylik soni). */
  quantity: number;
  sent: number;
  confirmed: number;
  draft: number;
}

/** Oylik sovg'a qoldig'i — admin panel "Random tanlov" tepasidagi karta. */
export interface DrawStock {
  prizeId: string;
  title: string;
  /** Aksiya davomida jami. */
  total: number;
  /** G'oliblarga bot orqali yuborilgan tanlovlardagi faol g'oliblar. */
  sent: number;
  /** Tasdiqlangan, hali yuborilmagan. */
  confirmed: number;
  /** Qoralamada (tasdiqlanmagan) — qoldiqdan ayrilmaydi. */
  draft: number;
  /** Hali taqsimlanmagan: jami − yuborilgan − tasdiqlangan. */
  remaining: number;
  stages: DrawStockStage[];
}

export interface DrawsOptions {
  clock?: () => Date;
  /** Telegram cheklovi (~30 xabar/soniya) uchun xabarlar orasidagi tanaffus. */
  sendIntervalMs?: number;
}
export const DRAWS_OPTIONS = Symbol("DRAWS_OPTIONS");

const SAMPLE_SIZE = 20;
const MIN_REASON_LENGTH = 5;
const DEFAULT_SEND_INTERVAL_MS = 40;
const EXCLUSIONS: DrawExclusion[] = [
  "NOT_ACCEPTED",
  "OUT_OF_PERIOD",
  "VIEWS_LOW",
  "VIEWS_HIGH",
  "STATUS",
  "WARNED",
  "TARGET",
  "PREVIOUS_WINNER",
];

/** Admin xatosi: `{ message }` — admin panel shu matnni ko'rsatadi. */
const fail = (status: number, message: string) => new HttpException({ message }, status);

/** Oylik bitta sovg'a (voucher) — `miniapp/prizes.ts` dan. */
const MONTHLY_PRIZE_ID = "monthly";

/**
 * Oylik voucherlar uchun random tanlov: nomzodlarni filtrlash, kriptografik tasodifiy tanlash,
 * g'olibni zaxira bilan almashtirish, tasdiqlash va g'oliblarga Telegram bot orqali xabar.
 *
 * `StateStore` orqali diskka saqlanadi; Faza 1 da `voucher_draws` jadvaliga ko'chadi.
 */
@Injectable()
export class DrawsService {
  private readonly logger = new Logger(DrawsService.name);
  private readonly draws: VoucherDraw[] = [];
  private readonly periods: DrawPeriod[] = [];
  private periodSeq = 0;
  /** Admin o'chirgan bosqichlar (raqamlari). Raqamlar o'zgarmaydi — tanlovlar ularga bog'langan. */
  private removedStages: number[] = [];
  private readonly now: () => Date;
  private readonly sendIntervalMs: number;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly notifier: ParticipantNotifier,
    @Optional() @Inject(DRAWS_OPTIONS) options: DrawsOptions | null = null,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
  ) {
    this.now = options?.clock ?? (() => new Date());
    this.sendIntervalMs = options?.sendIntervalMs ?? DEFAULT_SEND_INTERVAL_MS;
    const saved = store?.attach("draws", () => ({
      draws: this.draws,
      periods: this.periods,
      periodSeq: this.periodSeq,
      removedStages: this.removedStages,
    }));
    if (saved) {
      this.draws.push(...saved.draws);
      this.periods.push(...saved.periods);
      this.periodSeq = saved.periodSeq;
      // Eski saqlangan holatda bu maydon yo'q.
      this.removedStages = saved.removedStages ?? [];
    }
  }

  /** Barcha bosqichlar (`prizes.ts`), raqami bilan. */
  private allStages(): { index: number; startsOn: string; endsOn: string }[] {
    return contestPrizes.stages.map((s, i) => ({ index: i + 1, startsOn: s.startsOn, endsOn: s.endsOn }));
  }

  /** Amaldagi (o'chirilmagan) bosqichlar. */
  private activeStages(): { index: number; startsOn: string; endsOn: string }[] {
    return this.allStages().filter((s) => !this.removedStages.includes(s.index));
  }

  setup() {
    const today = contestDay(this.now());
    const withState = (s: { index: number; startsOn: string; endsOn: string }) => ({ ...s, finished: s.endsOn < today });
    const stages = this.activeStages().map(withState);
    const stage =
      [...stages].reverse().find((s) => s.finished) ??
      stages.find((s) => s.startsOn <= today && today <= s.endsOn) ??
      stages[0];
    const { monthly } = contestPrizes;
    return {
      today,
      stages,
      removedStages: this.allStages()
        .filter((s) => this.removedStages.includes(s.index))
        .map(withState),
      prizes: [
        {
          id: MONTHLY_PRIZE_ID,
          title: monthly.title,
          quantity: monthly.perMonth,
          minViews: monthly.minViews,
          maxViews: monthly.maxViews,
        },
      ],
      defaults: {
        prizeId: MONTHLY_PRIZE_ID,
        stage: stage?.index ?? null,
        periodFrom: stage?.startsOn ?? today,
        periodTo: stage?.endsOn ?? today,
        dateBasis: "POSTED",
        minViews: monthly.minViews,
        maxViews: monthly.maxViews,
        winnersCount: monthly.perMonth,
        reservesCount: Math.ceil(monthly.perMonth / 10),
        excludeWarned: false,
        excludeTargets: true,
        excludePreviousWinners: false,
        messageTemplate: DEFAULT_DRAW_MESSAGE,
      } satisfies DrawSettings,
      placeholders: DRAW_PLACEHOLDERS,
      periods: this.listPeriods(),
    };
  }

  preview(settings: DrawSettings) {
    this.check(settings);
    const pool = this.pool(settings);
    const today = contestDay(this.now());
    const warnings: string[] = [];
    const existing = this.activeFor(settings);
    if (existing) {
      warnings.push(
        `Bu davr uchun #${existing.number} tanlov allaqachon o'tkazilgan. Yangisini o'tkazish uchun avval uni bekor qiling.`,
      );
    }
    if (settings.periodTo >= today) {
      warnings.push("Davr hali tugamagan — ko'rishlar bugungi holat bo'yicha olinadi va keyin o'zgarishi mumkin.");
    }
    if (pool.eligible.length === 0) {
      warnings.push("Talabga javob beradigan nomzod yo'q — sozlamalarni tekshiring.");
    } else if (pool.eligible.length <= settings.winnersCount) {
      warnings.push("Nomzodlar g'oliblar sonidan ko'p emas — barcha nomzodlar g'olib bo'ladi, zaxira qolmaydi.");
    }
    return {
      viewsAsOf: pool.viewsAsOf,
      totalReels: pool.totalReels,
      eligibleCount: pool.eligible.length,
      excluded: pool.excluded,
      poolHash: poolHash(pool.eligible),
      sample: [...pool.eligible].sort((a, b) => b.views - a.views).slice(0, SAMPLE_SIZE),
      warnings,
    };
  }

  run(settings: DrawSettings, actor: string): VoucherDraw {
    this.check(settings);
    const existing = this.activeFor(settings);
    if (existing) throw fail(409, `Bu davr uchun #${existing.number} tanlov allaqachon bor — avval uni bekor qiling.`);
    const pool = this.pool(settings);
    if (pool.eligible.length === 0) throw fail(400, "Talabga javob beradigan nomzod yo'q.");

    const seed = randomBytes(16).toString("hex");
    const shuffled = seededShuffle(pool.eligible, seed);
    const entry = (candidate: DrawCandidate, position: number): DrawEntry => ({
      position,
      state: "ACTIVE",
      candidate,
      replaced: null,
      promotedFor: null,
      notify: { status: "NOT_SENT", at: null, error: null },
    });
    const draw = withSummary({
      id: `drw_${randomBytes(6).toString("hex")}`,
      number: this.draws.length + 1,
      prizeTitle: contestPrizes.monthly.title,
      stage: settings.stage,
      periodFrom: settings.periodFrom,
      periodTo: settings.periodTo,
      status: "DRAFT",
      winners: 0,
      reserves: 0,
      poolSize: pool.eligible.length,
      createdAt: this.now().toISOString(),
      createdBy: actor,
      delivery: { sent: 0, failed: 0, notSent: 0 },
      settings: { ...settings, messageTemplate: settings.messageTemplate.trim() },
      viewsAsOf: pool.viewsAsOf,
      seed,
      poolHash: poolHash(pool.eligible),
      winnerEntries: shuffled.slice(0, settings.winnersCount).map((c, i) => entry(c, i + 1)),
      reserveEntries: shuffled
        .slice(settings.winnersCount, settings.winnersCount + settings.reservesCount)
        .map((c, i) => entry(c, i + 1)),
      confirmed: null,
      sent: null,
      cancelled: null,
    });
    this.draws.push(draw);
    this.logger.log(
      `${actor}: random tanlov #${draw.number} (${stageLabel(draw.stage)}, ${periodLabel(draw.periodFrom, draw.periodTo)}) — ` +
        `${draw.winners} g'olib, ${draw.reserves} zaxira, ${draw.poolSize} nomzod; seed ${seed}`,
    );
    return draw;
  }

  // -------------------------------------------------------------------------
  // Admin yaratadigan davrlar (kalendardan)
  // -------------------------------------------------------------------------

  /** Boshlanish sanasi bo'yicha. */
  listPeriods(): DrawPeriod[] {
    return [...this.periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title));
  }

  createPeriod(input: DrawPeriodInput, actor: string): DrawPeriod {
    const clean = this.checkPeriod(input);
    this.periodSeq += 1;
    const period: DrawPeriod = {
      id: `per_${this.periodSeq}`,
      ...clean,
      createdAt: this.now().toISOString(),
      createdBy: actor,
      updatedAt: null,
      updatedBy: null,
    };
    this.periods.push(period);
    this.logger.log(`${actor}: davr yaratildi — ${period.title} (${periodLabel(period.startsOn, period.endsOn)})`);
    return period;
  }

  updatePeriod(id: string, input: DrawPeriodInput, actor: string): DrawPeriod {
    const period = this.findPeriod(id);
    const before = `${period.title} (${periodLabel(period.startsOn, period.endsOn)})`;
    Object.assign(period, this.checkPeriod(input, id), { updatedAt: this.now().toISOString(), updatedBy: actor });
    this.logger.log(`${actor}: davr o'zgartirildi — ${before} → ${period.title} (${periodLabel(period.startsOn, period.endsOn)})`);
    return period;
  }

  /** O'tkazilgan tanlovlar o'z sanalarini saqlaydi — davr o'chsa ham ular o'zgarmaydi. */
  deletePeriod(id: string, actor: string): void {
    const period = this.findPeriod(id);
    this.periods.splice(this.periods.indexOf(period), 1);
    this.logger.log(`${actor}: davr o'chirildi — ${period.title} (${periodLabel(period.startsOn, period.endsOn)})`);
  }

  private findPeriod(id: string): DrawPeriod {
    const period = this.periods.find((item) => item.id === id);
    if (!period) throw fail(404, "Davr topilmadi.");
    return period;
  }

  /** Tanlov muddati ichida va boshqa davr yoki bosqich bilan sanalari bir xil emas. */
  private checkPeriod(input: DrawPeriodInput, exceptId?: string): DrawPeriodInput {
    // Chegaralar — butun aksiya muddati (o'chirilgan bosqichlar ham kiradi).
    const all = this.allStages();
    const bounds = { min: all[0].startsOn, max: all[all.length - 1].endsOn };
    const error = validateDrawPeriod(input, bounds);
    if (error) throw fail(400, error);
    const clean = { title: input.title.trim(), startsOn: input.startsOn, endsOn: input.endsOn };
    const sameDates = (a: { startsOn: string; endsOn: string }) => a.startsOn === clean.startsOn && a.endsOn === clean.endsOn;
    const stage = this.activeStages().find(sameDates);
    if (stage) throw fail(409, `Bu sanalar ${stage.index}-bosqich bilan bir xil — bosqichni tanlang.`);
    const twin = this.periods.find((item) => item.id !== exceptId && sameDates(item));
    if (twin) throw fail(409, `Bu sanalar uchun «${twin.title}» davri allaqachon bor.`);
    return clean;
  }

  /**
   * Bosqichni o'chirish: random tanlovda tanlab bo'lmaydi, voucherlar jami shu bosqich kvotasiga
   * kamayadi, Mini App'dagi sovg'alar sahifasidan ham yo'qoladi. Unda tanlov o'tkazilgan bo'lsa
   * (bekor qilinmagan) — o'chirilmaydi; kamida bitta bosqich qolishi shart. Tiklash mumkin.
   */
  deleteStage(index: number, actor: string): { index: number; startsOn: string; endsOn: string } {
    const stage = this.activeStages().find((s) => s.index === index);
    if (!stage) throw fail(404, "Bosqich topilmadi.");
    if (this.activeStages().length <= 1) throw fail(409, "Kamida bitta bosqich qolishi kerak.");
    const used = this.draws.find((d) => d.status !== "CANCELLED" && d.stage === index);
    if (used) throw fail(409, `Bu bosqichda #${used.number} tanlov o'tkazilgan — avval uni bekor qiling.`);
    this.removedStages.push(index);
    this.removedStages.sort((a, b) => a - b);
    this.logger.log(`${actor}: ${index}-bosqich o'chirildi.`);
    return stage;
  }

  restoreStage(index: number, actor: string): { index: number; startsOn: string; endsOn: string } {
    const stage = this.allStages().find((s) => s.index === index);
    if (!stage || !this.removedStages.includes(index)) throw fail(404, "O'chirilgan bosqich topilmadi.");
    const twin = this.periods.find((p) => p.startsOn === stage.startsOn && p.endsOn === stage.endsOn);
    if (twin) throw fail(409, `Bu sanalar uchun «${twin.title}» davri bor — avval uni o'chiring.`);
    this.removedStages = this.removedStages.filter((i) => i !== index);
    this.logger.log(`${actor}: ${index}-bosqich tiklandi.`);
    return stage;
  }

  /** Mini App'dagi sovg'alar: faqat amaldagi bosqichlar, voucherlar jami — shularga qarab. */
  publicPrizes(): ContestPrizes {
    const stages = this.activeStages();
    return {
      ...contestPrizes,
      monthly: { ...contestPrizes.monthly, total: contestPrizes.monthly.perMonth * stages.length },
      stages: stages.map(({ startsOn, endsOn }) => ({ startsOn, endsOn })),
    };
  }

  /**
   * Voucherlar qoldig'i: jami, yuborilgan, tasdiqlangan, qoralamada va qolgani (bosqichlar bo'yicha).
   * Bekor qilingan tanlovlar hisobga olinmaydi; "boshqa davr" tanlovlari faqat umumiy sonlarda.
   */
  stock(): DrawStock[] {
    const { monthly } = contestPrizes;
    const stages = this.activeStages();
    const total = monthly.perMonth * stages.length;
    const today = contestDay(this.now());
    const live = this.draws.filter((d) => d.status !== "CANCELLED" && d.settings.prizeId === MONTHLY_PRIZE_ID);
    const count = (status: DrawStatus, stage?: number) =>
      live
        .filter((d) => d.status === status && (stage === undefined || d.stage === stage))
        .reduce((sum, d) => sum + d.winners, 0);
    const sent = count("SENT");
    const confirmed = count("CONFIRMED");
    return [
      {
        prizeId: MONTHLY_PRIZE_ID,
        title: monthly.title,
        total,
        sent,
        confirmed,
        draft: count("DRAFT"),
        remaining: Math.max(0, total - sent - confirmed),
        stages: stages.map((s) => ({
          index: s.index,
          startsOn: s.startsOn,
          endsOn: s.endsOn,
          finished: s.endsOn < today,
          quantity: monthly.perMonth,
          sent: count("SENT", s.index),
          confirmed: count("CONFIRMED", s.index),
          draft: count("DRAFT", s.index),
        })),
      },
    ];
  }

  list(): VoucherDrawSummary[] {
    return [...this.draws].sort((a, b) => b.number - a.number).map(toSummary);
  }

  get(id: string): VoucherDraw {
    const draw = this.draws.find((item) => item.id === id);
    if (!draw) throw fail(404, "Tanlov topilmadi.");
    return draw;
  }

  replace(id: string, participantId: string, reason: string, actor: string): VoucherDraw {
    const draw = this.get(id);
    const why = reason.trim();
    if (draw.status === "CANCELLED") throw fail(409, "Tanlov bekor qilingan.");
    if (why.length < MIN_REASON_LENGTH) throw fail(400, "Sababni yozing (kamida 5 belgi).");
    const index = draw.winnerEntries.findIndex(
      (e) => e.state === "ACTIVE" && e.candidate.participantId === participantId,
    );
    if (index < 0) throw fail(404, "Bu ishtirokchi faol g'oliblar orasida yo'q.");
    const reserve = draw.reserveEntries.find((e) => e.state === "ACTIVE");
    if (!reserve) throw fail(409, "Zaxira qolmadi — o'rniga beradigan nomzod yo'q.");

    const old = draw.winnerEntries[index];
    const at = this.now().toISOString();
    old.state = "REPLACED";
    old.replaced = { at, by: actor, reason: why, replacementId: reserve.candidate.participantId };
    reserve.state = "PROMOTED";
    reserve.promotedFor = old.candidate.participantId;
    draw.winnerEntries.splice(index + 1, 0, {
      position: old.position,
      state: "ACTIVE",
      candidate: reserve.candidate,
      replaced: null,
      promotedFor: old.candidate.participantId,
      notify: { status: "NOT_SENT", at: null, error: null },
    });
    this.logger.log(`${actor}: #${draw.number} ${old.position}-g'olib zaxira bilan almashtirildi — ${why}`);
    return this.refresh(draw);
  }

  confirm(id: string, actor: string): VoucherDraw {
    const draw = this.get(id);
    if (draw.status !== "DRAFT") throw fail(409, "Faqat qoralama holatidagi tanlov tasdiqlanadi.");
    draw.status = "CONFIRMED";
    draw.confirmed = { at: this.now().toISOString(), by: actor };
    this.logger.log(`${actor}: #${draw.number} natijasi tasdiqlandi.`);
    return this.refresh(draw);
  }

  cancel(id: string, reason: string, actor: string): VoucherDraw {
    const draw = this.get(id);
    const why = reason.trim();
    if (draw.status !== "DRAFT" && draw.status !== "CONFIRMED") {
      throw fail(409, "G'oliblarga xabar yuborilgan tanlovni bekor qilib bo'lmaydi.");
    }
    if (why.length < MIN_REASON_LENGTH) throw fail(400, "Sababni yozing (kamida 5 belgi).");
    draw.status = "CANCELLED";
    draw.cancelled = { at: this.now().toISOString(), by: actor, reason: why };
    this.logger.log(`${actor}: #${draw.number} bekor qilindi — ${why}`);
    return this.refresh(draw);
  }

  /** Faol g'oliblarga (yuborilmagan yoki xato bo'lganlarga) bot orqali xabar, ketma-ket. */
  async send(id: string, actor: string): Promise<VoucherDraw> {
    const draw = this.get(id);
    if (draw.status !== "CONFIRMED" && draw.status !== "SENT") throw fail(409, "Avval natijani tasdiqlang.");
    const queue = draw.winnerEntries.filter((e) => e.state === "ACTIVE" && e.notify.status !== "SENT");
    if (queue.length === 0) throw fail(409, "Yuboriladigan xabar qolmadi.");

    for (const [i, entry] of queue.entries()) {
      if (i > 0 && this.sendIntervalMs > 0) await sleep(this.sendIntervalMs);
      const at = this.now().toISOString();
      const participant = this.participants.get(Number(entry.candidate.participantId));
      if (!participant?.chatId) {
        entry.notify = { status: "FAILED", at, error: "Ishtirokchi bot bilan chat ochmagan" };
        continue;
      }
      const text = renderDrawMessage(draw.settings.messageTemplate, {
        firstName: entry.candidate.firstName,
        lastName: entry.candidate.lastName,
        prizeTitle: draw.prizeTitle,
        stage: draw.stage,
        periodFrom: draw.periodFrom,
        periodTo: draw.periodTo,
        views: entry.candidate.views,
      });
      try {
        await this.notifier.notify(participant.chatId, text, "VOUCHER_WIN");
        entry.notify = { status: "SENT", at, error: null };
      } catch (err) {
        entry.notify = { status: "FAILED", at, error: (err as Error).message };
      }
    }
    draw.status = "SENT";
    draw.sent ??= { at: this.now().toISOString(), by: actor };
    const result = this.refresh(draw);
    this.logger.log(
      `${actor}: #${draw.number} g'oliblarga yuborildi — ${result.delivery.sent} ta yetdi, ${result.delivery.failed} ta xato.`,
    );
    return result;
  }

  // -------------------------------------------------------------------------

  private check(settings: DrawSettings): void {
    const error = validateDrawSettings(settings);
    if (error) throw fail(400, error);
    if (settings.prizeId !== MONTHLY_PRIZE_ID) throw fail(400, "Oylik sovg'a tanlanmagan.");
    if (settings.stage !== null && !this.activeStages().some((s) => s.index === settings.stage)) {
      throw fail(400, "Bunday bosqich yo'q.");
    }
  }

  private activeFor(settings: DrawSettings): VoucherDraw | null {
    return (
      this.draws.find(
        (d) =>
          d.status !== "CANCELLED" &&
          d.settings.prizeId === settings.prizeId &&
          d.periodFrom === settings.periodFrom &&
          d.periodTo === settings.periodTo,
      ) ?? null
    );
  }

  private previousWinners(prizeId: string): Set<string> {
    const ids = new Set<string>();
    for (const d of this.draws) {
      if (d.settings.prizeId !== prizeId || (d.status !== "CONFIRMED" && d.status !== "SENT")) continue;
      for (const e of d.winnerEntries) if (e.state === "ACTIVE") ids.add(e.candidate.participantId);
    }
    return ids;
  }

  /**
   * Talabga javob beradigan nomzodlar va chetda qolganlar soni (ishtirokchi bo'yicha, birinchi
   * sabab bo'yicha). `totalReels` — barcha yuborilgan videolar soni (hamma holatda).
   */
  private pool(settings: DrawSettings) {
    const today = contestDay(this.now());
    const viewsAsOf = settings.periodTo < today ? settings.periodTo : today;
    const previous = settings.excludePreviousWinners ? this.previousWinners(settings.prizeId) : new Set<string>();
    const excluded = Object.fromEntries(EXCLUSIONS.map((k) => [k, 0])) as Record<DrawExclusion, number>;
    const eligible: DrawCandidate[] = [];
    let totalReels = 0;

    for (const p of this.participants.all()) {
      if (p.reels.length === 0) continue;
      totalReels += p.reels.length;
      const counted = countedReels(p, settings);
      const reason = exclusionOf(p, counted, settings, viewsAsOf, previous);
      if (reason) {
        excluded[reason] += 1;
        continue;
      }
      eligible.push(toCandidate(p, counted, viewsAsOf));
    }
    // Tartib tasodifga bog'liq bo'lmasin — natijani qayta hisoblash uchun.
    eligible.sort((a, b) => a.participantId.localeCompare(b.participantId));
    return { viewsAsOf, totalReels, eligible, excluded };
  }

  private refresh(draw: VoucherDraw): VoucherDraw {
    Object.assign(draw, withSummary(draw));
    return draw;
  }
}

/**
 * Qoidalar 7.2: davrga faqat sanasi (`dateBasis` — Instagram'da joylangan yoki ilovaga yuborilgan
 * kun) davr ichida bo'lgan qabul qilingan videolar kiradi.
 */
function countedReels(p: Participant, s: DrawSettings): { accepted: Reel[]; inPeriod: Reel[] } {
  const accepted = p.reels.filter((r) => r.status === "ACCEPTED");
  const inPeriod = accepted.filter((r) => {
    const day = s.dateBasis === "POSTED" ? postedOn(r) : contestDay(r.submittedAt);
    return day >= s.periodFrom && day <= s.periodTo;
  });
  return { accepted, inPeriod };
}

function exclusionOf(
  p: Participant,
  counted: { accepted: Reel[]; inPeriod: Reel[] },
  s: DrawSettings,
  viewsAsOf: string,
  previous: Set<string>,
): DrawExclusion | null {
  if (counted.accepted.length === 0) return "NOT_ACCEPTED";
  if (counted.inPeriod.length === 0) return "OUT_OF_PERIOD";
  // Nomzod ko'rishlari — davrga kirgan videolardan eng ko'p ko'rilganiniki (qo'shilmaydi).
  const views = bestViewsOn(counted.inPeriod, viewsAsOf);
  if (views < s.minViews) return "VIEWS_LOW";
  if (views > s.maxViews) return "VIEWS_HIGH";
  if (p.status !== "ACTIVE") return "STATUS";
  // Ogohlantirish holati backendda hali yo'q — `excludeWarned` hozircha hech kimni chiqarmaydi.
  if (s.excludeTargets && counted.inPeriod.some((r) => r.flags.length > 0)) return "TARGET";
  if (previous.has(String(p.telegramId))) return "PREVIOUS_WINNER";
  return null;
}

/** Instagram'da joylangan kun; noma'lum bo'lsa — ilovaga yuborilgan kun. */
const postedOn = (reel: Reel) => contestDay(reel.postedAt ?? reel.submittedAt);

/** `date` kunigacha (shu kun ham) yozilgan oxirgi ko'rishlar. */
function viewsOn(reel: Reel, date: string): number {
  let views = 0;
  for (const s of reel.history) {
    if (s.date > date) break;
    views = s.views;
  }
  return views;
}

/** Davrga kirgan videolardan eng ko'p ko'rilgani — `date` kunidagi ko'rishlari (bo'sh ro'yxat — 0). */
const bestViewsOn = (reels: readonly Reel[], date: string): number =>
  reels.reduce((best, reel) => Math.max(best, viewsOn(reel, date)), 0);

/**
 * Nomzod: davrga kirgan videolardan eng ko'p ko'rilgani — ko'rishlar, link, akkaunt va sanalar
 * shu videoniki (videolar ko'rishlari qo'shilmaydi).
 */
function toCandidate(p: Participant, counted: { inPeriod: Reel[] }, viewsAsOf: string): DrawCandidate {
  const main = topReel(counted.inPeriod, (r) => viewsOn(r, viewsAsOf)) ?? counted.inPeriod[0];
  return {
    participantId: String(p.telegramId),
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    phone: p.phone ?? "",
    instagramUsername: main.owner,
    reelUrl: main.url,
    views: viewsOn(main, viewsAsOf),
    postedOn: postedOn(main),
    submittedOn: contestDay(main.submittedAt),
  };
}

/** Nomzodlar ro'yxatining izi (SHA-256, 16 belgi). */
const poolHash = (candidates: DrawCandidate[]) =>
  createHash("sha256")
    .update(candidates.map((c) => c.participantId).join("\n"))
    .digest("hex")
    .slice(0, 16);

function toSummary(d: VoucherDraw): VoucherDrawSummary {
  return {
    id: d.id,
    number: d.number,
    prizeTitle: d.prizeTitle,
    stage: d.stage,
    periodFrom: d.periodFrom,
    periodTo: d.periodTo,
    status: d.status,
    winners: d.winners,
    reserves: d.reserves,
    poolSize: d.poolSize,
    createdAt: d.createdAt,
    createdBy: d.createdBy,
    delivery: d.delivery,
  };
}

function withSummary(draw: VoucherDraw): VoucherDraw {
  const active = draw.winnerEntries.filter((e) => e.state === "ACTIVE");
  return {
    ...draw,
    winners: active.length,
    reserves: draw.reserveEntries.filter((e) => e.state === "ACTIVE").length,
    delivery: {
      sent: active.filter((e) => e.notify.status === "SENT").length,
      failed: active.filter((e) => e.notify.status === "FAILED").length,
      notSent: active.filter((e) => e.notify.status === "NOT_SENT").length,
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
