/**
 * Apify API bilan ishlash: aktorni ishga tushirish → tugashini kutish → natijalarni o'qish.
 * Instagram ko'rishlari (`apify.provider.ts`) va reklama kutubxonasi (`ad-library.ts`) shu orqali.
 */
const API = "https://api.apify.com/v2";
/** Holatni so'raganda server shuncha soniya kutib turadi (long polling). */
const WAIT_SECONDS = 60;
/** Bitta ish bundan uzoq cho'zilsa — xato. */
const MAX_RUN_MS = 30 * 60_000;
const REQUEST_TIMEOUT_MS = (WAIT_SECONDS + 30) * 1000;
const FINISHED = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

export type FetchFn = typeof fetch;

/**
 * Bitta ish uchun pul chegarasi (pay-per-event aktorlar). Apify 2026-11-21 dan faqat `maxItems`
 * bilan kelgan ishni "max-total-charge-usd-below-minimum" (HTTP 400) bilan rad etadi — shuning
 * uchun `maxTotalChargeUsd` ham aniq yuboriladi.
 */
export interface RunBudget {
  /** Ko'pi bilan nechta natija uchun pul yechiladi. */
  maxItems: number;
  /**
   * Bitta natija narxi — bepul (FREE) rejadagi, ya'ni eng qimmati. Yuqori rejalarda natija
   * arzonroq, chegara baribir yetadi; ortiqcha pul yechilmaydi — natijalar soni `maxItems` bilan cheklangan.
   */
  pricePerItemUsd: number;
}

/**
 * `maxTotalChargeUsd`: natijalar × narx, 0.0001 $ gacha yuqoriga yaxlitlangan va kamida bitta
 * natija narxi (aktorning minimal chegarasi — shu narx; suzuvchi nuqta xatosi pastga tushirmasin).
 */
export function maxChargeUsd({ maxItems, pricePerItemUsd }: RunBudget): number {
  const total = Math.ceil(maxItems * pricePerItemUsd * 10_000) / 10_000;
  return Math.max(total, pricePerItemUsd);
}

export class ApifyClient {
  constructor(
    private readonly token: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  /**
   * Aktorni ishga tushirib, natijalarini qaytaradi.
   * `budget` — shu ishda ko'pi bilan nechta natija va qancha pul (pay-per-event).
   */
  async run<T>(actor: string, input: unknown, budget?: RunBudget): Promise<T[]> {
    const query =
      budget === undefined ? "" : `?maxItems=${budget.maxItems}&maxTotalChargeUsd=${maxChargeUsd(budget)}`;
    let run = await this.call<ApifyRun>("POST", `/acts/${actor}/runs${query}`, input);
    const started = Date.now();
    while (!FINISHED.has(run.status)) {
      if (Date.now() - started > MAX_RUN_MS) {
        throw new Error(`Apify ishi ${run.id} juda uzoq cho'zildi (holat: ${run.status})`);
      }
      run = await this.call<ApifyRun>("GET", `/actor-runs/${run.id}?waitForFinish=${WAIT_SECONDS}`);
    }
    if (run.status !== "SUCCEEDED") {
      throw new Error(`Apify ishi ${run.id} muvaffaqiyatsiz tugadi (holat: ${run.status})`);
    }
    return this.call<T[]>("GET", `/datasets/${run.defaultDatasetId}/items?clean=true&format=json`, undefined, false);
  }

  /** `unwrap` — Apify javobi `{ data: ... }` ichida keladi (datasetdan tashqari). */
  private async call<T>(method: string, path: string, body?: unknown, unwrap = true): Promise<T> {
    const res = await this.fetchFn(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      const route = path.split("?")[0];
      throw new Error(`Apify ${method} ${route} → HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = JSON.parse(text) as T | { data: T };
    return unwrap ? (json as { data: T }).data : (json as T);
  }
}
