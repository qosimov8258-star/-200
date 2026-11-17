/**
 * MOCK backend: g'olibni aniqlash (TZ 5.3). Haqiqiy backendda:
 *   GET    /api/v1/admin/winner
 *   PUT    /api/v1/admin/winner/purchase-check
 *   POST   /api/v1/admin/winner/skip
 *   POST   /api/v1/admin/winner/confirm
 *   DELETE /api/v1/admin/winner/confirm
 *   POST   /api/v1/admin/winner/announce
 */
import { ApiError } from "../api-error";
import { diffDays, eachDay } from "../dates";
import { formatDate, formatNumber } from "../format";
import type {
  AdminUser,
  IsoDate,
  WinnerCandidate,
  WinnerCheck,
  WinnerOverview,
  WinnerPurchaseCheckRequest,
  WinnerSkipRequest,
  WinnerStage,
} from "../types";
import { getContestData, reelStatusOn, type MockReel } from "./contest";
import { computeRanking, type MockRankingEntry } from "./ranking";
import { effectiveSettings } from "./settings";
import { auditId, readStore, writeStore, type MockAuditEntry, type MockStore } from "./store";
import { targetCaseStatus } from "./targets";

/** Bir kunlik o'sish odatdagidan (mediana) shuncha marta ko'p bo'lsa — soxta ko'rish shubhasi. */
const FAKE_VIEWS_RATIO = 6;
const RUNNERS_UP_COUNT = 4;
const MIN_TEXT_LENGTH = 5;

// ---------------------------------------------------------------------------
// Tanlov holati
// ---------------------------------------------------------------------------

function contestInfo(store: MockStore): WinnerOverview["contest"] {
  const data = getContestData();
  // Tanlov muddati Sozlamalar bo'limida o'zgartirilishi mumkin.
  const { startsOn, endsOn } = effectiveSettings(store);
  const ended = store.winner.contestEnded || data.today > endsOn;
  return {
    startsOn,
    endsOn,
    ended,
    daysLeft: ended ? 0 : Math.max(0, diffDays(data.today, endsOn)),
    // Mock'da "tugadi" tugmasi bosilsa, yakuniy reyting — bugungi reyting.
    ratingDate: data.today < endsOn ? data.today : endsOn,
  };
}

// ---------------------------------------------------------------------------
// Avtomatik tekshiruvlar
// ---------------------------------------------------------------------------

function targetIssue(participantId: string, store: MockStore): string | null {
  const target = getContestData().targets.find(
    (item) => item.participantId === participantId && targetCaseStatus(item, store) !== "DISMISSED",
  );
  return target ? `Target aniqlangan: ${formatDate(target.detectedOn)}` : null;
}

function reelIssue(reel: MockReel, date: IsoDate): string | null {
  const status = reelStatusOn(reel, date);
  if (status === "REMOVED") return "Reel Instagramdan o'chirilgan";
  if (status !== "ACCEPTED") return "Reel qabul qilinmagan";
  return null;
}

function fakeViewsIssue(reel: MockReel, date: IsoDate): string | null {
  const days = reel.reviewedOn ? eachDay(reel.reviewedOn, date) : [];
  const growth = days
    .map((day) => ({ day, value: reel.growthByDay.get(day) ?? 0 }))
    .filter((item) => item.value > 0);
  if (growth.length < 3) return null;

  const sorted = growth.map((item) => item.value).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const peak = growth.reduce((best, item) => (item.value > best.value ? item : best));
  const ratio = median > 0 ? peak.value / median : 0;

  return ratio >= FAKE_VIEWS_RATIO
    ? `Keskin o'sish: ${formatDate(peak.day)} (+${formatNumber(peak.value)}, odatdagidan ${Math.round(ratio)}×)`
    : null;
}

function buildChecks(participantId: string, reel: MockReel, date: IsoDate, store: MockStore): WinnerCheck[] {
  const target = targetIssue(participantId, store);
  const reelProblem = reelIssue(reel, date);
  const fakeViews = fakeViewsIssue(reel, date);
  const purchase = store.winner.purchaseChecks[participantId];

  return [
    {
      key: "NO_TARGET",
      status: target ? "FAILED" : "PASSED",
      detail: target ?? "Target (pullik reklama) aniqlanmagan",
      manual: false,
    },
    {
      key: "REEL_AVAILABLE",
      status: reelProblem ? "FAILED" : "PASSED",
      detail: reelProblem ?? "Reel Instagramda mavjud va ochiq",
      manual: false,
    },
    {
      key: "NO_FAKE_VIEWS",
      status: fakeViews ? "FAILED" : "PASSED",
      detail: fakeViews ?? "Ko'rishlar o'sishida g'ayritabiiy sakrash yo'q",
      manual: false,
    },
    {
      key: "PURCHASE_CONFIRMED",
      status: purchase ? (purchase.passed ? "PASSED" : "FAILED") : "PENDING",
      detail: purchase
        ? `${purchase.note} — ${purchase.by}`
        : "Chek yoki xarid hujjatini qo'lda tekshiring (PLAN.md Q4)",
      manual: true,
    },
  ];
}

function automaticIssues(participantId: string, reel: MockReel, date: IsoDate, store: MockStore): string[] {
  return [targetIssue(participantId, store), reelIssue(reel, date), fakeViewsIssue(reel, date)].filter(
    (issue): issue is string => issue !== null,
  );
}

// ---------------------------------------------------------------------------
// Umumiy ko'rinish
// ---------------------------------------------------------------------------

interface Computed {
  overview: WinnerOverview;
  ranking: MockRankingEntry[];
}

function stageOf(store: MockStore, ended: boolean): WinnerStage {
  if (!ended) return "NOT_STARTED";
  if (store.winner.announced) return "ANNOUNCED";
  if (store.winner.confirmed) return "CONFIRMED";
  return "CANDIDATE";
}

function compute(store: MockStore): Computed {
  const data = getContestData();
  const contest = contestInfo(store);
  const participants = new Map(data.participants.map((item) => [item.id, item]));
  const reels = new Map(data.reels.map((reel) => [reel.id, reel]));
  const skippedIds = new Set(store.winner.skipped.map((item) => item.participantId));

  const ranking = computeRanking(contest.ratingDate, store).filter(
    (entry) => !skippedIds.has(entry.participantId),
  );

  // Tasdiqlangan g'olib reyting keyin o'zgarsa ham o'zgarmaydi.
  const confirmedId = store.winner.confirmed?.participantId;
  const candidateEntry =
    (confirmedId && ranking.find((entry) => entry.participantId === confirmedId)) || ranking[0];

  let candidate: WinnerCandidate | null = null;
  if (candidateEntry) {
    const participant = participants.get(candidateEntry.participantId);
    const reel = reels.get(candidateEntry.reelId);
    if (participant && reel) {
      candidate = {
        participant: {
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          age: participant.age,
          phone: participant.phone,
          instagramUsername: participant.instagramUsername,
        },
        rank: candidateEntry.rank,
        views: candidateEntry.views,
        reelUrl: reel.url,
        checks: buildChecks(participant.id, reel, contest.ratingDate, store),
      };
    }
  }

  const runnersUp = ranking
    .filter((entry) => entry.participantId !== candidateEntry?.participantId)
    .slice(0, RUNNERS_UP_COUNT)
    .flatMap((entry) => {
      const participant = participants.get(entry.participantId);
      const reel = reels.get(entry.reelId);
      if (!participant || !reel) return [];
      return [
        {
          rank: entry.rank,
          participantId: participant.id,
          name: `${participant.firstName} ${participant.lastName}`,
          views: entry.views,
          issues: automaticIssues(participant.id, reel, contest.ratingDate, store),
        },
      ];
    });

  const nameOf = (id: string) => {
    const participant = participants.get(id);
    return participant ? `${participant.firstName} ${participant.lastName}` : id;
  };

  return {
    ranking,
    overview: {
      contest,
      stage: stageOf(store, contest.ended),
      candidate,
      runnersUp,
      skipped: store.winner.skipped.map((item) => ({ ...item, name: nameOf(item.participantId) })),
      confirmed: store.winner.confirmed
        ? { at: store.winner.confirmed.at, by: store.winner.confirmed.by }
        : null,
      announced: store.winner.announced,
    },
  };
}

// ---------------------------------------------------------------------------
// Tekshiruvlar va amallar
// ---------------------------------------------------------------------------

function auditEntry(actor: AdminUser, action: string, entityId: string, before: string, after: string, reason: string): MockAuditEntry {
  return {
    id: auditId(),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.fullName,
    action: `winner.${action}`,
    entity: "winner",
    entityId,
    before,
    after,
    reason,
  };
}

function requireText(value: string, what: string): string {
  const trimmed = value.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new ApiError(400, `${what}ni yozing (kamida ${MIN_TEXT_LENGTH} ta belgi).`);
  }
  return trimmed;
}

/** Amal joriy nomzod uchun va to'g'ri bosqichda bajarilayotganini tekshirish. */
function requireCandidate(overview: WinnerOverview, participantId: string, stage: WinnerStage): void {
  if (!overview.contest.ended) {
    throw new ApiError(409, "Tanlov hali tugamagan.");
  }
  if (overview.stage !== stage) {
    throw new ApiError(409, "Bu amalni hozirgi bosqichda bajarib bo'lmaydi.");
  }
  if (overview.candidate?.participant.id !== participantId) {
    throw new ApiError(409, "Nomzod o'zgargan. Sahifani yangilang.");
  }
}

export function getWinnerOverview(): WinnerOverview {
  return compute(readStore()).overview;
}

export function setPurchaseCheck(request: WinnerPurchaseCheckRequest, actor: AdminUser): WinnerOverview {
  const note = requireText(request.note, "Izoh");
  const store = readStore();
  if (store.winner.announced) {
    throw new ApiError(409, "G'olib allaqachon e'lon qilingan.");
  }
  if (!getContestData().participants.some((item) => item.id === request.participantId)) {
    throw new ApiError(404, "Ishtirokchi topilmadi.");
  }

  const at = new Date().toISOString();
  const previous = store.winner.purchaseChecks[request.participantId];
  const nextStore: MockStore = {
    ...store,
    winner: {
      ...store.winner,
      purchaseChecks: {
        ...store.winner.purchaseChecks,
        [request.participantId]: { passed: request.passed, note, at, by: actor.fullName },
      },
    },
    audit: [
      ...store.audit,
      auditEntry(
        actor,
        "purchase_check",
        request.participantId,
        previous ? (previous.passed ? "PASSED" : "FAILED") : "PENDING",
        request.passed ? "PASSED" : "FAILED",
        note,
      ),
    ],
  };
  writeStore(nextStore);
  return compute(nextStore).overview;
}

export function skipCandidate(request: WinnerSkipRequest, actor: AdminUser): WinnerOverview {
  const reason = requireText(request.reason, "Sabab");
  const store = readStore();
  requireCandidate(compute(store).overview, request.participantId, "CANDIDATE");

  const at = new Date().toISOString();
  const nextStore: MockStore = {
    ...store,
    winner: {
      ...store.winner,
      skipped: [
        ...store.winner.skipped,
        { participantId: request.participantId, reason, at, by: actor.fullName },
      ],
    },
    audit: [...store.audit, auditEntry(actor, "skip", request.participantId, "CANDIDATE", "SKIPPED", reason)],
  };
  writeStore(nextStore);
  return compute(nextStore).overview;
}

export function confirmWinner(participantId: string, actor: AdminUser): WinnerOverview {
  const store = readStore();
  const { overview } = compute(store);
  requireCandidate(overview, participantId, "CANDIDATE");
  if (overview.candidate?.checks.some((check) => check.status !== "PASSED")) {
    throw new ApiError(409, "Tekshiruv ro'yxatidagi barcha bandlar o'tishi kerak.");
  }

  const at = new Date().toISOString();
  const nextStore: MockStore = {
    ...store,
    winner: { ...store.winner, confirmed: { participantId, at, by: actor.fullName } },
    audit: [...store.audit, auditEntry(actor, "confirm", participantId, "CANDIDATE", "CONFIRMED", "")],
  };
  writeStore(nextStore);
  return compute(nextStore).overview;
}

export function cancelWinnerConfirmation(actor: AdminUser): WinnerOverview {
  const store = readStore();
  const confirmed = store.winner.confirmed;
  if (!confirmed || store.winner.announced) {
    throw new ApiError(409, "Bekor qilinadigan tasdiq yo'q.");
  }

  const nextStore: MockStore = {
    ...store,
    winner: { ...store.winner, confirmed: null },
    audit: [...store.audit, auditEntry(actor, "unconfirm", confirmed.participantId, "CONFIRMED", "CANDIDATE", "")],
  };
  writeStore(nextStore);
  return compute(nextStore).overview;
}

export function announceWinner(actor: AdminUser): WinnerOverview {
  const store = readStore();
  const confirmed = store.winner.confirmed;
  if (!confirmed || store.winner.announced) {
    throw new ApiError(409, "Avval g'olibni tasdiqlang.");
  }

  const at = new Date().toISOString();
  const nextStore: MockStore = {
    ...store,
    winner: { ...store.winner, announced: { at, by: actor.fullName } },
    audit: [...store.audit, auditEntry(actor, "announce", confirmed.participantId, "CONFIRMED", "ANNOUNCED", "")],
  };
  writeStore(nextStore);
  return compute(nextStore).overview;
}

/**
 * Faqat mock: tanlovni tugagan / davom etayotgan deb belgilash. "Davom etmoqda"ga
 * qaytarilganda g'olib oqimi (rad etilganlar, tasdiq, e'lon) qayta boshlanadi.
 */
export function setMockContestEnded(ended: boolean): void {
  const store = readStore();
  writeStore({
    ...store,
    winner: ended
      ? { ...store.winner, contestEnded: true }
      : { ...store.winner, contestEnded: false, skipped: [], confirmed: null, announced: null },
  });
}
