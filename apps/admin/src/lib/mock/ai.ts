/**
 * MOCK backend: AI tekshiruvi — admin namuna rasmlar va mezonlarni beradi, tasdiqlagach worker
 * har bir videoni Claude bilan tekshiradi. Haqiqiy backendda:
 *   GET    /api/v1/admin/ai/state
 *   POST   /api/v1/admin/ai/draft                    PUT /api/v1/admin/ai/draft
 *   POST   /api/v1/admin/ai/draft/references          PATCH | DELETE /api/v1/admin/ai/draft/references/:id
 *   GET    /api/v1/admin/ai/references/:id/image
 *   GET    /api/v1/admin/ai/candidates?search=
 *   POST   /api/v1/admin/ai/approve                   POST /api/v1/admin/ai/run-all
 *   GET    /api/v1/admin/ai/reviews                   GET  /api/v1/admin/ai/reviews/:id/frames/:second
 *   POST   /api/v1/admin/ai/reviews/:id/decision
 *
 * Mock worker vaqt bo'yicha taqlid qilinadi: navbatga qo'yilganda har bir video uchun boshlanish va
 * tugash vaqti belgilanadi (5 ta parallel "yo'lak", 2,5–5,5 soniyadan), holat esa o'qilgan paytdagi
 * vaqtdan hisoblanadi: QUEUED → PROCESSING → DONE (ba'zilari FAILED). Xulosa, ishonch, dalillar va
 * sarf video shortcode'i bo'yicha deterministik (sahifa yangilansa ham o'zgarmaydi).
 *
 * Holat `localStorage` da: `reels-admin:mock-ai` (versiyalar, navbat, qo'lda qarorlar) va
 * `reels-admin:mock-ai-images` (namuna rasmlar, `data:` URL). Audit yozuvlari — umumiy mock
 * store'da (`reels-admin:mock-store`). Boshlang'ich holatga qaytarish — shu ikki kalitni o'chirish.
 */
import { ApiError } from "../api-error";
import { todayIso } from "../dates";
import { AI_REF_KIND_LABELS, AI_RUN_MODE_LABELS } from "../labels";
import {
  AI_LIMITS,
  type AdminUser,
  type AiApproveRequest,
  type AiCandidate,
  type AiConfigVersion,
  type AiDecisionRequest,
  type AiDraftUpdate,
  type AiEvidence,
  type AiProgress,
  type AiRefKind,
  type AiReferenceInput,
  type AiReferenceUpdate,
  type AiReviewItem,
  type AiReviewListQuery,
  type AiReviewListResponse,
  type AiReviewState,
  type AiSettings,
  type AiState,
  type AiTokens,
  type AiVerdict,
} from "../types";
import { recordAudit } from "./audit";
import { getContestData, latestViews, reelStatusOn, type MockParticipant, type MockReel } from "./contest";
import { createRandom, hashString } from "./random";
import { effectiveStatus, isRankable } from "./ranking";
import { readStore } from "./store";
import { matchesPerson } from "./text";

const AI_STORE_KEY = "reels-admin:mock-ai";
const AI_IMAGES_KEY = "reels-admin:mock-ai-images";
const AI_STORE_VERSION = 1;

const SETTINGS: AiSettings = {
  model: "claude-opus-5-5",
  frameIntervalSec: 2,
  frameHeight: 720,
  confidenceMin: 0.8,
  trialSize: AI_LIMITS.trialMax,
};

/** Worker bir vaqtda nechta videoni ishlaydi. */
const WORKER_LANES = 5;
const MIN_PROCESS_MS = 2500;
const MAX_PROCESS_MS = 5500;
/** Navbatga qo'yilgandan worker olguncha. */
const START_DELAY_MS = 1500;
const MAX_CANDIDATES = 50;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
/** Brauzer ochib bo'lmaydigan manzil — `<img>` 404 dagidek `error` beradi. */
const MISSING_IMAGE_URL = "data:image/gif;base64,";

/** Navbatdagi bitta video. Holat va natija vaqtdan va shortcode'dan hisoblanadi. */
interface MockAiReview {
  id: string;
  version: number;
  reelId: string;
  queuedAt: string;
  /** Worker olgan vaqt (ms). */
  startAt: number;
  /** Tugagan vaqt (ms). */
  finishAt: number;
  manual: AiReviewItem["manual"];
}

interface MockAiStore {
  version: number;
  draft: AiConfigVersion | null;
  active: AiConfigVersion | null;
  run: AiState["run"];
  /** Faqat joriy `run.version` navbati (yangi versiya tasdiqlanganda eskisi o'chiriladi). */
  reviews: MockAiReview[];
}

// ---------------------------------------------------------------------------
// Saqlash
// ---------------------------------------------------------------------------

/**
 * `localStorage` ishlamasa (yozib bo'lmasa) — sahifa ochiq turganda shu nusxalar ishlaydi. Xotira
 * ishlab tursa ular ishlatilmaydi: kalitlar o'chirilsa, mock darhol boshlang'ich holatga qaytadi.
 */
let memoryOnly = false;
let memoryStore: MockAiStore | null = null;
/** Rasmlar katta — har renderda qayta `JSON.parse` qilmaslik uchun oxirgi o'qilgan nusxa. */
let imageCache: Record<string, string> = {};
let imageCacheRaw: string | null = null;

function emptyStore(): MockAiStore {
  return { version: AI_STORE_VERSION, draft: null, active: null, run: null, reviews: [] };
}

function readAiStore(): MockAiStore {
  try {
    const raw = memoryOnly ? null : window.localStorage.getItem(AI_STORE_KEY);
    if (!raw) return memoryOnly && memoryStore ? clone(memoryStore) : emptyStore();
    const parsed = JSON.parse(raw) as Partial<MockAiStore>;
    if (parsed.version !== AI_STORE_VERSION) return emptyStore();
    return { ...emptyStore(), ...parsed, version: AI_STORE_VERSION };
  } catch {
    return memoryStore ? clone(memoryStore) : emptyStore();
  }
}

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
}

const QUOTA_MESSAGE =
  "Brauzer xotirasi to'ldi: mock rejimda rasmlar brauzerda saqlanadi. Boshqa rasmlarni o'chiring yoki kichikroq rasm tanlang.";

/** `localStorage` ga yozish; to'lsa — `413`, umuman ishlamasa — faqat shu sahifa xotirasida. */
function persist(key: string, raw: string): void {
  if (memoryOnly) return;
  try {
    window.localStorage.setItem(key, raw);
  } catch (error) {
    if (isQuotaError(error)) throw new ApiError(413, QUOTA_MESSAGE);
    memoryOnly = true;
  }
}

function writeAiStore(store: MockAiStore): void {
  persist(AI_STORE_KEY, JSON.stringify(store));
  memoryStore = clone(store);
}

function readImages(): Record<string, string> {
  if (memoryOnly) return imageCache;
  try {
    const raw = window.localStorage.getItem(AI_IMAGES_KEY);
    if (raw !== imageCacheRaw) {
      imageCache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      imageCacheRaw = raw;
    }
  } catch {
    // O'qib bo'lmadi — oxirgi nusxa qoladi.
  }
  return imageCache;
}

function writeImages(images: Record<string, string>): void {
  const raw = JSON.stringify(images);
  persist(AI_IMAGES_KEY, raw);
  imageCache = images;
  imageCacheRaw = raw;
}

/** Qoralamada ham, faol versiyada ham ishlatilmaydigan rasmlarni o'chiradi. */
function collectImages(store: MockAiStore): void {
  const used = new Set([...(store.draft?.references ?? []), ...(store.active?.references ?? [])].map((ref) => ref.id));
  const images = readImages();
  const kept = Object.fromEntries(Object.entries(images).filter(([id]) => used.has(id)));
  if (Object.keys(kept).length !== Object.keys(images).length) writeImages(kept);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function randomId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/** Audit uchun qisqa matn. */
function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function audit(actor: AdminUser, entry: { action: string; entity?: "settings" | "reel"; entityId?: string; before?: string; after?: string; reason?: string }): void {
  recordAudit({
    actorId: actor.id,
    actorName: actor.fullName,
    action: entry.action,
    entity: entry.entity ?? "settings",
    entityId: entry.entityId ?? "ai",
    before: entry.before ?? "",
    after: entry.after ?? "",
    reason: entry.reason ?? "",
  });
}

// ---------------------------------------------------------------------------
// Qabul qilingan videolar
// ---------------------------------------------------------------------------

interface AcceptedReel {
  reel: MockReel;
  participant: MockParticipant;
  views: number;
}

/** Bugun qabul qilingan videolar (bloklangan / diskvalifikatsiya qilinganlarniki emas), eng ko'p ko'rilgani birinchi. */
function acceptedReels(): AcceptedReel[] {
  const data = getContestData();
  const store = readStore();
  const participants = new Map(data.participants.map((item) => [item.id, item]));
  const today = todayIso();
  const items: AcceptedReel[] = [];
  for (const reel of data.reels) {
    const participant = participants.get(reel.participantId);
    if (!participant || !isRankable(effectiveStatus(participant, store))) continue;
    if (reelStatusOn(reel, today) !== "ACCEPTED") continue;
    items.push({ reel, participant, views: latestViews(reel) });
  }
  return items.sort(
    (a, b) => b.views - a.views || a.reel.submittedAt.localeCompare(b.reel.submittedAt) || a.reel.id.localeCompare(b.reel.id),
  );
}

const fullName = (participant: MockParticipant) => `${participant.firstName} ${participant.lastName}`;

// ---------------------------------------------------------------------------
// Worker taqlidi
// ---------------------------------------------------------------------------

/** Videolarni navbatga qo'yish: har biriga bo'sh "yo'lak"dagi boshlanish va tugash vaqti. */
function schedule(existing: MockAiReview[], reels: MockReel[], version: number, now: number): MockAiReview[] {
  const lanes = Array.from({ length: WORKER_LANES }, () => now + START_DELAY_MS);
  // Hali tugamaganlar band qilgan yo'laklar.
  existing
    .map((review) => review.finishAt)
    .filter((finishAt) => finishAt > now)
    .sort((a, b) => b - a)
    .slice(0, WORKER_LANES)
    .forEach((finishAt, index) => {
      lanes[index] = Math.max(lanes[index], finishAt);
    });

  const queuedAt = new Date(now).toISOString();
  return reels.map((reel) => {
    const lane = lanes.indexOf(Math.min(...lanes));
    const random = createRandom(hashString(`ai-duration:${version}:${reel.shortcode}`));
    const startAt = lanes[lane];
    const finishAt = startAt + random.int(MIN_PROCESS_MS, MAX_PROCESS_MS);
    lanes[lane] = finishAt;
    return { id: `air_${version}_${reel.id}`, version, reelId: reel.id, queuedAt, startAt, finishAt, manual: null };
  });
}

const APPROVED_REASONS = [
  "Mahsulot qadog'i va logotipi videoning bir necha joyida aniq ko'rinadi; taqiqlangan narsa yo'q.",
  "Ishtirokchi mahsulotni qo'lida ushlab ko'rsatadi, nomi o'qiladi. Mezonlarga mos.",
  "Mahsulot ishlatilayotgani ko'rsatilgan, qadoq yaqin planda bor. Boshqa brend ko'rinmaydi.",
];
const REJECTED_REASONS = [
  "Videoda mahsulot umuman ko'rinmaydi — faqat ishtirokchining o'zi va xona.",
  "Boshqa brend mahsuloti yaqin planda ko'rsatilgan («Bo'lmasligi kerak» namunasiga mos).",
  "Video tanlovga aloqasiz: mahsulot qadog'i ham, logotip ham topilmadi.",
];
const UNCERTAIN_REASONS = [
  "Mahsulotga o'xshash qadoq bor, lekin logotip xira — aniq aytib bo'lmaydi.",
  "Mahsulot faqat 1–2 soniya va uzoqdan ko'rinadi; ishonch past.",
  "Kadrlar qorong'i, qadoqdagi yozuv o'qilmaydi.",
];
const EVIDENCE: Record<AiVerdict, string[]> = {
  APPROVED: [
    "Qadoqdagi logotip yaqin planda",
    "Mahsulot qo'lda, nomi o'qiladi",
    "Mahsulot ishlatilmoqda",
    "Qadoqning orqa tomoni ko'rinadi",
  ],
  REJECTED: ["Mahsulot ko'rinmaydi", "Boshqa brend qadog'i", "Faqat xona va ishtirokchi"],
  UNCERTAIN: ["Qadoqqa o'xshash narsa, lekin xira", "Uzoqdan, logotip o'qilmaydi", "Qorong'i kadr"],
};
const FAILURES = [
  "Videoni yuklab bo'lmadi: Instagram videoni bermadi (o'chirilgan yoki yopiq akkaunt).",
  "Video buzilgan — kadrlarni ajratib bo'lmadi.",
  "Claude javobini o'qib bo'lmadi (3 marta urinildi).",
];

/** Mock narxlar (1 token uchun, $) — faqat ~$0,16 / video chiqishi uchun; haqiqiy hisob backendda. */
const PRICE = { input: 2.25e-6, output: 1.1e-5, cacheRead: 2.2e-7, cacheWrite: 2.8e-6 };

interface Outcome {
  failed: boolean;
  error: string | null;
  attempts: number;
  verdict: AiVerdict;
  confidence: number;
  reason: string;
  evidence: AiEvidence[];
  tokens: AiTokens;
  costUsd: number;
}

function outcomeOf(review: MockAiReview, reel: MockReel, referenceCount: number, cacheWriter: boolean): Outcome {
  const random = createRandom(hashString(`ai-outcome:${review.version}:${reel.shortcode}`));
  const failed = random.chance(0.06);
  const roll = random.next();
  const lowConfidence = roll >= 0.84;
  const raw: AiVerdict = roll < 0.7 ? "APPROVED" : roll < 0.84 ? "REJECTED" : random.chance(0.5) ? "APPROVED" : "REJECTED";
  const confidence = lowConfidence ? 0.42 + random.next() * 0.37 : 0.8 + random.next() * 0.19;
  const verdict: AiVerdict = confidence < SETTINGS.confidenceMin ? "UNCERTAIN" : raw;

  // ~2 daqiqalik videolar: kadr har 2 soniyada.
  const lengthSec = random.int(70, 150);
  const evidenceCount = random.int(1, 3);
  const descriptions = EVIDENCE[verdict];
  const seconds = new Set<number>();
  while (seconds.size < evidenceCount) seconds.add(random.int(0, Math.floor(lengthSec / 2)) * 2);
  const evidence = [...seconds]
    .sort((a, b) => a - b)
    .map((second, index) => ({
      second,
      description: descriptions[(index + random.int(0, descriptions.length - 1)) % descriptions.length],
      hasFrame: random.chance(0.92),
    }));

  const frames = Math.ceil(lengthSec / SETTINGS.frameIntervalSec);
  const referenceTokens = 600 + referenceCount * 1500;
  const tokens: AiTokens = {
    input: frames * random.int(1050, 1150) + random.int(2000, 3000),
    output: random.int(220, 650),
    cacheRead: cacheWriter ? 0 : referenceTokens,
    cacheWrite: cacheWriter ? referenceTokens : 0,
  };
  const costUsd =
    Math.round(
      (tokens.input * PRICE.input +
        tokens.output * PRICE.output +
        tokens.cacheRead * PRICE.cacheRead +
        tokens.cacheWrite * PRICE.cacheWrite) *
        10_000,
    ) / 10_000;

  const reasons = verdict === "APPROVED" ? APPROVED_REASONS : verdict === "REJECTED" ? REJECTED_REASONS : UNCERTAIN_REASONS;
  return {
    failed,
    error: failed ? random.pick(FAILURES) : null,
    attempts: failed ? 3 : random.chance(0.1) ? 2 : 1,
    verdict,
    confidence: Math.round(confidence * 100) / 100,
    reason: random.pick(reasons),
    evidence,
    tokens,
    costUsd,
  };
}

function stateAt(review: MockAiReview, outcome: Outcome, now: number): AiReviewState {
  if (now < review.startAt) return "QUEUED";
  if (now < review.finishAt) return "PROCESSING";
  return outcome.failed ? "FAILED" : "DONE";
}

interface Context {
  now: number;
  reels: Map<string, MockReel>;
  participants: Map<string, MockParticipant>;
  referenceCount: number;
  /** Ishga tushirishdagi birinchi video kesh yozadi (namuna rasmlar va mezonlar). */
  cacheWriterId: string | null;
}

function contextOf(store: MockAiStore, now: number): Context {
  const data = getContestData();
  const first = [...store.reviews].sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id))[0];
  return {
    now,
    reels: new Map(data.reels.map((reel) => [reel.id, reel])),
    participants: new Map(data.participants.map((item) => [item.id, item])),
    referenceCount: store.active?.references.length ?? 0,
    cacheWriterId: first?.id ?? null,
  };
}

function toItem(review: MockAiReview, context: Context): AiReviewItem | null {
  const reel = context.reels.get(review.reelId);
  const participant = reel ? context.participants.get(reel.participantId) : undefined;
  if (!reel || !participant) return null;

  const outcome = outcomeOf(review, reel, context.referenceCount, review.id === context.cacheWriterId);
  const state = stateAt(review, outcome, context.now);
  const done = state === "DONE";
  const verdict = done ? outcome.verdict : null;
  const stateTime =
    state === "QUEUED" ? review.queuedAt : new Date(state === "PROCESSING" ? review.startAt : review.finishAt).toISOString();
  const updatedAt = review.manual && review.manual.at > stateTime ? review.manual.at : stateTime;

  return {
    id: review.id,
    version: review.version,
    participant: { id: participant.id, fullName: fullName(participant), phone: participant.phone },
    reel: { shortcode: reel.shortcode, url: reel.url, views: latestViews(reel) },
    state,
    verdict,
    finalVerdict: review.manual?.decision ?? verdict,
    confidence: done ? outcome.confidence : null,
    reason: done ? outcome.reason : null,
    evidence: done ? outcome.evidence : [],
    manual: review.manual,
    attempts: state === "QUEUED" ? 0 : state === "PROCESSING" ? 1 : outcome.attempts,
    error: state === "FAILED" ? outcome.error : null,
    tokens: done ? outcome.tokens : null,
    costUsd: done ? outcome.costUsd : null,
    updatedAt,
  };
}

function emptyProgress(): AiProgress {
  return {
    total: 0,
    queued: 0,
    processing: 0,
    done: 0,
    failed: 0,
    approved: 0,
    rejected: 0,
    uncertain: 0,
    manual: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
  };
}

function itemsOf(store: MockAiStore, now: number): AiReviewItem[] {
  if (!store.run) return [];
  const context = contextOf(store, now);
  const version = store.run.version;
  return store.reviews
    .filter((review) => review.version === version)
    .map((review) => toItem(review, context))
    .filter((item): item is AiReviewItem => item !== null);
}

function progressOf(items: AiReviewItem[]): AiProgress {
  const progress = emptyProgress();
  for (const item of items) {
    progress.total += 1;
    if (item.state === "QUEUED") progress.queued += 1;
    else if (item.state === "PROCESSING") progress.processing += 1;
    else if (item.state === "DONE") progress.done += 1;
    else progress.failed += 1;
    if (item.finalVerdict === "APPROVED") progress.approved += 1;
    else if (item.finalVerdict === "REJECTED") progress.rejected += 1;
    else if (item.finalVerdict === "UNCERTAIN") progress.uncertain += 1;
    if (item.manual) progress.manual += 1;
    if (item.tokens) {
      progress.inputTokens += item.tokens.input;
      progress.outputTokens += item.tokens.output;
      progress.cacheReadTokens += item.tokens.cacheRead;
      progress.cacheWriteTokens += item.tokens.cacheWrite;
    }
    progress.costUsd += item.costUsd ?? 0;
  }
  progress.costUsd = Math.round(progress.costUsd * 10_000) / 10_000;
  return progress;
}

/** "Hamma videolar" ishga tushgan bo'lsa — keyin qabul qilingan videolar ham navbatga qo'shiladi. */
function syncFullRun(store: MockAiStore, now: number): MockAiStore {
  const run = store.run;
  if (!run || run.mode !== "FULL" || !store.active) return store;
  const queued = new Set(store.reviews.map((review) => review.reelId));
  const missing = acceptedReels()
    .map((item) => item.reel)
    .filter((reel) => !queued.has(reel.id));
  if (missing.length === 0) return store;
  const updated = { ...store, reviews: [...store.reviews, ...schedule(store.reviews, missing, run.version, now)] };
  writeAiStore(updated);
  return updated;
}

function stateOf(store: MockAiStore, now: number): AiState {
  return {
    draft: store.draft ? clone(store.draft) : null,
    active: store.active ? clone(store.active) : null,
    run: store.run ? { ...store.run } : null,
    progress: progressOf(itemsOf(store, now)),
    // Mock worker doim ishlab turadi: oxirgi signal — bir necha soniya oldin.
    worker: { lastSeenAt: new Date(now - 4000).toISOString(), online: true },
    settings: { ...SETTINGS },
  };
}

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

export function getAiState(): AiState {
  const now = Date.now();
  return stateOf(syncFullRun(readAiStore(), now), now);
}

export function createAiDraft(): AiState {
  const now = Date.now();
  const store = readAiStore();
  if (store.draft) return stateOf(store, now);

  const at = new Date(now).toISOString();
  const active = store.active;
  const draft: AiConfigVersion = {
    version: (active?.version ?? 0) + 1,
    status: "DRAFT",
    criteria: active?.criteria ?? "",
    // Rasmlar faol versiya bilan umumiy (o'chirilsa ham faol versiyadagisi qoladi).
    references: active ? clone(active.references) : [],
    createdAt: at,
    updatedAt: at,
    approvedAt: null,
    approvedBy: null,
  };
  const updated = { ...store, draft };
  writeAiStore(updated);
  return stateOf(updated, now);
}

function requireDraft(store: MockAiStore): AiConfigVersion {
  if (!store.draft) {
    throw new ApiError(409, "Tahrirlanadigan qoralama yo'q. «Yangi versiya» tugmasini bosing.", "AI_NO_DRAFT");
  }
  return store.draft;
}

export function updateAiDraft(update: AiDraftUpdate, actor: AdminUser): AiState {
  const now = Date.now();
  const store = readAiStore();
  const draft = requireDraft(store);
  if (typeof update.criteria !== "string" || update.criteria.length > AI_LIMITS.criteriaMax) {
    throw new ApiError(400, `Mezonlar ko'pi bilan ${AI_LIMITS.criteriaMax} ta belgi bo'lsin.`);
  }
  if (update.criteria === draft.criteria) return stateOf(store, now);

  const updated = {
    ...store,
    draft: { ...draft, criteria: update.criteria, updatedAt: new Date(now).toISOString() },
  };
  writeAiStore(updated);
  audit(actor, {
    action: "ai.draft.update",
    before: excerpt(draft.criteria),
    after: excerpt(update.criteria),
  });
  return stateOf(updated, now);
}

function isKind(value: unknown): value is AiRefKind {
  return value === "MUST" || value === "MUST_NOT" || value === "INFO";
}

function describeRef(ref: { kind: AiRefKind; note: string }): string {
  return ref.note.trim() ? `${AI_REF_KIND_LABELS[ref.kind]}: ${excerpt(ref.note, 80)}` : AI_REF_KIND_LABELS[ref.kind];
}

export function addAiReference(input: AiReferenceInput, actor: AdminUser): AiState {
  const now = Date.now();
  const store = readAiStore();
  const draft = requireDraft(store);

  const match = DATA_URL_PATTERN.exec(input.dataUrl);
  if (!match) {
    throw new ApiError(400, "Faqat JPG, PNG yoki WebP rasm yuborish mumkin.", "AI_REFERENCE_INVALID");
  }
  const [, mime, base64] = match;
  const sizeBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (sizeBytes > AI_LIMITS.maxReferenceBytes) {
    throw new ApiError(413, "Rasm 2 MB dan katta bo'lmasin.", "AI_REFERENCE_TOO_LARGE");
  }
  if (!isKind(input.kind)) throw new ApiError(400, "Rasm turi noto'g'ri.");
  if (typeof input.note !== "string" || input.note.length > AI_LIMITS.noteMax) {
    throw new ApiError(400, `Izoh ko'pi bilan ${AI_LIMITS.noteMax} ta belgi bo'lsin.`);
  }
  if (draft.references.length >= AI_LIMITS.maxReferences) {
    throw new ApiError(409, `Ko'pi bilan ${AI_LIMITS.maxReferences} ta rasm qo'shish mumkin.`, "AI_REFERENCE_LIMIT");
  }

  const at = new Date(now).toISOString();
  const reference = { id: randomId("ref"), kind: input.kind, note: input.note.trim(), mime, sizeBytes, createdAt: at };
  // Avval rasm: xotira to'lsa — hech narsa o'zgarmaydi.
  writeImages({ ...readImages(), [reference.id]: input.dataUrl });
  const updated = {
    ...store,
    draft: { ...draft, references: [...draft.references, reference], updatedAt: at },
  };
  writeAiStore(updated);
  audit(actor, { action: "ai.reference.add", after: describeRef(reference) });
  return stateOf(updated, now);
}

export function updateAiReference(id: string, update: AiReferenceUpdate): AiState {
  const now = Date.now();
  const store = readAiStore();
  const draft = requireDraft(store);
  const reference = draft.references.find((ref) => ref.id === id);
  if (!reference) throw new ApiError(404, "Rasm topilmadi — u o'chirilgan bo'lishi mumkin.");
  if (update.kind !== undefined && !isKind(update.kind)) throw new ApiError(400, "Rasm turi noto'g'ri.");
  if (update.note !== undefined && (typeof update.note !== "string" || update.note.length > AI_LIMITS.noteMax)) {
    throw new ApiError(400, `Izoh ko'pi bilan ${AI_LIMITS.noteMax} ta belgi bo'lsin.`);
  }

  const next = {
    ...reference,
    ...(update.kind !== undefined ? { kind: update.kind } : {}),
    ...(update.note !== undefined ? { note: update.note.trim() } : {}),
  };
  const updated = {
    ...store,
    draft: {
      ...draft,
      references: draft.references.map((ref) => (ref.id === id ? next : ref)),
      updatedAt: new Date(now).toISOString(),
    },
  };
  writeAiStore(updated);
  return stateOf(updated, now);
}

export function deleteAiReference(id: string, actor: AdminUser): AiState {
  const now = Date.now();
  const store = readAiStore();
  const draft = requireDraft(store);
  const reference = draft.references.find((ref) => ref.id === id);
  if (!reference) throw new ApiError(404, "Rasm topilmadi — u o'chirilgan bo'lishi mumkin.");

  const updated = {
    ...store,
    draft: {
      ...draft,
      references: draft.references.filter((ref) => ref.id !== id),
      updatedAt: new Date(now).toISOString(),
    },
  };
  writeAiStore(updated);
  collectImages(updated);
  audit(actor, { action: "ai.reference.remove", before: describeRef(reference) });
  return stateOf(updated, now);
}

/** `<img src>` uchun: rasm `data:` URL; topilmasa — ochilmaydigan manzil (404 kabi). */
export function aiReferenceImageUrl(id: string): string {
  return readImages()[id] ?? MISSING_IMAGE_URL;
}

export function getAiCandidates(search: string): AiCandidate[] {
  return acceptedReels()
    .filter((item) => matchesPerson(item.participant, search, item.reel.shortcode))
    .slice(0, MAX_CANDIDATES)
    .map((item) => ({
      shortcode: item.reel.shortcode,
      url: item.reel.url,
      fullName: fullName(item.participant),
      views: item.views,
    }));
}

function runLabel(mode: "TRIAL" | "FULL", count: number): string {
  return `${AI_RUN_MODE_LABELS[mode]} (${count} ta video)`;
}

export function approveAiDraft(request: AiApproveRequest, actor: AdminUser): AiState {
  const now = Date.now();
  const store = readAiStore();
  const draft = requireDraft(store);

  if (request.mode !== "TRIAL" && request.mode !== "FULL") throw new ApiError(400, "Ishga tushirish turi noto'g'ri.");
  if (draft.criteria.trim().length < AI_LIMITS.criteriaMinToApprove && draft.references.length === 0) {
    throw new ApiError(
      400,
      `Tasdiqlash uchun mezonlarni yozing (kamida ${AI_LIMITS.criteriaMinToApprove} ta belgi) yoki kamida bitta namuna rasm qo'shing.`,
      "AI_DRAFT_EMPTY",
    );
  }

  const accepted = acceptedReels();
  let reels: MockReel[];
  if (request.mode === "TRIAL") {
    const shortcodes = [...new Set(request.trialShortcodes ?? [])];
    if (shortcodes.length > AI_LIMITS.trialMax) {
      throw new ApiError(400, `Sinov uchun ko'pi bilan ${AI_LIMITS.trialMax} ta video tanlang.`);
    }
    if (shortcodes.length === 0) {
      reels = accepted.slice(0, SETTINGS.trialSize).map((item) => item.reel);
    } else {
      const byShortcode = new Map(accepted.map((item) => [item.reel.shortcode, item.reel]));
      const unknown = shortcodes.filter((code) => !byShortcode.has(code));
      if (unknown.length > 0) {
        throw new ApiError(400, `Bu videolar qabul qilinmagan yoki topilmadi: ${unknown.join(", ")}.`, "AI_TRIAL_UNKNOWN");
      }
      reels = shortcodes.map((code) => byShortcode.get(code)).filter((reel): reel is MockReel => reel !== undefined);
    }
  } else {
    reels = accepted.map((item) => item.reel);
  }
  if (reels.length === 0) throw new ApiError(409, "Tekshiriladigan qabul qilingan video yo'q.", "AI_NO_VIDEOS");

  const at = new Date(now).toISOString();
  const previous = store.active;
  const active: AiConfigVersion = { ...draft, status: "APPROVED", approvedAt: at, approvedBy: actor.fullName, updatedAt: at };
  const run = { version: active.version, mode: request.mode, startedAt: at, startedBy: actor.fullName };
  // Oldingi versiya navbati to'xtatiladi — natijalar endi yangi versiya bo'yicha.
  const updated: MockAiStore = { ...store, draft: null, active, run, reviews: schedule([], reels, active.version, now) };
  writeAiStore(updated);
  collectImages(updated);
  audit(actor, {
    action: "ai.approve",
    before: previous ? `Versiya ${previous.version}` : "",
    after: `Versiya ${active.version}: ${runLabel(request.mode, reels.length)}`,
  });
  return stateOf(updated, now);
}

export function runAiForAll(actor: AdminUser): AiState {
  const now = Date.now();
  const store = readAiStore();
  if (!store.active || !store.run) {
    throw new ApiError(409, "Avval sozlamalarni tasdiqlang.", "AI_NOT_APPROVED");
  }
  const queued = new Set(store.reviews.map((review) => review.reelId));
  const missing = acceptedReels()
    .map((item) => item.reel)
    .filter((reel) => !queued.has(reel.id));
  const at = new Date(now).toISOString();
  const previousMode = store.run.mode;
  const updated: MockAiStore = {
    ...store,
    run: { ...store.run, mode: "FULL", startedAt: at, startedBy: actor.fullName },
    reviews: [...store.reviews, ...schedule(store.reviews, missing, store.active.version, now)],
  };
  writeAiStore(updated);
  audit(actor, {
    action: "ai.run_all",
    before: runLabel(previousMode, store.reviews.length),
    after: `Versiya ${store.active.version}: ${runLabel("FULL", updated.reviews.length)}`,
  });
  return stateOf(updated, now);
}

export function listAiReviews(query: AiReviewListQuery): AiReviewListResponse {
  const now = Date.now();
  const store = syncFullRun(readAiStore(), now);
  const search = (query.search ?? "").trim();

  const items = itemsOf(store, now)
    .filter((item) => !query.verdict || item.finalVerdict === query.verdict)
    .filter((item) => !query.state || item.state === query.state)
    .filter((item) => {
      if (!search) return true;
      const [firstName = "", ...rest] = item.participant.fullName.split(" ");
      return matchesPerson({ firstName, lastName: rest.join(" "), phone: item.participant.phone }, search, item.reel.shortcode);
    })
    // Eng yangi o'zgargani yuqorida.
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));

  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
  const lastPage = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(lastPage, Math.max(1, query.page ?? 1));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export function decideAiReview(id: string, request: AiDecisionRequest, actor: AdminUser): AiReviewItem {
  const now = Date.now();
  const store = readAiStore();
  const review = store.run ? store.reviews.find((item) => item.id === id && item.version === store.run?.version) : undefined;
  if (!review) throw new ApiError(404, "Natija topilmadi — u boshqa versiyaga tegishli bo'lishi mumkin.");
  if (request.decision !== "APPROVED" && request.decision !== "REJECTED") {
    throw new ApiError(400, "Qaror noto'g'ri.");
  }
  const note = typeof request.note === "string" ? request.note.trim() : "";
  if (note.length < AI_LIMITS.decisionNoteMin || note.length > AI_LIMITS.decisionNoteMax) {
    throw new ApiError(400, `Izoh ${AI_LIMITS.decisionNoteMin}–${AI_LIMITS.decisionNoteMax} ta belgidan iborat bo'lsin.`);
  }

  const before = toItem(review, contextOf(store, now));
  const manual = { decision: request.decision, note, by: actor.fullName, at: new Date(now).toISOString() };
  const updated: MockAiStore = {
    ...store,
    reviews: store.reviews.map((item) => (item.id === id ? { ...item, manual } : item)),
  };
  writeAiStore(updated);
  audit(actor, {
    action: "ai.decision",
    entity: "reel",
    entityId: review.reelId,
    before: before?.finalVerdict ?? "",
    after: request.decision,
    reason: note,
  });

  const item = toItem({ ...review, manual }, contextOf(updated, now));
  if (!item) throw new ApiError(404, "Natija topilmadi.");
  return item;
}

/** Mock kadr: videoning shu soniyasi o'rniga chizilgan vertikal (9:16) rasm. */
export function aiFrameUrl(reviewId: string, second: number): string {
  const hue = hashString(reviewId) % 360;
  const accent = (hue + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640" viewBox="0 0 360 640">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,68%)"/><stop offset="1" stop-color="hsl(${accent},45%,28%)"/></linearGradient></defs>
<rect width="360" height="640" fill="url(#g)"/>
<circle cx="250" cy="150" r="70" fill="rgba(255,255,255,0.18)"/>
<rect x="105" y="220" width="150" height="200" rx="22" fill="rgba(255,255,255,0.9)"/>
<rect x="125" y="250" width="110" height="18" rx="9" fill="hsl(${hue},40%,55%)"/>
<text x="180" y="335" font-family="Arial,sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="hsl(${accent},40%,30%)">MAHSULOT</text>
<text x="180" y="600" font-family="Arial,sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#ffffff">${Math.round(second)}-soniya</text>
<text x="180" y="40" font-family="Arial,sans-serif" font-size="18" text-anchor="middle" fill="rgba(255,255,255,0.75)">mock kadr</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
