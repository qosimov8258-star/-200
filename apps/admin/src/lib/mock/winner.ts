/**
 * MOCK backend: g'olibni aniqlash (TZ 5.3). Haqiqiy backendda:
 *   GET    /api/v1/admin/winner
 *   PUT    /api/v1/admin/winner/manual-check
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
  WinnerManualCheckKey,
  WinnerManualCheckRequest,
  WinnerOverview,
  WinnerSkipRequest,
  WinnerStage,
} from "../types";
import { getContestData, reelStatusOn, type MockReel } from "./contest";
import { computeRanking, type MockRankingEntry } from "./ranking";
import { effectiveSettings } from "./settings";
import {
  auditId,
  readStore,
  writeStore,
  type MockAuditEntry,
  type MockManualCheck,
  type MockStore,
  type MockWinnerState,
} from "./store";
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

/** Reytingda hisobga olingan videolar: o'chirilgani bormi, qabul qilingani bormi. */
function reelIssue(reels: MockReel[], date: IsoDate): string | null {
  const statuses = reels.map((reel) => reelStatusOn(reel, date));
  const removed = statuses.filter((status) => status === "REMOVED").length;
  if (removed > 0) return `${removed} ta video Instagramdan o'chirilgan`;
  if (!statuses.includes("ACCEPTED")) return "Qabul qilingan video yo'q";
  return null;
}

/** Hisobga olingan videolardan birida g'ayritabiiy sakrash bo'lsa — birinchisi. */
function fakeViewsIssue(reels: MockReel[], date: IsoDate): string | null {
  for (const reel of reels) {
    const issue = reelFakeViewsIssue(reel, date);
    if (issue) return reels.length > 1 ? `Video ${reel.shortcode}: ${issue}` : issue;
  }
  return null;
}

function reelFakeViewsIssue(reel: MockReel, date: IsoDate): string | null {
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

/** Qo'lda belgilanadigan bandlar store'da qayerda saqlanadi. */
const MANUAL_CHECK_FIELDS = {
  PURCHASE_CONFIRMED: "purchaseChecks",
  AD_TOOLS_REVIEWED: "adToolsChecks",
} as const satisfies Record<WinnerManualCheckKey, keyof MockWinnerState>;

const MANUAL_CHECK_AUDIT: Record<WinnerManualCheckKey, string> = {
  PURCHASE_CONFIRMED: "purchase_check",
  AD_TOOLS_REVIEWED: "ad_tools_check",
};

function manualChecks(store: MockStore, key: WinnerManualCheckKey): Record<string, MockManualCheck> {
  // Eski mock yozuvlarida `adToolsChecks` bo'lmasligi mumkin.
  return store.winner[MANUAL_CHECK_FIELDS[key]] ?? {};
}

function manualCheck(
  key: WinnerManualCheckKey,
  result: MockManualCheck | undefined,
  pendingDetail: string,
): WinnerCheck {
  return {
    key,
    status: result ? (result.passed ? "PASSED" : "FAILED") : "PENDING",
    detail: result ? `${result.note} — ${result.by}` : pendingDetail,
    manual: true,
  };
}

/** `reels` — nomzodning reytingda hisobga olingan videolari. */
function buildChecks(participantId: string, reels: MockReel[], date: IsoDate, store: MockStore): WinnerCheck[] {
  const target = targetIssue(participantId, store);
  const reelProblem = reelIssue(reels, date);
  const fakeViews = fakeViewsIssue(reels, date);

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
      detail: reelProblem ?? "Videolar Instagramda mavjud va ochiq",
      manual: false,
    },
    {
      key: "NO_FAKE_VIEWS",
      status: fakeViews ? "FAILED" : "PASSED",
      detail: fakeViews ?? "Ko'rishlar o'sishida g'ayritabiiy sakrash yo'q",
      manual: false,
    },
    manualCheck(
      "PURCHASE_CONFIRMED",
      manualChecks(store, "PURCHASE_CONFIRMED")[participantId],
      "Chek yoki xarid hujjatini qo'lda tekshiring (PLAN.md Q4)",
    ),
    manualCheck(
      "AD_TOOLS_REVIEWED",
      manualChecks(store, "AD_TOOLS_REVIEWED")[participantId],
      "Uchrashuvda g'olib telefonida Instagram → Professional panel → \"Reklama vositalari\" (reklama tarixi) bo'limini ko'ring",
    ),
  ];
}

function automaticIssues(participantId: string, reels: MockReel[], date: IsoDate, store: MockStore): string[] {
  return [targetIssue(participantId, store), reelIssue(reels, date), fakeViewsIssue(reels, date)].filter(
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
  const reelsById = new Map(data.reels.map((reel) => [reel.id, reel]));
  const reelsOf = (entry: MockRankingEntry): MockReel[] =>
    entry.reelIds.flatMap((id) => reelsById.get(id) ?? []);
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
    const reel = reelsById.get(candidateEntry.topReelId);
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
        checks: buildChecks(participant.id, reelsOf(candidateEntry), contest.ratingDate, store),
      };
    }
  }

  const runnersUp = ranking
    .filter((entry) => entry.participantId !== candidateEntry?.participantId)
    .slice(0, RUNNERS_UP_COUNT)
    .flatMap((entry) => {
      const participant = participants.get(entry.participantId);
      if (!participant) return [];
      return [
        {
          rank: entry.rank,
          participantId: participant.id,
          name: `${participant.firstName} ${participant.lastName}`,
          views: entry.views,
          issues: automaticIssues(participant.id, reelsOf(entry), contest.ratingDate, store),
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

export function setManualCheck(request: WinnerManualCheckRequest, actor: AdminUser): WinnerOverview {
  if (!(request.check in MANUAL_CHECK_FIELDS)) {
    throw new ApiError(400, "Tekshiruv bandi noto'g'ri.");
  }
  const note = requireText(request.note, "Izoh");
  const store = readStore();
  if (store.winner.announced) {
    throw new ApiError(409, "G'olib allaqachon e'lon qilingan.");
  }
  if (!getContestData().participants.some((item) => item.id === request.participantId)) {
    throw new ApiError(404, "Ishtirokchi topilmadi.");
  }

  const at = new Date().toISOString();
  const checks = manualChecks(store, request.check);
  const previous = checks[request.participantId];
  const nextStore: MockStore = {
    ...store,
    winner: {
      ...store.winner,
      [MANUAL_CHECK_FIELDS[request.check]]: {
        ...checks,
        [request.participantId]: { passed: request.passed, note, at, by: actor.fullName },
      },
    },
    audit: [
      ...store.audit,
      auditEntry(
        actor,
        MANUAL_CHECK_AUDIT[request.check],
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
