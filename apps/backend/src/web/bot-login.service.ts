import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import type { Lang } from "../common/lang";

/**
 * Saytdagi "Hisobim bor" — Telegram bot orqali tasdiqlanadigan kirish (parol va SMS'siz).
 *
 * 1. Sayt so'rov ochadi (`start`): ochiq `id` (bot havolasida: `?start=login_<id>`), maxfiy
 *    `secret` (faqat shu brauzerning `HttpOnly` cookie'sida) va 4 xonali `code` (saytda ham, botda
 *    ham ko'rinadi — foydalanuvchi solishtiradi).
 * 2. Foydalanuvchi botni ochadi (`claim`): so'rov shu Telegram hisobiga bog'lanadi — boshqa odam
 *    uni "tortib ololmaydi". Raqami bo'lmasa — bot raqam ulashishni so'raydi (saytdagi hisob shu
 *    yerda Telegram'ga ulanadi).
 * 3. Botda "Ha, kirish" (`confirm`) — so'rov hisob ID si bilan tasdiqlanadi; "Men emas" (`deny`).
 * 4. Sayt kutib turadi (`poll`, cookie'dagi `secret` bilan): tasdiqlansa — sessiya beriladi
 *    (`issued`). So'rov yana qisqa muddat (`BOT_LOGIN_GRACE_MS`) saqlanadi: javob brauzerga yetmay
 *    qolsa (tarmoq uzildi), o'sha `secret` bilan qayta so'rov o'sha sessiyani oladi — kirish
 *    ikkinchi marta qayd etilmaydi (bir martalik ruxsat bekorga sarflanmaydi). Keyin o'chiriladi.
 *
 * Havolani (id) ko'rgan begona odam kira olmaydi: sessiya faqat `secret` i bor brauzerga beriladi.
 * So'rovlar xotirada (10 daqiqa) — backend qayta ishga tushsa, foydalanuvchi "Yangi kod" bosadi.
 */
export const BOT_LOGIN_TTL_MS = 10 * 60_000;
/** Sessiya berilgandan keyin tasdiqlangan so'rov shuncha saqlanadi (javob yo'qolsa — qayta so'rov uchun). */
export const BOT_LOGIN_GRACE_MS = 60_000;
/** Bir vaqtda ochiq so'rovlar chegarasi (xotira to'lib ketmasin). */
export const BOT_LOGIN_MAX_OPEN = 5_000;
/** Bot havolasidagi `id`: 16 bayt, base64url — 22 belgi (Telegram `start` parametriga sig'adi). */
export const BOT_LOGIN_ID = /^[A-Za-z0-9_-]{22}$/;
/** Bot `/start` parametri: `login_<id>`. */
export const BOT_LOGIN_START_PREFIX = "login_";

/**
 * - `PENDING` — botda tasdiq kutilmoqda;
 * - `CONFIRMED` — tasdiqlandi (sessiya beriladi);
 * - `DENIED` — botda "Men emas" bosildi;
 * - `FAILED` — kirib bo'lmaydi (raqam boshqa Telegram hisobiga bog'langan — botda sababi yozilgan);
 * - `LOCKED` — hisobga saytda allaqachon kirilgan: qayta kirish faqat admin ruxsati bilan (botda
 *   "Supportga yozish" taklif qilinadi);
 * - `EXPIRED` — muddati o'tgan, ishlatilgan yoki noma'lum.
 */
export type BotLoginStatus = "PENDING" | "CONFIRMED" | "DENIED" | "FAILED" | "LOCKED" | "EXPIRED";

interface BotLoginRequest {
  id: string;
  secretHash: Buffer;
  code: string;
  expiresAt: number;
  status: Exclude<BotLoginStatus, "EXPIRED">;
  /** Botda birinchi ochgan Telegram foydalanuvchisi — faqat u tasdiqlay oladi. */
  telegramId: number | null;
  /** Tasdiqlangan hisob (ishtirokchi ID si; saytdagi hisob ham bo'lishi mumkin). */
  accountId: number | null;
  /** Shu so'rov bo'yicha berilgan sayt sessiyasi vaqti (ms); hali berilmagan — null. */
  issuedAt: number | null;
  /** Saytda tanlangan til — bot ham shu tilda gapiradi; noma'lum — null. */
  lang: Lang | null;
}

/** `poll` natijasi. `issuedAt` — faqat `CONFIRMED` da, sessiya avval berilgan bo'lsa (aks holda null). */
export interface BotLoginPoll {
  status: BotLoginStatus;
  accountId: number | null;
  issuedAt: number | null;
}

export interface BotLoginStart {
  id: string;
  secret: string;
  code: string;
  expiresAt: Date;
}

const hash = (secret: string) => createHash("sha256").update(secret).digest();

/** So'rov yo'q, kalit mos emas yoki muddati o'tgan — sababi aytilmaydi. */
const expired = (): BotLoginPoll => ({ status: "EXPIRED", accountId: null, issuedAt: null });

@Injectable()
export class BotLoginService {
  private readonly requests = new Map<string, BotLoginRequest>();

  /** Yangi so'rov; ochiq so'rovlar juda ko'p bo'lsa — null (chaqiruvchi `TOO_MANY` qaytaradi). */
  start(now: number = Date.now(), lang: Lang | null = null): BotLoginStart | null {
    this.prune(now);
    if (this.requests.size >= BOT_LOGIN_MAX_OPEN) return null;
    const id = randomBytes(16).toString("base64url");
    const secret = randomBytes(32).toString("base64url");
    const code = String(randomInt(0, 10_000)).padStart(4, "0");
    const expiresAt = now + BOT_LOGIN_TTL_MS;
    this.requests.set(id, {
      id,
      secretHash: hash(secret),
      code,
      expiresAt,
      status: "PENDING",
      telegramId: null,
      accountId: null,
      issuedAt: null,
      lang,
    });
    return { id, secret, code, expiresAt: new Date(expiresAt) };
  }

  /**
   * Bot havolasi ochildi: so'rov shu Telegram foydalanuvchisiga bog'lanadi. Natija — saytdagi kod va
   * saytda tanlangan til; noma'lum, eskirgan, tugagan yoki boshqa odam ochgan so'rov — null.
   */
  claim(id: string, telegramId: number, now: number = Date.now()): { code: string; lang: Lang | null } | null {
    const request = this.pending(id, now);
    if (!request) return null;
    if (request.telegramId !== null && request.telegramId !== telegramId) return null;
    request.telegramId = telegramId;
    return { code: request.code, lang: request.lang };
  }

  /** Shu Telegram foydalanuvchisi botda ochgan, hali tasdiqlanmagan eng oxirgi so'rov (raqam ulashgandan keyin). */
  claimedBy(telegramId: number, now: number = Date.now()): { id: string; code: string } | null {
    let found: BotLoginRequest | null = null;
    for (const request of this.requests.values()) {
      if (request.telegramId !== telegramId || request.status !== "PENDING" || request.expiresAt <= now) continue;
      if (!found || request.expiresAt > found.expiresAt) found = request;
    }
    return found ? { id: found.id, code: found.code } : null;
  }

  /** Botda "Ha, kirish": faqat so'rovni ochgan foydalanuvchi, muddati ichida. */
  confirm(id: string, telegramId: number, accountId: number, now: number = Date.now()): boolean {
    const request = this.pending(id, now);
    if (!request || request.telegramId !== telegramId) return false;
    request.status = "CONFIRMED";
    request.accountId = accountId;
    return true;
  }

  /** Botda "Men emas" yoki kirib bo'lmaydigan holat (`FAILED`). */
  close(id: string, telegramId: number, status: "DENIED" | "FAILED" | "LOCKED", now: number = Date.now()): boolean {
    const request = this.pending(id, now);
    if (!request || request.telegramId !== telegramId) return false;
    request.status = status;
    return true;
  }

  /**
   * Sayt holatni so'raydi. `secret` mos kelmasa yoki so'rov yo'q bo'lsa — `EXPIRED` (sababi
   * aytilmaydi). Yopilgan (`DENIED`, `FAILED`, `LOCKED`) so'rov shu yerda o'chiriladi. Tasdiqlangani
   * qoladi: chaqiruvchi sessiya bersa — `issued` (qisqa muddat saqlanadi), bermasa — `drop`.
   */
  poll(id: string, secret: string, now: number = Date.now()): BotLoginPoll {
    const request = this.requests.get(id);
    if (!request || !secretMatches(request.secretHash, secret)) return expired();
    if (request.expiresAt <= now) {
      this.requests.delete(id);
      return expired();
    }
    if (request.status !== "PENDING" && request.status !== "CONFIRMED") this.requests.delete(id);
    return { status: request.status, accountId: request.accountId, issuedAt: request.issuedAt };
  }

  /**
   * Tasdiqlangan so'rov bo'yicha sessiya berildi (`issuedAt`, ms). So'rov yana `BOT_LOGIN_GRACE_MS`
   * saqlanadi — javob yo'qolsa, qayta `poll` o'sha vaqtni qaytaradi; keyin o'chadi. Faqat birinchi
   * chaqiruv yoziladi.
   */
  issued(id: string, issuedAt: number, now: number = Date.now()): void {
    const request = this.requests.get(id);
    if (!request || request.status !== "CONFIRMED" || request.issuedAt !== null) return;
    request.issuedAt = issuedAt;
    request.expiresAt = now + BOT_LOGIN_GRACE_MS;
  }

  /** Tasdiqlangan so'rov bo'yicha sessiya berilmaydi (hisob yo'q yoki kirish yopiq) — so'rov o'chiriladi. */
  drop(id: string): void {
    this.requests.delete(id);
  }

  private pending(id: string, now: number): BotLoginRequest | null {
    const request = this.requests.get(id);
    if (!request || request.status !== "PENDING" || request.expiresAt <= now) return null;
    return request;
  }

  private prune(now: number): void {
    for (const [id, request] of this.requests) if (request.expiresAt <= now) this.requests.delete(id);
  }
}

function secretMatches(expected: Buffer, secret: string): boolean {
  if (!secret) return false;
  const given = hash(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
