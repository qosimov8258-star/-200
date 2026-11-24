import type { AiJob, AiOpenBatch, AiResult, AiWorkerConfig } from "../ai-review/ai-types";

export type FetchFn = typeof fetch;

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Backend'ning ichki API'si (`/internal/ai/*`) — `X-Worker-Token` bilan. */
export class BackendClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  heartbeat(): Promise<{ runVersion: number | null }> {
    return this.json("POST", "/internal/ai/heartbeat", {});
  }

  async lease(limit: number): Promise<AiJob[]> {
    // Backend video manzillarini Apify'dan yangilashi mumkin — javob bir necha daqiqa olishi mumkin.
    const res = await this.json<{ jobs: AiJob[] }>("POST", "/internal/ai/lease", { limit }, 10 * 60_000);
    return res.jobs;
  }

  release(reviewIds: string[], error: string): Promise<{ released: number }> {
    return this.json("POST", "/internal/ai/release", { reviewIds, error });
  }

  config(version: number): Promise<AiWorkerConfig> {
    return this.json("GET", `/internal/ai/config/${version}`);
  }

  async reference(version: number, id: string): Promise<Buffer> {
    const res = await this.request("GET", `/internal/ai/config/${version}/references/${encodeURIComponent(id)}`);
    return Buffer.from(await res.arrayBuffer());
  }

  registerBatch(batchId: string, reviewIds: string[]): Promise<{ registered: number }> {
    return this.json("POST", "/internal/ai/batches", { batchId, reviewIds });
  }

  async openBatches(): Promise<AiOpenBatch[]> {
    return (await this.json<{ batches: AiOpenBatch[] }>("GET", "/internal/ai/batches/open")).batches;
  }

  closeBatch(batchId: string): Promise<{ requeued: number }> {
    return this.json("POST", `/internal/ai/batches/${encodeURIComponent(batchId)}/close`, {});
  }

  results(results: AiResult[]): Promise<{ applied: number; ignored: number }> {
    return this.json("POST", "/internal/ai/results", { results });
  }

  private async json<T>(method: string, path: string, body?: unknown, timeoutMs = 60_000): Promise<T> {
    const res = await this.request(method, path, body, timeoutMs);
    return (await res.json()) as T;
  }

  private async request(method: string, path: string, body?: unknown, timeoutMs = 60_000): Promise<Response> {
    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-Worker-Token": this.token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      let message = `${method} ${path}: HTTP ${res.status}`;
      try {
        const data = (await res.json()) as { message?: unknown };
        if (typeof data.message === "string") message += ` — ${data.message}`;
      } catch {
        // javob JSON emas
      }
      throw new BackendError(message, res.status);
    }
    return res;
  }
}
