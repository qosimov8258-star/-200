/**
 * MOCK backend: ega (tashkilot egasi) bo'limi. Eksport qilingan funksiyalar nomi va imzosi
 * `../owner-api.http.ts` dagi bilan bir xil — buni `../owner-api.ts` dagi tip tekshiruvi
 * kafolatlaydi. Kontrakt (manzillar, xavf ballari qoidalari) — `../owner-types.ts`.
 *
 * Ma'lumot manbalari:
 *   - ishtirokchilar, videolar, ko'rishlar va target holatlari — `./contest.ts` (admin mock bilan
 *     bir xil), admin mock'ida o'zgartirilgan holatlar (`./store.ts`) boshlang'ich qiymat bo'ladi;
 *   - ega o'zgartirishlari (tahrir, o'chirish, target holati, xavf belgisi) — brauzer
 *     `localStorage` idagi ALOHIDA kalitda (`reels-admin:mock-owner`). Admin mock bo'limlari
 *     ularni ko'rmaydi (haqiqiy backendda esa hammasi bitta bazada).
 *   - ro'yxatdan to'liq o'tmaganlar (botga kirgan, ism kiritmagan) faqat shu yerda qo'shiladi.
 *
 * Ega amallari audit log'ga yozilmaydi (kontrakt). Mock ega hisobi — `./db.ts` dagi `mockOwners`.
 */
import { ApiError } from "../api-error";
import { addDays, todayIso } from "../dates";
import { formatCompact, formatNumber } from "../format";
import { TARGET_METHOD_LABELS } from "../labels";
import type {
  OwnerLoginRequest,
  OwnerParticipant,
  OwnerParticipantFilter,
  OwnerParticipantListQuery,
  OwnerParticipantListResponse,
  OwnerParticipantStatus,
  OwnerParticipantUpdate,
  OwnerReelStatus,
  OwnerTargetUpdate,
  OwnerUser,
  RiskAccount,
  RiskLevel,
  RiskListQuery,
  RiskListResponse,
  RiskSignal,
  RiskSignalKind,
  RiskVerdict,
} from "../owner-types";
import type {
  IsoDate,
  ManualReviewItem,
  ParticipantStatus,
  ReelStatus,
  TargetCaseListItem,
  TargetCaseListQuery,
  TargetCaseListResponse,
  TargetCaseStatus,
  TargetStatusFilter,
} from "../types";
import { eventTime, getContestData, reelStatusOn, type MockParticipant, type MockReel } from "./contest";
import { mockOwners } from "./db";
import { listManualReviews } from "./manual-review";
import { createRandom, hashString } from "./random";
import { computeRanking, effectiveStatus } from "./ranking";
import { readStore, type MockStore } from "./store";
import { listTargetCases, targetCaseStatus } from "./targets";
import { matchesPerson, normalizeSearch } from "./text";

const OWNER_STORE_KEY = "reels-admin:mock-owner";
const OWNER_SESSION_KEY = "reels-admin:mock-owner-session";
const STORE_VERSION = 1;
/** Backenddagi `reels_owner` cookie'si kabi — 2 soat. */
const SESSION_MS = 2 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_NOTE_LENGTH = 300;
const RISK_SEED = 20261120;
/** Botga kirib, ro'yxatdan to'liq o'tmaganlar soni. */
const INCOMPLETE_COUNT = 7;
/** Shuncha muvaffaqiyatsiz urinishdan keyin — 429. */
const MAX_LOGIN_FAILURES = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

const PARTICIPANT_STATUSES: readonly OwnerParticipantStatus[] = ["ACTIVE", "BLOCKED", "DISQUALIFIED"];
const TARGET_STATUSES: readonly TargetCaseStatus[] = ["NEW", "WARNED", "DISQUALIFIED", "DISMISSED"];
const UPDATE_FIELDS = new Set(["firstName", "lastName", "age", "phone", "status"]);

/** Kontraktdagi ballar (backend bilan bir xil). */
const SIGNAL_POINTS: Record<Exclude<RiskSignalKind, "REPORTS">, number> = {
  ENGAGEMENT_GAP: 40,
  VIEW_SPIKE: 35,
  LOW_ENGAGEMENT: 25,
  VIEW_DROP: 20,
  TARGET: 40,
  MANUAL_REVIEW: 15,
  NOT_FOUND: 10,
};
const TARGET_WARNED_BONUS = 10;
const REPORT_POINTS = 10;
const REPORT_POINTS_MAX = 30;

/** Tarmoq kechikishini taqlid qilish. */
function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Ega o'zgartirishlari (localStorage)
// ---------------------------------------------------------------------------

interface OwnerEdits {
  firstName?: string;
  lastName?: string;
  age?: number;
  phone?: string;
  status?: OwnerParticipantStatus;
}

interface OwnerTargetNote {
  at: string;
  from: TargetCaseStatus;
  to: TargetCaseStatus;
  note: string;
  by: string;
}

interface OwnerStore {
  version: number;
  /** Ishtirokchi id (Telegram ID) -> ega o'zgartirgan maydonlar. */
  edits: Record<string, OwnerEdits>;
  /** Butunlay o'chirilgan ishtirokchilar. */
  deleted: string[];
  /** Target holati id -> ega o'rnatgan holat. */
  targetStatus: Record<string, TargetCaseStatus>;
  /** Target holati id -> holat tarixi izohlari. */
  targetNotes: Record<string, OwnerTargetNote[]>;
  /** Ishtirokchi id -> ega belgisi. */
  reviews: Record<string, { verdict: RiskVerdict; at: string; by: string }>;
}

let memoryStore: OwnerStore | null = null;

function emptyStore(): OwnerStore {
  return { version: STORE_VERSION, edits: {}, deleted: [], targetStatus: {}, targetNotes: {}, reviews: {} };
}

function readOwnerStore(): OwnerStore {
  try {
    const raw = window.localStorage.getItem(OWNER_STORE_KEY);
    if (!raw) return memoryStore ?? emptyStore();
    const parsed = JSON.parse(raw) as Partial<OwnerStore>;
    if (parsed.version !== STORE_VERSION) return emptyStore();
    return { ...emptyStore(), ...parsed, version: STORE_VERSION };
  } catch {
    return memoryStore ?? emptyStore();
  }
}

function writeOwnerStore(store: OwnerStore): void {
  memoryStore = store;
  try {
    window.localStorage.setItem(OWNER_STORE_KEY, JSON.stringify(store));
  } catch {
    // Xotira yopiq (private rejim) — o'zgarish sahifa yangilanguncha `memoryStore` da qoladi.
  }
}

// ---------------------------------------------------------------------------
// Sessiya (haqiqiy backendda — HttpOnly `reels_owner` cookie'si)
// ---------------------------------------------------------------------------

interface MockOwnerSession {
  ownerId: string;
  expiresAt: number;
}

let memorySession: MockOwnerSession | null = null;
let loginFailures: number[] = [];

function readSession(): MockOwnerSession | null {
  try {
    const raw = window.localStorage.getItem(OWNER_SESSION_KEY);
    // Xotira ishlayapti, kalit yo'q — sessiya yo'q (cookie o'chgandek). `memorySession` faqat
    // xotira yopiq bo'lganda (pastdagi `catch`).
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MockOwnerSession>;
    if (typeof parsed.ownerId !== "string" || typeof parsed.expiresAt !== "number") return null;
    return { ownerId: parsed.ownerId, expiresAt: parsed.expiresAt };
  } catch {
    return memorySession;
  }
}

function writeSession(session: MockOwnerSession | null): void {
  memorySession = session;
  try {
    if (session) {
      window.localStorage.setItem(OWNER_SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(OWNER_SESSION_KEY);
    }
  } catch {
    // Xotira yopiq — sessiya faqat shu sahifada.
  }
}

function toOwnerUser(record: OwnerUser): OwnerUser {
  return { id: record.id, login: record.login, fullName: record.fullName };
}

/** Sessiya yo'q yoki muddati o'tgan — 401 (admin sessiyasi bu yerda hisobga olinmaydi). */
function requireOwner(): OwnerUser {
  const session = readSession();
  const record = session && session.expiresAt > Date.now() ? mockOwners.find((item) => item.id === session.ownerId) : null;
  if (!record) {
    if (session) writeSession(null);
    throw new ApiError(401, "Sessiya tugadi. Qaytadan kiring.");
  }
  return toOwnerUser(record);
}

// ---------------------------------------------------------------------------
// Ishtirokchilar: mock tanlov ma'lumotidan + to'liq o'tmaganlar
// ---------------------------------------------------------------------------

interface BasePerson {
  /** Telegram ID (`OwnerParticipant.id`). */
  id: string;
  /** `MockParticipant.id`; to'liq o'tmaganlarda — null. */
  sourceId: string | null;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  phone: string | null;
  instagramUsername: string | null;
  registeredAt: string;
  complete: boolean;
}

interface Person extends BasePerson {
  status: OwnerParticipantStatus;
}

/** "+998 90 123-45-67" -> "+998901234567"; normallashtirilgach aynan +998 va 9 raqam bo'lmasa — null. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return /^998\d{9}$/.test(digits) ? `+${digits}` : null;
}

/** Mock ishtirokchi uchun barqaror "Telegram ID". */
function telegramIdFor(participant: MockParticipant): string {
  const index = Number.parseInt(participant.id.replace(/\D/g, ""), 10) || 0;
  return String(5_200_000_000 + index * 7_368_113);
}

let baseCache: { today: IsoDate; people: BasePerson[] } | null = null;

function basePeople(): BasePerson[] {
  const data = getContestData();
  if (baseCache?.today === data.today) return baseCache.people;

  const people: BasePerson[] = data.participants.map((participant) => ({
    id: telegramIdFor(participant),
    sourceId: participant.id,
    firstName: participant.firstName,
    lastName: participant.lastName,
    age: participant.age,
    phone: normalizePhone(participant.phone),
    instagramUsername: participant.instagramUsername,
    registeredAt: eventTime(participant.registeredOn, participant.id, 8, 22),
    complete: true,
  }));

  // Botga kirgan, lekin ism kiritmagan / qoidalarga rozilik bermaganlar.
  const random = createRandom(RISK_SEED + 1);
  for (let k = 1; k <= INCOMPLETE_COUNT; k++) {
    const id = String(7_400_000_000 + k * 5_113_007);
    const sharedPhone = k % 3 !== 0;
    const registeredOn = addDays(data.today, -random.int(0, 20));
    people.push({
      id,
      sourceId: null,
      firstName: null,
      lastName: null,
      age: null,
      phone: sharedPhone ? `+99893${String(random.int(1_000_000, 9_999_999))}` : null,
      instagramUsername: null,
      registeredAt: eventTime(registeredOn, id, 8, 22),
      complete: false,
    });
  }

  baseCache = { today: data.today, people };
  return people;
}

/** Admin mock holatidan ega holatiga: "Ogohlantirilgan" alohida holat emas (u target holatida). */
function toOwnerStatus(status: ParticipantStatus): OwnerParticipantStatus {
  return status === "WARNED" ? "ACTIVE" : status;
}

function latestViews(reel: MockReel): number {
  let latest = 0;
  for (const views of reel.viewsByDay.values()) latest = views;
  return latest;
}

function groupReels(reels: readonly MockReel[]): Map<string, MockReel[]> {
  const grouped = new Map<string, MockReel[]>();
  for (const reel of reels) {
    const list = grouped.get(reel.participantId);
    if (list) list.push(reel);
    else grouped.set(reel.participantId, [reel]);
  }
  return grouped;
}

// ---------------------------------------------------------------------------
// Kontekst: admin mock + ega o'zgartirishlari
// ---------------------------------------------------------------------------

interface RiskResult {
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
}

interface Context {
  owner: OwnerStore;
  /** Admin mock bazasining nusxasi, ega o'zgartirgan holatlar qo'shilgan. */
  virtual: MockStore;
  today: IsoDate;
  people: Person[];
  byId: Map<string, Person>;
  bySource: Map<string, Person>;
  /** Ishtirokchining barcha videolari (yuborilgan tartibda) — `sourceId` bo'yicha. */
  reelsBySource: Map<string, MockReel[]>;
  rankBySource: Map<string, number>;
  /** Ochiq qo'lda tekshiruvlar (ishtirokchi `sourceId` bo'yicha). */
  openReviews: Map<string, ManualReviewItem>;
  /** Faqat ACTIVE va BLOCKED, ball > 0. */
  risk: Map<string, RiskResult>;
}

function buildContext(owner: OwnerStore = readOwnerStore()): Context {
  const data = getContestData();
  const admin = readStore();
  const deleted = new Set(owner.deleted);
  const sourceById = new Map(data.participants.map((item) => [item.id, item]));

  const people: Person[] = [];
  const statusOverrides: MockStore["statusOverrides"] = { ...admin.statusOverrides };

  for (const base of basePeople()) {
    const source = base.sourceId ? sourceById.get(base.sourceId) : undefined;
    if (deleted.has(base.id)) {
      // O'chirilgan — reyting va boshqa ro'yxatlardan ham chiqadi.
      if (base.sourceId) statusOverrides[base.sourceId] = "DISQUALIFIED";
      continue;
    }
    const edits = owner.edits[base.id] ?? {};
    const status = edits.status ?? (source ? toOwnerStatus(effectiveStatus(source, admin)) : "ACTIVE");
    if (base.sourceId && edits.status) statusOverrides[base.sourceId] = edits.status;
    people.push({
      ...base,
      firstName: edits.firstName ?? base.firstName,
      lastName: edits.lastName ?? base.lastName,
      age: edits.age ?? base.age,
      phone: edits.phone ?? base.phone,
      status,
    });
  }

  const virtual: MockStore = {
    ...admin,
    statusOverrides,
    targetCaseStatus: { ...admin.targetCaseStatus, ...owner.targetStatus },
  };

  const openReviews = new Map(
    listManualReviews({ status: "OPEN", pageSize: MAX_PAGE_SIZE }).items.map((item) => [item.participant.id, item]),
  );

  const context: Context = {
    owner,
    virtual,
    today: data.today,
    people,
    byId: new Map(people.map((person) => [person.id, person])),
    bySource: new Map(
      people.flatMap((person): Array<[string, Person]> => (person.sourceId ? [[person.sourceId, person]] : [])),
    ),
    reelsBySource: groupReels(data.reels),
    rankBySource: new Map(computeRanking(data.today, virtual).map((entry) => [entry.participantId, entry.rank])),
    openReviews,
    risk: new Map(),
  };

  for (const person of people) {
    if (person.status === "DISQUALIFIED") continue;
    const signals = riskSignals(person, context);
    const score = signals.reduce((sum, signal) => sum + signal.points, 0);
    const level = riskLevel(score);
    if (level) context.risk.set(person.id, { score, level, signals });
  }

  return context;
}

// ---------------------------------------------------------------------------
// Xavf signallari (kontraktdagi qoidalar)
// ---------------------------------------------------------------------------

function riskLevel(score: number): RiskLevel | null {
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  if (score > 0) return "LOW";
  return null;
}

interface Spike {
  day: IsoDate;
  growth: number;
  baseline: number;
}

/**
 * Bir kunlik o'sish oldingi kunlar o'rtachasidan ≥ 5× (target yoqilgan kunlar shunday).
 * Tur bo'yicha bitta signal — eng oxirgi shunday kun (backend bilan bir xil).
 */
function findSpike(reel: MockReel): Spike | null {
  const days = [...reel.growthByDay.entries()];
  let latest: Spike | null = null;
  for (let i = 1; i < days.length; i++) {
    const previous = days.slice(Math.max(0, i - 3), i).map(([, growth]) => growth);
    const baseline = previous.reduce((sum, value) => sum + value, 0) / previous.length;
    const [day, growth] = days[i];
    if (baseline > 0 && growth >= 1500 && growth >= baseline * 5) latest = { day, growth, baseline };
  }
  return latest;
}

/** O'sish eng katta bo'lgan kun (nakrutka belgisi uchun). */
function peakDay(reel: MockReel): { day: IsoDate; growth: number } | null {
  let peak: { day: IsoDate; growth: number } | null = null;
  for (const [day, growth] of reel.growthByDay) {
    if (!peak || growth > peak.growth) peak = { day, growth };
  }
  return peak;
}

interface VideoSignals {
  /** Ishtirokchi `sourceId` -> videodagi nakrutka belgilari va qo'shimcha shikoyatlar. */
  signals: Map<string, RiskSignal[]>;
  reports: Map<string, { count: number; at: IsoDate }>;
}

let videoCache: { today: IsoDate; value: VideoSignals } | null = null;

/**
 * Videodagi belgilar kun davomida o'zgarmaydi — bir marta hisoblanadi. Mock ma'lumotida layklar
 * yo'q, shuning uchun ENGAGEMENT_GAP / LOW_ENGAGEMENT / VIEW_DROP va qo'shimcha shikoyatlar bir
 * nechta ishtirokchiga deterministik (har safar bir xil) qo'shiladi.
 */
function videoSignals(): VideoSignals {
  const data = getContestData();
  if (videoCache?.today === data.today) return videoCache.value;

  const today = data.today;
  const clampDay = (day: IsoDate, reel: MockReel): IsoDate => {
    const min = reel.reviewedOn ?? reel.submittedOn;
    return day < min ? min : day > today ? today : day;
  };
  const recentDay = (reel: MockReel, salt: string): IsoDate =>
    clampDay(addDays(today, -(1 + (hashString(`${reel.id}:${salt}`) % 6))), reel);

  const accepted = data.reels.filter((reel) => reel.reviewOutcome === "ACCEPTED" && reel.growthByDay.size >= 5);
  const candidates = [...new Set(accepted.map((reel) => reel.participantId))].sort();
  const random = createRandom(RISK_SEED);
  const pickSet = (count: number): Set<string> => {
    const picked = new Set<string>();
    for (let guard = 0; picked.size < count && guard < 1000 && candidates.length > 0; guard++) {
      picked.add(random.pick(candidates));
    }
    return picked;
  };
  const gapSet = pickSet(3);
  const lowSet = pickSet(5);
  const dropSet = pickSet(4);
  const reportSet = pickSet(3);
  // Targetsiz ham yuqori xavf bo'lsin: birinchi "layk o'smagan" hisob — kam faollik ham.
  const firstGap = [...gapSet][0];
  if (firstGap) lowSet.add(firstGap);

  // Ishtirokchining bir nechta videosi bo'lishi mumkin: har bir belgi turi bir marta, eng
  // oxirgi kuni bilan (backend: `owner/risk.ts`).
  const signals = new Map<string, RiskSignal[]>();
  const mergeSignal = (participantId: string, signal: RiskSignal) => {
    const list = signals.get(participantId) ?? [];
    const index = list.findIndex((item) => item.kind === signal.kind);
    if (index === -1) list.push(signal);
    else if ((signal.at ?? "") > (list[index]?.at ?? "")) list[index] = signal;
    signals.set(participantId, list);
  };
  for (const reel of accepted) {
    const list: RiskSignal[] = [];
    const spike = findSpike(reel);
    const hash = hashString(`${reel.id}:risk`);

    if (spike) {
      list.push({
        kind: "VIEW_SPIKE",
        detail: `Bir kunda +${formatNumber(spike.growth)} ko'rish (odatda ~${formatCompact(Math.round(spike.baseline))})`,
        at: spike.day,
        points: SIGNAL_POINTS.VIEW_SPIKE,
      });
    }
    const gapSource = spike && hash % 2 === 0 ? spike : gapSet.has(reel.participantId) ? peakDay(reel) : null;
    if (gapSource) {
      const likes = Math.max(3, Math.round(gapSource.growth * 0.0015));
      list.push({
        kind: "ENGAGEMENT_GAP",
        detail: `+${formatNumber(gapSource.growth)} ko'rish, +${formatNumber(likes)} layk`,
        at: gapSource.day,
        points: SIGNAL_POINTS.ENGAGEMENT_GAP,
      });
    }
    if (lowSet.has(reel.participantId)) {
      const ratio = (2 + (hash % 5)) / 10;
      list.push({
        kind: "LOW_ENGAGEMENT",
        detail: `Layk/ko'rish ${String(ratio).replace(".", ",")}% (odatda 4–6%)`,
        at: recentDay(reel, "low"),
        points: SIGNAL_POINTS.LOW_ENGAGEMENT,
      });
    }
    if (dropSet.has(reel.participantId)) {
      const after = latestViews(reel);
      const before = Math.round(after * (1.08 + (hash % 10) / 100));
      list.push({
        kind: "VIEW_DROP",
        detail: `Ko'rishlar ${formatNumber(before)} → ${formatNumber(after)} ga kamaydi`,
        at: recentDay(reel, "drop"),
        points: SIGNAL_POINTS.VIEW_DROP,
      });
    }
    for (const signal of list) mergeSignal(reel.participantId, signal);
  }

  // Shikoyatlar: target bo'limidagi skrinshotlar + bir nechta qo'shimcha.
  const reports = new Map<string, { count: number; at: IsoDate }>();
  const addReports = (participantId: string, count: number, at: IsoDate) => {
    const current = reports.get(participantId);
    reports.set(participantId, {
      count: (current?.count ?? 0) + count,
      at: current && current.at > at ? current.at : at,
    });
  };
  for (const target of data.targets) {
    for (const report of target.reports) addReports(target.participantId, 1, report.on);
  }
  const reelByParticipant = new Map(accepted.map((reel) => [reel.participantId, reel]));
  for (const participantId of reportSet) {
    const reel = reelByParticipant.get(participantId);
    if (reel) addReports(participantId, 1 + (hashString(`${participantId}:reports`) % 3), recentDay(reel, "reports"));
  }

  const value = { signals, reports };
  videoCache = { today, value };
  return value;
}

function riskSignals(person: Person, context: Context): RiskSignal[] {
  if (!person.sourceId) return [];
  const sourceId = person.sourceId;
  const video = videoSignals();
  const signals: RiskSignal[] = [...(video.signals.get(sourceId) ?? [])];

  // Ochiq target holatlari — bitta signal; ogohlantirilgani bo'lsa +10.
  const open = getContestData()
    .targets.filter((target) => target.participantId === sourceId)
    .map((target) => ({ target, status: targetCaseStatus(target, context.virtual) }))
    .filter((item) => item.status === "NEW" || item.status === "WARNED")
    .sort((a, b) => b.target.detectedOn.localeCompare(a.target.detectedOn));
  if (open.length > 0) {
    const latest = open[0].target;
    const warned = open.some((item) => item.status === "WARNED");
    signals.push({
      kind: "TARGET",
      // Sana alohida (`at`) — matnda takrorlanmaydi.
      detail:
        (open.length > 1 ? `${open.length} ta ochiq holat` : TARGET_METHOD_LABELS[latest.method]) +
        (warned ? " · ogohlantirilgan" : ""),
      at: latest.detectedOn,
      points: SIGNAL_POINTS.TARGET + (warned ? TARGET_WARNED_BONUS : 0),
    });
  }

  const reports = video.reports.get(sourceId);
  if (reports && reports.count > 0) {
    signals.push({
      kind: "REPORTS",
      detail: `${reports.count} ta shikoyat`,
      at: reports.at,
      points: Math.min(REPORT_POINTS_MAX, REPORT_POINTS * reports.count),
    });
  }

  const review = context.openReviews.get(sourceId);
  if (review) {
    signals.push({
      kind: "MANUAL_REVIEW",
      detail: review.kind === "LOST_REEL" ? "Reytingdagi video yo'qoldi — qo'lda tekshiruvda" : "Yangi video qo'lda tekshiruvda",
      at: todayIso(new Date(review.requestedAt)),
      points: SIGNAL_POINTS.MANUAL_REVIEW,
    });
  }

  const removedOn = (context.reelsBySource.get(sourceId) ?? [])
    .map((reel) => reel.removedOn)
    .filter((day): day is IsoDate => day !== null && day !== undefined && day <= context.today)
    .sort()
    .at(-1);
  if (removedOn) {
    signals.push({
      kind: "NOT_FOUND",
      detail: "Oxirgi tekshiruvlarda video Instagram'da topilmadi",
      at: removedOn,
      points: SIGNAL_POINTS.NOT_FOUND,
    });
  }

  return signals;
}

/** SAFE belgisidan keyin yangi signal (signal kuni belgi kunidan keyin) bo'lsa — yana ko'rinadi. */
function hiddenAsSafe(review: OwnerStore["reviews"][string] | undefined, signals: RiskSignal[]): boolean {
  if (!review || review.verdict !== "SAFE") return false;
  const reviewDay = todayIso(new Date(review.at));
  return !signals.some((signal) => signal.at !== null && signal.at > reviewDay);
}

// ---------------------------------------------------------------------------
// Javob elementlari
// ---------------------------------------------------------------------------

interface PersonReel {
  reel: MockReel;
  status: ReelStatus;
}

/** Bugungi kunda yuborilgan videolar va ularning holati. */
function personReels(person: Person, context: Context): PersonReel[] {
  if (!person.sourceId) return [];
  return (context.reelsBySource.get(person.sourceId) ?? []).flatMap((reel) => {
    const status = reelStatusOn(reel, context.today);
    return status ? [{ reel, status }] : [];
  });
}

const isLive = ({ status }: PersonReel) => status !== "REJECTED" && status !== "REMOVED";

/**
 * Reytingda hisoblanadigan video: eng ko'p ko'rilgan qabul qilingani, teng bo'lsa — oldinroq
 * yuborilgani. Qabul qilingan video yo'q — null.
 */
function bestAccepted(reels: PersonReel[]): PersonReel | null {
  let best: PersonReel | null = null;
  for (const item of reels) {
    if (item.status !== "ACCEPTED") continue;
    if (best === null) {
      best = item;
      continue;
    }
    const diff = latestViews(item.reel) - latestViews(best.reel);
    if (diff > 0 || (diff === 0 && item.reel.submittedAt < best.reel.submittedAt)) best = item;
  }
  return best;
}

/**
 * Asosiy video (backend: `owner.service.ts` → `mainReel`): reytingda hisoblanadigan (eng ko'p
 * ko'rilgan qabul qilingan) video, bo'lmasa — oxirgi tirik video, u ham bo'lmasa — oxirgisi.
 */
function mainReel(reels: PersonReel[]): PersonReel | null {
  return bestAccepted(reels) ?? reels.filter(isLive).at(-1) ?? reels.at(-1) ?? null;
}

function ownerReel(person: Person, context: Context): OwnerParticipant["reel"] {
  const main = mainReel(personReels(person, context));
  if (!main || !person.sourceId) return null;
  const reelStatus: OwnerReelStatus =
    context.openReviews.has(person.sourceId) && main.status !== "ACCEPTED"
      ? "MANUAL_REVIEW"
      : main.status === "REMOVED"
        ? "REJECTED"
        : main.status;
  return { url: main.reel.url, status: reelStatus, submittedAt: eventTime(main.reel.submittedOn, main.reel.id) };
}

function openTargetCount(person: Person, context: Context): number {
  if (!person.sourceId) return 0;
  return getContestData().targets.filter((target) => {
    if (target.participantId !== person.sourceId) return false;
    const status = targetCaseStatus(target, context.virtual);
    return status === "NEW" || status === "WARNED";
  }).length;
}

/** Ro'yxat tabi: ismi yo'q — faqat INCOMPLETE (holati qanday bo'lsa ham), qolganlari — o'z holatida. */
function participantTab(person: Person): OwnerParticipantFilter {
  return person.firstName === null ? "INCOMPLETE" : person.status;
}

/**
 * Eng ko'p ko'rilgan qabul qilingan videoning ko'rishlari (videolar ko'rishlari qo'shilmaydi) —
 * reyting va admin ro'yxati bilan bir xil. Qabul qilingan video yo'q — 0.
 */
function personViews(person: Person, context: Context): number {
  const best = bestAccepted(personReels(person, context));
  return best ? latestViews(best.reel) : 0;
}

function toOwnerParticipant(person: Person, context: Context): OwnerParticipant {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    age: person.age,
    phone: person.phone,
    status: person.status,
    // Ism kiritilgan va qoidalarga rozilik berilgan (botda to'liq o'tmaganlar rozilik bermagan).
    profileComplete: person.complete && person.firstName !== null,
    registeredAt: person.registeredAt,
    instagramUsername: person.instagramUsername,
    reel: ownerReel(person, context),
    reelCount: personReels(person, context).filter(isLive).length,
    views: personViews(person, context),
    rank: person.sourceId ? (context.rankBySource.get(person.sourceId) ?? null) : null,
    openTargetCases: openTargetCount(person, context),
    riskLevel: context.risk.get(person.id)?.level ?? null,
  };
}

/**
 * Qidiruv (backend bilan bir xil): ism-familiya (apostrof variantlari bir xil), telefon (kamida
 * 3 raqam), @instagram (@ siz ham), Telegram ID — faqat raqamli so'rovda, qismi bo'yicha.
 */
function matchesSearch(person: Person, search: string): boolean {
  const needle = normalizeSearch(search);
  if (!needle) return true;
  if (/^\d+$/.test(needle) && person.id.includes(needle)) return true;
  return matchesPerson(
    {
      firstName: person.firstName ?? "",
      lastName: person.lastName ?? "",
      phone: person.phone ?? "",
      instagramUsername: person.instagramUsername,
    },
    search,
  );
}

function paginate<T>(items: T[], page: number | undefined, pageSize: number | undefined) {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(lastPage, Math.max(1, page ?? 1));
  return {
    items: items.slice((current - 1) * size, current * size),
    total: items.length,
    page: current,
    pageSize: size,
  };
}

// ---------------------------------------------------------------------------
// Kirish
// ---------------------------------------------------------------------------

/**
 * @endpoint POST /api/v1/owner/auth/login
 * @throws ApiError 401 — login yoki parol noto'g'ri; 429 — juda ko'p urinish
 */
export async function ownerLogin(request: OwnerLoginRequest): Promise<OwnerUser> {
  await delay(600);
  const now = Date.now();
  loginFailures = loginFailures.filter((at) => now - at < LOGIN_WINDOW_MS);
  if (loginFailures.length >= MAX_LOGIN_FAILURES) {
    throw new ApiError(429, "Juda ko'p urinish. Birozdan keyin qaytadan urinib ko'ring.");
  }

  const record = mockOwners.find(
    (owner) => owner.login === request.login.trim() && owner.password === request.password,
  );
  if (!record) {
    loginFailures.push(now);
    throw new ApiError(401, "Login yoki parol noto'g'ri.");
  }

  loginFailures = [];
  writeSession({ ownerId: record.id, expiresAt: now + SESSION_MS });
  return toOwnerUser(record);
}

/** @endpoint POST /api/v1/owner/auth/logout */
export async function ownerLogout(): Promise<void> {
  await delay(200);
  writeSession(null);
}

/**
 * @endpoint GET /api/v1/owner/auth/me
 * @throws ApiError 401 — sessiya yo'q yoki muddati tugagan
 */
export async function getOwnerMe(): Promise<OwnerUser> {
  await delay(250);
  return requireOwner();
}

// ---------------------------------------------------------------------------
// Ishtirokchilar
// ---------------------------------------------------------------------------

/** @endpoint GET /api/v1/owner/participants?search=&status=&page=&pageSize= */
export async function getOwnerParticipants(query: OwnerParticipantListQuery): Promise<OwnerParticipantListResponse> {
  await delay(350);
  requireOwner();
  const context = buildContext();
  const found = context.people.filter((person) => matchesSearch(person, query.search ?? ""));

  // Tablar kesishmaydi: ALL — qolgan to'rttasining yig'indisi.
  const counts: OwnerParticipantListResponse["counts"] = {
    ALL: found.length,
    ACTIVE: 0,
    BLOCKED: 0,
    DISQUALIFIED: 0,
    INCOMPLETE: 0,
  };
  for (const person of found) {
    counts[participantTab(person)] += 1;
  }

  const filter: OwnerParticipantFilter | undefined = query.status;
  const rankOf = (person: Person) => (person.sourceId ? context.rankBySource.get(person.sourceId) : undefined);
  const items = found
    .filter((person) => !filter || participantTab(person) === filter)
    // Avval reytingdagilar o'rni bo'yicha, keyin qolganlari — eng yangi ro'yxatdan o'tgan birinchi.
    .sort((a, b) => {
      const rankA = rankOf(a);
      const rankB = rankOf(b);
      if (rankA !== undefined || rankB !== undefined) {
        if (rankA === undefined) return 1;
        if (rankB === undefined) return -1;
        return rankA - rankB;
      }
      return b.registeredAt.localeCompare(a.registeredAt) || a.id.localeCompare(b.id);
    });

  const page = paginate(items, query.page, query.pageSize);
  return { ...page, items: page.items.map((person) => toOwnerParticipant(person, context)), counts };
}

/** Ism/familiya: 2–40 ta harf, apostrof, chiziqcha va bo'sh joy (raqam yo'q). */
function validName(value: unknown, label: string): string {
  const trimmed = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!/^[\p{L}'ʻʼ‘’`\- ]{2,40}$/u.test(trimmed) || !/\p{L}/u.test(trimmed)) {
    throw new ApiError(422, `${label} 2–40 ta harfdan iborat bo'lsin (apostrof, chiziqcha va bo'sh joy mumkin).`);
  }
  return trimmed;
}

/**
 * Xato tartibi (backend bilan bir xil): 400 — bo'sh yoki noma'lum maydon; 422 — qiymat noto'g'ri
 * (tur ham); 404 — ishtirokchi yo'q; 409 — telefon boshqa ishtirokchida.
 * @endpoint PATCH /api/v1/owner/participants/:id
 */
export async function updateOwnerParticipant(id: string, update: OwnerParticipantUpdate): Promise<OwnerParticipant> {
  await delay(450);
  requireOwner();

  // Kiruvchi tana — tekshirilmagan JSON (tur ham noto'g'ri bo'lishi mumkin).
  const body: Record<string, unknown> = { ...update };
  const unknown = Object.keys(body).filter((key) => !UPDATE_FIELDS.has(key));
  if (unknown.length > 0) {
    throw new ApiError(400, `Noma'lum maydon: ${unknown.join(", ")}.`);
  }
  const given = (key: string) => body[key] !== undefined;
  if (![...UPDATE_FIELDS].some(given)) {
    throw new ApiError(400, "O'zgartirish uchun kamida bitta maydonni kiriting.");
  }

  const edits: OwnerEdits = {};
  if (given("firstName")) edits.firstName = validName(body.firstName, "Ism");
  if (given("lastName")) edits.lastName = validName(body.lastName, "Familiya");
  if (given("age")) {
    const age = body.age;
    if (typeof age !== "number" || !Number.isInteger(age) || age < 14 || age > 100) {
      throw new ApiError(422, "Yosh 14 dan 100 gacha butun son bo'lsin.");
    }
    edits.age = age;
  }
  if (given("phone")) {
    const normalized = typeof body.phone === "string" ? normalizePhone(body.phone) : null;
    if (!normalized) {
      throw new ApiError(422, "Telefon raqami +998 va 9 ta raqamdan iborat bo'lsin.");
    }
    edits.phone = normalized;
  }
  if (given("status")) {
    const status = PARTICIPANT_STATUSES.find((value) => value === body.status);
    if (!status) {
      throw new ApiError(422, "Holat noto'g'ri.");
    }
    edits.status = status;
  }

  const owner = readOwnerStore();
  const context = buildContext(owner);
  const person = context.byId.get(id);
  if (!person) {
    throw new ApiError(404, "Ishtirokchi topilmadi. U o'chirilgan bo'lishi mumkin.");
  }

  if (edits.phone !== undefined && context.people.some((other) => other.id !== id && other.phone === edits.phone)) {
    throw new ApiError(409, "Bu telefon raqami boshqa ishtirokchida.");
  }

  const next: OwnerStore = { ...owner, edits: { ...owner.edits, [id]: { ...owner.edits[id], ...edits } } };
  writeOwnerStore(next);
  const nextContext = buildContext(next);
  const updated = nextContext.byId.get(id);
  if (!updated) throw new ApiError(404, "Ishtirokchi topilmadi.");
  return toOwnerParticipant(updated, nextContext);
}

/**
 * @endpoint DELETE /api/v1/owner/participants/:id
 * @throws ApiError 404
 */
export async function deleteOwnerParticipant(id: string): Promise<void> {
  await delay(450);
  requireOwner();
  const owner = readOwnerStore();
  if (!buildContext(owner).byId.has(id)) {
    throw new ApiError(404, "Ishtirokchi topilmadi. U allaqachon o'chirilgan bo'lishi mumkin.");
  }
  const edits = { ...owner.edits };
  const reviews = { ...owner.reviews };
  delete edits[id];
  delete reviews[id];
  writeOwnerStore({ ...owner, deleted: [...owner.deleted, id], edits, reviews });
}

// ---------------------------------------------------------------------------
// Target holatlari
// ---------------------------------------------------------------------------

/** Admin mock elementini ega ko'rinishiga: ishtirokchi — Telegram ID, tahrirlangan ism va holat. */
function adaptTarget(item: TargetCaseListItem, context: Context): TargetCaseListItem | null {
  const person = context.bySource.get(item.participant.id);
  if (!person) return null;
  return {
    ...item,
    participant: {
      id: person.id,
      firstName: person.firstName ?? "",
      lastName: person.lastName ?? "",
      phone: person.phone ?? "",
      instagramUsername: person.instagramUsername,
      status: person.status,
    },
  };
}

function allTargets(context: Context): TargetCaseListItem[] {
  return listTargetCases({ pageSize: MAX_PAGE_SIZE }, context.virtual)
    .items.map((item) => adaptTarget(item, context))
    .filter((item): item is TargetCaseListItem => item !== null);
}

function matchesTargetFilter(status: TargetCaseStatus, filter: TargetStatusFilter | undefined): boolean {
  if (!filter) return true;
  if (filter === "OPEN") return status === "NEW" || status === "WARNED";
  return status === filter;
}

/** @endpoint GET /api/v1/owner/targets?status=&search=&page=&pageSize= */
export async function getOwnerTargets(query: TargetCaseListQuery): Promise<TargetCaseListResponse> {
  await delay(350);
  requireOwner();
  const context = buildContext();
  const found = allTargets(context).filter((item) => matchesPerson(item.participant, query.search ?? ""));

  const statusCounts: TargetCaseListResponse["statusCounts"] = {
    ALL: found.length,
    OPEN: found.filter((item) => matchesTargetFilter(item.status, "OPEN")).length,
    NEW: found.filter((item) => item.status === "NEW").length,
    WARNED: found.filter((item) => item.status === "WARNED").length,
    DISQUALIFIED: found.filter((item) => item.status === "DISQUALIFIED").length,
    DISMISSED: found.filter((item) => item.status === "DISMISSED").length,
  };

  const items = found
    .filter((item) => matchesTargetFilter(item.status, query.status))
    .sort((a, b) => b.detectedOn.localeCompare(a.detectedOn) || a.id.localeCompare(b.id));

  return { ...paginate(items, query.page, query.pageSize), statusCounts };
}

/**
 * Xato tartibi: 400 — `status` yo'q yoki noma'lum maydon; 422 — holat noto'g'ri yoki izoh > 300;
 * 404 — target holati yo'q. Holat o'zi bo'lsa — hech narsa o'zgarmaydi (izoh ham yozilmaydi).
 * @endpoint PATCH /api/v1/owner/targets/:id
 */
export async function updateOwnerTarget(id: string, update: OwnerTargetUpdate): Promise<TargetCaseListItem> {
  await delay(400);
  const actor = requireOwner();

  // Kiruvchi tana — tekshirilmagan JSON.
  const body: Record<string, unknown> = { ...update };
  const unknown = Object.keys(body).filter((key) => key !== "status" && key !== "note");
  if (unknown.length > 0 || body.status === undefined) {
    throw new ApiError(400, unknown.length > 0 ? `Noma'lum maydon: ${unknown.join(", ")}.` : "Holatni ko'rsating.");
  }
  const to = TARGET_STATUSES.find((value) => value === body.status);
  if (!to) {
    throw new ApiError(422, "Holat noto'g'ri.");
  }
  if (body.note !== undefined && typeof body.note !== "string") {
    throw new ApiError(422, "Izoh matn bo'lsin.");
  }
  const note = (typeof body.note === "string" ? body.note : "").trim();
  if (note.length > MAX_NOTE_LENGTH) {
    throw new ApiError(422, `Izoh ko'pi bilan ${MAX_NOTE_LENGTH} ta belgi.`);
  }

  const target = getContestData().targets.find((item) => item.id === id);
  const owner = readOwnerStore();
  const context = buildContext(owner);
  const person = target ? context.bySource.get(target.participantId) : undefined;
  const current = allTargets(context).find((item) => item.id === id);
  if (!target || !person || !current) {
    throw new ApiError(404, "Target holati topilmadi.");
  }

  const from = targetCaseStatus(target, context.virtual);
  if (from === to) return current;
  const targetStatus = { ...owner.targetStatus, [id]: to };

  // Ishtirokchi holatiga ta'siri: chetlatish — ishtirokchi ham chetlatiladi; chetlatishdan
  // chiqarilsa, ishtirokchi hozir chetlatilgan bo'lsa va boshqa chetlatish holati qolmasa — faol.
  let participantStatus: OwnerParticipantStatus | null = null;
  if (to === "DISQUALIFIED") {
    participantStatus = "DISQUALIFIED";
  } else if (from === "DISQUALIFIED" && person.status === "DISQUALIFIED") {
    const virtual: MockStore = { ...context.virtual, targetCaseStatus: { ...context.virtual.targetCaseStatus, ...targetStatus } };
    const stillDisqualified = getContestData().targets.some(
      (item) => item.participantId === target.participantId && targetCaseStatus(item, virtual) === "DISQUALIFIED",
    );
    if (!stillDisqualified) participantStatus = "ACTIVE";
  }

  const next: OwnerStore = {
    ...owner,
    targetStatus,
    targetNotes: {
      ...owner.targetNotes,
      [id]: [...(owner.targetNotes[id] ?? []), { at: new Date().toISOString(), from, to, note, by: actor.fullName }],
    },
    edits: participantStatus
      ? { ...owner.edits, [person.id]: { ...owner.edits[person.id], status: participantStatus } }
      : owner.edits,
  };
  writeOwnerStore(next);

  const updated = allTargets(buildContext(next)).find((item) => item.id === id);
  if (!updated) throw new ApiError(404, "Target holati topilmadi.");
  return updated;
}

// ---------------------------------------------------------------------------
// Xavfga yaqin hisoblar
// ---------------------------------------------------------------------------

function toRiskAccount(person: Person, result: RiskResult, context: Context): RiskAccount {
  return {
    participant: toOwnerParticipant(person, context),
    score: result.score,
    level: result.level,
    signals: [...result.signals].sort((a, b) => b.points - a.points),
    review: context.owner.reviews[person.id] ?? null,
  };
}

/** @endpoint GET /api/v1/owner/risk?level=&includeSafe=&search=&page=&pageSize= */
export async function getRiskAccounts(query: RiskListQuery): Promise<RiskListResponse> {
  await delay(400);
  requireOwner();
  const context = buildContext();

  const found = context.people.flatMap((person) => {
    const result = context.risk.get(person.id);
    return result && matchesSearch(person, query.search ?? "") ? [{ person, result }] : [];
  });

  const counts: RiskListResponse["counts"] = { ALL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, SAFE: 0 };
  const visible = found.filter(({ person, result }) => {
    const hidden = hiddenAsSafe(context.owner.reviews[person.id], result.signals);
    if (hidden) counts.SAFE += 1;
    if (hidden && !query.includeSafe) return false;
    counts.ALL += 1;
    counts[result.level] += 1;
    return true;
  });

  const items = visible
    .filter(({ result }) => !query.level || result.level === query.level)
    .sort(
      (a, b) =>
        b.result.score - a.result.score ||
        personViews(b.person, context) - personViews(a.person, context) ||
        a.person.id.localeCompare(b.person.id),
    );

  const page = paginate(items, query.page, query.pageSize);
  return {
    ...page,
    items: page.items.map(({ person, result }) => toRiskAccount(person, result, context)),
    counts,
  };
}

/**
 * @endpoint POST /api/v1/owner/risk/:id/review   { verdict: "SAFE" | "WATCH" | null }
 * @throws ApiError 404 — ishtirokchi yoki xavf belgisi topilmadi; 422 — belgi noto'g'ri
 */
export async function reviewRiskAccount(id: string, verdict: RiskVerdict | null): Promise<RiskAccount> {
  await delay(350);
  const actor = requireOwner();
  if (verdict !== null && verdict !== "SAFE" && verdict !== "WATCH") {
    throw new ApiError(422, "Belgi noto'g'ri.");
  }

  const owner = readOwnerStore();
  const context = buildContext(owner);
  const person = context.byId.get(id);
  if (!person || !context.risk.has(id)) {
    throw new ApiError(404, "Bu hisob xavfli ro'yxatda topilmadi.");
  }

  const reviews = { ...owner.reviews };
  if (verdict) {
    reviews[id] = { verdict, at: new Date().toISOString(), by: actor.fullName };
  } else {
    delete reviews[id];
  }
  const next: OwnerStore = { ...owner, reviews };
  writeOwnerStore(next);

  const nextContext = buildContext(next);
  const nextPerson = nextContext.byId.get(id);
  const result = nextContext.risk.get(id);
  if (!nextPerson || !result) throw new ApiError(404, "Bu hisob xavfli ro'yxatda topilmadi.");
  return toRiskAccount(nextPerson, result, nextContext);
}
