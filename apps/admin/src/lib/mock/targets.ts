/**
 * MOCK backend: "Target yoqqanlar" ro'yxati (TZ 4, 5.2, 6-bo'limlar). Haqiqiy backendda
 * (`apps/backend/src/admin/admin-targets.controller.ts`):
 *   GET  /api/v1/admin/targets
 *   GET  /api/v1/admin/targets/check
 *   POST /api/v1/admin/targets/check
 *   GET  /api/v1/admin/targets/:id
 *   POST /api/v1/admin/targets/:id/resolve
 *
 * Target uch qatlamda aniqlanadi: (1) Meta reklama kutubxonasi — reyting yetakchilari har kuni
 * Apify orqali tekshiriladi; (2) ko'rishlar o'sishi tahlili; (3) g'olib bilan yuzma-yuz
 * uchrashuvda Instagram "Reklama vositalari" bo'limi ko'riladi (G'olib bo'limi).
 */
import { ApiError } from "../api-error";
import { addDays, clampDate, diffDays, eachDay } from "../dates";
import { formatCompact, formatDate, formatNumber } from "../format";
import type {
  AdminUser,
  IsoDate,
  ParticipantStatus,
  TargetAction,
  TargetAdsCheckReport,
  TargetCheckStatus,
  TargetCaseDetail,
  TargetCaseListItem,
  TargetCaseListQuery,
  TargetCaseListResponse,
  TargetCaseStatus,
  TargetState,
  TargetStatusFilter,
} from "../types";
import {
  BOOST_END_OFFSET,
  getContestData,
  isBoostDay,
  latestViews,
  type MockParticipant,
  type MockReel,
  type MockTargetDetection,
} from "./contest";
import { computeRanking, effectiveStatus } from "./ranking";
import { effectiveSettings } from "./settings";
import { auditId, readStore, writeStore, type MockAuditEntry, type MockStore } from "./store";
import { matchesPerson } from "./text";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MIN_REASON_LENGTH = 5;
/** Reklama kutubxonasida reytingning nechta yetakchisi tekshiriladi (backend: TARGET_CHECK_TOP). */
export const TARGET_CHECK_TOP = 30;
/** Tanlov boshidan necha kunda bir avtomatik tekshiriladi — oyiga bir marta (backend: TARGET_CHECK_EVERY_DAYS). */
export const TARGET_CHECK_EVERY_DAYS = 30;

/** Har bir amal qaysi holatlardan qaysi holatga o'tkazadi. */
const CASE_TRANSITIONS: Record<TargetAction, { from: TargetCaseStatus[]; to: TargetCaseStatus }> = {
  warn: { from: ["NEW"], to: "WARNED" },
  disqualify: { from: ["NEW", "WARNED"], to: "DISQUALIFIED" },
  dismiss: { from: ["NEW", "WARNED"], to: "DISMISSED" },
};

// ---------------------------------------------------------------------------
// Boshqa mock modullar uchun
// ---------------------------------------------------------------------------

/** Target holatining hozirgi ko'rib chiqilish holati (admin qarori bilan). */
export function targetCaseStatus(target: MockTargetDetection, store: MockStore): TargetCaseStatus {
  return store.targetCaseStatus[target.id] ?? target.status;
}

/**
 * Targeti aniqlangan va ro'yxatdan chiqarilmagan ishtirokchilar.
 * `date` berilsa — shu kungacha aniqlanganlar.
 */
export function activeTargetParticipants(store: MockStore, date?: IsoDate): Set<string> {
  return new Set(
    getContestData()
      .targets.filter(
        (target) =>
          targetCaseStatus(target, store) !== "DISMISSED" &&
          (date === undefined || target.detectedOn <= date),
      )
      .map((target) => target.participantId),
  );
}

// ---------------------------------------------------------------------------
// Dalil va tarix
// ---------------------------------------------------------------------------

function growthOn(reel: MockReel, date: IsoDate): number {
  return reel.growthByDay.get(date) ?? 0;
}

function evidenceFor(target: MockTargetDetection, reel: MockReel): string {
  switch (target.method) {
    case "AD_LIBRARY":
      return `Meta reklama kutubxonasi: 1 ta faol reklama (${formatDate(addDays(target.detectedOn, -1))} dan)`;
    case "REPORT": {
      const people = new Set(target.reports.map((report) => report.reporterId)).size;
      return `Ishtirokchilar shikoyati: ${target.reports.length} ta skrinshot (${people} kishidan)`;
    }
    case "GROWTH_ANALYSIS": {
      const spike = growthOn(reel, target.detectedOn);
      // Taqqoslash uchun reklamadan oldingi 3 kun.
      const baselineDays = [2, 3, 4]
        .map((offset) => addDays(target.detectedOn, -offset))
        .filter((date) => reel.growthByDay.has(date));
      const baseline =
        baselineDays.reduce((sum, date) => sum + growthOn(reel, date), 0) /
        Math.max(1, baselineDays.length);
      if (baselineDays.length === 0 || baseline <= 0) {
        return `Keskin o'sish: bir kunda +${formatNumber(spike)} ko'rish`;
      }
      return `Kunlik o'sish ${Math.round(spike / baseline)}× oshgan (${formatCompact(baseline)} → ${formatCompact(spike)})`;
    }
  }
}

function historyFor(
  target: MockTargetDetection,
  reel: MockReel,
  today: IsoDate,
): TargetCaseDetail["history"] {
  const history: TargetCaseDetail["history"] = [];
  const firstCheck = reel.reviewedOn ?? target.detectedOn;

  history.push({ date: firstCheck, state: "OFF", note: "Reel qabul qilindi, birinchi tekshiruv" });

  const suspicionDay = addDays(target.detectedOn, -1);
  if (target.method === "GROWTH_ANALYSIS" && suspicionDay > firstCheck) {
    history.push({
      date: suspicionDay,
      state: "UNKNOWN",
      note: "Ko'rishlar keskin o'sdi — tahlil boshlandi",
    });
  }

  const detectionNotes: Record<MockTargetDetection["method"], string> = {
    AD_LIBRARY: "Meta reklama kutubxonasida faol reklama topildi",
    GROWTH_ANALYSIS: "AI: o'sish tezligi pullik reklamaga xos",
    REPORT: "Shikoyat: lentada reklama sifatida ko'rilgan",
  };
  history.push({ date: target.detectedOn, state: "ON", note: detectionNotes[target.method] });
  target.reports.slice(1).forEach((report, index) => {
    if (report.on <= today) {
      history.push({ date: report.on, state: "ON", note: `Yana bir shikoyat (jami ${index + 2})` });
    }
  });

  const stoppedOn = addDays(target.detectedOn, BOOST_END_OFFSET);
  if (stoppedOn <= today) {
    history.push({ date: stoppedOn, state: "OFF", note: "Reklama to'xtatilgan" });
  }

  // Barqaror saralash: bir kundagi yozuvlar qo'shilgan tartibda qoladi.
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Ro'yxat elementi va batafsil
// ---------------------------------------------------------------------------

interface CaseContext {
  store: MockStore;
  today: IsoDate;
  participantsById: Map<string, MockParticipant>;
  reelsById: Map<string, MockReel>;
  rankById: Map<string, number>;
}

function buildContext(store: MockStore): CaseContext {
  const data = getContestData();
  return {
    store,
    today: data.today,
    participantsById: new Map(data.participants.map((item) => [item.id, item])),
    reelsById: new Map(data.reels.map((reel) => [reel.id, reel])),
    rankById: new Map(
      computeRanking(data.today, store).map((entry) => [entry.participantId, entry.rank]),
    ),
  };
}

function toListItem(target: MockTargetDetection, context: CaseContext): TargetCaseListItem | null {
  const participant = context.participantsById.get(target.participantId);
  const reel = context.reelsById.get(target.reelId);
  if (!participant || !reel) return null;

  const history = historyFor(target, reel, context.today);
  const currentState: TargetState = history[history.length - 1]?.state ?? "UNKNOWN";

  return {
    id: target.id,
    participant: {
      id: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
      // Target holati bitta video bo'yicha — o'sha videoning akkaunti.
      instagramUsername: reel.owner ?? participant.instagramUsername,
      status: effectiveStatus(participant, context.store),
    },
    reelUrl: reel.url,
    detectedOn: target.detectedOn,
    method: target.method,
    evidence: evidenceFor(target, reel),
    currentState,
    status: targetCaseStatus(target, context.store),
    views: latestViews(reel),
    rank: context.rankById.get(participant.id) ?? null,
  };
}

function toDetail(target: MockTargetDetection, context: CaseContext): TargetCaseDetail {
  const item = toListItem(target, context);
  const reel = context.reelsById.get(target.reelId);
  if (!item || !reel) {
    throw new ApiError(404, "Target holati topilmadi.");
  }

  const from = clampDate(addDays(target.detectedOn, -5), reel.reviewedOn ?? target.detectedOn, context.today);
  const to = clampDate(addDays(target.detectedOn, BOOST_END_OFFSET + 1), from, context.today);

  return {
    ...item,
    dailyGrowth: eachDay(from, to).map((date) => ({
      date,
      viewsGrowth: growthOn(reel, date),
      flagged: isBoostDay(target.detectedOn, date),
    })),
    history: historyFor(target, reel, context.today),
    attachments: target.reports.map((report, index) => ({
      id: `${target.id}_a${index + 1}`,
      fileName: `shikoyat-${index + 1}.jpg`,
      sizeBytes: report.sizeBytes,
      url: null,
    })),
    evidenceUrl: target.adId ? `https://www.facebook.com/ads/library/?id=${target.adId}` : null,
    reports: target.reports.map((report, index) => {
      const reporter = context.participantsById.get(report.reporterId);
      return {
        id: `${target.id}_r${index + 1}`,
        // Mock: shikoyat kunning kechki soatida kelgan.
        at: `${report.on}T${String(14 + index * 3).padStart(2, "0")}:2${index}:00+05:00`,
        comment: report.comment,
        attachmentId: `${target.id}_a${index + 1}`,
        reporter: {
          id: report.reporterId,
          fullName: reporter ? `${reporter.firstName} ${reporter.lastName}` : "O'chirilgan foydalanuvchi",
          phone: reporter?.phone ?? "",
        },
      };
    }),
  };
}

function matchesFilter(status: TargetCaseStatus, filter: TargetStatusFilter | undefined): boolean {
  if (!filter) return true;
  if (filter === "OPEN") return status === "NEW" || status === "WARNED";
  return status === filter;
}

function findTarget(id: string): MockTargetDetection {
  const target = getContestData().targets.find((item) => item.id === id);
  if (!target) {
    throw new ApiError(404, "Target holati topilmadi.");
  }
  return target;
}

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

export function listTargetCases(query: TargetCaseListQuery): TargetCaseListResponse {
  const context = buildContext(readStore());

  let items = getContestData()
    .targets.map((target) => toListItem(target, context))
    .filter((item): item is TargetCaseListItem => item !== null)
    .filter((item) => matchesPerson(item.participant, query.search ?? ""));

  const statusCounts: TargetCaseListResponse["statusCounts"] = {
    ALL: items.length,
    OPEN: items.filter((item) => matchesFilter(item.status, "OPEN")).length,
    NEW: items.filter((item) => item.status === "NEW").length,
    WARNED: items.filter((item) => item.status === "WARNED").length,
    DISQUALIFIED: items.filter((item) => item.status === "DISQUALIFIED").length,
    DISMISSED: items.filter((item) => item.status === "DISMISSED").length,
  };

  items = items
    .filter((item) => matchesFilter(item.status, query.status))
    // Eng yangi aniqlanganlar yuqorida.
    .sort((a, b) => b.detectedOn.localeCompare(a.detectedOn) || a.id.localeCompare(b.id));

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

export function getTargetCheckStatus(): TargetCheckStatus {
  const store = readStore();
  const { startsOn, endsOn } = effectiveSettings(store);
  const { today } = getContestData();
  const k = Math.floor(diffDays(startsOn, today) / TARGET_CHECK_EVERY_DAYS) + 1;
  const next = addDays(startsOn, Math.max(1, k) * TARGET_CHECK_EVERY_DAYS);
  return { running: false, lastCheck: store.targetCheck, nextCheckOn: next <= endsOn ? next : null };
}

/**
 * Reklama kutubxonasini hoziroq tekshirish. Mock: yangi reklama topilmaydi — mavjud
 * "Yoqilgan" holatdagi reklama kutubxonasi holatlari sanaladi.
 */
export function runTargetCheck(actor: AdminUser): TargetAdsCheckReport {
  const store = readStore();
  const context = buildContext(store);
  const leaders = computeRanking(context.today, store).slice(0, TARGET_CHECK_TOP);
  const leaderIds = new Set(leaders.map((entry) => entry.participantId));
  const found = getContestData()
    .targets.filter((target) => target.method === "AD_LIBRARY" && leaderIds.has(target.participantId))
    .map((target) => toListItem(target, context))
    .filter((item) => item?.currentState === "ON").length;

  const report: TargetAdsCheckReport = {
    reason: "admin",
    at: new Date().toISOString(),
    checked: leaders.length,
    found,
    error: null,
  };
  writeStore({
    ...store,
    targetCheck: report,
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at: report.at,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "target.check",
        entity: "target_case",
        entityId: "ad_library",
        before: "",
        after: `${report.checked} ta tekshirildi, ${report.found} ta faol reklama`,
        reason: "",
      },
    ],
  });
  return report;
}

export function getTargetCaseDetail(id: string): TargetCaseDetail {
  return toDetail(findTarget(id), buildContext(readStore()));
}

export function applyTargetAction(
  id: string,
  action: TargetAction,
  reason: string,
  actor: AdminUser,
): TargetCaseDetail {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < MIN_REASON_LENGTH) {
    throw new ApiError(400, `Sababni yozing (kamida ${MIN_REASON_LENGTH} ta belgi).`);
  }

  const target = findTarget(id);
  const participant = getContestData().participants.find((item) => item.id === target.participantId);
  if (!participant) {
    throw new ApiError(404, "Ishtirokchi topilmadi.");
  }

  const store = readStore();
  const caseStatus = targetCaseStatus(target, store);
  const transition = CASE_TRANSITIONS[action];
  if (!transition.from.includes(caseStatus)) {
    throw new ApiError(409, "Bu amalni target holatining hozirgi holatida bajarib bo'lmaydi.");
  }

  const participantBefore = effectiveStatus(participant, store);
  if (action === "warn" && participantBefore === "DISQUALIFIED") {
    throw new ApiError(409, "Ishtirokchi allaqachon diskvalifikatsiya qilingan.");
  }

  // Ishtirokchi holatiga ta'siri: ogohlantirish faolni "Ogohlantirilgan"ga, diskvalifikatsiya — "Diskvalifikatsiya"ga.
  let participantAfter: ParticipantStatus = participantBefore;
  if (action === "warn" && participantBefore === "ACTIVE") participantAfter = "WARNED";
  if (action === "disqualify") participantAfter = "DISQUALIFIED";

  const now = new Date().toISOString();
  const audit: MockAuditEntry[] = [
    ...store.audit,
    {
      id: auditId(),
      at: now,
      actorId: actor.id,
      actorName: actor.fullName,
      action: `target.${action}`,
      entity: "target_case",
      entityId: target.id,
      before: caseStatus,
      after: transition.to,
      reason: trimmedReason,
    },
  ];
  if (participantAfter !== participantBefore) {
    audit.push({
      id: auditId(),
      at: now,
      actorId: actor.id,
      actorName: actor.fullName,
      action: action === "warn" ? "participant.warn" : "participant.disqualify",
      entity: "participant",
      entityId: participant.id,
      before: participantBefore,
      after: participantAfter,
      reason: trimmedReason,
    });
  }

  const nextStore: MockStore = {
    ...store,
    targetCaseStatus: { ...store.targetCaseStatus, [target.id]: transition.to },
    statusOverrides:
      participantAfter !== participantBefore
        ? { ...store.statusOverrides, [participant.id]: participantAfter }
        : store.statusOverrides,
    audit,
  };
  writeStore(nextStore);

  return toDetail(target, buildContext(nextStore));
}
