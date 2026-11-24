/**
 * AI video tekshiruvi — backend va worker uchun umumiy turlar.
 *
 * Texnik topshiriqdagi modellar (AiConfig, AiReferenceImage, VideoReview, BatchJob) hozircha
 * `StateStore` da (ma'lumotlar bazasi ulanguncha) — `ai-review.service.ts` dagi `*Record` turlari.
 * Bu fayl Nest'ga bog'liq emas: worker (`src/worker/`) ham shuni import qiladi.
 */

/** Namuna rasm turi: MUST — "ko'rinishi shart", MUST_NOT — "bo'lmasligi kerak", INFO — ma'lumot uchun. */
export type AiRefKind = "MUST" | "MUST_NOT" | "INFO";
export const AI_REF_KINDS: readonly AiRefKind[] = ["MUST", "MUST_NOT", "INFO"];

export type AiVerdict = "APPROVED" | "REJECTED" | "UNCERTAIN";
export const AI_VERDICTS: readonly AiVerdict[] = ["APPROVED", "REJECTED", "UNCERTAIN"];

export type AiReviewState = "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
export const AI_REVIEW_STATES: readonly AiReviewState[] = ["QUEUED", "PROCESSING", "DONE", "FAILED"];

export type AiRunMode = "TRIAL" | "FULL";

/** Tekshiruv sozlamalari (env'dan; versiya tasdiqlanganda unga muhrlanadi). */
export interface AiSettings {
  /** Claude modeli, masalan `claude-opus-5-5`. */
  model: string;
  /** Necha soniyada bir kadr olinadi. */
  frameIntervalSec: number;
  /** Kadrning qisqa tomoni, px (720 = 720p). */
  frameHeight: number;
  /** Shundan past ishonchli javob — SHUBHALI (UNCERTAIN). */
  confidenceMin: number;
  /** Sinov rejimida nechta video tekshiriladi. */
  trialSize: number;
}

/** Claude so'rovi tokenlari (`usage`). */
export interface AiUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const ZERO_USAGE: AiUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const addUsage = (a: AiUsage, b: AiUsage): AiUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
});

// --- Worker ↔ backend (`/internal/ai/*`, `X-Worker-Token`) ---------------------------

/** Worker oladigan ish: bitta video. */
export interface AiJob {
  reviewId: string;
  version: number;
  shortcode: string;
  /** Instagram CDN'dagi mp4 (Apify bergan, muddati cheklangan). */
  videoUrl: string;
  /** Nechanchi urinish (1 dan). */
  attempt: number;
}

export interface AiWorkerReference {
  id: string;
  kind: AiRefKind;
  note: string;
  mime: string;
}

/** Tasdiqlangan versiya — worker so'rovni shu bo'yicha yig'adi. */
export interface AiWorkerConfig {
  version: number;
  criteria: string;
  references: AiWorkerReference[];
  settings: AiSettings;
}

/** Claude javobi (qat'iy JSON, `VERDICT_SCHEMA`). */
export interface AiModelVerdict {
  status: AiVerdict;
  /** 0..1 */
  confidence: number;
  reason: string;
  evidence: { second: number; description: string }[];
}

/** Worker natijasi. Muvaffaqiyatsiz bo'lsa ham sarflangan tokenlar (bo'lsa) yuboriladi. */
export type AiResult =
  | {
      reviewId: string;
      ok: true;
      verdict: AiModelVerdict;
      usage: AiUsage;
      /** Dalil kadrlari (JPEG `data:` URL), soniyasi bilan. */
      frames: { second: number; dataUrl: string }[];
    }
  | {
      reviewId: string;
      ok: false;
      error: string;
      /** VIDEO_URL_EXPIRED — backend video manzilini Apify'dan yangilaydi. */
      code: AiFailureCode | null;
      retryable: boolean;
      usage: AiUsage | null;
    };

export type AiFailureCode = "VIDEO_URL_EXPIRED" | "VIDEO_DOWNLOAD" | "VIDEO_DECODE" | "MODEL" | "TOO_LARGE";
export const AI_FAILURE_CODES: readonly AiFailureCode[] = [
  "VIDEO_URL_EXPIRED",
  "VIDEO_DOWNLOAD",
  "VIDEO_DECODE",
  "MODEL",
  "TOO_LARGE",
];

/** Yuborilgan va hali yopilmagan batch. */
export interface AiOpenBatch {
  batchId: string;
  version: number;
  /** Natijasi hali yozilmagan videolar. */
  reviewIds: string[];
  createdAt: string;
}

// --- Claude javobi sxemasi ------------------------------------------------------------

/**
 * Structured outputs (`output_config.format`) uchun JSON sxema. Bu API `minimum`/`maximum`/
 * `maxLength` ni qo'llab-quvvatlamaydi — chegaralar `parseModelVerdict` da tekshiriladi.
 */
export const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["APPROVED", "REJECTED", "UNCERTAIN"] },
    confidence: { type: "number", description: "0 dan 1 gacha: qarorning to'g'ri bo'lish ehtimoli" },
    reason: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          second: { type: "number" },
          description: { type: "string" },
        },
        required: ["second", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["status", "confidence", "reason", "evidence"],
  additionalProperties: false,
} as const;

export const MAX_EVIDENCE = 8;
const MAX_REASON = 1_000;
const MAX_DESCRIPTION = 300;

const clip = (text: string, max: number): string => {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Model javobi (yoki worker yuborgan qiymat) → tekshirilgan verdikt; yaroqsiz bo'lsa — null. */
export function toModelVerdict(value: unknown): AiModelVerdict | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const status = AI_VERDICTS.find((s) => s === v.status);
  if (!status) return null;
  if (typeof v.confidence !== "number" || !Number.isFinite(v.confidence)) return null;
  if (typeof v.reason !== "string" || !Array.isArray(v.evidence)) return null;
  const evidence: AiModelVerdict["evidence"] = [];
  for (const item of v.evidence.slice(0, MAX_EVIDENCE)) {
    if (typeof item !== "object" || item === null) return null;
    const e = item as Record<string, unknown>;
    if (typeof e.second !== "number" || !Number.isFinite(e.second) || e.second < 0) return null;
    if (typeof e.description !== "string") return null;
    evidence.push({ second: Math.round(e.second), description: clip(e.description, MAX_DESCRIPTION) });
  }
  return {
    status,
    confidence: Math.min(1, Math.max(0, v.confidence)),
    reason: clip(v.reason, MAX_REASON),
    evidence,
  };
}

/** Claude matn javobi (JSON) → verdikt; JSON buzilgan bo'lsa — null. */
export function parseModelVerdict(text: string): AiModelVerdict | null {
  try {
    return toModelVerdict(JSON.parse(text));
  } catch {
    return null;
  }
}

// --- Narx -------------------------------------------------------------------------------

/** $ / 1M token. Manba: platform.claude.com/docs → Pricing (2026-11). */
interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  /** 1 soatlik kesh yozish (2 × input) — so'rovlarda `ttl: "1h"` ishlatiladi. */
  cacheWrite1h: number;
}

const PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite1h: 8 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite1h: 4 },
};

/** Message Batches API barcha tokenlarga 50% chegirma beradi. */
const BATCH_DISCOUNT = 0.5;

export const isPricedModel = (model: string): boolean => model in PRICES;

/** So'rov narxi, $ (batch narxida). Narxi noma'lum model — Opus 5.5 narxida (yuqori baho). */
export function costUsd(model: string, usage: AiUsage): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const full =
    usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite1h;
  return Math.round(((full * BATCH_DISCOUNT) / 1_000_000) * 1_000_000) / 1_000_000;
}
