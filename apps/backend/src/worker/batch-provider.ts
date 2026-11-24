import { randomBytes } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";

import type { AiUsage } from "../ai-review/ai-types";

export interface BatchRequest {
  /** = reviewId */
  custom_id: string;
  params: Anthropic.MessageCreateParamsNonStreaming;
}

/** Bitta so'rov natijasi (SDK turlaridan mustaqil — mock ham shuni qaytaradi). */
export type BatchOutcome =
  | { type: "succeeded"; stopReason: string | null; text: string | null; usage: AiUsage }
  | { type: "errored"; errorType: string; message: string }
  | { type: "expired" }
  | { type: "canceled" };

export type BatchStatus = "in_progress" | "canceling" | "ended" | "missing";

export interface BatchProvider {
  readonly name: string;
  submit(requests: BatchRequest[]): Promise<string>;
  status(batchId: string): Promise<BatchStatus>;
  results(batchId: string): AsyncIterable<{ customId: string; outcome: BatchOutcome }>;
}

/** Kalit, limit yoki to'lov muammosi — videolar aybdor emas, worker biroz to'xtab turadi. */
export class ProviderUnavailableError extends Error {}

const usageOf = (u: Anthropic.Usage): AiUsage => ({
  input: u.input_tokens,
  output: u.output_tokens,
  cacheRead: u.cache_read_input_tokens ?? 0,
  cacheWrite: u.cache_creation_input_tokens ?? 0,
});

/** Claude Message Batches API (50% arzon, natija 24 soatgacha). */
export class AnthropicBatchProvider implements BatchProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 3 });
  }

  async submit(requests: BatchRequest[]): Promise<string> {
    try {
      // Katta so'rov (o'nlab MB rasm) — yuklash vaqti uchun uzunroq timeout.
      const batch = await this.client.messages.batches.create({ requests }, { timeout: 15 * 60_000 });
      return batch.id;
    } catch (err) {
      if (
        err instanceof Anthropic.AuthenticationError ||
        err instanceof Anthropic.PermissionDeniedError ||
        err instanceof Anthropic.RateLimitError ||
        err instanceof Anthropic.InternalServerError ||
        err instanceof Anthropic.APIConnectionError
      ) {
        throw new ProviderUnavailableError(`Claude API: ${(err as Error).message}`);
      }
      throw err;
    }
  }

  async status(batchId: string): Promise<BatchStatus> {
    try {
      return (await this.client.messages.batches.retrieve(batchId)).processing_status;
    } catch (err) {
      if (err instanceof Anthropic.NotFoundError) return "missing";
      throw err;
    }
  }

  async *results(batchId: string): AsyncIterable<{ customId: string; outcome: BatchOutcome }> {
    for await (const item of await this.client.messages.batches.results(batchId)) {
      const r = item.result;
      let outcome: BatchOutcome;
      if (r.type === "succeeded") {
        const text = r.message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? null;
        outcome = { type: "succeeded", stopReason: r.message.stop_reason, text, usage: usageOf(r.message.usage) };
      } else if (r.type === "errored") {
        outcome = { type: "errored", errorType: r.error.error.type, message: r.error.error.message };
      } else {
        outcome = { type: r.type };
      }
      yield { customId: item.custom_id, outcome };
    }
  }
}

/**
 * SOXTA Claude — lokal sinov uchun (`AI_PROVIDER=mock`), pul sarflanmaydi. Javob shortcode'ga
 * bog'liq emas, reviewId xeshidan: ~60% tasdiqlandi, ~20% rad etildi, ~20% past ishonch.
 */
export class MockBatchProvider implements BatchProvider {
  readonly name = "mock";
  private readonly batches = new Map<string, { readyAt: number; requests: BatchRequest[] }>();

  constructor(private readonly delayMs: number) {}

  submit(requests: BatchRequest[]): Promise<string> {
    const id = `mockbatch_${randomBytes(6).toString("hex")}`;
    this.batches.set(id, { readyAt: Date.now() + this.delayMs, requests });
    return Promise.resolve(id);
  }

  status(batchId: string): Promise<BatchStatus> {
    const batch = this.batches.get(batchId);
    if (!batch) return Promise.resolve("missing");
    return Promise.resolve(Date.now() >= batch.readyAt ? "ended" : "in_progress");
  }

  async *results(batchId: string): AsyncIterable<{ customId: string; outcome: BatchOutcome }> {
    const batch = this.batches.get(batchId);
    if (!batch) return;
    for (const req of batch.requests) yield { customId: req.custom_id, outcome: mockOutcome(req) };
    this.batches.delete(batchId);
  }
}

function mockOutcome(req: BatchRequest): BatchOutcome {
  const content = req.params.messages[0]?.content;
  const blocks = Array.isArray(content) ? content : [];
  const seconds = blocks.flatMap((b) => {
    const m = b.type === "text" ? /^\[t=(\d+)s\]$/.exec(b.text) : null;
    return m ? [Number(m[1])] : [];
  });
  const images = blocks.filter((b) => b.type === "image").length;
  const hash = [...req.custom_id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 1_000, 7);
  const pick = (i: number) => seconds[Math.min(seconds.length - 1, Math.floor((seconds.length * i) / 4))] ?? 0;
  const roll = hash % 10;
  const verdict =
    roll < 6
      ? {
          status: "APPROVED",
          confidence: 0.86 + (hash % 13) / 100,
          reason: "Mahsulot qadog'i va logotipi aniq ko'rinadi, taqiqlangan narsa yo'q (sinov javobi).",
          evidence: [
            { second: pick(1), description: "Mahsulot qadog'i yaqindan" },
            { second: pick(2), description: "Logotip ko'rinadi" },
          ],
        }
      : roll < 8
        ? {
            status: "REJECTED",
            confidence: 0.9,
            reason: "Videoda zavod mahsuloti hech bir kadrda ko'rinmadi (sinov javobi).",
            evidence: [{ second: pick(1), description: "Mahsulot bo'lishi kerak bo'lgan joy — yo'q" }],
          }
        : {
            status: "APPROVED",
            confidence: 0.55 + (hash % 20) / 100,
            reason: "Mahsulotga o'xshash narsa bor, lekin kadr qorong'i — aniq emas (sinov javobi).",
            evidence: [{ second: pick(3), description: "Qorong'i kadr, mahsulot noaniq" }],
          };
  return {
    type: "succeeded",
    stopReason: "end_turn",
    text: JSON.stringify(verdict),
    usage: { input: images * 1_196 + 1_500, output: 900, cacheRead: 0, cacheWrite: 0 },
  };
}
