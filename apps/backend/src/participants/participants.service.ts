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
 * PENDING — avtomatik tekshiruv kutilmoqda; ACCEPTED — reytingda (eng ko'p ko'rilgani hisoblanadi);
 * MANUAL_REVIEW — Apify 3 marta topa olmadi, admin qo'lda tekshiradi (reytingda hisoblanmaydi);
 * REJECTED — rad etilgan (shu linkni qayta yuborish mumkin).
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
  /**
   * Yuborilgan videolar — eskidan yangiga (yuborilish tartibida). Soni cheklanmagan; har biri
   * alohida tekshiriladi va yig'iladi. Reytingda — qabul qilinganlar (ACCEPTED) ichida eng ko'p
   * ko'rilgan bitta videosi (ko'rishlar qo'shilmaydi; `participantViews`).
   */
  reels: Reel[];
  status: "ACTIVE" | "BLOCKED" | "DISQUALIFIED";
  createdAt: Date;
}

/** `ownerUpdate` uchun o'zgarishlar (faqat berilganlari yoziladi). */
export interface OwnerParticipantPatch {
  firstName?: string;
  lastName?: string;
  age?: number;
  /** Istalgan ko'rinishda — "+998901234567" ga normallashtiriladi. */
  phone?: string;
  status?: Participant["status"];
}

/** `ownerUpdate` rad etish sababi. */
export type OwnerUpdateError = "NOT_FOUND" | "PHONE_TAKEN" | "PROFILE_INCOMPLETE";

/**
 * Diskdagi ko'rinish: ilgari ishtirokchida bitta `reel` bo'lgan, endi — `reels` (cheksiz).
 * Holat faylini o'qishda `migrateParticipant` bilan yangi ko'rinishga o'tkaziladi.
 */
export type StoredParticipant = Omit<Participant, "reels"> & { reels?: Reel[]; reel?: Reel | null };

/** Sozlamalar ulanmagan bo'lsa (testlar) — minimal yosh. */
export const MIN_AGE = 18;

/** Eski `reel` → `reels` (bitta video bo'lsa — bitta elementli ro'yxat); `reel` maydoni tashlanadi. */
export function migrateParticipant(saved: StoredParticipant): Participant {
  const { reel, reels, ...rest } = saved;
  return { ...rest, reels: reels ?? (reel ? [reel] : []) };
}

/** Rad etilmagan video: tekshiruvda, reytingda yoki qo'lda tekshiruvda. Shu holatda link band. */
export const isLiveReel = (reel: Reel): boolean => reel.status !== "REJECTED";

/** Rad etilmagan videolar (yuborilish tartibida). */
export const liveReels = (p: Participant): Reel[] => p.reels.filter(isLiveReel);

/** Reytingga kiradigan (ACCEPTED) videolar (yuborilish tartibida). */
export const acceptedReels = (p: Participant): Reel[] => p.reels.filter((r) => r.status === "ACCEPTED");

/** Videoning oxirgi yig'ilgan ko'rishlari (hali yig'ilmagan bo'lsa — 0). */
export const reelViews = (reel: Reel): number => reel.history.at(-1)?.views ?? 0;

/** Reytingda hisoblanadigan video: qabul qilinganlar ichida eng ko'p ko'rilgani (bo'lmasa — null). */
export const bestReel = (p: Participant): Reel | null => topReel(acceptedReels(p));

/**
 * Ishtirokchi ko'rishlari (reyting, asosiy sovrinlar, g'olib — qoidalar 7.1, 7.3): eng ko'p ko'rilgan
 * bitta qabul qilingan videosining oxirgi ko'rishlari. Videolar ko'rishlari qo'shilmaydi; qabul
 * qilingan video yo'q — 0.
 */
export function participantViews(p: Participant): number {
  const best = bestReel(p);
  return best ? reelViews(best) : 0;
}

/** Ro'yxatdagi guruh: 0 — qabul qilingan, 1 — qaror kutilmoqda (PENDING, MANUAL_REVIEW), 2 — rad etilgan. */
const displayGroup = (reel: Reel): number => (reel.status === "ACCEPTED" ? 0 : reel.status === "REJECTED" ? 2 : 1);

/**
 * Ishtirokchi videolari ko'rsatiladigan tartib (Mini App "Video" bo'limi, admin → ishtirokchi videolari):
 * avval qabul qilinganlar — ko'rishlar kamayishi bo'yicha (teng bo'lsa — oldinroq yuborilgani), ya'ni
 * birinchisi reytingda hisoblanadigan video (`bestReel`); keyin qaror kutilayotganlar, oxirida rad
 * etilganlar — ikkalasida yangisi birinchi.
 */
export function reelsForDisplay(reels: readonly Reel[]): Reel[] {
  // Bir xil vaqtda yuborilganlar uchun — yuborilish tartibi (`reels` eskidan yangiga).
  const order = new Map(reels.map((r, i) => [r, i]));
  const older = (a: Reel, b: Reel) =>
    a.submittedAt.getTime() - b.submittedAt.getTime() || (order.get(a) ?? 0) - (order.get(b) ?? 0);
  return [...reels].sort((a, b) => {
    const group = displayGroup(a) - displayGroup(b);
    if (group !== 0) return group;
    return a.status === "ACCEPTED" ? reelViews(b) - reelViews(a) || older(a, b) : older(b, a);
  });
}

/** Rad etilmagan videolar egalari (Instagram akkauntlari), takrorlarsiz, birinchi uchragan tartibda. */
export function instagramUsernames(p: Participant): string[] {
  const owners = liveReels(p).flatMap((r) => (r.owner ? [r.owner] : []));
  return [...new Set(owners)];
}

/**
 * "Asosiy" video — ko'rishlari eng ko'pi (teng bo'lsa — oldinroq yuborilgani). Ishtirokchining
 * natijasi shu videoning ko'rishlari (reyting, g'olib, random tanlov nomzodi, kunlik reyting).
 * `views` — qaysi kundagi ko'rishlar (standart — oxirgi). Bo'sh ro'yxat — null.
 */
export function topReel(reels: readonly Reel[], views: (reel: Reel) => number = reelViews): Reel | null {
  let best: Reel | null = null;
  for (const reel of reels) {
    if (best === null) {
      best = reel;
      continue;
    }
    const diff = views(reel) - views(best);
    if (diff > 0 || (diff === 0 && reel.submittedAt < best.submittedAt)) best = reel;
  }
  return best;
}

/**
 * Ishtirokchilar ombori.
 *
 * Xotirada ishlaydi va `StateStore` orqali diskka saqlanadi (server qayta ishga tushsa ham
 * yo'qolmaydi). Faza 1 da shu interfeys saqlangan holda Prisma + PostgreSQL ga ko'chiriladi.
 *
 * Qoidalar (CLAUDE.md): ism, familiya, yosh bir marta yoziladi — ularni yangilovchi
 * metod yo'q; bitta telefon raqami — bitta ishtirokchi. Yagona istisno — `ownerUpdate`:
 * uni FAQAT tashkilot egalari bo'limi chaqiradi (`src/owner/` va ega nomidan ishlaydigan
 * `TargetsService.ownerSetStatus`) — egalar qarori.
 */
@Injectable()
export class ParticipantsService {
  private readonly byTelegramId = new Map<number, Participant>();

  constructor(
    private readonly rules: RulesService,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
    @Optional() @Inject(ContestSettingsService) private readonly contest: ContestSettingsService | null = null,
  ) {
    const saved = store?.attach<{ participants: StoredParticipant[] }>("participants", () => ({
      participants: this.all(),
    }));
    for (const stored of saved?.participants ?? []) {
      const p = migrateParticipant(stored);
      this.byTelegramId.set(p.telegramId, p);
    }
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
        reels: [],
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
   * Reel linkini qabul qiladi (holat PENDING) va ishtirokchi ro'yxati oxiriga qo'shadi. Instagram'dagi
   * tekshiruv (mavjudligi, video ekanligi, egasi) va ko'rishlar — StatsService ishi.
   *
   * Videolar soni cheklanmagan. Rad etilmagan (band) link qayta yuborilmaydi: o'zida bo'lsa —
   * `REEL_ALREADY_SUBMITTED`, boshqa ishtirokchida bo'lsa — `REEL_TAKEN`. O'zining rad etilgan
   * videosini qayta yuborsa — eski yozuv o'chiriladi, yangisi oxiriga qo'shiladi.
   */
  submitReel(telegramId: number, url: string, shortcode: string): Reel {
    const p = this.requireActive(telegramId);
    const own = p.reels.find((r) => r.shortcode === shortcode);
    if (own && isLiveReel(own)) throw new ApiException(409, "REEL_ALREADY_SUBMITTED");
    const taken = this.all().some(
      (o) => o !== p && o.reels.some((r) => isLiveReel(r) && r.shortcode === shortcode),
    );
    if (taken) throw new ApiException(409, "REEL_TAKEN");
    const reel: Reel = {
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
    if (own) p.reels = p.reels.filter((r) => r !== own);
    p.reels.push(reel);
    return reel;
  }

  /**
   * Shu Instagram akkauntdan boshqa ishtirokchi video yuborganmi (rad etilganlar hisobga
   * olinmaydi). Bitta akkaunt — bitta ishtirokchi; o'zining boshqa videolari to'sqinlik qilmaydi.
   */
  ownerTakenByOther(owner: string, telegramId: number): boolean {
    return this.all().some(
      (o) => o.telegramId !== telegramId && o.reels.some((r) => isLiveReel(r) && r.owner === owner),
    );
  }

  /**
   * Shortcode bo'yicha video va uning egasi (admin qo'lda tekshiruvi uchun). Rad etilmagan (band)
   * video ustun — u bitta bo'ladi; bo'lmasa — eng oxirgi yuborilgan rad etilgani.
   */
  findByShortcode(shortcode: string): { participant: Participant; reel: Reel } | null {
    let rejected: { participant: Participant; reel: Reel } | null = null;
    for (const p of this.byTelegramId.values()) {
      for (const reel of p.reels) {
        if (reel.shortcode !== shortcode) continue;
        if (isLiveReel(reel)) return { participant: p, reel };
        if (rejected === null || reel.submittedAt > rejected.reel.submittedAt) rejected = { participant: p, reel };
      }
    }
    return rejected;
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

  /**
   * FAQAT TASHKILOT EGALARI BO'LIMI CHAQIRADI — `src/owner/` va ega nomidan ishlaydigan
   * `TargetsService.ownerSetStatus` (chetlatishni bekor qilish). Boshqa joyda ishlatilmaydi.
   *
   * CLAUDE.md dagi "ism, familiya va yoshni o'zgartirib bo'lmaydi" qoidasidan yagona istisno
   * (egalar qarori): ega ism, familiya, yosh, telefon va holatni (istalgan tomonga, chetlatishni
   * bekor qilish ham) o'zgartira oladi. Qiymatlar chaqiruvchida tekshirilgan bo'ladi; bu yerda
   * faqat ombor qoidalari: bitta telefon — bitta ishtirokchi, ism bilan birga familiya va yosh.
   * Hammasi tekshirilgach birdaniga yoziladi (yarim o'zgarish qolmaydi). Ko'rishlar va video
   * bu metod orqali o'zgarmaydi.
   */
  ownerUpdate(telegramId: number, patch: OwnerParticipantPatch): Participant | OwnerUpdateError {
    const p = this.get(telegramId);
    if (!p) return "NOT_FOUND";
    const phone = patch.phone === undefined ? undefined : normalizePhone(patch.phone);
    if (phone !== undefined && this.all().some((o) => o.telegramId !== telegramId && o.phone === phone)) {
      return "PHONE_TAKEN";
    }
    const firstName = patch.firstName ?? p.firstName;
    const lastName = patch.lastName ?? p.lastName;
    const age = patch.age ?? p.age;
    // Ro'yxatdan o'tmagan ishtirokchiga faqat ism yozilsa — u o'zi ro'yxatdan o'ta olmay qoladi.
    if (firstName !== null && (lastName === null || age === null)) return "PROFILE_INCOMPLETE";

    p.firstName = firstName;
    p.lastName = lastName;
    p.age = age;
    if (phone !== undefined) p.phone = phone;
    if (patch.status !== undefined) p.status = patch.status;
    return p;
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
