import { Body, Controller, Delete, Get, HttpCode, Inject, Optional, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

import { ContestSettingsService } from "../contest/contest-settings.service";
import { DrawsService } from "../draws/draws.service";
import { ApiException } from "../common/api-exception";
import {
  isWebAccount,
  maskPhone,
  ParticipantsService,
  reelsForDisplay,
  reelViews,
  topReel,
  type Reel,
  type ReelRejectReason,
  type ReelStatus,
} from "../participants/participants.service";
import { RulesVideoService } from "../rules/rules-video.service";
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
  /**
   * Eng ko'p ko'rilgan qabul qilingan videoning oxirgi ko'rishlari — reytingdagi natija
   * (videolar ko'rishlari qo'shilmaydi). Qabul qilingan video yo'q — 0.
   */
  bestViews: number;
  /** Shu videoning oxirgi kundagi o'sishi. */
  todayViews: number;
  /** Eng ko'p ko'rilgan videosining videolar reytingidagi o'rni (reytingda bo'lmasa — null). */
  rank: number | null;
  rankDelta: number;
  /** Shu videoning kunlik o'sishi — eskidan yangiga, oxirgi `DAILY_DAYS` kun. */
  daily: { date: string; views: number }[];
  /** Videolar ichida eng oxirgi yig'ish vaqti (ISO). */
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  syncEveryDays: number;
  /**
   * Tartib (`reelsForDisplay`): qabul qilinganlar ko'rishlar kamayishi bo'yicha (birinchisi —
   * reytingdagi video), keyin tekshiruvdagilar, keyin rad etilganlar (ikkalasida yangisi birinchi).
   */
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
  /** Reytingda hisoblanadigan video (eng ko'p ko'rilgan qabul qilingani) — faqat bittasida true. */
  best: boolean;
  /** Shu videoning videolar reytingidagi o'rni; reytingda bo'lmasa (qabul qilinmagan) — null. */
  rank: number | null;
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
    // Testlarda ulanmasligi mumkin — shunda video yo'q deb hisoblanadi. `@Inject` shart: `| null`
    // turida Nest token'ni metadata'dan ololmaydi va jim `null` berib qo'yadi.
    @Optional() @Inject(RulesVideoService) private readonly rulesVideo: RulesVideoService | null = null,
  ) {}

  @Get("me")
  me(@TgUser() user: TelegramIdentity) {
    const p = this.participants.getOrCreate(user.telegramId);
    return {
      stage: this.participants.stage(p),
      phoneMasked: p.phone ? maskPhone(p.phone) : null,
      profile:
        p.firstName && p.age
          ? { firstName: p.firstName, lastName: p.lastName ?? "", age: p.age }
          : null,
      /** Avval rozilik bergan, lekin qoidalar shundan keyin muhim tarzda o'zgargan. */
      rulesUpdated: p.consentVersion !== null && p.consentVersion !== this.rulesService.version,
      /** `web` — saytda (Telegram'siz) ro'yxatdan o'tgan: faqat shu brauzer orqali kiriladi. */
      account: isWebAccount(p.telegramId) && !p.linkedTelegramId ? "web" : "telegram",
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
  /** Qoidalar; `video` — admin yuklagan tushuntirish videosi (eng tepada ko'rsatiladi) yoki null. */
  @Get("rules")
  rules() {
    const { version, sections } = this.rulesService.get();
    const video = this.rulesVideo?.get() ?? null;
    return { version, sections, video: video ? { id: video.id, mime: video.mime } : null };
  }

  /**
   * `GET /miniapp/rules/video/:id` — qoida videosi (ochiq, Range so'rovlari bilan — iOS/Android
   * `<video>` shusiz o'ynamaydi). `id` joriysi bo'lmasa — 404 (almashtirilgan yoki o'chirilgan).
   */
  @Public()
  @Get("rules/video/:id")
  rulesVideoFile(@Param("id") id: string, @Res() res: Response): void {
    const file = /^[a-f0-9]{24}$/.test(id) ? (this.rulesVideo?.file(id) ?? null) : null;
    if (!file) throw new ApiException(404, "NOT_FOUND");
    // Har yuklashda id yangi — fayl o'zgarmaydi, uzoq keshlash mumkin.
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    if ("path" in file) {
      res.sendFile(file.path, { headers: { "Content-Type": file.mime } });
      return;
    }
    res.type(file.mime).send(file.data);
  }

  @Post("rules/accept")
  @HttpCode(204)
  acceptRules(@TgUser() user: TelegramIdentity, @Body() body: unknown): void {
    this.participants.acceptRules(user.telegramId, parseVersion(body));
  }

  /**
   * Ommaviy reyting — har bir qabul qilingan video alohida qator (4 ta videosi bor ishtirokchi
   * 4 joyda). Telefon raqamlari va video linklari berilmaydi. Ko'rishlarni worker (StatsService) yig'adi.
   */
  @Public()
  @Get("rating")
  rating(@TgUserOptional() user: TelegramIdentity | null) {
    return this.stats.reelRanking().map((e) => ({
      rank: e.rank,
      fullName: `${e.participant.firstName} ${e.participant.lastName}`,
      views: e.views,
      rankDelta: e.rankDelta,
      isMe: user !== null && e.participant.telegramId === user.telegramId,
    }));
  }

  /**
   * Ishtirokchining barcha videolari va natijasi. Video bo'lmasa ham obyekt qaytadi (`reels: []`).
   * Ko'rishlar, kunlik o'sish va o'rin — eng ko'p ko'rilgan qabul qilingan video bo'yicha
   * (videolar ko'rishlari qo'shilmaydi).
   */
  @Get("reels")
  reels(@TgUser() user: TelegramIdentity): MyReels {
    const p = this.participants.get(user.telegramId);
    const reels = p?.reels ?? [];
    const best = topReel(reels.filter((r) => r.status === "ACCEPTED"));
    const entry = p ? (this.stats.ranking().find((e) => e.participant === p) ?? null) : null;
    const reelRanks = new Map(
      p ? this.stats.reelRanking().filter((e) => e.participant === p).map((e) => [e.reel, e.rank]) : [],
    );
    const daily = best ? dailyGrowth(best) : [];
    const lastSyncedAt = reels.reduce<Date | null>((latest, r) => {
      const at = r.history.at(-1)?.at ?? null;
      return at !== null && (latest === null || at > latest) ? at : latest;
    }, null);
    return {
      bestViews: best ? reelViews(best) : 0,
      todayViews: daily.at(-1)?.views ?? 0,
      rank: entry?.rank ?? null,
      rankDelta: entry?.rankDelta ?? 0,
      daily: daily.slice(-DAILY_DAYS),
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
      /** Keyingi rejadagi yangilanish (har `syncEveryDays` kunda); bo'lmasa — null. */
      nextSyncAt: this.stats.nextSyncAt()?.toISOString() ?? null,
      syncEveryDays: this.stats.syncEveryDays,
      reels: reelsForDisplay(reels).map(
        (r): MyReelItem => ({
          url: r.url,
          shortcode: r.shortcode,
          status: r.status,
          rejectReason: r.status === "REJECTED" ? r.rejectReason : null,
          views: reelViews(r),
          submittedAt: r.submittedAt.toISOString(),
          best: r === best,
          rank: reelRanks.get(r) ?? null,
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
 * Bitta videoning kunlik o'sishi: kun oxiridagi ko'rishlar − oldingi yozuv (birinchi yozuv o'sish
 * emas). Kamayish 0 deb ko'rsatiladi (ishtirokchiga; admin VIEW_DROP belgisini ko'radi). Eskidan yangiga.
 */
export function dailyGrowth(reel: Pick<Reel, "history">): { date: string; views: number }[] {
  const h = reel.history;
  return h.slice(1).map((s, i) => ({ date: s.date, views: Math.max(0, s.views - h[i].views) }));
}
