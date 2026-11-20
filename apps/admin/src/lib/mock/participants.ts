/**
 * MOCK backend: ishtirokchilar ro'yxati va admin amallari (bloklash,
 * blokdan chiqarish, diskvalifikatsiya). Haqiqiy backendda:
 *   GET  /api/v1/admin/participants
 *   POST /api/v1/admin/participants/:id/{block|unblock|disqualify}
 */
import { ApiError } from "../api-error";
import type {
  AdminUser,
  ParticipantAction,
  ParticipantListItem,
  ParticipantListQuery,
  ParticipantListResponse,
  ParticipantStatus,
  ViewsRefreshPreview,
  ViewsRefreshReport,
  ViewsRefreshRequest,
} from "../types";
import { getContestData, reelStatusOn, type MockParticipant, type MockReel } from "./contest";
import { computeRanking, effectiveStatus } from "./ranking";
import { auditId, readStore, writeStore, type MockStore } from "./store";
import { activeTargetParticipants } from "./targets";
import { matchesPerson } from "./text";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_REASON_LENGTH = 5;

/** Har bir amal qaysi holatlardan qaysi holatga o'tkazadi. */
const TRANSITIONS: Record<ParticipantAction, { from: ParticipantStatus[]; to: ParticipantStatus }> = {
  block: { from: ["ACTIVE", "WARNED"], to: "BLOCKED" },
  unblock: { from: ["BLOCKED"], to: "ACTIVE" },
  disqualify: { from: ["ACTIVE", "WARNED", "BLOCKED"], to: "DISQUALIFIED" },
};

// ---------------------------------------------------------------------------
// Ro'yxat elementini yig'ish
// ---------------------------------------------------------------------------

interface ListContext {
  store: MockStore;
  today: string;
  rankById: Map<string, number>;
  reelByParticipant: Map<string, MockReel>;
  targetParticipants: Set<string>;
}

function buildContext(store: MockStore): ListContext {
  const data = getContestData();
  return {
    store,
    today: data.today,
    rankById: new Map(
      computeRanking(data.today, store).map((entry) => [entry.participantId, entry.rank]),
    ),
    reelByParticipant: new Map(data.reels.map((reel) => [reel.participantId, reel])),
    // Ro'yxatdan chiqarilgan (yolg'on signal deb topilgan) targetlar hisobga olinmaydi.
    targetParticipants: activeTargetParticipants(store),
  };
}

/** Reelning oxirgi yig'ilgan ko'rishlari (kunlar xronologik tartibda saqlangan). */
function latestViews(reel: MockReel): number {
  let latest = 0;
  for (const views of reel.viewsByDay.values()) {
    latest = views;
  }
  return latest;
}

function toListItem(participant: MockParticipant, context: ListContext): ParticipantListItem {
  const reel = context.reelByParticipant.get(participant.id);
  const reelStatus = reel ? reelStatusOn(reel, context.today) : null;

  return {
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    age: participant.age,
    phone: participant.phone,
    instagramUsername: participant.instagramUsername,
    status: effectiveStatus(participant, context.store),
    registeredOn: participant.registeredOn,
    reel:
      reel && reelStatus ? { url: reel.url, status: reelStatus } : null,
    views: reel ? latestViews(reel) : 0,
    rank: context.rankById.get(participant.id) ?? null,
    hasTarget: context.targetParticipants.has(participant.id),
  };
}

// ---------------------------------------------------------------------------
// Qidiruv va saralash
// ---------------------------------------------------------------------------

function compareItems(
  a: ParticipantListItem,
  b: ParticipantListItem,
  sort: NonNullable<ParticipantListQuery["sort"]>,
  order: NonNullable<ParticipantListQuery["order"]>,
): number {
  const direction = order === "asc" ? 1 : -1;

  if (sort === "rank") {
    // Reytingda yo'qlar har doim oxirida.
    if (a.rank === null && b.rank === null) return a.id.localeCompare(b.id);
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return (a.rank - b.rank) * direction;
  }

  if (sort === "views") {
    return (a.views - b.views) * direction || a.id.localeCompare(b.id);
  }

  const byName =
    a.lastName.localeCompare(b.lastName, "uz") || a.firstName.localeCompare(b.firstName, "uz");
  return byName * direction || a.id.localeCompare(b.id);
}

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

export function listParticipants(query: ParticipantListQuery): ParticipantListResponse {
  const context = buildContext(readStore());
  const data = getContestData();

  let items = data.participants
    .map((participant) => toListItem(participant, context))
    .filter((item) => matchesPerson(item, query.search ?? ""));

  if (query.reel === "NONE") {
    items = items.filter((item) => item.reel === null);
  } else if (query.reel) {
    items = items.filter((item) => item.reel?.status === query.reel);
  }
  if (query.minViews !== undefined) items = items.filter((item) => item.views >= (query.minViews ?? 0));
  if (query.maxViews !== undefined) items = items.filter((item) => item.views <= (query.maxViews ?? Infinity));

  const statusCounts: ParticipantListResponse["statusCounts"] = {
    ALL: items.length,
    ACTIVE: 0,
    WARNED: 0,
    BLOCKED: 0,
    DISQUALIFIED: 0,
  };
  for (const item of items) {
    statusCounts[item.status] += 1;
  }

  if (query.status) {
    items = items.filter((item) => item.status === query.status);
  }

  const sort = query.sort ?? "rank";
  const order = query.order ?? (sort === "views" ? "desc" : "asc");
  items.sort((a, b) => compareItems(a, b, sort, order));

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

export function applyParticipantAction(
  participantId: string,
  action: ParticipantAction,
  reason: string,
  actor: AdminUser,
): ParticipantListItem {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < MIN_REASON_LENGTH) {
    throw new ApiError(400, `Sababni yozing (kamida ${MIN_REASON_LENGTH} ta belgi).`);
  }

  const participant = getContestData().participants.find((item) => item.id === participantId);
  if (!participant) {
    throw new ApiError(404, "Ishtirokchi topilmadi.");
  }

  const store = readStore();
  const current = effectiveStatus(participant, store);
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(current)) {
    throw new ApiError(409, "Bu amalni ishtirokchining hozirgi holatida bajarib bo'lmaydi.");
  }

  const nextStore: MockStore = {
    ...store,
    statusOverrides: { ...store.statusOverrides, [participant.id]: transition.to },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.fullName,
        action: `participant.${action}`,
        entity: "participant",
        entityId: participant.id,
        before: current,
        after: transition.to,
        reason: trimmedReason,
      },
    ],
  };
  writeStore(nextStore);

  return toListItem(participant, buildContext(nextStore));
}

// ---------------------------------------------------------------------------
// "Ko'rishlarni yangilash" (mock): tanlov backend bilan bir xil, yangilash taqlid qilinadi
// ---------------------------------------------------------------------------

/** Pastki chegaradan shuncha pastdagilar ham olinadi (backend: `reports/views-refresh.ts`). */
const NEAR_MARGIN = 0.2;
const MOCK_REFRESH_MS = 2500;

let mockRefresh: ViewsRefreshReport | null = null;

function refreshRange(request: ViewsRefreshRequest): { from: number | null; to: number | null } {
  const from =
    request.minViews === null
      ? null
      : request.includeNear
        ? Math.floor(request.minViews * (1 - NEAR_MARGIN))
        : request.minViews;
  return { from, to: request.maxViews };
}

function refreshIds(request: ViewsRefreshRequest): string[] {
  const context = buildContext(readStore());
  const { from, to } = refreshRange(request);
  return getContestData()
    .participants.map((participant) => toListItem(participant, context))
    .filter(
      (item) =>
        item.status !== "BLOCKED" &&
        item.status !== "DISQUALIFIED" &&
        item.reel?.status === "ACCEPTED" &&
        (from === null || item.views >= from) &&
        (to === null || item.views <= to),
    )
    .map((item) => item.id);
}

export function viewsRefreshPreview(request: ViewsRefreshRequest): ViewsRefreshPreview {
  const running = mockRefresh !== null && mockRefresh.finishedAt === null;
  return {
    count: refreshIds(request).length,
    range: refreshRange(request),
    // Mock'da ko'rishlar har kuni ertalab "yig'ilgan" deb olinadi.
    lastSyncAt: `${getContestData().today}T01:00:00.000Z`,
    running,
    lastReport: mockRefresh,
  };
}

/** Mock: Instagram yo'q — bir necha soniyadan keyin "hammasi yangilandi" deb tugaydi. */
export function startMockViewsRefresh(request: ViewsRefreshRequest): { started: boolean; count: number } {
  if (mockRefresh !== null && mockRefresh.finishedAt === null) {
    throw new ApiError(409, "Ko'rishlar hozir yig'ilmoqda — tugashini kuting.");
  }
  const count = refreshIds(request).length;
  if (count === 0) throw new ApiError(422, "Bu oraliqda yangilanadigan video yo'q.");
  const report: ViewsRefreshReport = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    requested: count,
    updated: 0,
    missing: 0,
    error: null,
  };
  mockRefresh = report;
  setTimeout(() => {
    mockRefresh = { ...report, finishedAt: new Date().toISOString(), updated: count };
  }, MOCK_REFRESH_MS);
  return { started: true, count };
}
