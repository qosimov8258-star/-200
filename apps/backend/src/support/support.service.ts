import { Injectable } from "@nestjs/common";

export type TicketStatus = "NEW" | "IN_PROGRESS" | "CLOSED";

export interface SupportMessage {
  from: "PARTICIPANT" | "OPERATOR";
  text: string;
  /** Telegram fayl ID si (skrinshot); matnli xabarda null. */
  photoFileId: string | null;
  createdAt: Date;
}

export interface SupportTicket {
  id: number;
  telegramId: number;
  status: TicketStatus;
  messages: SupportMessage[];
  updatedAt: Date;
}

/**
 * Support murojaatlari. Ishtirokchi botga yozadi → murojaat ochiladi yoki davom etadi;
 * operator javobi bot orqali ishtirokchiga boradi.
 *
 * VAQTINCHA xotirada; Faza 1 da `support_tickets` / `support_messages` jadvallariga
 * ko'chadi va admin panelning Support bo'limi shu ma'lumotni o'qiydi.
 */
@Injectable()
export class SupportService {
  private seq = 1;
  private readonly tickets = new Map<number, SupportTicket>();
  /** Support guruhidagi xabar ID → ishtirokchi (operator "reply" qilganda kerak). */
  private readonly groupMessageOwner = new Map<number, number>();

  /** Ishtirokchining ochiq murojaatiga qo'shadi yoki yangisini ochadi. */
  addParticipantMessage(telegramId: number, text: string, photoFileId: string | null): SupportTicket {
    let ticket = [...this.tickets.values()].find(
      (t) => t.telegramId === telegramId && t.status !== "CLOSED",
    );
    if (!ticket) {
      ticket = { id: this.seq++, telegramId, status: "NEW", messages: [], updatedAt: new Date() };
      this.tickets.set(ticket.id, ticket);
    }
    ticket.messages.push({ from: "PARTICIPANT", text, photoFileId, createdAt: new Date() });
    ticket.updatedAt = new Date();
    return ticket;
  }

  addOperatorReply(telegramId: number, text: string): SupportTicket | null {
    const ticket = [...this.tickets.values()].find(
      (t) => t.telegramId === telegramId && t.status !== "CLOSED",
    );
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

  list(): SupportTicket[] {
    return [...this.tickets.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}
