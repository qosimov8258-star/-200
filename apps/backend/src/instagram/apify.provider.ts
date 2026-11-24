import { canonicalReelUrl } from "../miniapp/reel-url";
import { ApifyClient, type FetchFn } from "./apify-client";
import { ReelStatsProvider, type ReelStats } from "./reel-stats";

/** Apify'ning rasmiy Instagram aktori: https://apify.com/apify/instagram-scraper */
const ACTOR = "apify~instagram-scraper";
/** Bitta ishga (run) nechta link beriladi. */
const CHUNK_SIZE = 100;
/** Bitta Reel natijasi narxi — bepul rejada (aktorning minimal chegarasi ham shu). */
const PRICE_PER_REEL_USD = 0.0027;

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
  /** Video faylining manzili (Instagram CDN). */
  videoUrl?: string | null;
  /** Topilmagan / yopiq sahifa uchun aktor xato yozuvini qaytaradi. */
  error?: string;
}


/**
 * Reel ko'rishlarini Apify orqali oladi (Meta App Review kerak emas).
 *
 * Asinxron ish: ishni boshlaydi → tugashini kutadi → natijalarni datasetdan o'qiydi.
 * Narx: natija boshiga (≈ $2.7 / 1000 Reel); `maxItems` bitta ishda ortiqcha pul
 * yechilishiga yo'l qo'ymaydi.
 */
export class ApifyReelStatsProvider extends ReelStatsProvider {
  readonly name = "apify";

  private readonly client: ApifyClient;

  constructor(token: string, fetchFn: FetchFn = fetch) {
    super();
    this.client = new ApifyClient(token, fetchFn);
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

  private run(shortcodes: string[]): Promise<ApifyItem[]> {
    return this.client.run<ApifyItem>(
      ACTOR,
      { directUrls: shortcodes.map(canonicalReelUrl), resultsType: "details", resultsLimit: 1 },
      { maxItems: shortcodes.length, pricePerItemUsd: PRICE_PER_REEL_USD },
    );
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
    videoUrl: typeof item.videoUrl === "string" && /^https:\/\//.test(item.videoUrl) ? item.videoUrl : null,
  };
}
