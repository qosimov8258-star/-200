import { HttpException, Inject, Injectable, Optional } from "@nestjs/common";

import { instagramUsernames, type Participant } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";

export type TicketStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

export const TICKET_STATUSES: readonly TicketStatus[] = ["NEW", "IN_PROGRESS", "CLOSED"];

/** Admin panel filtri: "OPEN" — yangi va ko'rilmoqda birga. */
export type SupportStatusFilter = TicketStatus | "OPEN";

export const SUPPORT_STATUS_FILTERS: readonly SupportStatusFilter[] = [...TICKET_STATUSES, "OPEN"];

export interface SupportMessage {
  from: "PARTICIPANT" | "OPERATOR";
  text: string;
  /** Telegram fayl ID si (skrinshot); matnli xabarda null. */
  photoFileId: string | null;
  /** Skrinshot hajmi, bayt (Telegram bergan bo'lsa); eski yozuvlarda yo'q. */
  photoSize?: number;
  /**
   * Javob yozgan xodim (admin panel orqali). Guruhdan "Reply" qilingan va eski javoblarda
   * yo'q — panelda "Operator" deb ko'rsatiladi.
   */
  by?: string;
  createdAt: Date;
}

export interface SupportTicket {
  id: number;
  telegramId: number;
  status: TicketStatus;
  messages: SupportMessage[];
  updatedAt: Date;
}

// --- Admin panel ko'rinishi (`apps/admin/src/lib/types.ts` → "Support" bo'limi) ---------

export type SupportMessageAuthor = "PARTICIPANT" | "STAFF";

export interface SupportTicketParticipant {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface SupportTicketListItem {
  id: string;
  subject: string;
  status: TicketStatus;
  participant: SupportTicketParticipant;
  lastMessage: { text: string; author: SupportMessageAuthor; at: string };
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  awaitingReply: boolean;
}

export interface SupportAttachment {
  id: string;
  fileName: string;
  sizeBytes: number;
  url: string | null;
}

export interface SupportMessageView {
  id: string;
  author: SupportMessageAuthor;
  authorName: string;
  text: string;
  at: string;
  attachments: SupportAttachment[];
}

export interface SupportTicketDetail {
  id: string;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  participant: SupportTicketParticipant & {
    instagramUsername: string | null;
    status: Participant["status"];
  };
  messages: SupportMessageView[];
}

export interface SupportTicketQuery {
  status?: SupportStatusFilter;
  /** Mavzu, ishtirokchi ismi, telefon (kamida 3 raqam) yoki murojaat raqami bo'yicha. */
  search?: string;
}

export interface SupportTicketList {
  /** Filtrlangan, eng so'nggi faollik birinchi; sahifalash — controller'da. */
  rows: SupportTicketListItem[];
  statusCounts: Record<SupportStatusFilter | "ALL", number>;
}

/** Ishtirokchini topish (amalda — `ParticipantsService.get`). */
export type ParticipantLookup = (telegramId: number) => Participant | null;

/** Mavzu — birinchi xabardan shuncha belgi. */
const SUBJECT_LENGTH = 60;
const PHOTO_LABEL = "Rasm";
const GROUP_OPERATOR = "Operator";
const ATTACHMENT_ID = /^m(\d{1,6})$/;

const fail = (status: number, message: string) => new HttpException({ message }, status);

interface SavedSupport {
  seq: number;
  tickets: SupportTicket[];
  groupMessageOwner: [number, number][];
}

/**
 * Support murojaatlari. Ishtirokchi botga (yoki ilova/saytdan) yozadi → murojaat ochiladi yoki
 * davom etadi; operator javobi — guruhdan "Reply" yoki admin panel orqali — bot orqali
 * ishtirokchiga boradi.
 *
 * `StateStore` orqali diskka saqlanadi; Faza 1 da `support_tickets` / `support_messages`
 * jadvallariga ko'chadi. Admin panelning Support bo'limi shu ma'lumotni o'qiydi.
 */
@Injectable()
export class SupportService {
  private seq = 1;
  private readonly tickets = new Map<number, SupportTicket>();
  /** Support guruhidagi xabar ID → ishtirokchi (operator "reply" qilganda kerak). */
  private readonly groupMessageOwner = new Map<number, number>();

  constructor(@Optional() @Inject(StateStore) store: StateStore | null = null) {
    const saved = store?.attach<SavedSupport>("support", () => ({
      seq: this.seq,
      tickets: [...this.tickets.values()],
      groupMessageOwner: [...this.groupMessageOwner],
    }));
    if (saved) this.restore(saved);
  }

  /** Ishtirokchining ochiq murojaatiga qo'shadi yoki yangisini ochadi. */
  addParticipantMessage(
    telegramId: number,
    text: string,
    photoFileId: string | null,
    photoSize?: number,
  ): SupportTicket {
    let ticket = this.openTicketOf(telegramId);
    if (!ticket) {
      ticket = { id: this.seq++, telegramId, status: "NEW", messages: [], updatedAt: new Date() };
      this.tickets.set(ticket.id, ticket);
    }
    const message: SupportMessage = { from: "PARTICIPANT", text, photoFileId, createdAt: new Date() };
    if (photoFileId && photoSize !== undefined) message.photoSize = photoSize;
    ticket.messages.push(message);
    ticket.updatedAt = new Date();
    return ticket;
  }

  /** Guruhdan "Reply" qilingan operator javobi (ishtirokchiga allaqachon yuborilgan). */
  addOperatorReply(telegramId: number, text: string): SupportTicket | null {
    const ticket = this.openTicketOf(telegramId);
    if (!ticket) return null;
    ticket.messages.push({ from: "OPERATOR", text, photoFileId: null, createdAt: new Date() });
    ticket.status = "IN_PROGRESS";
    ticket.updatedAt = new Date();
    return ticket;
  }

  rememberGroupMessage(groupMessageId: number, telegramId: number): void {
    this.groupMessageOwner.set(groupMessageId, telegramId);
  }

  ownerOfGroupMessage(groupMessageId: number): number | null {
    return this.groupMessageOwner.get(groupMessageId) ?? null;
  }

  /** Ishtirokchining barcha murojaatlaridagi xabarlar, eskisidan yangisiga (oxirgi `limit` tasi). */
  thread(telegramId: number, limit = 100): SupportMessage[] {
    return [...this.tickets.values()]
      .filter((t) => t.telegramId === telegramId)
      .flatMap((t) => t.messages)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit);
  }

  /** So'nggi `windowMs` ichida ishtirokchi nechta xabar yozgan (spamdan himoya). */
  recentParticipantMessages(telegramId: number, windowMs: number, now = new Date()): number {
    const since = now.getTime() - windowMs;
    return this.thread(telegramId, Number.MAX_SAFE_INTEGER).filter(
      (m) => m.from === "PARTICIPANT" && m.createdAt.getTime() >= since,
    ).length;
  }

  list(): SupportTicket[] {
    return [...this.tickets.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /** Murojaat (`id` — raqam yoki URL dagi matn); topilmasa — null. */
  get(id: number | string): SupportTicket | null {
    const n = typeof id === "number" ? id : /^\d{1,9}$/.test(id) ? Number(id) : Number.NaN;
    return this.tickets.get(n) ?? null;
  }

  /** Mavzu: birinchi ishtirokchi xabaridan ≈60 belgi; faqat rasm bo'lsa — "Rasm". */
  subjectOf(ticket: SupportTicket): string {
    const first = ticket.messages.find((m) => m.from === "PARTICIPANT");
    if (!first) return `Murojaat #${ticket.id}`;
    const text = first.text.replace(/\s+/g, " ").trim();
    if (!text) return first.photoFileId ? PHOTO_LABEL : `Murojaat #${ticket.id}`;
    return text.length > SUBJECT_LENGTH ? `${text.slice(0, SUBJECT_LENGTH - 1).trimEnd()}…` : text;
  }

  // --- Admin panel --------------------------------------------------------------

  adminList(query: SupportTicketQuery, people: ParticipantLookup): SupportTicketList {
    const needle = normalize(query.search);
    const matched = [...this.tickets.values()]
      .map((t) => this.toListItem(t, people(t.telegramId)))
      .filter((item) => matches(item, needle));

    const statusCounts: SupportTicketList["statusCounts"] = {
      ALL: matched.length,
      OPEN: matched.filter((i) => i.status !== "CLOSED").length,
      NEW: matched.filter((i) => i.status === "NEW").length,
      IN_PROGRESS: matched.filter((i) => i.status === "IN_PROGRESS").length,
      CLOSED: matched.filter((i) => i.status === "CLOSED").length,
    };
    const rows = matched
      .filter((i) => statusMatches(i.status, query.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || Number(b.id) - Number(a.id));
    return { rows, statusCounts };
  }

  adminDetail(id: number | string, people: ParticipantLookup): SupportTicketDetail {
    const ticket = this.require(id);
    const p = people(ticket.telegramId);
    const participantName = p ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : "";
    return {
      id: String(ticket.id),
      subject: this.subjectOf(ticket),
      status: ticket.status,
      createdAt: createdAtOf(ticket).toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      participant: {
        ...personOf(ticket.telegramId, p),
        instagramUsername: p ? (instagramUsernames(p)[0] ?? null) : null,
        status: p?.status ?? "ACTIVE",
      },
      messages: ticket.messages.map((m, i) => ({
        id: `${ticket.id}-${i + 1}`,
        author: authorOf(m),
        authorName: m.from === "PARTICIPANT" ? participantName || "Ishtirokchi" : (m.by ?? GROUP_OPERATOR),
        text: m.text,
        at: m.createdAt.toISOString(),
        attachments: m.photoFileId
          ? [
              {
                id: `m${i + 1}`,
                fileName: `rasm-${ticket.id}-${i + 1}.jpg`,
                sizeBytes: m.photoSize ?? 0,
                url: `/api/v1/admin/support/tickets/${ticket.id}/attachments/m${i + 1}`,
              },
            ]
          : [],
      })),
    };
  }

  /**
   * Xodim javobi (admin panel). Avval `deliver` — bot orqali ishtirokchiga yuborish; u xato
   * tashlasa, javob saqlanmaydi. Yetkazilgach murojaat "Ko'rilmoqda" holatiga o'tadi.
   */
  async replyAsStaff(
    id: number | string,
    text: string,
    by: string,
    deliver: (ticket: SupportTicket) => Promise<void>,
  ): Promise<{ ticket: SupportTicket; before: TicketStatus }> {
    const ticket = this.require(id);
    if (ticket.status === "CLOSED") {
      throw fail(409, "Murojaat yopilgan. Javob yozish uchun avval holatini o'zgartiring.");
    }
    const before = ticket.status;
    await deliver(ticket);
    const at = new Date();
    ticket.messages.push({ from: "OPERATOR", text, photoFileId: null, by, createdAt: at });
    ticket.status = "IN_PROGRESS";
    ticket.updatedAt = at;
    return { ticket, before };
  }

  /**
   * Holatni o'zgartirish. Yopilgan murojaatni qayta ochib bo'lmaydi, agar ishtirokchining boshqa
   * ochiq murojaati bo'lsa (yangi xabarlari o'sha yerga tushadi).
   */
  setStatus(id: number | string, status: TicketStatus): { ticket: SupportTicket; before: TicketStatus } {
    const ticket = this.require(id);
    const before = ticket.status;
    if (before === status) return { ticket, before };
    if (before === "CLOSED") {
      const other = this.openTicketOf(ticket.telegramId);
      if (other) throw fail(409, `Ishtirokchining boshqa ochiq murojaati bor (#${other.id}).`);
    }
    ticket.status = status;
    ticket.updatedAt = new Date();
    return { ticket, before };
  }

  /** Ilova (skrinshot) — Telegram fayl ID si; `attachmentId` = "m<xabar tartib raqami>". */
  attachmentFileId(id: number | string, attachmentId: string): string {
    const ticket = this.require(id);
    const match = ATTACHMENT_ID.exec(attachmentId);
    const fileId = match ? ticket.messages[Number(match[1]) - 1]?.photoFileId : null;
    if (!fileId) throw fail(404, "Fayl topilmadi.");
    return fileId;
  }

  // -------------------------------------------------------------------------

  private require(id: number | string): SupportTicket {
    const ticket = this.get(id);
    if (!ticket) throw fail(404, "Murojaat topilmadi.");
    return ticket;
  }

  private openTicketOf(telegramId: number): SupportTicket | undefined {
    return [...this.tickets.values()].find((t) => t.telegramId === telegramId && t.status !== "CLOSED");
  }

  private toListItem(ticket: SupportTicket, p: Participant | null): SupportTicketListItem {
    const last = ticket.messages.at(-1);
    return {
      id: String(ticket.id),
      subject: this.subjectOf(ticket),
      status: ticket.status,
      participant: personOf(ticket.telegramId, p),
      lastMessage: last
        ? { text: last.text || (last.photoFileId ? PHOTO_LABEL : ""), author: authorOf(last), at: last.createdAt.toISOString() }
        : { text: "", author: "PARTICIPANT", at: ticket.updatedAt.toISOString() },
      messageCount: ticket.messages.length,
      createdAt: createdAtOf(ticket).toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      awaitingReply: ticket.status !== "CLOSED" && last?.from === "PARTICIPANT",
    };
  }

  /** Saqlangan holat; eski yozuvlarda yangi maydonlar (`by`, `photoSize`) bo'lmasligi mumkin. */
  private restore(saved: Partial<SavedSupport>): void {
    for (const raw of saved.tickets ?? []) {
      if (typeof raw.id !== "number" || typeof raw.telegramId !== "number") continue;
      const messages = (Array.isArray(raw.messages) ? raw.messages : [])
        .filter((m) => m.createdAt instanceof Date)
        .map((m) => ({ ...m, text: typeof m.text === "string" ? m.text : "", photoFileId: m.photoFileId ?? null }));
      this.tickets.set(raw.id, {
        id: raw.id,
        telegramId: raw.telegramId,
        status: TICKET_STATUSES.find((s) => s === raw.status) ?? "NEW",
        messages,
        updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt : (messages.at(-1)?.createdAt ?? new Date(0)),
      });
    }
    for (const [messageId, telegramId] of saved.groupMessageOwner ?? []) this.groupMessageOwner.set(messageId, telegramId);
    const maxId = Math.max(0, ...this.tickets.keys());
    this.seq = Math.max(typeof saved.seq === "number" ? saved.seq : 1, maxId + 1);
  }
}

const authorOf = (m: SupportMessage): SupportMessageAuthor => (m.from === "PARTICIPANT" ? "PARTICIPANT" : "STAFF");

const createdAtOf = (ticket: SupportTicket): Date => ticket.messages[0]?.createdAt ?? ticket.updatedAt;

function personOf(telegramId: number, p: Participant | null): SupportTicketParticipant {
  return {
    id: String(telegramId),
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    phone: p?.phone ?? "",
  };
}

function statusMatches(status: TicketStatus, filter: SupportStatusFilter | undefined): boolean {
  if (!filter) return true;
  return filter === "OPEN" ? status !== "CLOSED" : status === filter;
}

/** Qidiruv: kichik harf, apostrof variantlari bir xil (o', oʻ, o`), 100 belgigacha. */
function normalize(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[ʻʼ‘’`]/g, "'")
    .trim()
    .slice(0, 100);
}

/** Ism-familiya (ikki tartibda), mavzu, murojaat raqami (#12) yoki telefon (kamida 3 raqam). */
function matches(item: SupportTicketListItem, needle: string): boolean {
  if (!needle) return true;
  const { firstName, lastName, phone } = item.participant;
  const text = normalize(`${firstName} ${lastName} ${lastName} ${firstName} #${item.id} ${item.subject}`);
  if (text.includes(needle)) return true;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && phone.replace(/\D/g, "").includes(digits);
}
