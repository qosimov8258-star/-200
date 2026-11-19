import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { maskPhone, ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { StatsService } from "../stats/stats.service";
import type { TelegramIdentity } from "../telegram/init-data";
import { contestSettings } from "./contest";
import { contestPrizes } from "./prizes";
import { canonicalReelUrl, parseReelShortcode } from "./reel-url";
import { TelegramAuthGuard, TgUser } from "./telegram-auth.guard";
import { parseRegister, parseUrl, parseVersion } from "./validation";

/** Mini App grafigi uchun nechta kun beriladi. */
const DAILY_DAYS = 30;

/**
 * Mini App API. Javob shakllari `apps/miniapp/src/lib/types.ts` bilan bir xil;
 * yo'llar `apps/miniapp/src/lib/api.ts` dagi `@endpoint` izohlariga mos.
 */
@Controller("miniapp")
@UseGuards(TelegramAuthGuard)
export class MiniappController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly rulesService: RulesService,
    private readonly stats: StatsService,
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

  @Get("contest")
  contest() {
    const participants = this.participants
      .all()
      .filter((p) => this.participants.stage(p) === "ACTIVE").length;
    return { ...contestSettings, participants };
  }

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
  @Get("rating")
  rating(@TgUser() user: TelegramIdentity) {
    return this.stats.ranking().map((e) => ({
      rank: e.rank,
      fullName: `${e.participant.firstName} ${e.participant.lastName}`,
      views: e.views,
      rankDelta: e.rankDelta,
      isMe: e.participant.telegramId === user.telegramId,
    }));
  }

  @Get("reel")
  reel(@TgUser() user: TelegramIdentity) {
    const p = this.participants.get(user.telegramId);
    const reel = p?.reel;
    if (!p || !reel) return null;
    const entry = this.stats.ranking().find((e) => e.participant === p) ?? null;
    const h = reel.history;
    // Kunlik o'sish: kun oxiridagi jami − oldingi yozuv. Kamayish 0 deb ko'rsatiladi
    // (ishtirokchiga; admin VIEW_DROP belgisini ko'radi).
    const daily = h.slice(1).map((s, i) => ({ date: s.date, views: Math.max(0, s.views - h[i].views) }));
    const last = h.at(-1);
    return {
      url: reel.url,
      shortcode: reel.shortcode,
      status: reel.status,
      rejectReason: reel.rejectReason,
      totalViews: last?.views ?? 0,
      todayViews: daily.at(-1)?.views ?? 0,
      rank: entry?.rank ?? null,
      rankDelta: entry?.rankDelta ?? 0,
      daily: daily.slice(-DAILY_DAYS),
      lastSyncedAt: last?.at.toISOString() ?? null,
      /** Keyingi rejadagi yangilanish (har `syncEveryDays` kunda); bo'lmasa — null. */
      nextSyncAt: this.stats.nextSyncAt()?.toISOString() ?? null,
      syncEveryDays: this.stats.syncEveryDays,
    };
  }

  /** Link qabul qilinadi (PENDING); tekshiruv bir necha soniyada fon rejimida, natija bot orqali. */
  @Post("reel")
  submitReel(@TgUser() user: TelegramIdentity, @Body() body: unknown) {
    const shortcode = parseReelShortcode(parseUrl(body));
    if (!shortcode) throw new ApiException(422, "INVALID_LINK");
    this.participants.submitReel(user.telegramId, canonicalReelUrl(shortcode), shortcode);
    this.stats.queueVerification(user.telegramId);
    return this.reel(user);
  }

  /** Sovrinlar: oylik voucherlar, bosqichlar, asosiy sovrin toifalari. */
  @Get("prizes")
  prizes() {
    return contestPrizes;
  }

  @Get("winner")
  winner() {
    return null;
  }

  @Delete("me")
  @HttpCode(204)
  deleteMe(@TgUser() user: TelegramIdentity): void {
    this.participants.delete(user.telegramId);
  }
}
