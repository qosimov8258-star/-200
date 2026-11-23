/**
 * MOCK backend: audit log (TZ 2-bo'lim: barcha Admin va Support harakatlari —
 * kim, nima, qachon). Haqiqiy backendda `GET /api/v1/admin/audit-log` va
 * `audit_logs` jadvali; yozuvlar faqat qo'shiladi, o'zgartirilmaydi.
 *
 * Ro'yxat ikki manbadan: mock tarixidagi xodim harakatlari (Reel moderatsiyasi,
 * support javoblari, murojaatni yopish, target qarorlari) va shu brauzerda
 * qilingan amallar (`store.ts`).
 */
import { addDays } from "../dates";
import { REEL_REJECT_REASON_LABELS } from "../labels";
import type { AdminRole, AuditLogEntry, AuditLogQuery, AuditLogResponse } from "../types";
import { eventTime, getContestData } from "./contest";
import { mockAdmins } from "./db";
import { effectivePrizes } from "./prizes";
import { storyParticipantId } from "./stories";
import { auditId, readStore, writeStore, type MockAuditEntry } from "./store";
import { normalizeSearch } from "./text";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/** Mock tarixida harakatlarni bajargan xodimlar (`db.ts` dagi mock xodimlar). */
const ADMIN = mockAdmins.find((admin) => admin.role === "ADMIN");
const SUPPORT = mockAdmins.find((admin) => admin.role === "SUPPORT");

function actorFields(actor: typeof ADMIN): Pick<MockAuditEntry, "actorId" | "actorName"> {
  return { actorId: actor?.id ?? "system", actorName: actor?.fullName ?? "Tizim" };
}

/** Mock ma'lumotlardan kelib chiqadigan oldingi xodim harakatlari. */
function historicalEntries(): MockAuditEntry[] {
  const data = getContestData();
  const entries: MockAuditEntry[] = [];

  for (const reel of data.reels) {
    if (!reel.reviewedOn || !reel.reviewOutcome) continue;
    const accepted = reel.reviewOutcome === "ACCEPTED";
    entries.push({
      id: `hist_reel_${reel.id}`,
      at: eventTime(reel.reviewedOn, `audit:${reel.id}`),
      ...actorFields(ADMIN),
      action: accepted ? "reel.accept" : "reel.reject",
      entity: "reel",
      entityId: reel.id,
      before: "PENDING",
      after: reel.reviewOutcome,
      reason: accepted || !reel.rejectReason ? "" : REEL_REJECT_REASON_LABELS[reel.rejectReason],
    });
  }

  for (const ticket of data.tickets) {
    for (const message of ticket.messages) {
      if (message.author !== "STAFF") continue;
      entries.push({
        id: `hist_reply_${message.id}`,
        at: message.at,
        ...actorFields(SUPPORT),
        action: "support.reply",
        entity: "support_ticket",
        entityId: ticket.id,
        before: "NEW",
        after: "IN_PROGRESS",
        reason: message.text.slice(0, 200),
      });
    }
    const last = ticket.messages[ticket.messages.length - 1];
    if (ticket.closedOn && last) {
      entries.push({
        id: `hist_close_${ticket.id}`,
        at: new Date(Date.parse(last.at) + 5 * 60_000).toISOString(),
        ...actorFields(SUPPORT),
        action: "support.status",
        entity: "support_ticket",
        entityId: ticket.id,
        before: "IN_PROGRESS",
        after: "CLOSED",
        reason: "",
      });
    }
  }

  for (const target of data.targets) {
    if (target.status !== "WARNED" && target.status !== "DISMISSED") continue;
    const day = addDays(target.detectedOn, 1) <= data.today ? addDays(target.detectedOn, 1) : data.today;
    entries.push({
      id: `hist_target_${target.id}`,
      at: eventTime(day, target.id, 10, 12),
      ...actorFields(ADMIN),
      action: target.status === "WARNED" ? "target.warn" : "target.dismiss",
      entity: "target_case",
      entityId: target.id,
      before: "NEW",
      after: target.status,
      reason:
        target.status === "WARNED"
          ? "Reklama aniqlandi, birinchi ogohlantirish"
          : "O'sish organik — Reel mashhur sahifada ulashilgan",
    });
  }

  return entries;
}

/** Obyektning odam o'qiy oladigan nomi. */
function entityLabelResolver(): (entry: MockAuditEntry) => string {
  const data = getContestData();
  const participants = new Map(
    data.participants.map((item) => [item.id, `${item.firstName} ${item.lastName}`]),
  );
  const reels = new Map(data.reels.map((reel) => [reel.id, reel.participantId]));
  const tickets = new Map(data.tickets.map((ticket) => [ticket.id, ticket.subject]));
  const targets = new Map(data.targets.map((target) => [target.id, target.participantId]));
  const prizes = new Map(effectivePrizes().map((prize) => [prize.id, prize.title]));
  const removedStories = readStore().removedStories;

  return (entry) => {
    switch (entry.entity) {
      case "participant":
      case "winner":
        return participants.get(entry.entityId) ?? entry.entityId;
      case "reel":
        return participants.get(reels.get(entry.entityId) ?? "") ?? entry.entityId;
      case "target_case":
        return participants.get(targets.get(entry.entityId) ?? "") ?? entry.entityId;
      case "support_ticket":
        return `${entry.entityId}: ${tickets.get(entry.entityId) ?? ""}`;
      case "telegram_message":
        return entry.entityId === "*" ? "O'qilmagan xabarlar" : entry.entityId;
      case "settings":
        return "Tanlov sozlamalari";
      case "prize":
        // O'chirilgan sovg'aning nomi audit yozuvining "oldin" qismida qoladi.
        return prizes.get(entry.entityId) ?? entry.before.split("; ")[0] ?? entry.entityId;
      case "voucher_draw": {
        const draw = readStore().draws.find((item) => item.id === entry.entityId);
        return draw ? `#${draw.number} — ${draw.prizeTitle}` : entry.entityId;
      }
      case "story": {
        // Istoriya o'chirilgan yoki muddati tugagan bo'lsa ham egasi ma'lum.
        const owner = removedStories[entry.entityId]?.participantId ?? storyParticipantId(entry.entityId);
        return participants.get(owner ?? "") ?? entry.entityId;
      }
      case "auth":
        return entry.actorName;
    }
  };
}

function roleOf(actorId: string): AdminRole {
  return mockAdmins.find((admin) => admin.id === actorId)?.role ?? "ADMIN";
}

export function listAuditLog(query: AuditLogQuery): AuditLogResponse {
  const labelOf = entityLabelResolver();
  const needle = normalizeSearch(query.search ?? "");

  const items: AuditLogEntry[] = [...historicalEntries(), ...readStore().audit]
    .filter((entry) => Date.parse(entry.at) <= Date.now())
    .map((entry) => ({
      id: entry.id,
      at: entry.at,
      actor: { id: entry.actorId, name: entry.actorName, role: roleOf(entry.actorId) },
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      entityLabel: labelOf(entry),
      before: entry.before,
      after: entry.after,
      reason: entry.reason,
    }))
    .filter((entry) => !query.entity || entry.entity === query.entity)
    .filter((entry) => !query.actorRole || entry.actor.role === query.actorRole)
    .filter(
      (entry) =>
        !needle ||
        normalizeSearch(
          `${entry.actor.name} ${entry.action} ${entry.entityLabel} ${entry.reason} ${entry.before} ${entry.after}`,
        ).includes(needle),
    )
    // Eng yangilari yuqorida.
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/** Kirish/chiqish kabi boshqa modullarga tegishli bo'lmagan yozuvlar uchun. */
export function recordAudit(entry: Omit<MockAuditEntry, "id" | "at">): void {
  const store = readStore();
  writeStore({
    ...store,
    audit: [...store.audit, { ...entry, id: auditId(), at: new Date().toISOString() }],
  });
}
