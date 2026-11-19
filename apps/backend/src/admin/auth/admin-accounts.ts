import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Admin panel roli (TZ, 2-bo'lim): ADMIN — hammasi, SUPPORT — faqat murojaatlar. */
export type AdminRole = "ADMIN" | "SUPPORT";

/** Panelga kirgan xodim — `apps/admin/src/lib/types.ts` → AdminUser bilan bir xil. */
export interface AdminUser {
  id: string;
  login: string;
  fullName: string;
  role: AdminRole;
}

export interface AdminAccount extends AdminUser {
  /** Parol o'zgarsa — eski sessiyalar bekor bo'lishi uchun (cookie'da shu barmoq izi). */
  fingerprint: string;
  verify(password: string): boolean;
}

const LOGIN = /^[a-z0-9._-]{3,32}$/;
const ROLES: AdminRole[] = ["ADMIN", "SUPPORT"];
const MIN_PASSWORD_LENGTH = 10;

/**
 * `ADMIN_USERS`: `login|ROL|Ism Familiya|parol`, bir nechta bo'lsa `;` bilan.
 * Parol xotirada faqat scrypt xeshi ko'rinishida turadi. Xato yozilgan qator — ishga tushishda
 * aniq xabar bilan to'xtatadi (jimgina e'tiborsiz qoldirilmaydi).
 */
export function parseAdminAccounts(raw: string | null): AdminAccount[] {
  if (!raw) return [];
  const accounts: AdminAccount[] = [];
  for (const [i, rawEntry] of raw.split(";").entries()) {
    // Yozuv chetidagi bo'sh joylar (`; ` kabi) parolga qo'shilib ketmasin.
    const entry = rawEntry.trim();
    if (!entry) continue;
    const parts = entry.split("|");
    const where = `ADMIN_USERS ${i + 1}-yozuv`;
    if (parts.length !== 4) throw new Error(`${where}: "login|ROL|Ism Familiya|parol" ko'rinishida bo'lishi kerak`);
    const [loginRaw, roleRaw, nameRaw, password] = parts as [string, string, string, string];
    const login = loginRaw.trim().toLowerCase();
    const role = ROLES.find((r) => r === roleRaw.trim().toUpperCase());
    const fullName = nameRaw.trim();
    if (!LOGIN.test(login)) throw new Error(`${where}: login 3–32 ta lotin harfi, raqam yoki . _ - bo'lsin`);
    if (!role) throw new Error(`${where}: rol ADMIN yoki SUPPORT bo'lishi kerak`);
    if (fullName.length < 2) throw new Error(`${where}: ism yozilmagan`);
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`${where}: parol kamida ${MIN_PASSWORD_LENGTH} belgi bo'lsin`);
    if (accounts.some((a) => a.login === login)) throw new Error(`${where}: "${login}" logini takrorlangan`);

    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 32);
    accounts.push({
      id: `adm_${login}`,
      login,
      fullName,
      role,
      fingerprint: createHash("sha256").update(`${login}\u0000${password}`).digest("base64url").slice(0, 12),
      verify: (candidate) => timingSafeEqual(scryptSync(candidate, salt, 32), hash),
    });
  }
  return accounts;
}

export const toAdminUser = (a: AdminUser): AdminUser => ({
  id: a.id,
  login: a.login,
  fullName: a.fullName,
  role: a.role,
});
