import { canonicalReelUrl } from "../miniapp/reel-url";
import { ReelStatsProvider, type ReelStats } from "./reel-stats";

const API = "https://api.apify.com/v2";
/** Apify'ning rasmiy Instagram aktori: https://apify.com/apify/instagram-scraper */
const ACTOR = "apify~instagram-scraper";
/** Bitta ishga (run) nechta link beriladi. */
const CHUNK_SIZE = 100;
/** Holatni so'raganda server shuncha soniya kutib turadi (long polling). */
const WAIT_SECONDS = 60;
/** Bitta ish bundan uzoq cho'zilsa — xato. */
const MAX_RUN_MS = 30 * 60_000;
const REQUEST_TIMEOUT_MS = (WAIT_SECONDS + 30) * 1000;
const FINISHED = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

/** Aktor natijasidagi bizga kerakli maydonlar (`resultsType: "details"`). */
interface ApifyItem {
  shortCode?: string;
  type?: string;
  productType?: string;
  ownerUsername?: string;
  videoPlayCount?: number | null;
  videoViewCount?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  timestamp?: string;
  /** Topilmagan / yopiq sahifa uchun aktor xato yozuvini qaytaradi. */
  error?: string;
}

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

type FetchFn = typeof fetch;

/**
 * Reel ko'rishlarini Apify orqali oladi (Meta App Review kerak emas).
 *
 * Asinxron ish: ishni boshlaydi → tugashini kutadi → natijalarni datasetdan o'qiydi.
 * Narx: natija boshiga (≈ $2.7 / 1000 Reel); `maxItems` bitta ishda ortiqcha pul
 * yechilishiga yo'l qo'ymaydi.
 */
export class ApifyReelStatsProvider extends ReelStatsProvider {
  readonly name = "apify";

  constructor(
    private readonly token: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    super();
  }

  async fetch(shortcodes: string[]): Promise<Map<string, ReelStats | null>> {
    const codes = [...new Set(shortcodes)];
    const result = new Map<string, ReelStats | null>();
    for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
      const chunk = codes.slice(i, i + CHUNK_SIZE);
      const items = await this.run(chunk);
      const byCode = new Map<string, ApifyItem>();
      for (const item of items) {
        if (item.shortCode && !item.error) byCode.set(item.shortCode, item);
      }
      for (const code of chunk) {
        const item = byCode.get(code);
        result.set(code, item ? toStats(code, item) : null);
      }
    }
    return result;
  }

  private async run(shortcodes: string[]): Promise<ApifyItem[]> {
    const input = {
      directUrls: shortcodes.map(canonicalReelUrl),
      resultsType: "details",
      resultsLimit: 1,
    };
    let run = await this.call<ApifyRun>(
      "POST",
      `/acts/${ACTOR}/runs?maxItems=${shortcodes.length}`,
      input,
    );
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
    return this.call<ApifyItem[]>(
      "GET",
      `/datasets/${run.defaultDatasetId}/items?clean=true&format=json`,
      undefined,
      false,
    );
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

/** Musbat butun son yoki null (Instagram yashirilgan laykni -1 deb berishi mumkin). */
function count(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

function toStats(shortcode: string, item: ApifyItem): ReelStats {
  const postedAt = item.timestamp ? new Date(item.timestamp) : null;
  return {
    shortcode,
    owner: item.ownerUsername?.toLowerCase() ?? null,
    isVideo: item.type === "Video" || item.productType === "clips",
    views: count(item.videoPlayCount) ?? count(item.videoViewCount),
    likes: count(item.likesCount),
    comments: count(item.commentsCount),
    postedAt: postedAt && !Number.isNaN(postedAt.getTime()) ? postedAt : null,
  };
}
