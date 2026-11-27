/**
 * MOCK backend: support murojaatlari. Haqiqiy backendda:
 *   GET   /api/v1/admin/support/tickets
 *   GET   /api/v1/admin/support/tickets/:id
 *   POST  /api/v1/admin/support/tickets/:id/messages
 *   PATCH /api/v1/admin/support/tickets/:id/status
 * Javob ishtirokchiga ilovada va (ulangan bo'lsa) Telegram orqali yetkaziladi.
 */
import { ApiError } from "../api-error";
import type {
  AdminUser,
  SupportMessage,
  SupportStatusFilter,
  SupportTicketDetail,
  SupportTicketListItem,
  SupportTicketListQuery,
  SupportTicketListResponse,
  SupportTicketStatus,
} from "../types";
import {
  getContestData,
  ticketStatusOn,
  type MockParticipant,
  type MockSupportMessage,
  type MockSupportTicket,
} from "./contest";
import { effectiveStatus } from "./ranking";
import { auditId, readStore, writeStore, type MockStore } from "./store";
import { matchesPerson } from "./text";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_REPLY_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------------

/** Murojaatning hozirgi holati: xodim o'zgartirgan bo'lsa — o'sha. */
function currentStatus(ticket: MockSupportTicket, store: MockStore, today: string): SupportTicketStatus {
  return store.ticketStatus[ticket.id] ?? ticketStatusOn(ticket, today) ?? "NEW";
}

function allMessages(ticket: MockSupportTicket, store: MockStore): MockSupportMessage[] {
  return [...ticket.messages, ...(store.ticketReplies[ticket.id] ?? [])];
}

function toMessage(message: MockSupportMessage): SupportMessage {
  return {
    id: message.id,
    author: message.author,
    authorName: message.authorName,
    text: message.text,
    at: message.at,
    attachments: message.attachment
      ? [
          {
            id: `${message.id}_a1`,
            fileName: message.attachment.fileName,
            sizeBytes: message.attachment.sizeBytes,
            url: null,
          },
        ]
      : [],
  };
}

function findTicket(id: string): { ticket: MockSupportTicket; participant: MockParticipant } {
  const data = getContestData();
  const ticket = data.tickets.find((item) => item.id === id);
  const participant = ticket && data.participants.find((item) => item.id === ticket.participantId);
  if (!ticket || !participant) {
    throw new ApiError(404, "Murojaat topilmadi.");
  }
  return { ticket, participant };
}

function updatedAt(ticket: MockSupportTicket, messages: MockSupportMessage[], store: MockStore): string {
  const lastMessageAt = messages.at(-1)?.at ?? "";
  const statusChangedAt = store.ticketStatusChangedAt[ticket.id] ?? "";
  return statusChangedAt > lastMessageAt ? statusChangedAt : lastMessageAt;
}

function matchesFilter(status: SupportTicketStatus, filter: SupportStatusFilter | undefined): boolean {
  if (!filter) return true;
  if (filter === "OPEN") return status !== "CLOSED";
  return status === filter;
}

function toListItem(
  ticket: MockSupportTicket,
  participant: MockParticipant,
  store: MockStore,
  today: string,
): SupportTicketListItem {
  const messages = allMessages(ticket, store);
  const last = messages[messages.length - 1];
  const status = currentStatus(ticket, store, today);

  return {
    id: ticket.id,
    subject: ticket.subject,
    status,
    participant: {
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
    },
    lastMessage: { text: last.text, author: last.author, at: last.at },
    messageCount: messages.length,
    createdAt: messages[0].at,
    updatedAt: updatedAt(ticket, messages, store),
    awaitingReply: status !== "CLOSED" && last.author === "PARTICIPANT",
  };
}

function toDetail(
  ticket: MockSupportTicket,
  participant: MockParticipant,
  store: MockStore,
): SupportTicketDetail {
  const today = getContestData().today;
  const messages = allMessages(ticket, store);

  return {
    id: ticket.id,
    subject: ticket.subject,
    status: currentStatus(ticket, store, today),
    createdAt: messages[0].at,
    updatedAt: updatedAt(ticket, messages, store),
    participant: {
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
      instagramUsername: participant.instagramUsername,
      status: effectiveStatus(participant, store),
      // Mock: murojaat yozganlar saytga kirgan deb olinadi — qayta kirish yopiq, ruxsat shu yerdan.
      webLogin: store.webLoginGrants[participant.id] ? "GRANTED" : "USED",
    },
    messages: messages.map(toMessage),
  };
}

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

/** Dashboard uchun: murojaatning bugungi holati (xodim o'zgarishlari bilan). */
export function supportStatusToday(ticket: MockSupportTicket, store: MockStore): SupportTicketStatus {
  return currentStatus(ticket, store, getContestData().today);
}

export function listSupportTickets(query: SupportTicketListQuery): SupportTicketListResponse {
  const data = getContestData();
  const store = readStore();
  const participantsById = new Map(data.participants.map((item) => [item.id, item]));

  let items = data.tickets
    .map((ticket) => {
      const participant = participantsById.get(ticket.participantId);
      return participant ? toListItem(ticket, participant, store, data.today) : null;
    })
    .filter((item): item is SupportTicketListItem => item !== null)
    // Bugungi sanadan keyingi (hali yaratilmagan) murojaatlar ko'rinmaydi.
    .filter((item) => item.createdAt <= new Date().toISOString())
    .filter((item) =>
      matchesPerson(item.participant, query.search ?? "", `${item.id} ${item.subject}`),
    );

  const statusCounts: SupportTicketListResponse["statusCounts"] = {
    ALL: items.length,
    OPEN: items.filter((item) => item.status !== "CLOSED").length,
    NEW: items.filter((item) => item.status === "NEW").length,
    IN_PROGRESS: items.filter((item) => item.status === "IN_PROGRESS").length,
    CLOSED: items.filter((item) => item.status === "CLOSED").length,
  };

  items = items
    .filter((item) => matchesFilter(item.status, query.status))
    // Eng so'nggi faollik yuqorida.
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    statusCounts,
  };
}

export function getSupportTicketDetail(id: string): SupportTicketDetail {
  const { ticket, participant } = findTicket(id);
  return toDetail(ticket, participant, readStore());
}

export function addSupportReply(id: string, rawText: string, actor: AdminUser): SupportTicketDetail {
  const text = rawText.trim();
  if (!text) {
    throw new ApiError(400, "Javob matnini yozing.");
  }
  if (text.length > MAX_REPLY_LENGTH) {
    throw new ApiError(400, `Javob ${MAX_REPLY_LENGTH} belgidan oshmasligi kerak.`);
  }

  const { ticket, participant } = findTicket(id);
  const store = readStore();
  const status = currentStatus(ticket, store, getContestData().today);
  if (status === "CLOSED") {
    throw new ApiError(409, "Murojaat yopilgan. Javob yozish uchun avval holatini o'zgartiring.");
  }

  const now = new Date().toISOString();
  const existing = store.ticketReplies[ticket.id] ?? [];
  const reply: MockSupportMessage = {
    id: `${ticket.id}_r${existing.length + 1}`,
    author: "STAFF",
    authorName: actor.fullName,
    text,
    at: now,
    attachment: null,
  };

  // Yangi murojaatga birinchi javob berilganda u "Ko'rilmoqda" holatiga o'tadi.
  const nextStatus: SupportTicketStatus = status === "NEW" ? "IN_PROGRESS" : status;
  const audit = [
    ...store.audit,
    {
      id: auditId(),
      at: now,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "support.reply",
      entity: "support_ticket" as const,
      entityId: ticket.id,
      before: status,
      after: nextStatus,
      reason: text.slice(0, 200),
    },
  ];

  const nextStore: MockStore = {
    ...store,
    ticketReplies: { ...store.ticketReplies, [ticket.id]: [...existing, reply] },
    ticketStatus:
      nextStatus !== status ? { ...store.ticketStatus, [ticket.id]: nextStatus } : store.ticketStatus,
    ticketStatusChangedAt:
      nextStatus !== status
        ? { ...store.ticketStatusChangedAt, [ticket.id]: now }
        : store.ticketStatusChangedAt,
    audit,
  };
  writeStore(nextStore);

  return toDetail(ticket, participant, nextStore);
}

/**
 * Saytga qayta kirishga bir martalik ruxsat (murojaat egasi uchun) — backenddagidek audit bilan.
 * Mock'da ishtirokchiga xabar yuborilmaydi.
 */
export function allowTicketWebLogin(id: string, actor: AdminUser): SupportTicketDetail {
  const { ticket, participant } = findTicket(id);
  const store = readStore();
  if (store.webLoginGrants[participant.id]) throw new ApiError(409, "Ruxsat allaqachon berilgan.");
  const now = new Date().toISOString();
  const nextStore: MockStore = {
    ...store,
    webLoginGrants: { ...store.webLoginGrants, [participant.id]: true },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at: now,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "participant.web_login",
        entity: "participant",
        entityId: participant.id,
        before: "USED",
        after: "GRANTED",
        reason: `Murojaat #${ticket.id}`,
      },
    ],
  };
  writeStore(nextStore);
  return toDetail(ticket, participant, nextStore);
}

export function setSupportTicketStatus(
  id: string,
  nextStatus: SupportTicketStatus,
  actor: AdminUser,
): SupportTicketDetail {
  const { ticket, participant } = findTicket(id);
  const store = readStore();
  const status = currentStatus(ticket, store, getContestData().today);
  if (status === nextStatus) {
    return toDetail(ticket, participant, store);
  }

  const now = new Date().toISOString();
  const nextStore: MockStore = {
    ...store,
    ticketStatus: { ...store.ticketStatus, [ticket.id]: nextStatus },
    ticketStatusChangedAt: { ...store.ticketStatusChangedAt, [ticket.id]: now },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at: now,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "support.status",
        entity: "support_ticket",
        entityId: ticket.id,
        before: status,
        after: nextStatus,
        reason: "",
      },
    ],
  };
  writeStore(nextStore);

  return toDetail(ticket, participant, nextStore);
}
