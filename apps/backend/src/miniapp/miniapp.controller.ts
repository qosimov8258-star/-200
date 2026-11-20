import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { ContestSettingsService } from "../contest/contest-settings.service";
import { DrawsService } from "../draws/draws.service";
import { ApiException } from "../common/api-exception";
import {
  maskPhone,
  ParticipantsService,
  reelViews,
  type Reel,
  type ReelRejectReason,
  type ReelStatus,
} from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import { SupportRelay } from "../support/support-relay";
import { SupportService } from "../support/support.service";
import { TargetsService } from "../targets/targets.service";
import type { TelegramIdentity } from "../telegram/init-data";
import { WinnerService } from "../winner/winner.service";
import { canonicalReelUrl, parseReelShortcode } from "./reel-url";
import { Public, TelegramAuthGuard, TgUser, TgUserOptional } from "./telegram-auth.guard";
import { parseRegister, parseSupportMessage, parseTargetReport, parseUrl, parseVersion } from "./validation";

/** Mini App grafigi uchun nechta kun beriladi. */
const DAILY_DAYS = 30;

/** "Mening videolarim" (`apps/miniapp/src/lib/types.ts` → MyReels). */
export interface MyReels {
  /** Qabul qilingan videolar oxirgi ko'rishlari yig'indisi. */
  totalViews: number;
  /** Oxirgi kundagi o'sish (barcha qabul qilinganlar bo'yicha). */
  todayViews: number;
  rank: number | null;
  rankDelta: number;
  /** Qabul qilingan videolarning kunlik o'sishi yig'indisi — eskidan yangiga, oxirgi `DAILY_DAYS` kun. */
  daily: { date: string; views: number }[];
  /** Videolar ichida eng oxirgi yig'ish vaqti (ISO). */
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  syncEveryDays: number;
  /** Eng yangisi birinchi. */
  reels: MyReelItem[];
}

export interface MyReelItem {
  url: string;
  shortcode: string;
  status: ReelStatus;
  rejectReason: ReelRejectReason | null;
  /** Shu videoning oxirgi ko'rishlari (hali yig'ilmagan — 0). */
  views: number;
  submittedAt: string;
}
/** Support: shu vaqt ichida ko'pi bilan shuncha xabar (spamdan himoya). */
const SUPPORT_WINDOW_MS = 10 * 60 * 1000;
const SUPPORT_MAX_IN_WINDOW = 5;

/**
 * Mini App API. Javob shakllari `apps/miniapp/src/lib/types.ts` bilan bir xil;
 * yo'llar `apps/miniapp/src/lib/api.ts` dagi `@endpoint` izohlariga mos.
 *
 * `@Public()` yo'llar (tanlov, qoidalar, reyting, sovg'alar, g'olib) veb-saytga kirmagan
 * mehmonga ham ochiq — u bosh sahifani ko'radi, ro'yxatdan o'tishni "Profil" da boshlaydi.
 */
@Controller("miniapp")
@UseGuards(TelegramAuthGuard)
export class MiniappController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly rulesService: RulesService,
    private readonly stats: StatsService,
    private readonly targets: TargetsService,
    private readonly support: SupportService,
    private readonly supportRelay: SupportRelay,
    private readonly contestSettings: ContestSettingsService,
    private readonly draws: DrawsService,
    private readonly winnerService: WinnerService,
  ) {}

  @Get("me")
  me(@TgUser() user: TelegramIdentity) {
    const p = this.participants.getOrCreate(user.telegramId);
    return {
      stage: this.participants.stage(p),
      phoneMasked: p.phone ? maskPhone(p.phone) : null,
      profile:
        p.firstName && p.lastName && p.age
          ? { firstName: p.firstName, lastName: p.lastName, age: p.age }
          : null,
      /** Avval rozilik bergan, lekin qoidalar shundan keyin muhim tarzda o'zgargan. */
      rulesUpdated: p.consentVersion !== null && p.consentVersion !== this.rulesService.version,
    };
  }

  @Post("register")
  @HttpCode(204)
  register(@TgUser() user: TelegramIdentity, @Body() body: unknown): void {
    const { firstName, lastName, age } = parseRegister(body);
    this.participants.register(user.telegramId, firstName, lastName, age);
  }

  @Public()
  @Get("contest")
  contest() {
    const participants = this.participants
      .all()
      .filter((p) => this.participants.stage(p) === "ACTIVE").length;
    return {
      startsOn: this.contestSettings.get().startsOn,
      endsAt: this.contestSettings.endsAt.toISOString(),
      prizeName: this.contestSettings.prizeName,
      minAge: this.contestSettings.get().minAge,
      participants,
    };
  }

  @Public()
  @Get("rules")
  rules() {
    const { version, sections } = this.rulesService.get();
    return { version, sections };
  }

  @Post("rules/accept")
  @HttpCode(204)
  acceptRules(@TgUser() user: TelegramIdentity, @Body() body: unknown): void {
    this.participants.acceptRules(user.telegramId, parseVersion(body));
  }

  /** Ommaviy reyting — telefon raqamlarisiz. Ko'rishlarni worker (StatsService) yig'adi. */
  @Public()
  @Get("rating")
  rating(@TgUserOptional() user: TelegramIdentity | null) {
    return this.stats.ranking().map((e) => ({
      rank: e.rank,
      fullName: `${e.participant.firstName} ${e.participant.lastName}`,
      views: e.views,
      rankDelta: e.rankDelta,
      isMe: user !== null && e.participant.telegramId === user.telegramId,
    }));
  }

  /**
   * Ishtirokchining barcha videolari va jami statistikasi. Video bo'lmasa ham obyekt qaytadi
   * (`reels: []`). Ko'rishlar, kunlik o'sish va o'rin — faqat qabul qilingan videolar bo'yicha.
   */
  @Get("reels")
  reels(@TgUser() user: TelegramIdentity): MyReels {
    const p = this.participants.get(user.telegramId);
    const reels = p?.reels ?? [];
    const accepted = reels.filter((r) => r.status === "ACCEPTED");
    const entry = p ? (this.stats.ranking().find((e) => e.participant === p) ?? null) : null;
    const daily = summedDailyGrowth(accepted);
    const lastSyncedAt = reels.reduce<Date | null>((latest, r) => {
      const at = r.history.at(-1)?.at ?? null;
      return at !== null && (latest === null || at > latest) ? at : latest;
    }, null);
    return {
      totalViews: accepted.reduce((sum, r) => sum + reelViews(r), 0),
      todayViews: daily.at(-1)?.views ?? 0,
      rank: entry?.rank ?? null,
      rankDelta: entry?.rankDelta ?? 0,
      daily: daily.slice(-DAILY_DAYS),
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      /** Keyingi rejadagi yangilanish (har `syncEveryDays` kunda); bo'lmasa — null. */
      nextSyncAt: this.stats.nextSyncAt()?.toISOString() ?? null,
      syncEveryDays: this.stats.syncEveryDays,
      reels: [...reels].reverse().map(
        (r): MyReelItem => ({
          url: r.url,
          shortcode: r.shortcode,
          status: r.status,
          rejectReason: r.status === "REJECTED" ? r.rejectReason : null,
          views: reelViews(r),
          submittedAt: r.submittedAt.toISOString(),
        }),
      ),
    };
  }

  /**
   * Yangi video (soni cheklanmagan): link qabul qilinadi (PENDING); tekshiruv bir necha soniyada
   * fon rejimida, natija bot orqali. Javob — yangilangan "Mening videolarim".
   */
  @Post("reels")
  submitReel(@TgUser() user: TelegramIdentity, @Body() body: unknown): MyReels {
    const shortcode = parseReelShortcode(parseUrl(body));
    if (!shortcode) throw new ApiException(422, "INVALID_LINK");
    this.participants.submitReel(user.telegramId, canonicalReelUrl(shortcode), shortcode);
    this.stats.queueVerification(user.telegramId, shortcode);
    return this.reels(user);
  }

  /**
   * "Reklamani ko'rdim": boshqa ishtirokchining Reeli pullik reklama bilan ko'rsatilayotgani
   * haqida skrinshotli shikoyat. Kim yuborgani faqat adminga ko'rinadi.
   */
  @Post("target-reports")
  @HttpCode(204)
  reportTarget(@TgUser() user: TelegramIdentity, @Body() body: unknown): void {
    this.targets.report(user.telegramId, parseTargetReport(body));
  }

  /** Support yozishmasi (ilova va sayt): ishtirokchi xabarlari va operator javoblari. */
  @Get("support")
  supportThread(@TgUser() user: TelegramIdentity) {
    return { messages: this.threadOf(user.telegramId) };
  }

  /**
   * Saytdan yoki ilovadan support'ga yozish — botdagidek murojaat ochiladi va operatorlar
   * guruhiga boradi. Raqam ulashilmagan bo'lsa — 403 (ishtirokchi hali aniqlanmagan).
   */
  @Post("support")
  async writeSupport(@TgUser() user: TelegramIdentity, @Body() body: unknown) {
    const text = parseSupportMessage(body);
    const p = this.participants.get(user.telegramId);
    if (!p?.phone) throw new ApiException(403, "UNAUTHORIZED");
    if (this.support.recentParticipantMessages(p.telegramId, SUPPORT_WINDOW_MS) >= SUPPORT_MAX_IN_WINDOW) {
      throw new ApiException(429, "SUPPORT_LIMIT");
    }
    const ticket = this.support.addParticipantMessage(p.telegramId, text, null);
    const name = p.firstName ? `${p.firstName} ${p.lastName ?? ""}`.trim() : `ID ${p.telegramId}`;
    try {
      await this.supportRelay.forward(p.telegramId, `🆘 Murojaat #${ticket.id} — ${name} (ilova/sayt)`, text);
    } catch {
      // Guruhga yetmasa ham xabar saqlangan — operator admin panelda ko'radi.
    }
    return { messages: this.threadOf(p.telegramId) };
  }

  private threadOf(telegramId: number) {
    return this.support.thread(telegramId).map((m) => ({
      from: m.from,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Sovrinlar: oylik voucherlar, bosqichlar, asosiy sovrin toifalari. */
  @Public()
  @Get("prizes")
  prizes() {
    return this.draws.publicPrizes();
  }

  /** G'olib e'loni: faqat e'lon qilingandan keyin — ism, yakuniy ko'rishlar, sana (telefonsiz). */
  @Public()
  @Get("winner")
  winner() {
    return this.winnerService.publicWinner();
  }

  @Delete("me")
  @HttpCode(204)
  deleteMe(@TgUser() user: TelegramIdentity): void {
    this.participants.delete(user.telegramId);
  }
}

/**
 * Kunlik o'sish: har bir video uchun kun oxiridagi jami − oldingi yozuv (birinchi yozuv o'sish
 * emas), so'ng sanalar bo'yicha qo'shiladi. Kamayish 0 deb ko'rsatiladi (ishtirokchiga; admin
 * VIEW_DROP belgisini ko'radi). Eskidan yangiga.
 */
export function summedDailyGrowth(reels: readonly Reel[]): { date: string; views: number }[] {
  const byDate = new Map<string, number>();
  for (const { history: h } of reels) {
    for (let i = 1; i < h.length; i++) {
      const growth = Math.max(0, h[i].views - h[i - 1].views);
      byDate.set(h[i].date, (byDate.get(h[i].date) ?? 0) + growth);
    }
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, views }));
}
