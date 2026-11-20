import { randomBytes, scryptSync } from "node:crypto";

import { HttpException, Inject, Injectable, Logger, Optional } from "@nestjs/common";

import { config } from "../../config/config";
import { parseOwnerAccounts, toOwnerUser, type OwnerAccount, type OwnerUser } from "./owner-accounts";
import { createOwnerToken, deriveOwnerKey, verifyOwnerToken } from "./owner-session";

export interface OwnerAuthOptions {
  /** `OWNER_USERS` ko'rinishidagi matn. */
  users: string | null;
  /** Imzo uchun umumiy kalit (`ADMIN_SESSION_SECRET`); null — har ishga tushishda tasodifiy. */
  sessionSecret: string | null;
  sessionTtlMinutes: number;
  clock?: () => Date;
}

export const OWNER_AUTH_OPTIONS = Symbol("OWNER_AUTH_OPTIONS");

/** Ketma-ket xato urinishlar chegarasi va qulf muddati (admin kirishi bilan bir xil). */
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const MAX_TRACKED_LOGINS = 5_000;
/** Log'ga yoziladigan login uzunligi. */
const LOGGED_LOGIN_LENGTH = 32;

const fail = (status: number, message: string) => new HttpException({ message }, status);

/**
 * Ega bo'limiga kirish: login/parol (`OWNER_USERS`), imzolangan sessiya cookie'si (`reels_owner`).
 * Parol 5 marta ketma-ket xato kiritilsa — shu login 15 daqiqaga qulflanadi.
 *
 * Audit log'ga hech narsa yozilmaydi (egalar qarori). Server log'iga faqat rad etilgan kirish
 * urinishi (qisqartirilgan login, parolsiz) yoziladi — muvaffaqiyatli kirish va chiqish yozilmaydi.
 */
@Injectable()
export class OwnerAuthService {
  private readonly logger = new Logger(OwnerAuthService.name);
  private readonly accounts: OwnerAccount[];
  private readonly key: Buffer;
  private readonly now: () => Date;
  /** Hisob topilmaganda ham parol xeshlanadi — javob vaqti loginning bor-yo'qligini oshkor qilmasin. */
  private readonly dummySalt = randomBytes(16);
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();
  readonly ttlSeconds: number;

  constructor(@Optional() @Inject(OWNER_AUTH_OPTIONS) options: OwnerAuthOptions | null = null) {
    const o = options ?? {
      users: config.owner.users,
      sessionSecret: config.admin.sessionSecret,
      sessionTtlMinutes: config.owner.sessionTtlMinutes,
    };
    if (!Number.isInteger(o.sessionTtlMinutes) || o.sessionTtlMinutes < 1) {
      throw new Error("OWNER_SESSION_TTL_MINUTES musbat butun son bo'lishi kerak");
    }
    this.accounts = parseOwnerAccounts(o.users);
    // Kalitsiz ham ishlaydi, lekin har qayta ishga tushishda egalar qaytadan kiradi.
    this.key = deriveOwnerKey(o.sessionSecret ? Buffer.from(o.sessionSecret, "utf8") : randomBytes(32));
    this.ttlSeconds = o.sessionTtlMinutes * 60;
    this.now = o.clock ?? (() => new Date());
  }

  /** To'g'ri bo'lsa — ega va cookie uchun token. */
  login(loginRaw: string, password: string): { user: OwnerUser; token: string } {
    const login = loginRaw.trim().toLowerCase();
    const now = this.now().getTime();
    const state = this.failures.get(login);
    if (state && state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60_000);
      throw fail(429, `Juda ko'p urinish. ${minutes} daqiqadan keyin qayta urinib ko'ring.`);
    }
    const account = this.accounts.find((a) => a.login === login);
    let ok = false;
    if (account) ok = account.verify(password);
    else scryptSync(password, this.dummySalt, 32);
    if (!account || !ok) {
      // Qulf muddati o'tgan bo'lsa — hisob boshidan.
      const previous = state && state.lockedUntil !== 0 ? 0 : (state?.count ?? 0);
      const count = previous + 1;
      this.failures.set(login, { count, lockedUntil: count >= MAX_FAILURES ? now + LOCK_MS : 0 });
      this.pruneFailures(now);
      this.logger.warn(
        `Ega bo'limiga kirish rad etildi: ${JSON.stringify(login.slice(0, LOGGED_LOGIN_LENGTH))} (${count}-urinish).`,
      );
      throw fail(401, "Login yoki parol noto'g'ri.");
    }
    this.failures.delete(login);
    const token = createOwnerToken({ login: account.login, fingerprint: account.fingerprint }, this.ttlSeconds, this.key, now);
    return { user: toOwnerUser(account), token };
  }

  /** Cookie'dagi token → ega (muddati o'tgan, parol o'zgargan yoki ega o'chirilgan bo'lsa — null). */
  fromToken(token: string): OwnerUser | null {
    const claims = verifyOwnerToken(token, this.key, this.now().getTime());
    if (!claims) return null;
    const account = this.accounts.find((a) => a.login === claims.login && a.fingerprint === claims.fingerprint);
    return account ? toOwnerUser(account) : null;
  }

  /** Tasodifiy loginlar bilan xaritani to'ldirib yuborishdan himoya: qulflanmaganlar o'chadi. */
  private pruneFailures(now: number): void {
    if (this.failures.size <= MAX_TRACKED_LOGINS) return;
    for (const [login, state] of this.failures) {
      if (state.lockedUntil <= now) this.failures.delete(login);
    }
  }
}
