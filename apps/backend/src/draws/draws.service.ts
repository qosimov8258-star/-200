import { createHash, randomBytes } from "node:crypto";

import { HttpException, Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { contestDay } from "../common/time";
import { contestPrizes } from "../miniapp/prizes";
import { ParticipantsService, type Participant, type Reel } from "../participants/participants.service";
import { ParticipantNotifier } from "../telegram/notifier";
import {
  DEFAULT_DRAW_MESSAGE,
  DRAW_PLACEHOLDERS,
  periodLabel,
  renderDrawMessage,
  seededShuffle,
  stageLabel,
  validateDrawSettings,
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
 * VAQTINCHA xotirada (ishtirokchilar kabi); Faza 1 da `voucher_draws` jadvaliga ko'chadi.
 * Admin login qurilguncha harakat qilgan xodim — "Admin", harakatlar server logida.
 */
@Injectable()
export class DrawsService {
  private readonly logger = new Logger(DrawsService.name);
  private readonly draws: VoucherDraw[] = [];
  private readonly now: () => Date;
  private readonly sendIntervalMs: number;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly notifier: ParticipantNotifier,
    @Optional() @Inject(DRAWS_OPTIONS) options: DrawsOptions | null = null,
  ) {
    this.now = options?.clock ?? (() => new Date());
    this.sendIntervalMs = options?.sendIntervalMs ?? DEFAULT_SEND_INTERVAL_MS;
  }

  setup() {
    const today = contestDay(this.now());
    const stages = contestPrizes.stages.map((s, i) => ({
      index: i + 1,
      startsOn: s.startsOn,
      endsOn: s.endsOn,
      finished: s.endsOn < today,
    }));
    const stage =
      [...stages].reverse().find((s) => s.finished) ??
      stages.find((s) => s.startsOn <= today && today <= s.endsOn) ??
      stages[0];
    const { monthly } = contestPrizes;
    return {
      today,
      stages,
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
        await this.notifier.notify(participant.chatId, text);
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
    if (settings.stage !== null && !contestPrizes.stages[settings.stage - 1]) throw fail(400, "Bunday bosqich yo'q.");
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

  /** Talabga javob beradigan nomzodlar va chetda qolganlar soni (birinchi sabab bo'yicha). */
  private pool(settings: DrawSettings) {
    const today = contestDay(this.now());
    const viewsAsOf = settings.periodTo < today ? settings.periodTo : today;
    const previous = settings.excludePreviousWinners ? this.previousWinners(settings.prizeId) : new Set<string>();
    const excluded = Object.fromEntries(EXCLUSIONS.map((k) => [k, 0])) as Record<DrawExclusion, number>;
    const eligible: DrawCandidate[] = [];
    let totalReels = 0;

    for (const p of this.participants.all()) {
      const reel = p.reel;
      if (!reel) continue;
      totalReels += 1;
      const reason = exclusionOf(p, reel, settings, viewsAsOf, previous);
      if (reason) {
        excluded[reason] += 1;
        continue;
      }
      eligible.push(toCandidate(p, reel, viewsAsOf));
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

function exclusionOf(
  p: Participant,
  reel: Reel,
  s: DrawSettings,
  viewsAsOf: string,
  previous: Set<string>,
): DrawExclusion | null {
  if (reel.status !== "ACCEPTED") return "NOT_ACCEPTED";
  const day = s.dateBasis === "POSTED" ? postedOn(reel) : contestDay(reel.submittedAt);
  if (day < s.periodFrom || day > s.periodTo) return "OUT_OF_PERIOD";
  const views = viewsOn(reel, viewsAsOf);
  if (views < s.minViews) return "VIEWS_LOW";
  if (views > s.maxViews) return "VIEWS_HIGH";
  if (p.status !== "ACTIVE") return "STATUS";
  // Ogohlantirish holati backendda hali yo'q — `excludeWarned` hozircha hech kimni chiqarmaydi.
  if (s.excludeTargets && reel.flags.length > 0) return "TARGET";
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

function toCandidate(p: Participant, reel: Reel, viewsAsOf: string): DrawCandidate {
  return {
    participantId: String(p.telegramId),
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    phone: p.phone ?? "",
    instagramUsername: reel.owner,
    reelUrl: reel.url,
    views: viewsOn(reel, viewsAsOf),
    postedOn: postedOn(reel),
    submittedOn: contestDay(reel.submittedAt),
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
