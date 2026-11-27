import { Body, Controller, Get, Headers, HttpCode, Logger, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { ApiException } from "../common/api-exception";
import { chosenLang } from "../common/lang";
import { config } from "../config/config";
import { contestDefaults } from "../miniapp/contest";
import { parseBotLoginPoll, parseBotLoginStart, parseWebRegister } from "../miniapp/validation";
import { ParticipantsService } from "../participants/participants.service";
import { BOT_LOGIN_START_PREFIX, BOT_LOGIN_TTL_MS, BotLoginService, type BotLoginStatus } from "./bot-login.service";
import { parseLoginWidget, verifyLoginWidget } from "./login-widget";
import {
  BOT_LOGIN_COOKIE,
  botLoginCookie,
  createDeviceToken,
  createSessionToken,
  DEVICE_COOKIE,
  deviceCookie,
  readCookie,
  readDeviceToken,
  readSessionToken,
  SESSION_COOKIE,
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
 * Telegram'siz saytning o'zida ro'yxatdan o'tadi (ism va telefon raqam; `web-register`).
 * Avval kirgan (yoki saytda ro'yxatdan o'tgan) ishtirokchi qaytib kirishi uchun — "Hisobim bor":
 * Telegram bot orqali tasdiqlanadigan kirish (`bot-login`, `BotLoginService`).
 *
 * Qoidalar (tashkilotchi qarori, 2026-11-27):
 * - saytdagi hisobga **bir marta** kiriladi; chiqib ketsa yoki boshqa qurilmadan — qayta kirish faqat
 *   admin ruxsati bilan (Support murojaati → "Qayta kirishga ruxsat"), ruxsat bir martalik va yangi
 *   kirish boshqa qurilmadagi eski sessiyani yopadi (`LOGIN_LOCKED`, `LOCKED`);
 * - hisob bot orqali Telegram'ga ulansa, eski sessiyalar yopiladi va raqam egasiga bir marta qayta
 *   kirish beriladi (`ParticipantsService.setPhone`);
 * - **bitta qurilma — bitta hisob**: shu brauzerda hisob ochilgan bo'lsa (`reels_device` cookie yoki
 *   belgisiz eski `reels_session`), yangisini ochib bo'lmaydi (`DEVICE_TAKEN`).
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

  /**
   * Body — widget `onauth` qaytargan obyektning o'zi. Muvaffaqiyatli bo'lsa sessiya cookie'si qo'yiladi.
   * Hisobga saytda allaqachon kirilgan bo'lsa (admin ruxsatisiz) — `403 LOGIN_LOCKED`.
   */
  @Post("telegram-login")
  @HttpCode(204)
  login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const token = config.telegram.botToken;
    const data = parseLoginWidget(body);
    const identity =
      token && data ? verifyLoginWidget(data, token, config.telegram.initDataMaxAgeSeconds) : null;
    if (!token || !identity) throw new ApiException(401, "UNAUTHORIZED");
    const accountId = this.participants.resolve(identity.telegramId);
    if (!this.participants.canStartWebSession(accountId)) throw new ApiException(403, "LOGIN_LOCKED");
    res.setHeader("Set-Cookie", this.newSession(accountId, token, isHttps(req)));
    this.logger.log(`Saytga kirish: ${accountId}`);
  }

  /**
   * Saytdan ro'yxatdan o'tish (Telegram'siz): `{ firstName, phone, age }` → yangi akkaunt va sessiya
   * cookie'si (keyin ilova qoidalarga rozilik qadamiga o'tadi). Raqam "+998 XX XXX XX XX".
   * Xatolar: `422 INVALID_PROFILE | INVALID_PHONE | UNDER_AGE`, `409 PHONE_TAKEN | DEVICE_TAKEN`,
   * `429 TOO_MANY`.
   */
  @Post("web-register")
  @HttpCode(204)
  webRegister(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const token = config.telegram.botToken;
    if (!token) throw new ApiException(503, "SERVER");
    const { firstName, phone, age } = parseWebRegister(body);
    // Bitta qurilma — bitta hisob: shu brauzerda ochilgan hisob hali bor bo'lsa, yangisi ochilmaydi.
    // Qurilma belgisidan oldingi (deploy'dan oldin berilgan) sessiya cookie'si ham hisobga olinadi.
    if (this.deviceAccount(req, token) !== null || this.sessionAccount(req, token) !== null) {
      throw new ApiException(409, "DEVICE_TAKEN");
    }
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
    res.setHeader("Set-Cookie", this.newSession(id, token, isHttps(req)));
    this.logger.log(`Saytdan ro'yxatdan o'tdi: ${id}`);
  }

  /**
   * "Hisobim bor" — Telegram bot orqali kirish so'rovi. Javob: bot havolasi (`?start=login_<id>`)
   * va saytda ko'rsatiladigan 4 xonali kod (botda ham chiqadi). Maxfiy kalit — shu brauzerning
   * `HttpOnly` cookie'sida: sessiya faqat shu brauzerga beriladi. Body — bo'sh obyekt. Saytdagi til
   * (`X-Lang`) so'rovda saqlanadi — bot ham shu tilda gapiradi.
   * Xatolar: `503 SERVER` (bot sozlanmagan), `429 TOO_MANY`.
   */
  @Post("bot-login")
  @HttpCode(200)
  startBotLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers("x-lang") lang?: string,
  ): { id: string; code: string; botUrl: string; expiresAt: string } {
    parseBotLoginStart(body);
    const bot = config.telegram.botUsername;
    if (!config.telegram.botToken || !bot) throw new ApiException(503, "SERVER");
    const now = Date.now();
    const ip = clientIp(req);
    const mine = (this.botLoginStarts.get(ip) ?? []).filter((at) => now - at < BOT_LOGIN_WINDOW_MS);
    if (mine.length >= BOT_LOGINS_PER_IP) throw new ApiException(429, "TOO_MANY");
    const started = this.botLogin.start(now, chosenLang(lang));
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
   * bo'lsa — shu javob bilan sessiya cookie'si qo'yiladi. Kirish bir marta qayd etiladi: javob
   * yetib bormay, brauzer qisqa muddat ichida (`BOT_LOGIN_GRACE_MS`) qayta so'rasa — o'sha sessiya
   * qayta beriladi, ruxsat ikkinchi marta sarflanmaydi. Cookie'dagi kalit mos kelmasa yoki so'rov
   * yo'q bo'lsa — `EXPIRED`. Hisobga saytda allaqachon kirilgan bo'lsa (admin ruxsatisiz) — `LOCKED`,
   * sessiya berilmaydi.
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
    const { status, accountId, issuedAt } = this.botLogin.poll(id, secret);
    if (status !== "CONFIRMED") return { status };
    const account = accountId === null ? null : this.participants.get(accountId);
    if (!account) {
      this.botLogin.drop(id);
      return { status: "EXPIRED" };
    }
    let sessionAt: number;
    if (issuedAt === null) {
      // Bot tasdig'idan keyin admin ruxsati ishlatilgan bo'lishi mumkin — shu yerda yana tekshiriladi.
      if (!this.participants.canStartWebSession(account.telegramId)) {
        this.botLogin.drop(id);
        return { status: "LOCKED" };
      }
      sessionAt = this.participants.startWebSession(account.telegramId);
      this.botLogin.issued(id, sessionAt);
      this.logger.log(`Saytga bot orqali kirish: ${account.telegramId}`);
    } else {
      // Avvalgi javob brauzerga yetmagan — o'sha sessiya qayta beriladi. Shu orada hisobga boshqa
      // joydan kirilgan yoki hisob Telegram'ga ulangan bo'lsa — u sessiya allaqachon yopilgan:
      // so'rov tugaydi, yangi urinish hisobning hozirgi holatiga qarab hal bo'ladi.
      if ((account.sessionsFrom?.getTime() ?? 0) > issuedAt) {
        this.botLogin.drop(id);
        return { status: "EXPIRED" };
      }
      sessionAt = issuedAt;
    }
    const secure = isHttps(req);
    res.setHeader("Set-Cookie", [
      ...this.sessionCookies(account.telegramId, token, sessionAt, secure),
      botLoginCookie("", 0, secure),
    ]);
    return { status: "CONFIRMED" };
  }

  /**
   * Chiqish: sessiya cookie'si o'chadi. Qurilma belgisi qoladi (shu qurilmadan yangi hisob ochilmaydi);
   * shu hisobga qaytib kirish — admin ruxsati bilan. Qurilma belgisidan oldin (deploy'dan oldin)
   * berilgan sessiyada belgi yo'q — chiqishda sessiyadagi hisob bilan qo'yiladi.
   */
  @Post("logout")
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    const secure = isHttps(req);
    const cookies = [sessionCookie("", 0, secure)];
    const token = config.telegram.botToken;
    const accountId = token ? this.sessionAccount(req, token) : null;
    if (token && accountId !== null && this.deviceAccount(req, token) === null) {
      cookies.push(deviceCookie(createDeviceToken(accountId, token), secure));
    }
    res.setHeader("Set-Cookie", cookies);
  }

  /**
   * Yangi sayt sessiyasi: kirish qayd etiladi (`startWebSession`) — keyingi kirish yopiladi, boshqa
   * qurilmadagi eski sessiya bekor bo'ladi.
   */
  private newSession(accountId: number, token: string, secure: boolean): string[] {
    return this.sessionCookies(accountId, token, this.participants.startWebSession(accountId), secure);
  }

  /** Sessiya cookie'si (`issuedAt` — berilgan vaqti, ms) va qurilma belgisi. */
  private sessionCookies(accountId: number, token: string, issuedAt: number, secure: boolean): string[] {
    const ttl = WEB_ACCOUNT_SESSION_TTL_SECONDS;
    return [
      sessionCookie(createSessionToken(accountId, token, issuedAt, ttl), ttl, secure),
      deviceCookie(createDeviceToken(accountId, token), secure),
    ];
  }

  /** Shu brauzerda ochilgan (yoki kirilgan) hisob — qurilma belgisi bo'yicha (`existingAccount`). */
  private deviceAccount(req: Request, token: string): number | null {
    const raw = readCookie(req.header("cookie"), DEVICE_COOKIE);
    return this.existingAccount(raw ? readDeviceToken(raw, token) : null);
  }

  /**
   * Shu brauzerdagi sayt sessiyasining hisobi (`existingAccount`). Imzo va muddat tekshiriladi;
   * keyin yopilgan sessiya ham hisobga olinadi — shu qurilmada o'sha hisob ochilgan.
   */
  private sessionAccount(req: Request, token: string): number | null {
    const raw = readCookie(req.header("cookie"), SESSION_COOKIE);
    return this.existingAccount(raw ? (readSessionToken(raw, token)?.id ?? null) : null);
  }

  /**
   * Cookie'dagi ID → hisob: Telegram ID saytdagi hisobga ulangan bo'lsa — o'sha hisob (Telegram
   * yozuvi ulanishda o'chgan bo'lishi mumkin). Hisob hali bor bo'lsa — uning ID si, aks holda null.
   */
  private existingAccount(id: number | null): number | null {
    if (id === null) return null;
    const accountId = this.participants.resolve(id);
    return this.participants.get(accountId) ? accountId : null;
  }
}
