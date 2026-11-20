import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Ega — `apps/admin/src/lib/owner-types.ts` → OwnerUser bilan bir xil. */
export interface OwnerUser {
  id: string;
  login: string;
  fullName: string;
}

export interface OwnerAccount extends OwnerUser {
  /** Parol o'zgarsa — eski sessiyalar bekor bo'lishi uchun (tokenda shu barmoq izi). */
  fingerprint: string;
  verify(password: string): boolean;
}

const LOGIN = /^[a-z0-9._-]{3,32}$/;
export const OWNER_MIN_PASSWORD_LENGTH = 12;

/**
 * `OWNER_USERS`: `login|Ism Familiya|parol`, bir nechta bo'lsa `;` bilan.
 * Parol xotirada faqat scrypt xeshi ko'rinishida turadi. Xato yozilgan yozuv — server ishga
 * tushishda aniq xabar bilan to'xtaydi (jimgina e'tiborsiz qoldirilmaydi). Xabarda parol yo'q.
 */
export function parseOwnerAccounts(raw: string | null): OwnerAccount[] {
  if (!raw) return [];
  const accounts: OwnerAccount[] = [];
  for (const [i, rawEntry] of raw.split(";").entries()) {
    // Yozuv chetidagi bo'sh joylar (`; ` kabi) parolga qo'shilib ketmasin.
    const entry = rawEntry.trim();
    if (!entry) continue;
    const parts = entry.split("|");
    const where = `OWNER_USERS ${i + 1}-yozuv`;
    if (parts.length !== 3) throw new Error(`${where}: "login|Ism Familiya|parol" ko'rinishida bo'lishi kerak`);
    const [loginRaw, nameRaw, password] = parts as [string, string, string];
    const login = loginRaw.trim().toLowerCase();
    const fullName = nameRaw.trim();
    if (!LOGIN.test(login)) throw new Error(`${where}: login 3–32 ta lotin harfi, raqam yoki . _ - bo'lsin`);
    if (fullName.length < 2) throw new Error(`${where}: ism yozilmagan`);
    if (password.length < OWNER_MIN_PASSWORD_LENGTH) {
      throw new Error(`${where}: parol kamida ${OWNER_MIN_PASSWORD_LENGTH} belgi bo'lsin`);
    }
    if (accounts.some((a) => a.login === login)) throw new Error(`${where}: "${login}" logini takrorlangan`);

    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 32);
    accounts.push({
      id: `own_${login}`,
      login,
      fullName,
      fingerprint: createHash("sha256").update(`owner\u0000${login}\u0000${password}`).digest("base64url").slice(0, 12),
      verify: (candidate) => timingSafeEqual(scryptSync(candidate, salt, 32), hash),
    });
  }
  return accounts;
}

export const toOwnerUser = (a: OwnerUser): OwnerUser => ({ id: a.id, login: a.login, fullName: a.fullName });
