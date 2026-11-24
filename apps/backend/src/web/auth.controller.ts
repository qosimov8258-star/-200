import { Body, Controller, Get, HttpCode, Logger, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { contestDefaults } from "../miniapp/contest";
import { parseBotLoginPoll, parseBotLoginStart, parseWebRegister } from "../miniapp/validation";
import { isWebAccount, ParticipantsService } from "../participants/participants.service";
import { BOT_LOGIN_START_PREFIX, BOT_LOGIN_TTL_MS, BotLoginService, type BotLoginStatus } from "./bot-login.service";
import { parseLoginWidget, verifyLoginWidget } from "./login-widget";
import {
  BOT_LOGIN_COOKIE,
  botLoginCookie,
  createSessionToken,
  readCookie,
  SESSION_TTL_SECONDS,
  sessionCookie,
  WEB_ACCOUNT_SESSION_TTL_SECONDS,
} from "./web-session";

/** Proksi (nginx) orqali https bo'lsa ham `Secure` cookie qo'yiladi. */
const isHttps = (req: Request) => req.secure || req.header("x-forwarded-proto") === "https";

/** Saytdan ro'yxatdan o'tish chegarasi: bitta IP dan soatiga, va hammasi bo'lib soatiga. */
const SIGNUPS_PER_IP_PER_HOUR = 5;
const SIGNUPS_PER_HOUR = 300;
const HOUR_MS = 60 * 60 * 1000;
/** "Hisobim bor" so'rovlari: bitta IP dan 10 daqiqada shunchadan ko'p emas. */
const BOT_LOGINS_PER_IP = 10;
const BOT_LOGIN_WINDOW_MS = 10 * 60 * 1000;

/** Mijoz IP si: nginx `X-Forwarded-For` ning birinchisi (bo'lmasa — ulanish manzili). */
const clientIp = (req: Request): string =>
  (req.header("x-forwarded-for") ?? "").split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

/**
 * Veb-sayt uchun kirish: ishtirokchi oddiy brauzerda Telegram Login Widget orqali kiradi
 * va Telegram'dagi Mini App bilan aynan bir xil akkaunt (telegramId) bilan ishlaydi — yoki
 * Telegram'siz saytning o'zida ro'yxatdan o'tadi (ism, telefon raqam, yosh; `web-register`).
 * Avval kirgan (yoki saytda ro'yxatdan o'tgan) ishtirokchi qaytib kirishi uchun — "Hisobim bor":
 * Telegram bot orqali tasdiqlanadigan kirish (`bot-login`, `BotLoginService`).
 * Mini App'ning o'zi bu endpointlarga muhtoj emas — u `initData` bilan tanilgan.
 *
 * Widget ishlashi uchun @BotFather → /setdomain da sayt domeni ko'rsatilgan bo'lishi kerak.
 */
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  /** Saytdan ro'yxatdan o'tishlar vaqti (oxirgi bir soat) — IP bo'yicha va umumiy. */
  private readonly signups = new Map<string, number[]>();
  private recentSignups: number[] = [];
  /** "Hisobim bor" so'rovlari vaqti (oxirgi 10 daqiqa) — IP bo'yicha. */
  private readonly botLoginStarts = new Map<string, number[]>();

  constructor(
    private readonly participants: ParticipantsService,
    private readonly botLogin: BotLoginService,
  ) {}

  /** Saytning kirish sahifasi uchun: bot nomi (Login Widget) va sovrin. Ochiq ma'lumot. */
  @Get("config")
  authConfig() {
    return { botUsername: config.telegram.botUsername, prizeName: contestDefaults.prizeName };
  }

  /** Body — widget `onauth` qaytargan obyektning o'zi. Muvaffaqiyatli bo'lsa sessiya cookie'si qo'yiladi. */
  @Post("telegram-login")
  @HttpCode(204)
  login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const token = config.telegram.botToken;
    const data = parseLoginWidget(body);
    const identity =
      token && data ? verifyLoginWidget(data, token, config.telegram.initDataMaxAgeSeconds) : null;
    if (!token || !identity) throw new ApiException(401, "UNAUTHORIZED");
    res.setHeader(
      "Set-Cookie",
      sessionCookie(createSessionToken(identity.telegramId, token), SESSION_TTL_SECONDS, isHttps(req)),
    );
    this.logger.log(`Saytga kirish: ${identity.telegramId}`);
  }

  /**
   * Saytdan ro'yxatdan o'tish (Telegram'siz): `{ firstName, phone, age }` → yangi akkaunt va sessiya
   * cookie'si (keyin ilova qoidalarga rozilik qadamiga o'tadi). Raqam "+998 XX XXX XX XX".
   * Xatolar: `422 INVALID_PROFILE | INVALID_PHONE | UNDER_AGE`, `409 PHONE_TAKEN`, `429 TOO_MANY`.
   */
  @Post("web-register")
  @HttpCode(204)
  webRegister(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const token = config.telegram.botToken;
    if (!token) throw new ApiException(503, "SERVER");
    const { firstName, phone, age } = parseWebRegister(body);
    const now = Date.now();
    const ip = clientIp(req);
    const mine = (this.signups.get(ip) ?? []).filter((at) => now - at < HOUR_MS);
    this.recentSignups = this.recentSignups.filter((at) => now - at < HOUR_MS);
    if (mine.length >= SIGNUPS_PER_IP_PER_HOUR || this.recentSignups.length >= SIGNUPS_PER_HOUR) {
      throw new ApiException(429, "TOO_MANY");
    }
    const id = this.participants.registerWeb(firstName, phone, age);
    this.signups.set(ip, [...mine, now]);
    this.recentSignups.push(now);
    if (this.signups.size > 10_000) this.signups.clear();
    const ttl = WEB_ACCOUNT_SESSION_TTL_SECONDS;
    res.setHeader("Set-Cookie", sessionCookie(createSessionToken(id, token, Date.now(), ttl), ttl, isHttps(req)));
    this.logger.log(`Saytdan ro'yxatdan o'tdi: ${id}`);
  }

  /**
   * "Hisobim bor" — Telegram bot orqali kirish so'rovi. Javob: bot havolasi (`?start=login_<id>`)
   * va saytda ko'rsatiladigan 4 xonali kod (botda ham chiqadi). Maxfiy kalit — shu brauzerning
   * `HttpOnly` cookie'sida: sessiya faqat shu brauzerga beriladi. Body — bo'sh obyekt.
   * Xatolar: `503 SERVER` (bot sozlanmagan), `429 TOO_MANY`.
   */
  @Post("bot-login")
  @HttpCode(200)
  startBotLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { id: string; code: string; botUrl: string; expiresAt: string } {
    parseBotLoginStart(body);
    const bot = config.telegram.botUsername;
    if (!config.telegram.botToken || !bot) throw new ApiException(503, "SERVER");
    const now = Date.now();
    const ip = clientIp(req);
    const mine = (this.botLoginStarts.get(ip) ?? []).filter((at) => now - at < BOT_LOGIN_WINDOW_MS);
    if (mine.length >= BOT_LOGINS_PER_IP) throw new ApiException(429, "TOO_MANY");
    const started = this.botLogin.start(now);
    if (!started) throw new ApiException(429, "TOO_MANY");
    this.botLoginStarts.set(ip, [...mine, now]);
    if (this.botLoginStarts.size > 10_000) this.botLoginStarts.clear();
    res.setHeader("Set-Cookie", botLoginCookie(started.secret, BOT_LOGIN_TTL_MS / 1000, isHttps(req)));
    return {
      id: started.id,
      code: started.code,
      botUrl: `https://t.me/${bot}?start=${BOT_LOGIN_START_PREFIX}${started.id}`,
      expiresAt: started.expiresAt.toISOString(),
    };
  }

  /**
   * "Hisobim bor" — holat (sayt har 2 soniyada so'raydi): `{ id }` → `{ status }`. `CONFIRMED`
   * bo'lsa — shu javob bilan sessiya cookie'si qo'yiladi (bir marta). Cookie'dagi kalit mos
   * kelmasa yoki so'rov yo'q bo'lsa — `EXPIRED`.
   */
  @Post("bot-login/poll")
  @HttpCode(200)
  pollBotLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): { status: BotLoginStatus } {
    const id = parseBotLoginPoll(body);
    const token = config.telegram.botToken;
    if (!token) throw new ApiException(503, "SERVER");
    const secret = readCookie(req.header("cookie"), BOT_LOGIN_COOKIE) ?? "";
    const { status, accountId } = this.botLogin.poll(id, secret);
    if (status !== "CONFIRMED") return { status };
    const account = accountId === null ? null : this.participants.get(accountId);
    if (!account) return { status: "EXPIRED" };
    const ttl = isWebAccount(account.telegramId) ? WEB_ACCOUNT_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
    // Hisob shu daqiqada Telegram'ga ulangan bo'lishi mumkin — undan oldingi sessiyalar bekor
    // (`sessionsFrom`). Yangi sessiya ulangandan keyin berilgan bo'lsin (vaqt soniyaga yaxlitlanadi).
    const issuedAt = Math.max(Date.now(), Math.ceil((account.sessionsFrom?.getTime() ?? 0) / 1000) * 1000);
    const secure = isHttps(req);
    res.setHeader("Set-Cookie", [
      sessionCookie(createSessionToken(account.telegramId, token, issuedAt, ttl), ttl, secure),
      botLoginCookie("", 0, secure),
    ]);
    this.logger.log(`Saytga bot orqali kirish: ${account.telegramId}`);
    return { status: "CONFIRMED" };
  }

  @Post("logout")
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    res.setHeader("Set-Cookie", sessionCookie("", 0, isHttps(req)));
  }
}
