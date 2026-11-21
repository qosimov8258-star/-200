import { ApifyClient, type FetchFn } from "./apify-client";

/** Meta reklama kutubxonasida topilgan faol reklama. */
export interface AdHit {
  adId: string;
  /** Reklama boshlangan kun "YYYY-MM-DD"; noma'lum bo'lsa — null. */
  startedOn: string | null;
  platforms: string[];
  /** Reklama kutubxonasidagi sahifasi — admin ko'rishi uchun. */
  url: string;
}

/**
 * Instagram akkauntlarida faol reklama (target) bor-yo'qligi. Natija: username → topilgan
 * reklamalar (bo'sh — reklama yo'q). Manbaning o'zi ishlamasa — xato otadi.
 */
export abstract class AdLibraryProvider {
  abstract readonly name: string;
  abstract check(usernames: string[]): Promise<Map<string, AdHit[]>>;
}

/** Apify'ning rasmiy aktori: https://apify.com/apify/facebook-ads-scraper */
const ACTOR = "apify~facebook-ads-scraper";
/** Bitta ishga nechta akkaunt. */
const CHUNK_SIZE = 50;
/** Bitta qidiruvdan ko'pi bilan nechta reklama olinadi (pul faqat topilgan reklama uchun). */
const RESULTS_PER_ACCOUNT = 5;
/** Bitta reklama natijasi narxi — bepul rejada (aktorning minimal chegarasi ham shu). */
const PRICE_PER_AD_USD = 0.0058;

interface AdItem {
  inputUrl?: string;
  adArchiveID?: string;
  isActive?: boolean;
  startDateFormatted?: string;
  publisherPlatform?: string[];
  ad_details?: {
    advertiser?: {
      ad_library_page_info?: { page_info?: { ig_username?: string | null; page_alias?: string | null } };
    };
  };
}

/** Kalit so'z bo'yicha faol reklamalarni qidirish manzili (barcha mamlakatlar). */
export const adLibrarySearchUrl = (query: string) =>
  `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(query)}&search_type=keyword_unordered&media_type=all`;

const adUrl = (id: string) => `https://www.facebook.com/ads/library/?id=${id}`;

/**
 * Meta reklama kutubxonasini Apify orqali tekshiradi. Har bir akkaunt username'i bo'yicha
 * qidiriladi va reklama beruvchining Instagram username'i aniq mos kelganlar olinadi.
 *
 * Cheklov: kutubxona faqat **faol** reklamalarni ko'rsatadi (Yevropadan tashqarida) — shuning
 * uchun tekshiruv tanlov davomida muntazam o'tkaziladi.
 */
export class ApifyAdLibraryProvider extends AdLibraryProvider {
  readonly name = "apify";
  private readonly client: ApifyClient;

  constructor(token: string, fetchFn: FetchFn = fetch) {
    super();
    this.client = new ApifyClient(token, fetchFn);
  }

  async check(usernames: string[]): Promise<Map<string, AdHit[]>> {
    const names = [...new Set(usernames.map((u) => u.toLowerCase()))];
    const result = new Map<string, AdHit[]>(names.map((u) => [u, []]));
    for (let i = 0; i < names.length; i += CHUNK_SIZE) {
      const chunk = names.slice(i, i + CHUNK_SIZE);
      const items = await this.client.run<AdItem>(
        ACTOR,
        {
          startUrls: chunk.map((u) => ({ url: adLibrarySearchUrl(u) })),
          resultsLimit: RESULTS_PER_ACCOUNT,
          activeStatus: "active",
          isDetailsPerAd: true,
        },
        { maxItems: chunk.length * RESULTS_PER_ACCOUNT, pricePerItemUsd: PRICE_PER_AD_USD },
      );
      for (const item of items) {
        if (!item.adArchiveID || item.isActive === false) continue;
        const info = item.ad_details?.advertiser?.ad_library_page_info?.page_info;
        const owner = (info?.ig_username ?? info?.page_alias ?? "").toLowerCase();
        // Kalit so'z boshqa reklamalarda ham uchrashi mumkin — faqat egasi aniq mos kelsa.
        const hits = result.get(owner);
        if (!hits) continue;
        hits.push({
          adId: item.adArchiveID,
          startedOn: item.startDateFormatted ? item.startDateFormatted.slice(0, 10) : null,
          platforms: item.publisherPlatform ?? [],
          url: adUrl(item.adArchiveID),
        });
      }
    }
    return result;
  }
}

/** Testlar va lokal sinov uchun. */
export class MockAdLibraryProvider extends AdLibraryProvider {
  readonly name = "mock";
  private readonly ads = new Map<string, AdHit[]>();
  readonly requests: string[][] = [];

  set(username: string, hits: AdHit[]): void {
    this.ads.set(username.toLowerCase(), hits);
  }

  check(usernames: string[]): Promise<Map<string, AdHit[]>> {
    this.requests.push([...usernames]);
    return Promise.resolve(new Map(usernames.map((u) => [u.toLowerCase(), this.ads.get(u.toLowerCase()) ?? []])));
  }
}

/** Token sozlanmagan — tekshiruv xato bilan tugaydi (jim "reklama yo'q" deyilmaydi). */
export class UnavailableAdLibraryProvider extends AdLibraryProvider {
  readonly name = "unavailable";
  check(): Promise<Map<string, AdHit[]>> {
    return Promise.reject(new Error("APIFY_API_TOKEN berilmagan — reklama kutubxonasi tekshirilmaydi"));
  }
}
