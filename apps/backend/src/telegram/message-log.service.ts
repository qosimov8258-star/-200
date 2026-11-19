import { HttpException, Inject, Injectable, Optional } from "@nestjs/common";

import { ParticipantsService, type Participant } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { TELEGRAM_MESSAGE_KINDS, type TelegramMessageKind } from "./notifier";

/**
 * SENT — yuborilmoqda (Telegram hali javob bermagan); DELIVERED — yetkazildi; READ — "✅ O'qidim"
 * bosilgan; UNREAD — yetkazilganiga 24 soatdan oshdi, o'qilmadi (saqlanmaydi, hisoblanadi);
 * FAILED — yuborilmadi. `apps/admin/src/lib/types.ts` → TelegramDeliveryStatus bilan bir xil.
 */
export type TelegramDeliveryStatus = "SENT" | "DELIVERED" | "READ" | "UNREAD" | "FAILED";

/** BOT_BLOCKED — ishtirokchi botni bloklagan (Telegram 403); NETWORK — boshqa (vaqtinchalik) xato. */
export type TelegramFailureReason = "BOT_BLOCKED" | "NETWORK";

type StoredStatus = Exclude<TelegramDeliveryStatus, "UNREAD">;

/** Jurnal yozuvi — bitta xabarnoma va uning yetkazilish tarixi. */
export interface LoggedMessage {
  id: string;
  kind: TelegramMessageKind;
  text: string;
  /** Shaxsiy chatda `chatId === telegramId`. */
  telegramId: number;
  chatId: number;
  firstSentAt: Date;
  lastSentAt: Date;
  attempts: number;
  status: StoredStatus;
  deliveredAt: Date | null;
  readAt: Date | null;
  failureReason: TelegramFailureReason | null;
}

/**
 * Botning jurnal uchun kerakli qismi (amalda — TelegramService, testlarda — soxta obyekt):
 * xabarni "✅ O'qidim" tugmasi bilan yuboradi, tugma `logId` yozuviga tegishli.
 * Yuborilmasa — xato tashlaydi (Telegram xatosi `error_code` bilan).
 */
export interface BotMessenger {
  send(chatId: number, text: string, logId: string): Promise<void>;
}

export interface MessageLogOptions {
  clock?: () => Date;
  /** Ommaviy qayta yuborishda xabarlar orasidagi pauza (Telegram limiti ~30 xabar/soniya). */
  resendIntervalMs?: number;
}

export const MESSAGE_LOG_OPTIONS = Symbol("MESSAGE_LOG_OPTIONS");

/** Yetkazilganiga shuncha vaqt bo'lib o'qilmasa — "o'qilmadi". */
export const UNREAD_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RESEND_INTERVAL_MS = 40;
/** Jurnal chegarasi — eng eskilari o'chadi (holat faylining cheksiz o'sishidan himoya). */
const MAX_MESSAGES = 50_000;
const STORED_STATUSES: readonly StoredStatus[] = ["SENT", "DELIVERED", "READ", "FAILED"];

/** `apps/admin/src/lib/types.ts` → TelegramMessageListItem bilan bir xil. */
export interface TelegramMessageListItem {
  id: string;
  kind: TelegramMessageKind;
  text: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    telegramUsername: string | null;
  };
  firstSentAt: string;
  lastSentAt: string;
  attempts: number;
  status: TelegramDeliveryStatus;
  deliveredAt: string | null;
  readAt: string | null;
  failureReason: TelegramFailureReason | null;
  canResend: boolean;
}

export interface TelegramMessageQuery {
  status?: TelegramDeliveryStatus;
  kind?: TelegramMessageKind;
  /** Ism, familiya, telefon (kamida 3 raqam) yoki @telegram bo'yicha. */
  search?: string;
}

export interface TelegramLogSummary {
  /** Profilini to'ldirgan ishtirokchilar. */
  totalParticipants: number;
  /** Ulardan bot bilan shaxsiy chati borlar. */
  linkedParticipants: number;
  /** Ulardan oxirgi xabari "bot bloklangan" bo'lib qaytganlar. */
  blockedBot: number;
}

export interface TelegramMessageList {
  /** Filtrlangan va saralangan (eng so'nggi yuborilgani birinchi); sahifalash — controller'da. */
  rows: TelegramMessageListItem[];
  statusCounts: Record<TelegramDeliveryStatus | "ALL", number>;
  summary: TelegramLogSummary;
}

export interface ResendOutcome {
  item: TelegramMessageListItem;
  before: TelegramDeliveryStatus;
  ok: boolean;
}

interface SavedLog {
  seq: number;
  messages: LoggedMessage[];
  usernames: [number, string][];
}

type Delivery = { ok: true } | { ok: false; error: unknown };

const fail = (status: number, message: string) => new HttpException({ message }, status);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const seqOf = (id: string): number => Number(id.slice(id.indexOf("_") + 1)) || 0;

/** Telegram 403 (bot bloklangan, akkaunt o'chirilgan) — BOT_BLOCKED; qolgani — NETWORK. */
export function failureReasonOf(err: unknown): TelegramFailureReason {
  const code = typeof err === "object" && err !== null && "error_code" in err ? err.error_code : null;
  return code === 403 ? "BOT_BLOCKED" : "NETWORK";
}

/**
 * Telegram xabarnomalari jurnali (TZ 6-bo'lim; admin panel → "Telegram"): har bir xabar, uning
 * holati (yuborildi → yetkazildi → o'qildi / o'qilmadi / yuborilmadi) va qayta yuborishlar.
 *
 * Bot API alohida "yetkazildi" tasdig'ini bermaydi — muvaffaqiyatli `sendMessage` yetkazilgan
 * hisoblanadi. O'qilganini ham bildirmaydi — shuning uchun har xabar ostida "✅ O'qidim" tugmasi
 * (PLAN.md Q11). Ishtirokchilarning @username lari ham shu yerda (bot yangilanishlaridan).
 *
 * `StateStore` orqali diskka saqlanadi; Faza 1 da `telegram_messages` jadvaliga ko'chadi.
 */
@Injectable()
export class MessageLogService {
  private seq = 0;
  private readonly messages: LoggedMessage[] = [];
  private readonly byId = new Map<string, LoggedMessage>();
  private readonly usernames = new Map<number, string>();
  private messenger: BotMessenger | null = null;
  private bulkRunning = false;
  private readonly now: () => Date;
  private readonly resendIntervalMs: number;

  constructor(
    private readonly participants: ParticipantsService,
    @Optional() @Inject(StateStore) store: StateStore | null = null,
    @Optional() @Inject(MESSAGE_LOG_OPTIONS) options: MessageLogOptions | null = null,
  ) {
    this.now = options?.clock ?? (() => new Date());
    this.resendIntervalMs = options?.resendIntervalMs ?? DEFAULT_RESEND_INTERVAL_MS;
    const saved = store?.attach<SavedLog>("telegramLog", () => ({
      seq: this.seq,
      messages: this.messages,
      usernames: [...this.usernames],
    }));
    if (saved) this.restore(saved);
  }

  /** Bot ishga tushganda TelegramService ulaydi; `null` — bot yo'q (xabarlar FAILED bo'ladi). */
  setMessenger(messenger: BotMessenger | null): void {
    this.messenger = messenger;
  }

  /** Xabarni jurnalga yozadi va yuboradi. Yuborilmasa — FAILED va xato chaqiruvchiga qaytadi. */
  async send(chatId: number, text: string, kind: TelegramMessageKind = "OTHER"): Promise<void> {
    const at = this.now();
    this.seq += 1;
    const entry: LoggedMessage = {
      id: `tgm_${this.seq}`,
      kind,
      text,
      telegramId: chatId,
      chatId,
      firstSentAt: at,
      lastSentAt: at,
      attempts: 1,
      status: "SENT",
      deliveredAt: null,
      readAt: null,
      failureReason: null,
    };
    this.add(entry);
    const result = await this.deliver(entry);
    if (!result.ok) throw result.error;
  }

  /**
   * "✅ O'qidim" bosildi. Faqat xabar egasi belgilay oladi; topilmasa — false.
   * Yuborilmadi deb turgan xabar bosilsa ham (oldingi nusxasi yetgan) — o'qilgan.
   */
  markRead(id: string, telegramId: number): boolean {
    const entry = this.byId.get(id);
    if (!entry || entry.telegramId !== telegramId) return false;
    if (entry.status !== "READ") {
      const at = this.now();
      entry.status = "READ";
      entry.readAt = at;
      entry.deliveredAt ??= at;
      entry.failureReason = null;
    }
    return true;
  }

  /** Bot yangilanishidagi `from.username` (bo'lmasa — o'chiriladi). */
  noteUsername(telegramId: number, username: string | null): void {
    if (username) {
      if (this.usernames.get(telegramId) !== username) this.usernames.set(telegramId, username);
    } else {
      this.usernames.delete(telegramId);
    }
  }

  usernameOf(telegramId: number): string | null {
    return this.usernames.get(telegramId) ?? null;
  }

  get(id: string): LoggedMessage | null {
    return this.byId.get(id) ?? null;
  }

  /** Holat (UNREAD shu yerda hisoblanadi). */
  statusOf(entry: LoggedMessage, now = this.now().getTime()): TelegramDeliveryStatus {
    if (
      entry.status === "DELIVERED" &&
      entry.readAt === null &&
      entry.deliveredAt !== null &&
      now - entry.deliveredAt.getTime() > UNREAD_AFTER_MS
    ) {
      return "UNREAD";
    }
    return entry.status;
  }

  /** Filtr bo'yicha xabarlar, holatlar soni (holat filtrisiz) va umumiy ko'rsatkichlar. */
  list(query: TelegramMessageQuery): TelegramMessageList {
    const now = this.now().getTime();
    const needle = normalize(query.search);
    const matched = this.messages
      .filter((m) => !query.kind || m.kind === query.kind)
      .map((m) => this.toItem(m, now))
      .filter((item) => matchesPerson(item.participant, needle));

    const statusCounts: TelegramMessageList["statusCounts"] = {
      ALL: matched.length,
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      UNREAD: 0,
      FAILED: 0,
    };
    for (const item of matched) statusCounts[item.status] += 1;

    const rows = matched
      .filter((item) => !query.status || item.status === query.status)
      .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt) || seqOf(b.id) - seqOf(a.id));
    return { rows, statusCounts, summary: this.summary() };
  }

  /** Bitta xabarni qayta yuborish (o'qilmagan yoki vaqtinchalik xato bo'lgan). */
  async resend(id: string): Promise<ResendOutcome> {
    const entry = this.byId.get(id);
    if (!entry) throw fail(404, "Xabar topilmadi.");
    const before = this.statusOf(entry);
    if (!canResend(before, entry.failureReason)) {
      throw fail(
        409,
        entry.failureReason === "BOT_BLOCKED"
          ? "Ishtirokchi botni bloklagan — qayta yuborib bo'lmaydi."
          : "Bu xabarni qayta yuborish shart emas.",
      );
    }
    if (!this.messenger) throw fail(503, "Telegram bot ishga tushmagan — qayta yuborib bo'lmaydi.");
    const result = await this.redeliver(entry);
    return { item: this.toItem(entry, this.now().getTime()), before, ok: result.ok };
  }

  /**
   * Filtr (tur, qidiruv) bo'yicha barcha o'qilmaganlarni ketma-ket qayta yuboradi, orada
   * ~40 ms pauza (Telegram limiti). Bir vaqtda bitta ommaviy yuborish.
   */
  async resendUnread(filter: Omit<TelegramMessageQuery, "status">): Promise<{ resent: number; failed: number }> {
    if (this.bulkRunning) throw fail(409, "Qayta yuborish allaqachon ketmoqda. Tugashini kuting.");
    if (!this.messenger) throw fail(503, "Telegram bot ishga tushmagan — qayta yuborib bo'lmaydi.");
    const queue = this.list({ ...filter, status: "UNREAD" })
      .rows.map((item) => this.byId.get(item.id))
      .filter((entry): entry is LoggedMessage => entry !== undefined)
      // Eng eskisi birinchi.
      .reverse();

    this.bulkRunning = true;
    let resent = 0;
    let failed = 0;
    try {
      for (const [i, entry] of queue.entries()) {
        if (i > 0 && this.resendIntervalMs > 0) await sleep(this.resendIntervalMs);
        // Navbat kutayotganda holat o'zgargan bo'lishi mumkin (masalan, "O'qidim" bosildi).
        if (this.statusOf(entry) !== "UNREAD") continue;
        const result = await this.redeliver(entry);
        if (result.ok) resent += 1;
        else failed += 1;
      }
    } finally {
      this.bulkRunning = false;
    }
    return { resent, failed };
  }

  toItem(entry: LoggedMessage, now = this.now().getTime()): TelegramMessageListItem {
    const p: Participant | null = this.participants.get(entry.telegramId);
    const status = this.statusOf(entry, now);
    return {
      id: entry.id,
      kind: entry.kind,
      text: entry.text,
      participant: {
        id: String(entry.telegramId),
        firstName: p?.firstName ?? "",
        lastName: p?.lastName ?? "",
        phone: p?.phone ?? "",
        telegramUsername: this.usernameOf(entry.telegramId),
      },
      firstSentAt: entry.firstSentAt.toISOString(),
      lastSentAt: entry.lastSentAt.toISOString(),
      attempts: entry.attempts,
      status,
      deliveredAt: entry.deliveredAt?.toISOString() ?? null,
      readAt: entry.readAt?.toISOString() ?? null,
      failureReason: status === "FAILED" ? entry.failureReason : null,
      canResend: canResend(status, entry.failureReason),
    };
  }

  // -------------------------------------------------------------------------

  private summary(): TelegramLogSummary {
    const last = new Map<number, LoggedMessage>();
    for (const m of this.messages) {
      const previous = last.get(m.telegramId);
      if (!previous || m.lastSentAt.getTime() >= previous.lastSentAt.getTime()) last.set(m.telegramId, m);
    }
    const profiles = this.participants.all().filter((p) => p.firstName);
    return {
      totalParticipants: profiles.length,
      linkedParticipants: profiles.filter((p) => p.chatId !== null).length,
      blockedBot: profiles.filter((p) => {
        const m = last.get(p.telegramId);
        return m?.status === "FAILED" && m.failureReason === "BOT_BLOCKED";
      }).length,
    };
  }

  private async redeliver(entry: LoggedMessage): Promise<Delivery> {
    entry.attempts += 1;
    entry.lastSentAt = this.now();
    entry.status = "SENT";
    entry.deliveredAt = null;
    entry.failureReason = null;
    return this.deliver(entry);
  }

  private async deliver(entry: LoggedMessage): Promise<Delivery> {
    const messenger = this.messenger;
    if (!messenger) {
      entry.status = "FAILED";
      entry.failureReason = "NETWORK";
      return { ok: false, error: new Error("Telegram bot ishga tushmagan") };
    }
    try {
      await messenger.send(entry.chatId, entry.text, entry.id);
      // Javob kelguncha "O'qidim" bosilgan bo'lishi mumkin — READ ni bosib ketmaymiz.
      if (entry.status === "SENT") entry.status = "DELIVERED";
      entry.deliveredAt ??= this.now();
      entry.failureReason = null;
      return { ok: true };
    } catch (error) {
      entry.status = "FAILED";
      entry.failureReason = failureReasonOf(error);
      return { ok: false, error };
    }
  }

  private add(entry: LoggedMessage): void {
    this.messages.push(entry);
    this.byId.set(entry.id, entry);
    const excess = this.messages.length - MAX_MESSAGES;
    if (excess > 0) {
      for (const old of this.messages.splice(0, excess)) this.byId.delete(old.id);
    }
  }

  /** Saqlangan jurnal. Yarim yo'lda qolgan (SENT) xabar — server yuborish paytida to'xtagan: FAILED. */
  private restore(saved: Partial<SavedLog>): void {
    for (const raw of saved.messages ?? []) {
      const entry = restoreEntry(raw);
      if (!entry || this.byId.has(entry.id)) continue;
      this.messages.push(entry);
      this.byId.set(entry.id, entry);
    }
    for (const [telegramId, username] of saved.usernames ?? []) this.usernames.set(telegramId, username);
    const maxSeq = this.messages.reduce((max, m) => Math.max(max, seqOf(m.id)), 0);
    this.seq = Math.max(typeof saved.seq === "number" ? saved.seq : 0, maxSeq);
  }
}

function canResend(status: TelegramDeliveryStatus, reason: TelegramFailureReason | null): boolean {
  return status === "UNREAD" || (status === "FAILED" && reason === "NETWORK");
}

function restoreEntry(raw: Partial<LoggedMessage>): LoggedMessage | null {
  if (typeof raw.id !== "string" || typeof raw.chatId !== "number" || !(raw.firstSentAt instanceof Date)) return null;
  const kind = TELEGRAM_MESSAGE_KINDS.find((k) => k === raw.kind) ?? "OTHER";
  const stored = STORED_STATUSES.find((s) => s === raw.status) ?? "FAILED";
  const interrupted = stored === "SENT";
  const reason = raw.failureReason === "BOT_BLOCKED" || raw.failureReason === "NETWORK" ? raw.failureReason : null;
  return {
    id: raw.id,
    kind,
    text: typeof raw.text === "string" ? raw.text : "",
    telegramId: typeof raw.telegramId === "number" ? raw.telegramId : raw.chatId,
    chatId: raw.chatId,
    firstSentAt: raw.firstSentAt,
    lastSentAt: raw.lastSentAt instanceof Date ? raw.lastSentAt : raw.firstSentAt,
    attempts: typeof raw.attempts === "number" && raw.attempts >= 1 ? raw.attempts : 1,
    status: interrupted ? "FAILED" : stored,
    deliveredAt: raw.deliveredAt instanceof Date ? raw.deliveredAt : null,
    readAt: raw.readAt instanceof Date ? raw.readAt : null,
    failureReason: interrupted ? "NETWORK" : stored === "FAILED" ? (reason ?? "NETWORK") : null,
  };
}

/** Qidiruv: kichik harf, apostrof variantlari bir xil (o', oʻ, o`), 100 belgigacha. */
function normalize(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[ʻʼ‘’`]/g, "'")
    .trim()
    .slice(0, 100);
}

/** Ism-familiya (ikki tartibda), @telegram yoki telefon (kamida 3 raqam) bo'yicha. */
function matchesPerson(
  person: { firstName: string; lastName: string; phone: string; telegramUsername: string | null },
  needle: string,
): boolean {
  if (!needle) return true;
  const names = normalize(`${person.firstName} ${person.lastName} ${person.lastName} ${person.firstName}`);
  if (names.includes(needle)) return true;
  const username = needle.replace(/^@/, "");
  if (username && person.telegramUsername?.toLowerCase().includes(username)) return true;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && person.phone.replace(/\D/g, "").includes(digits);
}
