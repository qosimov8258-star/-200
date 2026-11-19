/**
 * MOCK backend: "Qo'lda tekshiruv" — Apify videoni ketma-ket 3 marta topa olmaganda video
 * shu ro'yxatga tushadi, admin linkni ochib tasdiqlaydi yoki rad etadi. Haqiqiy backendda:
 *   GET  /api/v1/admin/manual-reviews
 *   POST /api/v1/admin/manual-reviews/:id/decision
 * (`apps/backend/src/admin/admin-manual-review.controller.ts`)
 *
 * Mock'da holatlar tanlov ma'lumotlaridan olinadi: tekshiruvdagi Reellarning bir qismi —
 * "yangi video", Instagramdan o'chirilganlari — "reytingdagi video yo'qoldi". Admin qarori
 * faqat shu bo'limda saqlanadi (Foydalanuvchilar va Reytingga ta'sir qilmaydi).
 */
import { ApiError } from "../api-error";
import { addDays } from "../dates";
import type {
  AdminUser,
  ManualReviewDecisionRequest,
  ManualReviewItem,
  ManualReviewKind,
  ManualReviewListQuery,
  ManualReviewListResponse,
  ManualReviewStatus,
} from "../types";
import { getContestData, type MockParticipant, type MockReel } from "./contest";
import { mockAdmins } from "./db";
import { effectiveStatus } from "./ranking";
import { auditId, readStore, writeStore, type MockManualDecision, type MockStore } from "./store";
import { matchesPerson } from "./text";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_NOTE_LENGTH = 500;
/** Backenddagi `ATTEMPTS_BEFORE_MANUAL_REVIEW`. */
const ATTEMPTS = 3;
const OPEN_NEW = 4;
const OPEN_LOST = 2;
const DECIDED = 2;

interface SeedCase {
  reel: MockReel;
  participant: MockParticipant;
  kind: ManualReviewKind;
  requestedAt: string;
  lastViews: number | null;
  /** Namunaviy tarix uchun — oldinroq qaror qilingan holatlar. */
  initial: MockManualDecision | null;
}

/** Toshkent vaqtidagi sana va soatni UTC ISO ga. */
const tashkentIso = (date: string, time: string) => new Date(`${date}T${time}:00+05:00`).toISOString();

function latestViews(reel: MockReel): number | null {
  let latest: number | null = null;
  for (const views of reel.viewsByDay.values()) latest = views;
  return latest;
}

let seedCache: { today: string; cases: SeedCase[] } | null = null;

function seedCases(): SeedCase[] {
  const data = getContestData();
  if (seedCache?.today === data.today) return seedCache.cases;

  const participants = new Map(data.participants.map((p) => [p.id, p]));
  const cases: SeedCase[] = [];
  const pending = data.reels.filter((reel) => reel.reviewedOn === null);
  const removed = data.reels.filter((reel) => reel.removedOn !== null);
  const admin = mockAdmins.find((item) => item.role === "ADMIN")?.fullName ?? "Admin";

  pending.slice(0, OPEN_NEW + DECIDED).forEach((reel, index) => {
    const participant = participants.get(reel.participantId);
    if (!participant) return;
    const requestedAt = tashkentIso(reel.submittedOn, `1${index}:2${index}`);
    const decided = index >= OPEN_NEW;
    cases.push({
      reel,
      participant,
      kind: "NEW_REEL",
      requestedAt,
      lastViews: null,
      initial: decided
        ? {
            approved: index === OPEN_NEW,
            reason: index === OPEN_NEW ? null : "NOT_FOUND",
            note: index === OPEN_NEW ? "Video ochiq, mahsulot ko'rinadi" : "Akkaunt yopiq",
            at: new Date(new Date(requestedAt).getTime() + 3 * 3_600_000).toISOString(),
            by: admin,
          }
        : null,
    });
  });

  removed.slice(0, OPEN_LOST).forEach((reel) => {
    const participant = participants.get(reel.participantId);
    if (!participant || !reel.removedOn) return;
    cases.push({
      reel,
      participant,
      kind: "LOST_REEL",
      // Uchinchi muvaffaqiyatsiz kunlik yig'ish.
      requestedAt: tashkentIso(addDays(reel.removedOn, 2), "06:05"),
      lastViews: latestViews(reel),
      initial: null,
    });
  });

  seedCache = { today: data.today, cases };
  return cases;
}

function decisionOf(seed: SeedCase, store: MockStore): MockManualDecision | null {
  return store.manualReviews[seed.reel.shortcode] ?? seed.initial;
}

function statusOf(decision: MockManualDecision | null): ManualReviewStatus {
  if (!decision) return "OPEN";
  return decision.approved ? "APPROVED" : "REJECTED";
}

function toItem(seed: SeedCase, store: MockStore): ManualReviewItem {
  const decision = decisionOf(seed, store);
  return {
    id: seed.reel.shortcode,
    participant: {
      id: seed.participant.id,
      firstName: seed.participant.firstName,
      lastName: seed.participant.lastName,
      phone: seed.participant.phone,
      status: effectiveStatus(seed.participant, store),
    },
    reelUrl: seed.reel.url,
    shortcode: seed.reel.shortcode,
    kind: seed.kind,
    attempts: ATTEMPTS,
    requestedAt: seed.requestedAt,
    submittedAt: tashkentIso(seed.reel.submittedOn, "09:00"),
    lastViews: seed.lastViews,
    owner: seed.kind === "LOST_REEL" ? seed.participant.instagramUsername : null,
    status: statusOf(decision),
    decision: decision
      ? { at: decision.at, by: decision.by, reason: decision.reason, note: decision.note }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

export function listManualReviews(query: ManualReviewListQuery): ManualReviewListResponse {
  const store = readStore();
  const search = query.search ?? "";
  const all = seedCases()
    .map((seed) => toItem(seed, store))
    .filter(
      (item) =>
        matchesPerson({ ...item.participant, instagramUsername: item.owner }, search, item.shortcode),
    );

  const statusCounts: ManualReviewListResponse["statusCounts"] = {
    ALL: all.length,
    OPEN: all.filter((item) => item.status === "OPEN").length,
    APPROVED: all.filter((item) => item.status === "APPROVED").length,
    REJECTED: all.filter((item) => item.status === "REJECTED").length,
  };

  // Ochiqlar — navbat bo'yicha (eng eskisi yuqorida); qaror qilinganlar — eng yangisi yuqorida.
  const items = all
    .filter((item) => !query.status || item.status === query.status)
    .sort((a, b) => {
      if (a.status === "OPEN" && b.status === "OPEN") return a.requestedAt.localeCompare(b.requestedAt);
      if (a.status === "OPEN") return -1;
      if (b.status === "OPEN") return 1;
      return (b.decision?.at ?? "").localeCompare(a.decision?.at ?? "");
    });

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

export function decideManualReview(
  id: string,
  request: ManualReviewDecisionRequest,
  actor: AdminUser,
): ManualReviewItem {
  const note = (request.note ?? "").trim();
  if (note.length > MAX_NOTE_LENGTH) {
    throw new ApiError(400, `Izoh ko'pi bilan ${MAX_NOTE_LENGTH} ta belgi.`);
  }
  if (request.decision === "reject" && !request.reason) {
    throw new ApiError(400, "Rad etish sababini tanlang.");
  }

  const seed = seedCases().find((item) => item.reel.shortcode === id);
  if (!seed) throw new ApiError(404, "Video topilmadi.");

  const store = readStore();
  if (decisionOf(seed, store)) {
    throw new ApiError(409, "Bu video bo'yicha qaror allaqachon qabul qilingan.");
  }

  const at = new Date().toISOString();
  const approved = request.decision === "approve";
  const decision: MockManualDecision = {
    approved,
    reason: request.decision === "reject" ? request.reason : null,
    note,
    at,
    by: actor.fullName,
  };

  const next: MockStore = {
    ...store,
    manualReviews: { ...store.manualReviews, [id]: decision },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at,
        actorId: actor.id,
        actorName: actor.fullName,
        action: approved ? "manual_review.approve" : "manual_review.reject",
        entity: "reel",
        entityId: id,
        before: "PENDING",
        after: approved ? "ACCEPTED" : "REJECTED",
        reason: [request.decision === "reject" ? request.reason : null, note].filter(Boolean).join(" — "),
      },
    ],
  };
  writeStore(next);
  return toItem(seed, next);
}
