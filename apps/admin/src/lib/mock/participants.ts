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
import { computeRanking, effectiveStatus } from "./ranking";
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
  rankById: Map<string, number>;
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

interface ReelSummary {
  counts: ParticipantReelCounts;
  /** Har bir videoning holati — Reel filtri uchun. */
  statuses: ReelStatus[];
  /** Qabul qilingan videolar ko'rishlari yig'indisi. */
  views: number;
  /** Rad etilmagan videolardagi akkauntlar, birinchi aniqlangani boshida (takrorlanmaydi). */
  owners: string[];
}

function summarizeReels(participant: MockParticipant, context: ListContext): ReelSummary {
  const reels = context.reelsByParticipant.get(participant.id) ?? [];
  const counts: ParticipantReelCounts = { total: reels.length, accepted: 0, pending: 0, rejected: 0 };
  const statuses: ReelStatus[] = [];
  const owners: string[] = [];
  let views = 0;

  for (const reel of reels) {
    const { status } = reelState(reel, context);
    statuses.push(status);
    if (status === "ACCEPTED") {
      counts.accepted += 1;
      views += latestViews(reel);
    } else if (status === "PENDING") {
      counts.pending += 1;
    } else if (status === "REJECTED") {
      counts.rejected += 1;
    }
    if (status !== "REJECTED" && reel.owner && !owners.includes(reel.owner)) {
      owners.push(reel.owner);
    }
  }

  return { counts, statuses, views, owners };
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

function toAdminReel(reel: MockReel, context: ListContext, syncTime: string): AdminReelItem {
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
    likes: snapshotDay ? Math.round(views * reel.likeRate) : null,
    submittedAt: reel.submittedAt,
    // Joylangan vaqt Instagram videoni topgandagina ma'lum bo'ladi (akkaunt bilan birga).
    postedAt: reel.owner ? postedAt(reel) : null,
    lastSyncedAt: snapshotDay ? lastSyncedAt(reel, snapshotDay, context.today, syncTime) : null,
    flags: [...reel.flags],
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
  const reels = (context.reelsByParticipant.get(participant.id) ?? [])
    .map((reel) => ({ id: reel.id, item: toAdminReel(reel, context, syncTime) }))
    // Eng yangisi birinchi.
    .sort((a, b) => b.item.submittedAt.localeCompare(a.item.submittedAt) || b.id.localeCompare(a.id))
    .map(({ item }) => item);

  return {
    participant: {
      id: participant.id,
      fullName: `${participant.firstName} ${participant.lastName}`,
      instagramUsernames: summary.owners,
    },
    totalViews: summary.views,
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
