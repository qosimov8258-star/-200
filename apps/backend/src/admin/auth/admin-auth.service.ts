import { randomBytes, timingSafeEqual } from "node:crypto";

import { HttpException, Injectable, Logger } from "@nestjs/common";

import { AuditService } from "../../audit/audit.service";
import { config } from "../../config/config";
import { parseAdminAccounts, toAdminUser, type AdminAccount, type AdminUser } from "./admin-accounts";
import { createAdminToken, verifyAdminToken } from "./admin-session";

/** Kalit bilan (skriptlar) ishlaganda audit logdagi "xodim". */
export const API_KEY_ACTOR: AdminUser = { id: "api", login: "api", fullName: "API kaliti", role: "ADMIN" };

/** Ketma-ket xato urinishlar chegarasi va qulf muddati. */
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const MAX_TRACKED_LOGINS = 5_000;

const fail = (status: number, message: string) => new HttpException({ message }, status);

/**
 * Admin panelga kirish: login/parol (`ADMIN_USERS`), imzolangan sessiya cookie'si.
 * Parol 5 marta ketma-ket xato kiritilsa — shu login 15 daqiqaga qulflanadi.
 */
@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly accounts: AdminAccount[];
  private readonly secret: Buffer;
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(private readonly audit: AuditService) {
    this.accounts = parseAdminAccounts(config.admin.users);
    if (this.accounts.length === 0) {
      this.logger.warn("ADMIN_USERS berilmagan — admin panelga hech kim kira olmaydi.");
    }
    if (config.admin.sessionSecret) {
      this.secret = Buffer.from(config.admin.sessionSecret, "utf8");
    } else {
      // Kalitsiz ham ishlaydi, lekin har qayta ishga tushishda xodimlar qaytadan kiradi.
      this.secret = randomBytes(32);
      if (this.accounts.length > 0) {
        this.logger.warn("ADMIN_SESSION_SECRET berilmagan — server qayta ishga tushganda admin sessiyalari tugaydi.");
      }
    }
  }

  get ttlSeconds(): number {
    const hours = config.admin.sessionTtlHours;
    return Math.round((Number.isFinite(hours) && hours > 0 ? hours : 12) * 3600);
  }

  /** To'g'ri bo'lsa — xodim va cookie uchun token. */
  login(loginRaw: string, password: string): { user: AdminUser; token: string } {
    const login = loginRaw.trim().toLowerCase();
    const now = Date.now();
    const state = this.failures.get(login);
    if (state && state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60_000);
      throw fail(429, `Juda ko'p urinish. ${minutes} daqiqadan keyin qayta urinib ko'ring.`);
    }
    const account = this.accounts.find((a) => a.login === login);
    let ok = false;
    if (account) ok = account.verify(password);
    // Login topilmasa ham parol tekshiriladi — javob vaqti loginning bor-yo'qligini oshkor qilmasin.
    else this.accounts[0]?.verify(password);
    if (!account || !ok) {
      // Qulf muddati o'tgan bo'lsa — hisob boshidan.
      const previous = state && state.lockedUntil !== 0 ? 0 : (state?.count ?? 0);
      const count = previous + 1;
      this.failures.set(login, { count, lockedUntil: count >= MAX_FAILURES ? now + LOCK_MS : 0 });
      this.pruneFailures(now);
      this.logger.warn(`Admin panelga kirish rad etildi: "${login.slice(0, 32)}" (${count}-urinish).`);
      throw fail(401, "Login yoki parol noto'g'ri.");
    }
    this.failures.delete(login);
    const token = createAdminToken({ login: account.login, fingerprint: account.fingerprint }, this.ttlSeconds, this.secret);
    this.audit.record({
      actor: actorOf(account),
      action: "auth.login",
      entity: "auth",
      entityId: account.id,
      entityLabel: account.fullName,
      before: "",
      after: "",
      reason: "",
    });
    return { user: toAdminUser(account), token };
  }

  /** Tasodifiy loginlar bilan xaritani to'ldirib yuborishdan himoya: qulflanmaganlar o'chadi. */
  private pruneFailures(now: number): void {
    if (this.failures.size <= MAX_TRACKED_LOGINS) return;
    for (const [login, state] of this.failures) {
      if (state.lockedUntil <= now) this.failures.delete(login);
    }
  }

  logout(user: AdminUser): void {
    if (user.id === API_KEY_ACTOR.id) return;
    this.audit.record({
      actor: actorOf(user),
      action: "auth.logout",
      entity: "auth",
      entityId: user.id,
      entityLabel: user.fullName,
      before: "",
      after: "",
      reason: "",
    });
  }

  /** Cookie'dagi token → xodim (parol o'zgargan yoki xodim o'chirilgan bo'lsa — null). */
  fromToken(token: string): AdminUser | null {
    const claims = verifyAdminToken(token, this.secret);
    if (!claims) return null;
    const account = this.accounts.find((a) => a.login === claims.login && a.fingerprint === claims.fingerprint);
    return account ? toAdminUser(account) : null;
  }

  /** `Authorization: Bearer <ADMIN_API_TOKEN>` (skriptlar uchun). */
  fromApiKey(given: string): AdminUser | null {
    const expected = config.adminApiToken;
    if (!expected || !given) return null;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b) ? API_KEY_ACTOR : null;
  }
}

/** Audit log uchun xodim. */
export const actorOf = (user: AdminUser) => ({ id: user.id, name: user.fullName, role: user.role });
