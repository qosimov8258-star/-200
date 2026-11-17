/**
 * MOCK backend: Telegram xabarnomalari va ularning holati (TZ 6-bo'lim). Haqiqiy backendda:
 *   GET  /api/v1/admin/telegram/messages
 *   POST /api/v1/admin/telegram/messages/:id/resend
 *   POST /api/v1/admin/telegram/messages/resend-unread
 * va ma'lumot `telegram_messages` jadvalidan olinadi.
 *
 * Xabarlar boshqa bo'limlardagi hodisalardan yig'iladi: Reel qabul/rad, support
 * javoblari, target ogohlantirishlari va reytingdagi o'rin o'zgarishi.
 *
 * "O'qildi" holati: Telegram Bot API o'qilganlikni bildirmaydi, shuning uchun
 * xabar ostidagi "✅ O'qidim" tugmasi bosilganda o'qilgan hisoblanadi (PLAN.md Q11).
 */
import { ApiError } from "../api-error";
import { addDays } from "../dates";
import type {
  AdminUser,
  TelegramDeliveryStatus,
  TelegramFailureReason,
  TelegramMessageKind,
  TelegramMessageListItem,
  TelegramMessageListQuery,
  TelegramMessageListResponse,
  TelegramResendUnreadRequest,
} from "../types";
import { eventTime, getContestData, type MockParticipant } from "./contest";
import { computeRanking } from "./ranking";
import { createRandom, hashString } from "./random";
import { auditId, readStore, writeStore, type MockStore } from "./store";
import { matchesPerson } from "./text";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
/** Yetkazilganiga shuncha vaqt bo'lib o'qilmasa — "o'qilmadi". */
const UNREAD_AFTER_MS = 24 * 60 * 60 * 1000;
/** Mock: qayta yuborilgan xabar shuncha vaqtdan keyin "yetkazildi" bo'ladi. */
const DELIVERY_CONFIRM_MS = 10_000;
/** Reytingdagi o'rin necha o'ringa o'zgarsa xabar boradi. */
const RANK_CHANGE_MIN = 3;
/** Necha kunlik o'rin o'zgarishi xabarlari ko'rsatiladi. */
const RANK_CHANGE_DAYS = 3;

// ---------------------------------------------------------------------------
// Telegram ulanishi (PLAN.md Q12: ishtirokchi botni deep link orqali o'zi ochadi)
// ---------------------------------------------------------------------------

interface TelegramLink {
  linked: boolean;
  blocked: boolean;
  username: string | null;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function telegramLink(participant: MockParticipant): TelegramLink {
  const random = createRandom(hashString(`tg:${participant.id}`));
  const roll = random.next();
  if (roll >= 0.78) {
    return { linked: false, blocked: false, username: null };
  }
  return {
    linked: true,
    blocked: roll < 0.03,
    username: random.chance(0.8)
      ? `${slug(participant.firstName)}_${slug(participant.lastName).slice(0, 4)}${random.int(10, 99)}`
      : null,
  };
}

// ---------------------------------------------------------------------------
// Hodisalardan xabarlar
// ---------------------------------------------------------------------------

interface BaseMessage {
  id: string;
  kind: TelegramMessageKind;
  text: string;
  participantId: string;
  /** UTC ISO vaqt. */
  at: string;
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function collectMessages(store: MockStore): BaseMessage[] {
  const data = getContestData();
  const messages: BaseMessage[] = [];
  const timeOn = eventTime;

  // 1. Reel qabul qilindi / rad etildi.
  for (const reel of data.reels) {
    if (!reel.reviewedOn || !reel.reviewOutcome) continue;
    const accepted = reel.reviewOutcome === "ACCEPTED";
    messages.push({
      id: `tg_reel_${reel.id}`,
      kind: accepted ? "REEL_ACCEPTED" : "REEL_REJECTED",
      text: accepted
        ? "✅ Reelingiz qabul qilindi va reytingga qo'shildi."
        : "❌ Reelingiz rad etildi. Sababini ilovadagi bildirishnomalarda ko'ring.",
      participantId: reel.participantId,
      at: timeOn(reel.reviewedOn, reel.id),
    });
  }

  // 2. Support javoblari (generatsiya qilingan va xodimlar yozgan).
  for (const ticket of data.tickets) {
    const staffMessages = [...ticket.messages, ...(store.ticketReplies[ticket.id] ?? [])].filter(
      (message) => message.author === "STAFF",
    );
    for (const message of staffMessages) {
      messages.push({
        id: `tg_sup_${message.id}`,
        kind: "SUPPORT_REPLY",
        text: `💬 Support javobi: ${truncate(message.text, 90)}`,
        participantId: ticket.participantId,
        at: new Date(Date.parse(message.at) + 2000).toISOString(),
      });
    }
  }

  // 3. Target bo'yicha ogohlantirishlar.
  const warningText =
    "⚠️ Ogohlantirish: Reelingiz uchun pullik reklama (target) aniqlandi. Tanlov qoidalariga ko'ra target taqiqlangan.";
  for (const target of data.targets) {
    if (target.status !== "WARNED") continue;
    const day = addDays(target.detectedOn, 1) <= data.today ? addDays(target.detectedOn, 1) : data.today;
    messages.push({
      id: `tg_warn_${target.id}`,
      kind: "WARNING",
      text: warningText,
      participantId: target.participantId,
      at: timeOn(day, target.id, 10, 12),
    });
  }
  for (const entry of store.audit) {
    if (entry.action !== "target.warn") continue;
    const target = data.targets.find((item) => item.id === entry.entityId);
    if (!target) continue;
    messages.push({
      id: `tg_warn_${entry.id}`,
      kind: "WARNING",
      text: warningText,
      participantId: target.participantId,
      at: new Date(Date.parse(entry.at) + 2000).toISOString(),
    });
  }

  // 4. Reytingdagi o'rin sezilarli o'zgarganda (reyting 00:00 da yangilanadi).
  for (let offset = RANK_CHANGE_DAYS - 1; offset >= 0; offset--) {
    const day = addDays(data.today, -offset);
    if (day <= data.startsOn) continue;
    const previous = new Map(
      computeRanking(addDays(day, -1), store).map((entry) => [entry.participantId, entry.rank]),
    );
    for (const entry of computeRanking(day, store)) {
      const before = previous.get(entry.participantId);
      if (before === undefined || Math.abs(before - entry.rank) < RANK_CHANGE_MIN) continue;
      const up = before > entry.rank;
      messages.push({
        id: `tg_rank_${day}_${entry.participantId}`,
        kind: "RANK_CHANGED",
        text: `📊 Reytingdagi o'rningiz: ${entry.rank} (${up ? "▲" : "▼"}${Math.abs(before - entry.rank)}).`,
        participantId: entry.participantId,
        at: timeOn(day, `${day}${entry.participantId}`, 0, 0),
      });
    }
  }

  return messages;
}

// ---------------------------------------------------------------------------
// Yetkazish va o'qilish holati
// ---------------------------------------------------------------------------

function toListItem(
  base: BaseMessage,
  participant: MockParticipant,
  link: TelegramLink,
  store: MockStore,
  now: number,
): TelegramMessageListItem {
  const random = createRandom(hashString(base.id));
  const networkFailure = random.chance(0.04);
  const willRead = random.chance(0.68);
  const readDelayMs = random.int(1, 600) * 60_000;

  const resend = store.telegramResends[base.id];
  const attempts = 1 + (resend?.attempts ?? 0);
  const lastSentAt = resend?.lastSentAt ?? base.at;

  let status: TelegramDeliveryStatus;
  let deliveredAt: string | null = null;
  let readAt: string | null = null;
  let failureReason: TelegramFailureReason | null = null;

  if (link.blocked) {
    status = "FAILED";
    failureReason = "BOT_BLOCKED";
  } else if (resend) {
    // Qayta yuborilgan: avval "yuborildi", tasdiq kelgach "yetkazildi".
    const sinceMs = now - Date.parse(resend.lastSentAt);
    if (sinceMs < DELIVERY_CONFIRM_MS) {
      status = "SENT";
    } else {
      deliveredAt = new Date(Date.parse(resend.lastSentAt) + 2000).toISOString();
      status = sinceMs > UNREAD_AFTER_MS ? "UNREAD" : "DELIVERED";
    }
  } else if (networkFailure) {
    status = "FAILED";
    failureReason = "NETWORK";
  } else {
    const sentMs = Date.parse(base.at);
    deliveredAt = new Date(sentMs + 2000).toISOString();
    if (willRead && sentMs + readDelayMs <= now) {
      readAt = new Date(sentMs + readDelayMs).toISOString();
      status = "READ";
    } else {
      status = now - sentMs > UNREAD_AFTER_MS ? "UNREAD" : "DELIVERED";
    }
  }

  return {
    id: base.id,
    kind: base.kind,
    text: base.text,
    participant: {
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
      telegramUsername: link.username,
    },
    firstSentAt: base.at,
    lastSentAt,
    attempts,
    status,
    deliveredAt,
    readAt,
    failureReason,
    canResend: status === "UNREAD" || failureReason === "NETWORK",
  };
}

interface Collected {
  items: TelegramMessageListItem[];
  summary: TelegramMessageListResponse["summary"];
}

function collectItems(store: MockStore): Collected {
  const data = getContestData();
  const now = Date.now();
  const participants = new Map(data.participants.map((item) => [item.id, item]));
  const links = new Map(data.participants.map((item) => [item.id, telegramLink(item)]));

  const items = collectMessages(store)
    .filter((message) => Date.parse(message.at) <= now)
    .flatMap((message) => {
      const participant = participants.get(message.participantId);
      const link = links.get(message.participantId);
      // Telegramni ulamaganlarga xabar faqat ilovada boradi — bu ro'yxatda yo'q.
      if (!participant || !link?.linked) return [];
      return [toListItem(message, participant, link, store, now)];
    });

  const linkValues = [...links.values()];
  return {
    items,
    summary: {
      totalParticipants: data.participants.length,
      linkedParticipants: linkValues.filter((link) => link.linked).length,
      blockedBot: linkValues.filter((link) => link.blocked).length,
    },
  };
}

function matchesQuery(
  item: TelegramMessageListItem,
  query: { kind?: TelegramMessageKind; search?: string },
): boolean {
  if (query.kind && item.kind !== query.kind) return false;
  return matchesPerson(
    { ...item.participant, instagramUsername: item.participant.telegramUsername },
    query.search ?? "",
  );
}

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

export function listTelegramMessages(query: TelegramMessageListQuery): TelegramMessageListResponse {
  const { items: all, summary } = collectItems(readStore());
  let items = all.filter((item) => matchesQuery(item, query));

  const statusCounts: TelegramMessageListResponse["statusCounts"] = {
    ALL: items.length,
    SENT: 0,
    DELIVERED: 0,
    READ: 0,
    UNREAD: 0,
    FAILED: 0,
  };
  for (const item of items) {
    statusCounts[item.status] += 1;
  }

  items = items
    .filter((item) => !query.status || item.status === query.status)
    // Eng so'nggi yuborilganlar yuqorida.
    .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt) || a.id.localeCompare(b.id));

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    statusCounts,
    summary,
  };
}

function markResent(store: MockStore, ids: string[], now: string): MockStore {
  const telegramResends = { ...store.telegramResends };
  for (const id of ids) {
    telegramResends[id] = { attempts: (telegramResends[id]?.attempts ?? 0) + 1, lastSentAt: now };
  }
  return { ...store, telegramResends };
}

export function resendTelegramMessage(id: string, actor: AdminUser): TelegramMessageListItem {
  const store = readStore();
  const item = collectItems(store).items.find((message) => message.id === id);
  if (!item) {
    throw new ApiError(404, "Xabar topilmadi.");
  }
  if (!item.canResend) {
    throw new ApiError(
      409,
      item.failureReason === "BOT_BLOCKED"
        ? "Ishtirokchi botni bloklagan — qayta yuborib bo'lmaydi."
        : "Bu xabarni qayta yuborish shart emas.",
    );
  }

  const now = new Date().toISOString();
  const nextStore = markResent(store, [id], now);
  nextStore.audit = [
    ...store.audit,
    {
      id: auditId(),
      at: now,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "telegram.resend",
      entity: "telegram_message",
      entityId: id,
      before: item.status,
      after: "SENT",
      reason: "",
    },
  ];
  writeStore(nextStore);

  const updated = collectItems(nextStore).items.find((message) => message.id === id);
  if (!updated) {
    throw new ApiError(404, "Xabar topilmadi.");
  }
  return updated;
}

export function resendUnreadTelegramMessages(
  request: TelegramResendUnreadRequest,
  actor: AdminUser,
): { resent: number } {
  const store = readStore();
  const unread = collectItems(store).items.filter(
    (item) => item.status === "UNREAD" && matchesQuery(item, request),
  );
  if (unread.length === 0) {
    return { resent: 0 };
  }

  const now = new Date().toISOString();
  const nextStore = markResent(
    store,
    unread.map((item) => item.id),
    now,
  );
  nextStore.audit = [
    ...store.audit,
    {
      id: auditId(),
      at: now,
      actorId: actor.id,
      actorName: actor.fullName,
      action: "telegram.resend_unread",
      entity: "telegram_message",
      entityId: "*",
      before: "UNREAD",
      after: `${unread.length} ta xabar qayta yuborildi`,
      reason: "",
    },
  ];
  writeStore(nextStore);

  return { resent: unread.length };
}
