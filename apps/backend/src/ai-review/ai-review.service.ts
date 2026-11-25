import { randomBytes } from "node:crypto";

import { Inject, Injectable, Logger, Optional, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { adminError } from "../admin/admin-http";
import { ReelStatsProvider } from "../instagram/reel-stats";
import { ParticipantsService, type Participant, type Reel } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { canonicalReelUrl } from "../miniapp/reel-url";
import { parseScreenshot, screenshotExtension, type ScreenshotMime } from "../targets/screenshot";
import {
  addUsage,
  costUsd,
  MAX_EVIDENCE,
  ZERO_USAGE,
  type AiFailureCode,
  type AiJob,
  type AiModelVerdict,
  type AiOpenBatch,
  type AiRefKind,
  type AiResult,
  type AiReviewState,
  type AiRunMode,
  type AiSettings,
  type AiUsage,
  type AiVerdict,
  type AiWorkerConfig,
} from "./ai-types";

// --- Saqlanadigan yozuvlar (TZ modellari; ma'lumotlar bazasi ulanguncha StateStore'da) ----------

/** AiReferenceImage — namuna rasm. Fayl o'zgarmaydi: yangi versiya eski fayldan foydalanishi mumkin. */
interface AiReferenceImageRecord {
  id: string;
  kind: AiRefKind;
  note: string;
  mime: ScreenshotMime;
  sizeBytes: number;
  createdAt: Date;
  file: string;
}

/** AiConfig — mezonlar versiyasi. APPROVED bo'lgach o'zgarmaydi (muhrlangan). */
interface AiConfigRecord {
  version: number;
  status: "DRAFT" | "APPROVED";
  criteria: string;
  references: AiReferenceImageRecord[];
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  /** Tasdiqlangan paytdagi sozlamalar (model, kadrlar) — keyin env o'zgarsa ham shu versiya o'zgarmaydi. */
  settings: AiSettings | null;
}

interface EvidenceRecord {
  second: number;
  description: string;
  /** Dalil kadri fayli (StateStore `files/`); worker yubormagan bo'lsa — null. */
  frame: string | null;
}

/** VideoReview — bitta videoning bitta versiya bo'yicha tekshiruvi. */
interface VideoReviewRecord {
  id: string;
  version: number;
  telegramId: number;
  shortcode: string;
  state: AiReviewState;
  /** Modelning o'z javobi (ishonch qoidasidan oldin). */
  modelStatus: AiVerdict | null;
  /** Ishonch qoidasidan keyingi AI qarori. */
  verdict: AiVerdict | null;
  confidence: number | null;
  reason: string | null;
  evidence: EvidenceRecord[];
  manual: { decision: "APPROVED" | "REJECTED"; note: string; by: string; at: Date } | null;
  attempts: number;
  error: string | null;
  tokens: AiUsage | null;
  costUsd: number;
  /** Worker shu vaqtgacha natija berishi kerak, aks holda ish navbatga qaytadi. */
  leaseUntil: Date | null;
  batchId: string | null;
  /**
   * Yangi yuborilgan videoning tekshiruvi (`submitForAcceptance`): natijasi video qabul qilinishini
   * hal qiladi. Boshqalari (sinov/FULL) — faqat admin uchun yordam.
   */
  gate?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** BatchJob — Claude Message Batches API'ga yuborilgan to'plam. */
interface BatchJobRecord {
  id: string;
  version: number;
  reviewIds: string[];
  createdAt: Date;
  closedAt: Date | null;
}

interface AiRunRecord {
  version: number;
  mode: AiRunMode;
  startedAt: Date;
  startedBy: string;
}

interface SavedAiReview {
  configs: AiConfigRecord[];
  run: AiRunRecord | null;
  reviews: VideoReviewRecord[];
  batches: BatchJobRecord[];
  videoUrls: [string, { url: string; at: Date }][];
  workerSeenAt: Date | null;
}

// --- Admin panel turlari (`apps/admin/src/lib/types.ts` bilan bir xil) -----------------------

export interface AiReferenceImage {
  id: string;
  kind: AiRefKind;
  note: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AiConfigVersion {
  version: number;
  status: "DRAFT" | "APPROVED";
  criteria: string;
  references: AiReferenceImage[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

export interface AiProgress {
  total: number;
  queued: number;
  processing: number;
  done: number;
  failed: number;
  approved: number;
  rejected: number;
  uncertain: number;
  manual: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

export interface AiState {
  draft: AiConfigVersion | null;
  active: AiConfigVersion | null;
  run: { version: number; mode: AiRunMode; startedAt: string; startedBy: string } | null;
  progress: AiProgress;
  worker: { lastSeenAt: string | null; online: boolean };
  settings: AiSettings;
}

export interface AiReviewItem {
  id: string;
  version: number;
  participant: { id: string; fullName: string; phone: string };
  reel: { shortcode: string; url: string; views: number };
  state: AiReviewState;
  verdict: AiVerdict | null;
  finalVerdict: AiVerdict | null;
  confidence: number | null;
  reason: string | null;
  evidence: { second: number; description: string; hasFrame: boolean }[];
  manual: { decision: "APPROVED" | "REJECTED"; note: string; by: string; at: string } | null;
  attempts: number;
  error: string | null;
  tokens: AiUsage | null;
  costUsd: number | null;
  updatedAt: string;
}

/**
 * Yangi video AI tekshiruvi natijasi (StatsService videoni qabul qiladi yoki qo'lda tekshiruvga
 * yuboradi). FAILED — AI videoni ko'ra olmadi (yuklab bo'lmadi, urinishlar tugadi).
 */
export interface AiGateOutcome {
  telegramId: number;
  shortcode: string;
  verdict: AiVerdict | "FAILED";
  reason: string | null;
  confidence: number | null;
}

export interface AiCandidate {
  shortcode: string;
  url: string;
  fullName: string;
  views: number;
}

export interface AiReviewFilter {
  verdict?: AiVerdict;
  state?: AiReviewState;
  search?: string;
}

// --- Sozlamalar -----------------------------------------------------------------------------

export const AI_REVIEW_OPTIONS = Symbol("AI_REVIEW_OPTIONS");

export interface AiReviewOptions {
  settings: AiSettings;
  /** Bitta video necha marta urinib ko'riladi (yuklab olish, model xatosi). */
  maxAttempts?: number;
  clock?: () => Date;
}

/**
 * Namuna rasmlar soni amalda cheklanmaydi — faqat Claude chegarasi: bitta so'rovda 600 tagacha
 * rasm (video kadrlari ham shunga kiradi). Worker kadrlar sonini qolganiga moslaydi.
 */
export const MAX_REFERENCES = 400;
export const CRITERIA_MAX = 5_000;
export const NOTE_MAX = 500;
/** Tasdiqlash uchun mezon matni kamida shuncha belgi (yoki kamida bitta namuna rasm). */
export const CRITERIA_MIN = 10;
export const MAX_TRIAL = 20;
const DEFAULT_MAX_ATTEMPTS = 3;
/** Worker videoni yuklab, kadrlarni ajratib, batch'ga qo'shgunicha. */
const LEASE_MS = 2 * 60 * 60 * 1000;
/** Batch 24 soatgacha ishlanadi (+ zaxira). */
const BATCH_LEASE_MS = 30 * 60 * 60 * 1000;
/** Instagram CDN manzili bir necha kun ishlaydi — 6 soatdan eskisini yangilaymiz. */
const VIDEO_URL_TTL_MS = 6 * 60 * 60 * 1000;
const WORKER_ONLINE_MS = 3 * 60 * 1000;
/** Yangi videolar shuncha vaqt ichida worker ko'rinmasa — AI ishlamayapti deb hisoblanadi. */
const WORKER_ALIVE_FOR_GATE_MS = 10 * 60 * 1000;
const SYNC_EVERY_MS = 2 * 60 * 1000;
const MAX_LEASE = 50;
const KEEP_CLOSED_BATCHES = 500;
const BATCH_ID = /^[A-Za-z0-9_-]{1,120}$/;

const newId = (): string => randomBytes(8).toString("hex");
const fullNameOf = (p: Participant): string => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
const viewsOf = (reel: Reel): number => reel.history.at(-1)?.views ?? 0;
const finalOf = (r: VideoReviewRecord): AiVerdict | null => r.manual?.decision ?? r.verdict;
const frameFile = (reviewId: string, second: number): string => `ai-frame-${reviewId}-${second}.jpg`;

export const VERDICT_LABEL: Record<AiVerdict, string> = {
  APPROVED: "Tasdiqlandi",
  REJECTED: "Rad etildi",
  UNCERTAIN: "Shubhali",
};

/**
 * AI video tekshiruvi (TZ: "konkurs videolarini AI bilan avtomatik tekshirish").
 *
 * Admin mezon (matn + namuna rasmlar) yozadi va "Tasdiqlash" bosadi: versiya muhrlanadi va
 * qabul qilingan videolar navbatga qo'yiladi (sinov rejimida — 20 tasi). Alohida worker jarayoni
 * `/internal/ai/*` orqali ishlarni oladi, videoni yuklab kadrlarga ajratadi, Claude Message Batches
 * API'ga yuboradi va natijani qaytaradi.
 *
 * Mezonlar tasdiqlangach, har bir yangi yuborilgan video ham shu yerdan o'tadi
 * (`submitForAcceptance`): Apify videoni topadi → AI mazmunini tekshiradi → TASDIQLANDI bo'lsa video
 * qabul qilinadi; RAD ETILDI, SHUBHALI yoki AI ko'ra olmasa — admin "Qo'lda tekshiruv"da hal qiladi.
 * Sinov/FULL ishlari (allaqachon qabul qilingan videolar) esa video holatini o'zgartirmaydi.
 *
 * Navbat va natijalar `StateStore` da (Redis/ma'lumotlar bazasi ulanguncha), namuna rasmlar va
 * dalil kadrlari — uning `files/` papkasida.
 */
@Injectable()
export class AiReviewService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiReviewService.name);
  private readonly now: () => Date;
  private readonly settings: AiSettings;
  private readonly maxAttempts: number;
  private configs: AiConfigRecord[] = [];
  private run: AiRunRecord | null = null;
  private reviews: VideoReviewRecord[] = [];
  private batches: BatchJobRecord[] = [];
  private videoUrls = new Map<string, { url: string; at: Date }>();
  private workerSeenAt: Date | null = null;
  /** Holat ombori ulanmagan bo'lsa (testlar) — fayllar xotirada. */
  private readonly memoryFiles = new Map<string, Buffer>();
  private timer: NodeJS.Timeout | null = null;
  private gateListener: ((outcome: AiGateOutcome) => void) | null = null;

  constructor(
    private readonly participants: ParticipantsService,
    private readonly provider: ReelStatsProvider,
    @Inject(AI_REVIEW_OPTIONS) options: AiReviewOptions,
    @Optional() @Inject(StateStore) private readonly store: StateStore | null = null,
  ) {
    this.now = options.clock ?? (() => new Date());
    this.settings = options.settings;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const saved = store?.attach<SavedAiReview>("aiReview", () => ({
      configs: this.configs,
      run: this.run,
      reviews: this.reviews,
      batches: this.batches,
      videoUrls: [...this.videoUrls],
      workerSeenAt: this.workerSeenAt,
    }));
    if (saved) {
      this.configs = saved.configs;
      this.run = saved.run;
      this.reviews = saved.reviews;
      this.batches = saved.batches;
      this.videoUrls = new Map(saved.videoUrls);
      this.workerSeenAt = saved.workerSeenAt;
    }
  }

  onModuleInit(): void {
    this.timer = setInterval(() => this.housekeeping(), SYNC_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // --- Admin: holat va mezonlar -------------------------------------------------------------

  state(): AiState {
    this.syncQueue();
    const draft = this.draft();
    const active = this.active();
    const seen = this.workerSeenAt;
    return {
      draft: draft ? this.toVersion(draft) : null,
      active: active ? this.toVersion(active) : null,
      run: this.run
        ? {
            version: this.run.version,
            mode: this.run.mode,
            startedAt: this.run.startedAt.toISOString(),
            startedBy: this.run.startedBy,
          }
        : null,
      progress: this.progress(),
      worker: {
        lastSeenAt: seen?.toISOString() ?? null,
        online: seen !== null && this.now().getTime() - seen.getTime() <= WORKER_ONLINE_MS,
      },
      settings: { ...this.settings },
    };
  }

  /** Qoralama yo'q bo'lsa — faol versiyadan nusxa (yoki bo'sh) ochadi. Bor bo'lsa — o'zgarmaydi. */
  createDraft(): boolean {
    if (this.draft()) return false;
    const active = this.active();
    const now = this.now();
    this.configs.push({
      version: (this.configs.at(-1)?.version ?? 0) + 1,
      status: "DRAFT",
      criteria: active?.criteria ?? "",
      // Fayllar umumiy (o'zgarmaydi) — faqat yozuvlar nusxalanadi.
      references: (active?.references ?? []).map((r) => ({ ...r, id: newId() })),
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      approvedBy: null,
      settings: null,
    });
    return true;
  }

  /** Mezon matni. Natija — oldingi va yangi matn (audit uchun). */
  updateCriteria(criteria: string): { before: string; after: string } {
    const draft = this.requireDraft();
    const text = criteria.trim();
    if (text.length > CRITERIA_MAX) throw adminError(422, `Mezon matni ${CRITERIA_MAX} belgidan oshmasin.`);
    const before = draft.criteria;
    draft.criteria = text;
    draft.updatedAt = this.now();
    return { before, after: text };
  }

  addReference(dataUrl: string, kind: AiRefKind, note: string): AiReferenceImage {
    const draft = this.requireDraft();
    if (draft.references.length >= MAX_REFERENCES) {
      throw adminError(
        422,
        `Ko'pi bilan ${MAX_REFERENCES} ta namuna rasm: Claude bitta so'rovda 600 tagacha rasm qabul qiladi (video kadrlari bilan birga).`,
        "TOO_MANY",
      );
    }
    const text = note.trim();
    if (text.length > NOTE_MAX) throw adminError(422, `Izoh ${NOTE_MAX} belgidan oshmasin.`);
    const image = parseScreenshot(dataUrl);
    if (!image) throw adminError(422, "Rasm yaroqsiz: JPEG, PNG yoki WebP, 2 MB gacha bo'lsin.", "BAD_IMAGE");
    const id = newId();
    const file = `ai-ref-${id}.${screenshotExtension(image.mime)}`;
    this.putFile(file, image.data);
    const ref: AiReferenceImageRecord = {
      id,
      kind,
      note: text,
      mime: image.mime,
      sizeBytes: image.data.length,
      createdAt: this.now(),
      file,
    };
    draft.references.push(ref);
    draft.updatedAt = this.now();
    return toReference(ref);
  }

  updateReference(id: string, patch: { kind?: AiRefKind; note?: string }): AiReferenceImage {
    const draft = this.requireDraft();
    const ref = draft.references.find((r) => r.id === id);
    if (!ref) throw adminError(404, "Namuna rasm topilmadi.", "NOT_FOUND");
    if (patch.note !== undefined) {
      const text = patch.note.trim();
      if (text.length > NOTE_MAX) throw adminError(422, `Izoh ${NOTE_MAX} belgidan oshmasin.`);
      ref.note = text;
    }
    if (patch.kind !== undefined) ref.kind = patch.kind;
    draft.updatedAt = this.now();
    return toReference(ref);
  }

  removeReference(id: string): AiReferenceImage {
    const draft = this.requireDraft();
    const index = draft.references.findIndex((r) => r.id === id);
    if (index < 0) throw adminError(404, "Namuna rasm topilmadi.", "NOT_FOUND");
    const [ref] = draft.references.splice(index, 1);
    draft.updatedAt = this.now();
    // Fayl eski (tasdiqlangan) versiyada ham ishlatilayotgan bo'lishi mumkin.
    if (!this.configs.some((c) => c.references.some((r) => r.file === ref.file))) this.deleteFile(ref.file);
    return toReference(ref);
  }

  /** Namuna rasm (istalgan versiyadan). */
  referenceImage(id: string): { mime: ScreenshotMime; data: Buffer } | null {
    for (const config of this.configs) {
      const ref = config.references.find((r) => r.id === id);
      if (ref) {
        const data = this.getFile(ref.file);
        return data ? { mime: ref.mime, data } : null;
      }
    }
    return null;
  }

  /** Sinov uchun tanlanadigan videolar: qabul qilinganlar, eng ko'p ko'rilgani birinchi (50 tagacha). */
  candidates(search: string): AiCandidate[] {
    const term = search.trim().toLowerCase();
    return this.acceptedReels()
      .filter(
        ({ p, reel }) =>
          !term ||
          fullNameOf(p).toLowerCase().includes(term) ||
          (p.phone ?? "").includes(term) ||
          reel.shortcode.toLowerCase().includes(term),
      )
      .slice(0, 50)
      .map(({ p, reel, views }) => ({
        shortcode: reel.shortcode,
        url: canonicalReelUrl(reel.shortcode),
        fullName: fullNameOf(p),
        views,
      }));
  }

  /**
   * "Tasdiqlash": qoralama muhrlanadi (yangi APPROVED versiya) va videolar navbatga qo'yiladi.
   * Oldingi versiyaning hali boshlanmagan ishlari olib tashlanadi (pul sarflanmasin).
   */
  approve(mode: AiRunMode, trialShortcodes: string[] | undefined, by: string): { version: number; queued: number } {
    const draft = this.requireDraft();
    if (draft.criteria.length < CRITERIA_MIN && draft.references.length === 0) {
      throw adminError(
        422,
        `Mezon matnini yozing (kamida ${CRITERIA_MIN} belgi) yoki kamida bitta namuna rasm qo'shing.`,
        "DRAFT_EMPTY",
      );
    }
    let targets: { p: Participant; reel: Reel }[];
    const accepted = this.acceptedReels();
    if (mode === "TRIAL") {
      const codes = [...new Set(trialShortcodes ?? [])];
      if (codes.length > MAX_TRIAL) throw adminError(422, `Sinov uchun ko'pi bilan ${MAX_TRIAL} ta video tanlang.`);
      if (codes.length === 0) {
        targets = accepted.slice(0, this.settings.trialSize);
      } else {
        targets = codes.map((code) => {
          const found = accepted.find((a) => a.reel.shortcode === code);
          if (!found) throw adminError(422, `Video topilmadi yoki qabul qilinmagan: ${code}`, "NOT_FOUND");
          return found;
        });
      }
      if (targets.length === 0) throw adminError(422, "Qabul qilingan video hali yo'q — sinov uchun video kerak.", "NO_VIDEOS");
    } else {
      targets = accepted;
    }

    const now = this.now();
    draft.status = "APPROVED";
    draft.approvedAt = now;
    draft.approvedBy = by;
    draft.updatedAt = now;
    draft.settings = { ...this.settings };
    this.run = { version: draft.version, mode, startedAt: now, startedBy: by };
    // Yangi videolar tekshiruvi (gate) yo'qolmaydi — yangi versiya mezonlari bilan tekshiriladi.
    for (const r of this.reviews) if (r.gate && r.state === "QUEUED") r.version = draft.version;
    this.reviews = this.reviews.filter((r) => !(r.state === "QUEUED" && r.version !== draft.version));
    let queued = 0;
    for (const t of targets) if (this.enqueue(draft.version, t.p, t.reel)) queued += 1;
    return { version: draft.version, queued };
  }

  /** Sinovdan keyin "Hammasini ishga tushirish": faol versiya bo'yicha hamma videolar navbatga. */
  runAll(by: string): { version: number; queued: number; changed: boolean } {
    const active = this.active();
    if (!active || !this.run || this.run.version !== active.version) {
      throw adminError(409, "Avval mezonlarni tasdiqlang.", "NO_ACTIVE");
    }
    const changed = this.run.mode !== "FULL";
    if (changed) this.run = { ...this.run, mode: "FULL", startedBy: by };
    const queued = this.syncQueue();
    return { version: active.version, queued, changed };
  }

  /** Natijalar — joriy ish versiyasi bo'yicha, oxirgi yangilangani birinchi. */
  list(filter: AiReviewFilter): AiReviewItem[] {
    if (!this.run) return [];
    const version = this.run.version;
    const term = filter.search?.trim().toLowerCase() ?? "";
    return this.reviews
      .filter((r) => r.version === version)
      .filter((r) => !filter.state || r.state === filter.state)
      .filter((r) => !filter.verdict || finalOf(r) === filter.verdict)
      .map((r) => this.toItem(r))
      .filter(
        (item) =>
          !term ||
          item.participant.fullName.toLowerCase().includes(term) ||
          item.participant.phone.includes(term) ||
          item.reel.shortcode.toLowerCase().includes(term),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  item(id: string): AiReviewItem | null {
    const review = this.reviews.find((r) => r.id === id);
    return review ? this.toItem(review) : null;
  }

  /** Dalil kadri (JPEG). */
  frame(reviewId: string, second: number): Buffer | null {
    const review = this.reviews.find((r) => r.id === reviewId);
    const evidence = review?.evidence.find((e) => e.second === second && e.frame !== null);
    return evidence?.frame ? this.getFile(evidence.frame) : null;
  }

  /** Admin qarori (ayniqsa SHUBHALI videolar uchun). Natija — oldingi yakuniy qaror va yangi holat. */
  decide(
    id: string,
    decision: "APPROVED" | "REJECTED",
    note: string,
    by: string,
  ): { before: AiVerdict | null; item: AiReviewItem; fullName: string; shortcode: string } {
    const review = this.reviews.find((r) => r.id === id);
    if (!review) throw adminError(404, "Tekshiruv topilmadi.", "NOT_FOUND");
    const before = finalOf(review);
    const now = this.now();
    review.manual = { decision, note, by, at: now };
    review.updatedAt = now;
    const item = this.toItem(review);
    return { before, item, fullName: item.participant.fullName, shortcode: review.shortcode };
  }

  // --- Yangi videolar: avval AI, keyin qabul ----------------------------------------------------

  /**
   * Yangi videolar AI tekshiruvidan o'tadimi: admin mezonlarni tasdiqlagan (faol versiya bor).
   * Mezon yo'q bo'lsa — videolar faqat Apify bo'yicha qabul qilinadi (avvalgidek).
   */
  gateEnabled(): boolean {
    const active = this.active();
    return active !== null && this.run !== null && this.run.version === active.version;
  }

  /** Worker yaqinda (10 daqiqa ichida) ko'rindimi — ko'rinmasa, kutayotgan videolar adminga o'tadi. */
  workerAlive(): boolean {
    const seen = this.workerSeenAt;
    return seen !== null && this.now().getTime() - seen.getTime() <= WORKER_ALIVE_FOR_GATE_MS;
  }

  /** StatsService natijani shu yerdan oladi (bitta tinglovchi). */
  setGateListener(listener: (outcome: AiGateOutcome) => void): void {
    this.gateListener = listener;
  }

  /**
   * Apify topgan yangi videoni AI navbatiga qo'yadi. `videoUrl` — Apify bergan video fayli (worker
   * uni qayta so'ramaydi). Natija `setGateListener` orqali keladi. AI yoqilmagan — false.
   */
  submitForAcceptance(telegramId: number, shortcode: string, videoUrl: string | null): boolean {
    if (!this.gateEnabled() || !this.run) return false;
    const version = this.run.version;
    if (videoUrl) this.videoUrls.set(shortcode, { url: videoUrl, at: this.now() });
    // Avvalgi (masalan, rad etilib qayta yuborilgan) tekshiruv — yangisi boshlanadi.
    this.reviews = this.reviews.filter(
      (r) => !(r.version === version && r.shortcode === shortcode && r.state === "QUEUED"),
    );
    const existing = this.reviews.find(
      (r) => r.version === version && r.shortcode === shortcode && r.state === "PROCESSING",
    );
    if (existing) {
      existing.gate = true;
      existing.telegramId = telegramId;
      return true;
    }
    for (const r of this.reviews) if (r.version === version && r.shortcode === shortcode) this.deleteFrames(r);
    this.reviews = this.reviews.filter((r) => !(r.version === version && r.shortcode === shortcode));
    this.pushReview(version, telegramId, shortcode, true);
    return true;
  }

  /** Admin qo'lda tekshiruvda qaror qildi — AI bo'limida ham ko'rinsin (oxirgi tekshiruvga yoziladi). */
  noteManualDecision(shortcode: string, approved: boolean, note: string, by: string): void {
    const review = this.reviews.filter((r) => r.shortcode === shortcode && r.gate).at(-1);
    if (!review) return;
    const now = this.now();
    review.manual = { decision: approved ? "APPROVED" : "REJECTED", note, by, at: now };
    review.updatedAt = now;
  }

  private emitGate(r: VideoReviewRecord): void {
    if (!r.gate || !this.gateListener) return;
    const outcome: AiGateOutcome =
      r.state === "DONE" && r.verdict
        ? {
            telegramId: r.telegramId,
            shortcode: r.shortcode,
            verdict: r.verdict,
            reason: r.reason,
            confidence: r.confidence,
          }
        : { telegramId: r.telegramId, shortcode: r.shortcode, verdict: "FAILED", reason: r.error, confidence: null };
    try {
      this.gateListener(outcome);
    } catch (err) {
      this.logger.error(`${r.shortcode}: AI natijasini qo'llab bo'lmadi: ${(err as Error).message}`);
    }
  }

  // --- Worker API -----------------------------------------------------------------------------

  heartbeat(): { runVersion: number | null } {
    this.workerSeenAt = this.now();
    return { runVersion: this.run?.version ?? null };
  }

  /**
   * Navbatdan `limit` ta ish beradi (PROCESSING ga o'tadi). Video manzili eski yoki yo'q bo'lsa —
   * Apify'dan yangilanadi (bitta so'rovda). Instagram'da topilmagan video — FAILED.
   */
  async lease(limit: number): Promise<AiJob[]> {
    this.workerSeenAt = this.now();
    this.housekeeping();
    if (!this.run) return [];
    const version = this.run.version;
    const count = Math.min(MAX_LEASE, Math.max(1, Math.floor(limit)));
    const picked = this.reviews.filter((r) => r.version === version && r.state === "QUEUED").slice(0, count);
    if (picked.length === 0) return [];

    // Avval band qilamiz — Apify so'rovi paytida boshqa so'rov xuddi shularni olmasin.
    const now = this.now();
    for (const r of picked) {
      r.state = "PROCESSING";
      r.attempts += 1;
      r.error = null;
      r.leaseUntil = new Date(now.getTime() + LEASE_MS);
      r.batchId = null;
      r.updatedAt = now;
    }

    const stale = picked.filter((r) => !this.freshUrl(r.shortcode)).map((r) => r.shortcode);
    let providerDown = false;
    if (stale.length > 0) {
      try {
        const stats = await this.provider.fetch(stale);
        const at = this.now();
        for (const [code, s] of stats) {
          if (s?.videoUrl) this.videoUrls.set(code, { url: s.videoUrl, at });
          else this.videoUrls.delete(code);
        }
      } catch (err) {
        providerDown = true;
        this.logger.warn(`Video manzillarini olib bo'lmadi (${this.provider.name}): ${(err as Error).message}`);
      }
    }

    const jobs: AiJob[] = [];
    for (const r of picked) {
      if (r.state !== "PROCESSING") continue;
      const url = this.freshUrl(r.shortcode);
      if (url) {
        jobs.push({ reviewId: r.id, version: r.version, shortcode: r.shortcode, videoUrl: url, attempt: r.attempts });
      } else if (providerDown) {
        // Apify vaqtincha ishlamayapti — urinish hisoblanmaydi, keyingi so'rovda yana olinadi.
        r.state = "QUEUED";
        r.attempts -= 1;
        r.leaseUntil = null;
        r.error = "Video manzilini olib bo'lmadi (Apify ishlamayapti) — keyinroq qayta urinadi.";
      } else {
        // Instagram videoni bermadi (o'chirilgan, yopiq akkaunt yoki video emas).
        this.failOrRetry(r, "Video faylining manzili olinmadi — Instagram'da topilmadi yoki yopiq.", true);
      }
    }
    return jobs;
  }

  /**
   * Worker ishni Claude'ga yubora olmadi (kalit xato, limit, tarmoq) yoki to'xtayapti — ishlar
   * navbatga qaytadi va urinish hisoblanmaydi (video aybdor emas).
   */
  release(reviewIds: string[], error: string): { released: number } {
    let released = 0;
    const now = this.now();
    for (const id of new Set(reviewIds)) {
      const r = this.reviews.find((x) => x.id === id);
      if (!r || r.state !== "PROCESSING" || r.batchId !== null) continue;
      r.state = "QUEUED";
      r.attempts = Math.max(0, r.attempts - 1);
      r.leaseUntil = null;
      r.error = error.slice(0, 500);
      r.updatedAt = now;
      released += 1;
    }
    return { released };
  }

  workerConfig(version: number): AiWorkerConfig | null {
    const config = this.configs.find((c) => c.version === version && c.status === "APPROVED");
    if (!config?.settings) return null;
    return {
      version: config.version,
      criteria: config.criteria,
      references: config.references.map((r) => ({ id: r.id, kind: r.kind, note: r.note, mime: r.mime })),
      settings: { ...config.settings },
    };
  }

  workerReference(version: number, id: string): { mime: ScreenshotMime; data: Buffer } | null {
    const config = this.configs.find((c) => c.version === version && c.status === "APPROVED");
    const ref = config?.references.find((r) => r.id === id);
    const data = ref ? this.getFile(ref.file) : null;
    return ref && data ? { mime: ref.mime, data } : null;
  }

  /** Worker batch yaratdi — videolar natijani 30 soatgacha kutadi. */
  registerBatch(batchId: string, reviewIds: string[]): { registered: number } {
    if (!BATCH_ID.test(batchId)) throw adminError(400, "batchId noto'g'ri.");
    if (this.batches.some((b) => b.id === batchId)) throw adminError(409, "Bu batch allaqachon yozilgan.");
    const now = this.now();
    const ids: string[] = [];
    let version: number | null = null;
    for (const id of new Set(reviewIds)) {
      const r = this.reviews.find((x) => x.id === id);
      if (!r || r.state !== "PROCESSING") continue;
      r.batchId = batchId;
      r.leaseUntil = new Date(now.getTime() + BATCH_LEASE_MS);
      r.updatedAt = now;
      version ??= r.version;
      ids.push(id);
    }
    if (ids.length === 0) throw adminError(409, "Batch uchun ishlanayotgan video topilmadi.");
    this.batches.push({ id: batchId, version: version ?? 0, reviewIds: ids, createdAt: now, closedAt: null });
    return { registered: ids.length };
  }

  openBatches(): AiOpenBatch[] {
    this.workerSeenAt = this.now();
    return this.batches
      .filter((b) => b.closedAt === null)
      .map((b) => ({
        batchId: b.id,
        version: b.version,
        reviewIds: b.reviewIds.filter((id) => {
          const r = this.reviews.find((x) => x.id === id);
          return r?.state === "PROCESSING" && r.batchId === b.id;
        }),
        createdAt: b.createdAt.toISOString(),
      }));
  }

  /** Batch tugadi: natijasi kelmagan videolar qayta navbatga (yoki urinishlar tugasa — xato). */
  closeBatch(batchId: string): { requeued: number } {
    const batch = this.batches.find((b) => b.id === batchId);
    if (!batch) throw adminError(404, "Batch topilmadi.");
    let requeued = 0;
    if (batch.closedAt === null) {
      batch.closedAt = this.now();
      for (const r of this.reviews) {
        if (r.batchId === batchId && r.state === "PROCESSING") {
          this.failOrRetry(r, "Batch natijasida bu video yo'q.", true);
          requeued += 1;
        }
      }
    }
    const closed = this.batches.filter((b) => b.closedAt !== null);
    if (closed.length > KEEP_CLOSED_BATCHES) {
      const drop = new Set(closed.slice(0, closed.length - KEEP_CLOSED_BATCHES));
      this.batches = this.batches.filter((b) => !drop.has(b));
    }
    return { requeued };
  }

  /** Worker natijalari. Ishlanmayotgan (eskirgan) video natijasi e'tiborsiz qoladi. */
  applyResults(results: AiResult[]): { applied: number; ignored: number } {
    let applied = 0;
    for (const result of results) {
      const r = this.reviews.find((x) => x.id === result.reviewId);
      if (!r || r.state !== "PROCESSING") continue;
      const config = this.configs.find((c) => c.version === r.version);
      const model = config?.settings?.model ?? this.settings.model;
      const usage = result.usage;
      if (usage) {
        r.tokens = addUsage(r.tokens ?? ZERO_USAGE, usage);
        r.costUsd = Math.round((r.costUsd + costUsd(model, usage)) * 1_000_000) / 1_000_000;
      }
      if (result.ok) this.applyVerdict(r, result.verdict, result.frames, config?.settings?.confidenceMin);
      else this.applyFailure(r, result.error, result.code, result.retryable);
      applied += 1;
    }
    return { applied, ignored: results.length - applied };
  }

  // -------------------------------------------------------------------------------------------

  private applyVerdict(
    r: VideoReviewRecord,
    verdict: AiModelVerdict,
    frames: { second: number; dataUrl: string }[],
    confidenceMin = this.settings.confidenceMin,
  ): void {
    this.deleteFrames(r);
    const stored = new Map<number, string>();
    for (const f of frames.slice(0, MAX_EVIDENCE)) {
      const second = Math.round(f.second);
      const image = parseScreenshot(f.dataUrl);
      if (!image || image.mime !== "image/jpeg" || stored.has(second)) continue;
      const file = frameFile(r.id, second);
      this.putFile(file, image.data);
      stored.set(second, file);
    }
    const now = this.now();
    r.state = "DONE";
    r.modelStatus = verdict.status;
    // TZ: ishonch 0.8 dan past — SHUBHALI.
    r.verdict = verdict.status !== "UNCERTAIN" && verdict.confidence < confidenceMin ? "UNCERTAIN" : verdict.status;
    r.confidence = verdict.confidence;
    r.reason = verdict.reason;
    r.evidence = verdict.evidence.map((e) => ({
      second: e.second,
      description: e.description,
      frame: stored.get(e.second) ?? null,
    }));
    r.error = null;
    r.leaseUntil = null;
    r.batchId = null;
    r.updatedAt = now;
    this.emitGate(r);
  }

  private applyFailure(r: VideoReviewRecord, error: string, code: AiFailureCode | null, retryable: boolean): void {
    // Muddati o'tgan CDN manzili — keyingi urinishda Apify'dan yangisi olinadi.
    if (code === "VIDEO_URL_EXPIRED") this.videoUrls.delete(r.shortcode);
    this.failOrRetry(r, error.slice(0, 500), retryable);
  }

  private failOrRetry(r: VideoReviewRecord, error: string, retryable: boolean): void {
    r.error = error;
    r.leaseUntil = null;
    r.batchId = null;
    r.updatedAt = this.now();
    r.state = retryable && r.attempts < this.maxAttempts ? "QUEUED" : "FAILED";
    if (r.state === "FAILED") this.emitGate(r);
  }

  /** Muddati o'tgan ishlar (worker o'chib qolgan) va FULL rejimdagi yangi videolar. */
  private housekeeping(): void {
    const now = this.now().getTime();
    for (const r of this.reviews) {
      if (r.state === "PROCESSING" && r.leaseUntil && r.leaseUntil.getTime() < now) {
        this.failOrRetry(r, "Worker belgilangan vaqtda natija bermadi.", true);
      }
    }
    this.syncQueue();
  }

  /** FULL rejimda: navbatda yo'q qabul qilingan videolarni qo'shadi. Natija — nechta qo'shildi. */
  private syncQueue(): number {
    if (!this.run || this.run.mode !== "FULL") return 0;
    let added = 0;
    for (const { p, reel } of this.acceptedReels()) if (this.enqueue(this.run.version, p, reel)) added += 1;
    return added;
  }

  private enqueue(version: number, p: Participant, reel: Reel): boolean {
    if (this.reviews.some((r) => r.version === version && r.shortcode === reel.shortcode)) return false;
    this.pushReview(version, p.telegramId, reel.shortcode, false);
    return true;
  }

  private pushReview(version: number, telegramId: number, shortcode: string, gate: boolean): void {
    const now = this.now();
    this.reviews.push({
      id: newId(),
      version,
      telegramId,
      shortcode,
      state: "QUEUED",
      modelStatus: null,
      verdict: null,
      confidence: null,
      reason: null,
      evidence: [],
      manual: null,
      attempts: 0,
      error: null,
      tokens: null,
      costUsd: 0,
      leaseUntil: null,
      batchId: null,
      gate,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Faol ishtirokchilarning qabul qilingan videolari, eng ko'p ko'rilgani birinchi. */
  private acceptedReels(): { p: Participant; reel: Reel; views: number }[] {
    const rows: { p: Participant; reel: Reel; views: number }[] = [];
    for (const p of this.participants.all()) {
      if (p.status !== "ACTIVE") continue;
      for (const reel of p.reels) if (reel.status === "ACCEPTED") rows.push({ p, reel, views: viewsOf(reel) });
    }
    return rows.sort((a, b) => b.views - a.views || a.reel.shortcode.localeCompare(b.reel.shortcode));
  }

  private freshUrl(shortcode: string): string | null {
    const cached = this.videoUrls.get(shortcode);
    if (!cached || this.now().getTime() - cached.at.getTime() > VIDEO_URL_TTL_MS) return null;
    return cached.url;
  }

  private progress(): AiProgress {
    const p: AiProgress = {
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
    if (!this.run) return p;
    for (const r of this.reviews) {
      if (r.version !== this.run.version) continue;
      p.total += 1;
      if (r.state === "QUEUED") p.queued += 1;
      else if (r.state === "PROCESSING") p.processing += 1;
      else if (r.state === "DONE") p.done += 1;
      else p.failed += 1;
      const final = finalOf(r);
      if (final === "APPROVED") p.approved += 1;
      else if (final === "REJECTED") p.rejected += 1;
      else if (final === "UNCERTAIN") p.uncertain += 1;
      if (r.manual) p.manual += 1;
      if (r.tokens) {
        p.inputTokens += r.tokens.input;
        p.outputTokens += r.tokens.output;
        p.cacheReadTokens += r.tokens.cacheRead;
        p.cacheWriteTokens += r.tokens.cacheWrite;
      }
      p.costUsd += r.costUsd;
    }
    p.costUsd = Math.round(p.costUsd * 10_000) / 10_000;
    return p;
  }

  private toItem(r: VideoReviewRecord): AiReviewItem {
    const p = this.participants.get(r.telegramId);
    const reel = p?.reels.find((x) => x.shortcode === r.shortcode);
    return {
      id: r.id,
      version: r.version,
      participant: { id: String(r.telegramId), fullName: p ? fullNameOf(p) : "—", phone: p?.phone ?? "" },
      reel: { shortcode: r.shortcode, url: canonicalReelUrl(r.shortcode), views: reel ? viewsOf(reel) : 0 },
      state: r.state,
      verdict: r.verdict,
      finalVerdict: finalOf(r),
      confidence: r.confidence,
      reason: r.reason,
      evidence: r.evidence.map((e) => ({ second: e.second, description: e.description, hasFrame: e.frame !== null })),
      manual: r.manual ? { ...r.manual, at: r.manual.at.toISOString() } : null,
      attempts: r.attempts,
      error: r.error,
      tokens: r.tokens,
      costUsd: r.tokens ? r.costUsd : null,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  private toVersion(c: AiConfigRecord): AiConfigVersion {
    return {
      version: c.version,
      status: c.status,
      criteria: c.criteria,
      references: c.references.map(toReference),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      approvedAt: c.approvedAt?.toISOString() ?? null,
      approvedBy: c.approvedBy,
    };
  }

  private draft(): AiConfigRecord | null {
    return this.configs.find((c) => c.status === "DRAFT") ?? null;
  }

  private active(): AiConfigRecord | null {
    return this.configs.filter((c) => c.status === "APPROVED").at(-1) ?? null;
  }

  private requireDraft(): AiConfigRecord {
    const draft = this.draft();
    if (!draft) throw adminError(409, "Tahrirlash uchun avval \"Yangi versiya\" yarating.", "NO_DRAFT");
    return draft;
  }

  private deleteFrames(r: VideoReviewRecord): void {
    for (const e of r.evidence) if (e.frame) this.deleteFile(e.frame);
  }

  private putFile(name: string, data: Buffer): void {
    if (this.store) this.store.putFile(name, data);
    else this.memoryFiles.set(name, data);
  }

  private getFile(name: string): Buffer | null {
    return this.store ? this.store.getFile(name) : (this.memoryFiles.get(name) ?? null);
  }

  private deleteFile(name: string): void {
    if (this.store) this.store.deleteFile(name);
    else this.memoryFiles.delete(name);
  }
}

const toReference = (r: AiReferenceImageRecord): AiReferenceImage => ({
  id: r.id,
  kind: r.kind,
  note: r.note,
  mime: r.mime,
  sizeBytes: r.sizeBytes,
  createdAt: r.createdAt.toISOString(),
});
