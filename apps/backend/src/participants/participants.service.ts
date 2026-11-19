import { Inject, Injectable, Optional } from "@nestjs/common";

import { ApiException } from "../common/api-exception";
import { ContestSettingsService } from "../contest/contest-settings.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";

export type ParticipantStage =
  | "NEEDS_CONTACT"
  | "NEEDS_PROFILE"
  | "NEEDS_CONSENT"
  | "ACTIVE"
  | "BLOCKED"
  | "DISQUALIFIED";

/**
 * PENDING — avtomatik tekshiruv kutilmoqda; ACCEPTED — reytingda;
 * MANUAL_REVIEW — Apify 3 marta topa olmadi, admin qo'lda tekshiradi (reytingda emas);
 * REJECTED — rad etilgan, ishtirokchi boshqa link yubora oladi.
 */
export type ReelStatus = "PENDING" | "ACCEPTED" | "MANUAL_REVIEW" | "REJECTED";

/** Nega video qabul qilinmadi (Mini App va bot shu kod bo'yicha matn ko'rsatadi). */
export type ReelRejectReason =
  /** Instagram'da topilmadi: o'chirilgan, yopiq akkaunt yoki noto'g'ri link. */
  | "NOT_FOUND"
  /** Rasm yoki karusel — Reel emas. */
  | "NOT_A_VIDEO"
  /** Shu Instagram akkauntdan boshqa ishtirokchi video yuborgan (bitta akkaunt — bitta ishtirokchi). */
  | "OWNER_TAKEN";

/** Nakrutka shubhasi — admin ko'rib chiqishi uchun belgi; reytingga o'zi ta'sir qilmaydi. */
export type ReelFlagType =
  /** Ko'rishlarga nisbatan layklar juda kam. */
  | "LOW_ENGAGEMENT"
  /** Ko'rishlar bir kunda keskin (o'n barobardan ko'p) oshgan. */
  | "VIEW_SPIKE"
  /**
   * Ko'rishlar bir kunda sezilarli oshgan, layklar esa deyarli oshmagan — pullik reklamaga xos
   * (reklama begona auditoriyaga ko'rsatiladi, ular kam layk bosadi).
   */
  | "ENGAGEMENT_GAP"
  /** Ko'rishlar kamaygan — Instagram sun'iy ko'rishlarni tozalaganda shunday bo'ladi. */
  | "VIEW_DROP";

export interface ReelFlag {
  type: ReelFlagType;
  /** Tanlov kuni (Asia/Tashkent). */
  date: string;
  detail: string;
}

/** Kunlik holat. Faqat worker (StatsService) yozadi — qo'lda o'zgartiruvchi endpoint yo'q. */
export interface ReelSnapshot {
  /** Tanlov kuni "YYYY-MM-DD" (Asia/Tashkent); bir kunga bitta yozuv. */
  date: string;
  at: Date;
  views: number;
  likes: number | null;
  comments: number | null;
}

/**
 * Qo'lda tekshiruv: Apify videoni ketma-ket 3 marta topa olmaganda ochiladi.
 * NEW_REEL — yangi yuborilgan video hali qabul qilinmagan;
 * LOST_REEL — avval qabul qilingan video endi topilmayapti (reytingdan vaqtincha chiqadi).
 */
export interface ManualReview {
  kind: "NEW_REEL" | "LOST_REEL";
  requestedAt: Date;
  /** Qo'lda tekshiruvga o'tgunga qadar avtomatik urinishlar soni. */
  attempts: number;
  /** null — admin hali qaror qilmagan. `by: "Avtomatik"` — Apify keyinroq o'zi topdi. */
  decision: {
    approved: boolean;
    reason: ReelRejectReason | null;
    note: string;
    by: string;
    at: Date;
  } | null;
}

export interface Reel {
  url: string;
  shortcode: string;
  status: ReelStatus;
  submittedAt: Date;
  /** Instagram akkaunt nomi — birinchi tekshiruvda aniqlanadi. */
  owner: string | null;
  postedAt: Date | null;
  rejectReason: ReelRejectReason | null;
  /** Eskidan yangiga. */
  history: ReelSnapshot[];
  flags: ReelFlag[];
  /** Ketma-ket necha marta Instagram'da topilmadi. */
  misses: number;
  /** Apify videoni oxirgi marta topgan vaqt. */
  lastFoundAt: Date | null;
  /** Oxirgi qo'lda tekshiruv (bo'lmagan bo'lsa — null). */
  review: ManualReview | null;
}

export interface Participant {
  telegramId: number;
  /** Bot bilan shaxsiy chat — xabarnoma va support javoblari shu yerga. */
  chatId: number | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  consentVersion: number | null;
  reel: Reel | null;
  status: "ACTIVE" | "BLOCKED" | "DISQUALIFIED";
  createdAt: Date;
}

/** Sozlamalar ulanmagan bo'lsa (testlar) — minimal yosh. */
export const MIN_AGE = 18;

/**
 * Ishtirokchilar ombori.
 *
 * Xotirada ishlaydi va `StateStore` orqali diskka saqlanadi (server qayta ishga tushsa ham
 * yo'qolmaydi). Faza 1 da shu interfeys saqlangan holda Prisma + PostgreSQL ga ko'chiriladi.
 *
 * Qoidalar (CLAUDE.md): ism, familiya, yosh bir marta yoziladi — ularni yangilovchi
 * metod yo'q; bitta telefon raqami — bitta ishtirokchi.
 */
@Injectable()
export class ParticipantsService {
  private readonly byTelegramId = new Map<number, Participant>();

  constructor(
    private readonly rules: RulesService,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
    @Optional() @Inject(ContestSettingsService) private readonly contest: ContestSettingsService | null = null,
  ) {
    const saved = store?.attach("participants", () => ({ participants: this.all() }));
    for (const p of saved?.participants ?? []) this.byTelegramId.set(p.telegramId, p);
  }

  get(telegramId: number): Participant | null {
    return this.byTelegramId.get(telegramId) ?? null;
  }

  getOrCreate(telegramId: number): Participant {
    let p = this.byTelegramId.get(telegramId);
    if (!p) {
      p = {
        telegramId,
        chatId: null,
        phone: null,
        firstName: null,
        lastName: null,
        age: null,
        consentVersion: null,
        reel: null,
        status: "ACTIVE",
        createdAt: new Date(),
      };
      this.byTelegramId.set(telegramId, p);
    }
    return p;
  }

  all(): Participant[] {
    return [...this.byTelegramId.values()];
  }

  stage(p: Participant): ParticipantStage {
    if (p.status === "BLOCKED") return "BLOCKED";
    if (p.status === "DISQUALIFIED") return "DISQUALIFIED";
    if (!p.phone) return "NEEDS_CONTACT";
    if (!p.firstName) return "NEEDS_PROFILE";
    if (p.consentVersion !== this.rules.version) return "NEEDS_CONSENT";
    return "ACTIVE";
  }

  /**
   * Bot orqali ulashilgan raqamni saqlaydi. Raqam boshqa Telegram akkauntiga
   * bog'langan bo'lsa — rad etadi (bitta raqam — bitta ishtirokchi).
   */
  setPhone(telegramId: number, chatId: number, rawPhone: string): "OK" | "TAKEN" {
    const phone = normalizePhone(rawPhone);
    const owner = this.all().find((p) => p.phone === phone && p.telegramId !== telegramId);
    if (owner) return "TAKEN";
    const p = this.getOrCreate(telegramId);
    p.phone = phone;
    p.chatId = chatId;
    return "OK";
  }

  register(telegramId: number, firstName: string, lastName: string, age: number): void {
    const p = this.get(telegramId);
    if (!p?.phone) throw new ApiException(401, "UNAUTHORIZED");
    if (p.firstName) throw new ApiException(409, "PROFILE_LOCKED");
    if (age < (this.contest?.get().minAge ?? MIN_AGE)) throw new ApiException(422, "UNDER_AGE");
    p.firstName = firstName;
    p.lastName = lastName;
    p.age = age;
  }

  acceptRules(telegramId: number, version: number): void {
    const p = this.get(telegramId);
    // Eskirgan versiyaga rozilik qabul qilinmaydi (admin shu orada qoidalarni yangilagan bo'lishi mumkin).
    if (!p?.firstName) throw new ApiException(401, "UNAUTHORIZED");
    if (version !== this.rules.version) throw new ApiException(409, "RULES_OUTDATED");
    p.consentVersion = version;
  }

  /**
   * Reel linkini qabul qiladi (holat PENDING). Instagram'dagi tekshiruv (mavjudligi,
   * video ekanligi, egasi) va ko'rishlar — StatsService ishi.
   *
   * Rad etilgan video o'rniga yangisini yuborish mumkin; boshqa holatda — bitta video.
   */
  submitReel(telegramId: number, url: string, shortcode: string): Reel {
    const p = this.requireActive(telegramId);
    if (p.reel && p.reel.status !== "REJECTED") throw new ApiException(409, "REEL_ALREADY_SUBMITTED");
    const taken = this.all().some(
      (o) => o !== p && o.reel && o.reel.status !== "REJECTED" && o.reel.shortcode === shortcode,
    );
    if (taken) throw new ApiException(409, "REEL_TAKEN");
    p.reel = {
      url,
      shortcode,
      status: "PENDING",
      submittedAt: new Date(),
      owner: null,
      postedAt: null,
      rejectReason: null,
      history: [],
      flags: [],
      misses: 0,
      lastFoundAt: null,
      review: null,
    };
    return p.reel;
  }

  /**
   * Shu Instagram akkauntdan boshqa ishtirokchi video yuborganmi (rad etilganlar hisobga
   * olinmaydi). Bitta akkaunt — bitta ishtirokchi.
   */
  ownerTakenByOther(owner: string, telegramId: number): boolean {
    return this.all().some(
      (o) =>
        o.telegramId !== telegramId &&
        o.reel !== null &&
        o.reel.status !== "REJECTED" &&
        o.reel.owner === owner,
    );
  }

  /** Shortcode bo'yicha video va uning egasi (admin qo'lda tekshiruvi uchun). */
  findByShortcode(shortcode: string): { participant: Participant; reel: Reel } | null {
    for (const p of this.byTelegramId.values()) {
      if (p.reel?.shortcode === shortcode) return { participant: p, reel: p.reel };
    }
    return null;
  }

  /** Qoidabuzarlik (masalan, target) uchun tanlovdan chetlatish — faqat admin qaroridan keyin. */
  disqualify(telegramId: number): void {
    const p = this.get(telegramId);
    if (p) p.status = "DISQUALIFIED";
  }

  /**
   * Admin bloklashi: faqat faol ishtirokchi. Bloklangan ishtirokchi ilovadan foydalana olmaydi
   * va reytingdan chiqadi (video va ko'rishlari saqlanadi). Holat o'zgargan bo'lsa — true.
   */
  block(telegramId: number): boolean {
    const p = this.get(telegramId);
    if (!p || p.status !== "ACTIVE") return false;
    p.status = "BLOCKED";
    return true;
  }

  /** Blokdan chiqarish: faqat bloklangan → faol. Holat o'zgargan bo'lsa — true. */
  unblock(telegramId: number): boolean {
    const p = this.get(telegramId);
    if (!p || p.status !== "BLOCKED") return false;
    p.status = "ACTIVE";
    return true;
  }

  /** Ishtirokni bekor qilish (do'kon talabi: akkauntni o'chirish). */
  delete(telegramId: number): void {
    this.byTelegramId.delete(telegramId);
  }

  private requireActive(telegramId: number): Participant {
    const p = this.get(telegramId);
    if (!p || this.stage(p) !== "ACTIVE") throw new ApiException(403, "UNAUTHORIZED");
    return p;
  }
}

/** "998 90 123-45-67" / "+998901234567" → "+998901234567". */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `+${digits}`;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} *** ** ${d.slice(-2)}`;
}
