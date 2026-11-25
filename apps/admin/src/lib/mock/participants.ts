/**
 * MOCK backend: ishtirokchilar ro'yxati, ishtirokchi videolari va admin amallari
 * (bloklash, blokdan chiqarish, diskvalifikatsiya). Haqiqiy backendda:
 *   GET  /api/v1/admin/participants
 *   GET  /api/v1/admin/participants/:id/reels
 *   POST /api/v1/admin/participants/:id/{block|unblock|disqualify}
 */
import { ApiError } from "../api-error";
import type {
  AdminReelItem,
  AdminUser,
  IsoDate,
  ParticipantAction,
  ParticipantListItem,
  ParticipantListQuery,
  ParticipantListResponse,
  ParticipantReelCounts,
  ParticipantReels,
  ParticipantStatus,
  ReelStatus,
  ViewsRefreshPreview,
  ViewsRefreshReport,
  ViewsRefreshRequest,
} from "../types";
import {
  eventTime,
  getContestData,
  lastSnapshotDay,
  latestViews,
  reelStatusOn,
  type MockParticipant,
  type MockReel,
} from "./contest";
import { openManualReviewShortcodes } from "./manual-review";
import { computeRanking, computeVideoRanking, effectiveStatus } from "./ranking";
import { effectiveSettings, lastSyncAt } from "./settings";
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
  today: IsoDate;
  /** Ishtirokchi -> o'rni: eng ko'p ko'rilgan videosining bugungi reytingdagi o'rni. */
  rankById: Map<string, number>;
  /** Video (id) -> bugungi reytingdagi o'rni (har bir qabul qilingan video alohida qator). */
  rankByReel: Map<string, number>;
  /** Ishtirokchi -> videolari (yuborilish tartibida). */
  reelsByParticipant: Map<string, MockReel[]>;
  targetParticipants: Set<string>;
  /** Hozir qo'lda tekshiruvda turgan videolar (shortcode). */
  openReviews: Set<string>;
}

function buildContext(store: MockStore): ListContext {
  const data = getContestData();
  const reelsByParticipant = new Map<string, MockReel[]>();
  for (const reel of data.reels) {
    const list = reelsByParticipant.get(reel.participantId);
    if (list) list.push(reel);
    else reelsByParticipant.set(reel.participantId, [reel]);
  }
  return {
    store,
    today: data.today,
    rankById: new Map(
      computeRanking(data.today, store).map((entry) => [entry.participantId, entry.rank]),
    ),
    rankByReel: new Map(computeVideoRanking(data.today, store).map((entry) => [entry.reelId, entry.rank])),
    reelsByParticipant,
    // Ro'yxatdan chiqarilgan (yolg'on signal deb topilgan) targetlar hisobga olinmaydi.
    targetParticipants: activeTargetParticipants(store),
    openReviews: openManualReviewShortcodes(store),
  };
}

/** Videoning panelda ko'rinadigan holati: qo'lda tekshiruvdagisi — `PENDING` + `manualReview`. */
function reelState(reel: MockReel, context: ListContext): { status: ReelStatus; manualReview: boolean } {
  if (context.openReviews.has(reel.shortcode)) return { status: "PENDING", manualReview: true };
  return { status: reelStatusOn(reel, context.today) ?? "PENDING", manualReview: false };
}

/**
 * Ishtirokchining eng ko'p ko'rilgan qabul qilingan videosi (teng bo'lsa — oldinroq yuborilgani,
 * backend bilan bir xil) — uning natijasi va o'rni shu bo'yicha. Qabul qilingan video yo'q — null.
 */
function bestReel(reels: MockReel[], context: ListContext): MockReel | null {
  let best: MockReel | null = null;
  for (const reel of reels) {
    if (reelState(reel, context).status !== "ACCEPTED") continue;
    if (best === null || compareAccepted(reel, best) < 0) best = reel;
  }
  return best;
}

/** Qabul qilinganlar tartibi: ko'rishlar kamayishi bo'yicha, teng bo'lsa — oldinroq yuborilgani. */
function compareAccepted(a: MockReel, b: MockReel): number {
  return (
    latestViews(b) - latestViews(a) ||
    a.submittedAt.localeCompare(b.submittedAt) ||
    a.id.localeCompare(b.id)
  );
}

/** Ro'yxatdagi guruh: qabul qilinganlar, keyin tekshiruvdagilar, keyin rad etilgan / o'chirilganlar. */
const REEL_GROUP: Record<ReelStatus, number> = { ACCEPTED: 0, PENDING: 1, REJECTED: 2, REMOVED: 2 };

interface ReelSummary {
  counts: ParticipantReelCounts;
  /** Har bir videoning holati — Reel filtri uchun. */
  statuses: ReelStatus[];
  /** Eng ko'p ko'rilgan qabul qilingan video (ishtirokchi o'rni shu bo'yicha); yo'q — null. */
  best: MockReel | null;
  /** Shu videoning ko'rishlari (videolar ko'rishlari qo'shilmaydi); yo'q — 0. */
  views: number;
  /** Rad etilmagan videolardagi akkauntlar, birinchi aniqlangani boshida (takrorlanmaydi). */
  owners: string[];
}

function summarizeReels(participant: MockParticipant, context: ListContext): ReelSummary {
  const reels = context.reelsByParticipant.get(participant.id) ?? [];
  const counts: ParticipantReelCounts = { total: reels.length, accepted: 0, pending: 0, rejected: 0 };
  const statuses: ReelStatus[] = [];
  const owners: string[] = [];
  const best = bestReel(reels, context);

  for (const reel of reels) {
    const { status } = reelState(reel, context);
    statuses.push(status);
    if (status === "ACCEPTED") {
      counts.accepted += 1;
    } else if (status === "PENDING") {
      counts.pending += 1;
    } else if (status === "REJECTED") {
      counts.rejected += 1;
    }
    if (status !== "REJECTED" && reel.owner && !owners.includes(reel.owner)) {
      owners.push(reel.owner);
    }
  }

  return { counts, statuses, best, views: best ? latestViews(best) : 0, owners };
}

function toListItem(
  participant: MockParticipant,
  context: ListContext,
  summary: ReelSummary = summarizeReels(participant, context),
): ParticipantListItem {
  return {
    id: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    age: participant.age,
    phone: participant.phone,
    instagramUsername: summary.owners[0] ?? null,
    status: effectiveStatus(participant, context.store),
    registeredOn: participant.registeredOn,
    reels: summary.counts,
    views: summary.views,
    rank: context.rankById.get(participant.id) ?? null,
    hasTarget: context.targetParticipants.has(participant.id),
  };
}

// ---------------------------------------------------------------------------
// Ishtirokchi videolari
// ---------------------------------------------------------------------------

/** Tasdiqlash (birinchi tekshiruv) videoni yuborgandan shuncha keyin bo'ladi. */
const VERIFY_DELAY_MS = 20 * 60_000;

/** Ko'rishlar oxirgi marta yig'ilgan vaqt: kunlik yig'ish vaqti, birinchi kuni — tekshiruv vaqti. */
function lastSyncedAt(reel: MockReel, day: IsoDate, today: IsoDate, syncTime: string): string {
  const syncedAt =
    day === today ? lastSyncAt(today, syncTime) : new Date(`${day}T${syncTime}:00+05:00`).toISOString();
  const verifiedAt = Date.parse(reel.submittedAt) + VERIFY_DELAY_MS;
  const at = Math.min(Date.now(), Math.max(Date.parse(syncedAt), verifiedAt));
  return new Date(at).toISOString();
}

/** Instagramda joylangan vaqt — yuborilgan vaqtdan oldin. */
function postedAt(reel: MockReel): string {
  const at = eventTime(reel.postedOn, `posted:${reel.id}`, 7, 21);
  return at < reel.submittedAt ? at : new Date(Date.parse(reel.submittedAt) - 45 * 60_000).toISOString();
}

function toAdminReel(reel: MockReel, context: ListContext, syncTime: string, best: boolean): AdminReelItem {
  const { status, manualReview } = reelState(reel, context);
  const snapshotDay = lastSnapshotDay(reel);
  const views = latestViews(reel);
  return {
    shortcode: reel.shortcode,
    url: reel.url,
    status,
    manualReview,
    rejectReason: status === "REJECTED" ? reel.rejectReason : null,
    owner: reel.owner,
    views,
    // Reytingda faqat qabul qilingan videolar bor; har biri o'z o'rnida.
    rank: status === "ACCEPTED" ? (context.rankByReel.get(reel.id) ?? null) : null,
    likes: snapshotDay ? Math.round(views * reel.likeRate) : null,
    submittedAt: reel.submittedAt,
    // Joylangan vaqt Instagram videoni topgandagina ma'lum bo'ladi (akkaunt bilan birga).
    postedAt: reel.owner ? postedAt(reel) : null,
    lastSyncedAt: snapshotDay ? lastSyncedAt(reel, snapshotDay, context.today, syncTime) : null,
    flags: [...reel.flags],
    best,
  };
}

/**
 * "Videolar" oynasidagi tartib (backend bilan bir xil): qabul qilinganlar ko'rishlar kamayishi
 * bo'yicha (birinchisi — eng ko'p ko'rilgani, `best`), keyin tekshiruvdagilar, keyin rad etilgan va
 * o'chirilganlar; oxirgi ikkalasida eng yangisi birinchi.
 */
function compareForDisplay(a: MockReel, b: MockReel, context: ListContext): number {
  const groupA = REEL_GROUP[reelState(a, context).status];
  const groupB = REEL_GROUP[reelState(b, context).status];
  if (groupA !== groupB) return groupA - groupB;
  if (groupA === REEL_GROUP.ACCEPTED) return compareAccepted(a, b);
  return b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id);
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
  const reelFilter = query.reel;

  let items = data.participants
    .map((participant) => ({ participant, summary: summarizeReels(participant, context) }))
    // Qidiruv ishtirokchining barcha akkauntlari bo'yicha.
    .filter(({ participant, summary }) =>
      matchesPerson(
        { ...participant, instagramUsername: summary.owners.join(" ") || null },
        query.search ?? "",
      ),
    )
    // Reel filtri: kamida bitta videosi shu holatda; NONE — umuman video yo'q.
    .filter(({ summary }) =>
      !reelFilter
        ? true
        : reelFilter === "NONE"
          ? summary.counts.total === 0
          : summary.statuses.includes(reelFilter),
    )
    .map(({ participant, summary }) => toListItem(participant, context, summary));
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

export function getParticipantReels(participantId: string): ParticipantReels {
  const participant = getContestData().participants.find((item) => item.id === participantId);
  if (!participant) {
    throw new ApiError(404, "Ishtirokchi topilmadi.");
  }

  const context = buildContext(readStore());
  const summary = summarizeReels(participant, context);
  const { syncTime } = effectiveSettings(context.store);
  const reels = [...(context.reelsByParticipant.get(participant.id) ?? [])]
    .sort((a, b) => compareForDisplay(a, b, context))
    .map((reel) => toAdminReel(reel, context, syncTime, reel === summary.best));

  return {
    participant: {
      id: participant.id,
      fullName: `${participant.firstName} ${participant.lastName}`,
      instagramUsernames: summary.owners,
      phone: participant.phone,
      age: participant.age,
      status: effectiveStatus(participant, context.store),
      registeredOn: participant.registeredOn,
    },
    bestViews: summary.views,
    reels,
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

/** Tanlangan ishtirokchilarning qabul qilingan videolari soni (backend: `reports/views-refresh.ts`). */
function refreshVideoCount(request: ViewsRefreshRequest): number {
  const context = buildContext(readStore());
  const { from, to } = refreshRange(request);
  return getContestData()
    .participants.map((participant) => toListItem(participant, context))
    .filter(
      (item) =>
        item.status !== "BLOCKED" &&
        item.status !== "DISQUALIFIED" &&
        item.reels.accepted > 0 &&
        (from === null || item.views >= from) &&
        (to === null || item.views <= to),
    )
    .reduce((sum, item) => sum + item.reels.accepted, 0);
}

export function viewsRefreshPreview(request: ViewsRefreshRequest): ViewsRefreshPreview {
  const running = mockRefresh !== null && mockRefresh.finishedAt === null;
  return {
    count: refreshVideoCount(request),
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
  const count = refreshVideoCount(request);
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
