import { Body, Controller, Get, HttpCode, Logger, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

import { ApiException } from "../common/api-exception";
import { config } from "../config/config";
import { contestDefaults } from "../miniapp/contest";
import { parseLoginWidget, verifyLoginWidget } from "./login-widget";
import { createSessionToken, SESSION_TTL_SECONDS, sessionCookie } from "./web-session";

/** Proksi (nginx) orqali https bo'lsa ham `Secure` cookie qo'yiladi. */
const isHttps = (req: Request) => req.secure || req.header("x-forwarded-proto") === "https";

/**
 * Veb-sayt uchun kirish: ishtirokchi oddiy brauzerda Telegram Login Widget orqali kiradi
 * va Telegram'dagi Mini App bilan aynan bir xil akkaunt (telegramId) bilan ishlaydi.
 * Mini App'ning o'zi bu endpointlarga muhtoj emas — u `initData` bilan tanilgan.
 *
 * Widget ishlashi uchun @BotFather → /setdomain da sayt domeni ko'rsatilgan bo'lishi kerak.
 */
@Controller("auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

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

  @Post("logout")
  @HttpCode(204)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): void {
    res.setHeader("Set-Cookie", sessionCookie("", 0, isHttps(req)));
  }
}
