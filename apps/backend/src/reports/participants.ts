import { contestDay } from "../common/time";
import type { Participant, ReelStatus } from "../participants/participants.service";
import type { TargetCase } from "../targets/targets.service";

/**
 * Admin panel → Foydalanuvchilar bo'limi: ishtirokchi qatori, filtr va saralash (sof funksiyalar).
 * Tiplar `apps/admin/src/lib/types.ts` → Ishtirokchilar bo'limi bilan bir xil.
 */

/** WARNED — o'zida emas, ochiq "ogohlantirilgan" target holatidan kelib chiqadi. */
export type AdminParticipantStatus = "ACTIVE" | "WARNED" | "DISQUALIFIED" | "BLOCKED";
/** REMOVED hozircha ishlatilmaydi (backendda o'chirilgan video holati yo'q). */
export type AdminReelStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REMOVED";
export type ReelFilter = AdminReelStatus | "NONE";
export type ParticipantSort = "rank" | "views" | "name";
export type SortOrder = "asc" | "desc";
export type ParticipantAction = "block" | "unblock" | "disqualify";

export const PARTICIPANT_STATUSES: readonly AdminParticipantStatus[] = ["ACTIVE", "WARNED", "DISQUALIFIED", "BLOCKED"];
export const REEL_FILTERS: readonly ReelFilter[] = ["PENDING", "ACCEPTED", "REJECTED", "REMOVED", "NONE"];
export const PARTICIPANT_SORTS: readonly ParticipantSort[] = ["rank", "views", "name"];
export const SORT_ORDERS: readonly SortOrder[] = ["asc", "desc"];

/**
 * Amal ishtirokchining qaysi (backenddagi) holatlarida bajariladi. Ogohlantirilgan (WARNED)
 * ishtirokchi backendda ACTIVE — uni ham bloklash va chetlatish mumkin.
 */
export const ACTION_ALLOWED_FROM: Record<ParticipantAction, readonly Participant["status"][]> = {
  block: ["ACTIVE"],
  unblock: ["BLOCKED"],
  disqualify: ["ACTIVE", "BLOCKED"],
};

export interface ParticipantListItem {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  phone: string;
  instagramUsername: string | null;
  status: AdminParticipantStatus;
  registeredOn: string;
  reel: { url: string; status: AdminReelStatus } | null;
  /** Reelning oxirgi yig'ilgan ko'rishlari. */
  views: number;
  /** Joriy reytingdagi o'rni; reytingda bo'lmasa — null. */
  rank: number | null;
  /** Ro'yxatdan chiqarilmagan (DISMISSED emas) target holati bormi. */
  hasTarget: boolean;
}

export type StatusCounts = Record<AdminParticipantStatus | "ALL", number>;

/** Target holatidan kerakli qism. */
export type CaseInfo = Pick<TargetCase, "telegramId" | "status" | "detectedOn">;

/** Ro'yxat qatorlarini yig'ish uchun bir marta hisoblanadigan ma'lumot. */
export interface ParticipantContext {
  rankById: ReadonlyMap<number, number>;
  /** Ochiq "ogohlantirilgan" target holati borlar. */
  warned: ReadonlySet<number>;
  /** DISMISSED bo'lmagan target holati borlar. */
  withTarget: ReadonlySet<number>;
}

export interface ParticipantFilter {
  /** Kichik harfdagi qidiruv matni (bo'sh — filtr yo'q). */
  search: string;
  status?: AdminParticipantStatus;
  reel?: ReelFilter;
  /** Ko'rishlar oralig'i (ikkala chegara ham kiradi); berilmasa — chegara yo'q. */
  minViews?: number;
  maxViews?: number;
  sort?: ParticipantSort;
  order?: SortOrder;
}

export function participantContext(
  ranking: readonly { participant: { telegramId: number }; rank: number }[],
  cases: readonly CaseInfo[],
): ParticipantContext {
  return {
    rankById: new Map(ranking.map((e) => [e.participant.telegramId, e.rank])),
    warned: new Set(cases.filter((c) => c.status === "WARNED").map((c) => c.telegramId)),
    withTarget: new Set(cases.filter((c) => c.status !== "DISMISSED").map((c) => c.telegramId)),
  };
}

/** Backend Reel holati → admin panel: qo'lda tekshiruvdagi video (MANUAL_REVIEW) ham kutilmoqda — PENDING. */
export function adminReelStatus(status: ReelStatus): AdminReelStatus {
  return status === "MANUAL_REVIEW" ? "PENDING" : status;
}

/** Bloklangan/chetlatilgan — o'zidan; aks holda ochiq ogohlantirish bo'lsa — WARNED, bo'lmasa — ACTIVE. */
export function adminStatus(p: Participant, warned: ReadonlySet<number>): AdminParticipantStatus {
  if (p.status !== "ACTIVE") return p.status;
  return warned.has(p.telegramId) ? "WARNED" : "ACTIVE";
}

/** Ro'yxatga faqat profilini to'ldirganlar kiradi. */
export const isListed = (p: Participant): boolean => Boolean(p.firstName);

export function toParticipantItem(p: Participant, ctx: ParticipantContext): ParticipantListItem {
  return {
    id: String(p.telegramId),
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    age: p.age ?? 0,
    phone: p.phone ?? "",
    instagramUsername: p.reel?.owner ?? null,
    status: adminStatus(p, ctx.warned),
    registeredOn: contestDay(p.createdAt),
    reel: p.reel ? { url: p.reel.url, status: adminReelStatus(p.reel.status) } : null,
    views: p.reel?.history.at(-1)?.views ?? 0,
    rank: ctx.rankById.get(p.telegramId) ?? null,
    hasTarget: ctx.withTarget.has(p.telegramId),
  };
}

/** Qidiruv uchun: kichik harf, apostrof variantlari (o', oʻ, o`) bir xil. */
const normalize = (value: string): string => value.toLowerCase().replace(/[ʻʼ‘’`]/g, "'").trim();

/** Ism-familiya, Instagram (@ bilan ham) yoki telefon (kamida 3 ta raqam) bo'yicha moslik. */
export function matchesPerson(item: ParticipantListItem, search: string): boolean {
  const needle = normalize(search);
  if (!needle) return true;
  const names = normalize(`${item.firstName} ${item.lastName} ${item.lastName} ${item.firstName}`);
  if (names.includes(needle)) return true;
  const username = needle.replace(/^@/, "");
  if (item.instagramUsername && username && item.instagramUsername.toLowerCase().includes(username)) return true;
  const digits = needle.replace(/\D/g, "");
  return digits.length >= 3 && item.phone.replace(/\D/g, "").includes(digits);
}

function compareItems(a: ParticipantListItem, b: ParticipantListItem, sort: ParticipantSort, order: SortOrder): number {
  const direction = order === "asc" ? 1 : -1;
  const byId = Number(a.id) - Number(b.id);
  if (sort === "rank") {
    // Reytingda yo'qlar har doim oxirida.
    if (a.rank === null && b.rank === null) return byId;
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return (a.rank - b.rank) * direction;
  }
  if (sort === "views") return (a.views - b.views) * direction || byId;
  const byName = a.lastName.localeCompare(b.lastName, "uz") || a.firstName.localeCompare(b.firstName, "uz");
  return byName * direction || byId;
}

/**
 * Ro'yxat: qidiruv va Reel filtri → holatlar soni → holat filtri → saralash.
 * `statusCounts` holat filtrini hisobga olmaydi (admin panel tablaridagi sonlar).
 * Standart saralash — reyting bo'yicha; tartib: ko'rishlarda kamayish, qolganlarida o'sish.
 */
export function listParticipants(
  participants: readonly Participant[],
  ctx: ParticipantContext,
  filter: ParticipantFilter,
): { items: ParticipantListItem[]; statusCounts: StatusCounts } {
  let items = participants
    .filter(isListed)
    .map((p) => toParticipantItem(p, ctx))
    .filter((item) => matchesPerson(item, filter.search));

  if (filter.reel === "NONE") items = items.filter((item) => item.reel === null);
  else if (filter.reel) items = items.filter((item) => item.reel?.status === filter.reel);
  if (filter.minViews !== undefined) items = items.filter((item) => item.views >= (filter.minViews ?? 0));
  if (filter.maxViews !== undefined) items = items.filter((item) => item.views <= (filter.maxViews ?? Infinity));

  const statusCounts: StatusCounts = { ALL: items.length, ACTIVE: 0, WARNED: 0, BLOCKED: 0, DISQUALIFIED: 0 };
  for (const item of items) statusCounts[item.status] += 1;

  if (filter.status) items = items.filter((item) => item.status === filter.status);

  const sort = filter.sort ?? "rank";
  const order = filter.order ?? (sort === "views" ? "desc" : "asc");
  items.sort((a, b) => compareItems(a, b, sort, order));
  return { items, statusCounts };
}
