import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * AI worker sozlamalari (alohida jarayon: `npm run worker`). Lokal ishga tushirishda
 * `apps/backend/.env` o'qiladi. Model, kadr oralig'i va ishonch chegarasi backend'dan
 * (tasdiqlangan versiya bilan birga) keladi — bu yerda faqat worker'ning o'z sozlamalari.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // .env yo'q — o'zgaruvchilar muhitdan olinadi.
}

const str = (name: string): string | null => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

const num = (name: string, fallback: number, min: number, max: number): number => {
  const raw = str(name);
  const value = raw === null ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} ${min}–${max} oralig'ida bo'lishi kerak`);
  }
  return value;
};

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface WorkerConfig {
  /** `anthropic` — haqiqiy Claude; `mock` — lokal sinov (pul sarflanmaydi). */
  provider: "anthropic" | "mock";
  /** Faqat `anthropic` uchun. Hech qachon log'ga yozilmaydi. */
  anthropicApiKey: string | null;
  backendUrl: string;
  workerToken: string;
  workDir: string;
  pollSeconds: number;
  /** Bitta lease'da nechta video olinadi. */
  batchSize: number;
  /** Bir vaqtda Claude'da kutilayotgan videolar chegarasi. */
  maxInFlight: number;
  /** Bitta videodan ko'pi bilan nechta kadr (uzun videoda oraliq kattalashadi). */
  maxFrames: number;
  /** Bitta batch hajmi, MB (API chegarasi — 256 MB). */
  maxBatchMb: number;
  effort: Effort;
  /** Mock: batch necha soniyada "tugaydi". */
  mockDelaySeconds: number;
}

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

export function loadWorkerConfig(): WorkerConfig {
  const provider = (str("AI_PROVIDER") ?? "anthropic") as WorkerConfig["provider"];
  if (provider !== "anthropic" && provider !== "mock") throw new Error("AI_PROVIDER: anthropic yoki mock");
  const anthropicApiKey = str("ANTHROPIC_API_KEY");
  if (provider === "anthropic" && !anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY berilmagan (apps/backend/.env yoki muhit). Sinov uchun: AI_PROVIDER=mock");
  }
  const workerToken = str("AI_WORKER_TOKEN");
  if (!workerToken) throw new Error("AI_WORKER_TOKEN berilmagan — backend'dagi bilan bir xil bo'lsin");
  const effort = (str("AI_EFFORT") ?? "medium") as Effort;
  if (!EFFORTS.includes(effort)) throw new Error(`AI_EFFORT: ${EFFORTS.join(", ")}`);
  return {
    provider,
    anthropicApiKey,
    backendUrl: (str("AI_BACKEND_URL") ?? "http://localhost:3000/api/v1").replace(/\/+$/, ""),
    workerToken,
    workDir: str("AI_WORK_DIR") ?? join(tmpdir(), "konkurs-ai-worker"),
    pollSeconds: num("AI_POLL_SECONDS", 30, 2, 3_600),
    batchSize: num("AI_BATCH_SIZE", 20, 1, 50),
    maxInFlight: num("AI_MAX_IN_FLIGHT", 200, 1, 10_000),
    maxFrames: num("AI_MAX_FRAMES", 150, 10, 500),
    maxBatchMb: num("AI_MAX_BATCH_MB", 150, 10, 240),
    effort,
    mockDelaySeconds: num("AI_MOCK_DELAY_SECONDS", 5, 0, 3_600),
  };
}
