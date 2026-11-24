/** Bitta Reel haqida tashqi manbadan olingan ma'lumot. */
export interface ReelStats {
  shortcode: string;
  /** Instagram akkaunt nomi (egasi). */
  owner: string | null;
  /** Video (Reel) ekanligi — rasm yoki karusel emas. */
  isVideo: boolean;
  /** Ko'rishlar (Instagram'dagi "plays"); manba bera olmasa — null. */
  views: number | null;
  /** Yashirilgan bo'lsa — null. */
  likes: number | null;
  comments: number | null;
  postedAt: Date | null;
  /**
   * Video faylining manzili (Instagram CDN, muddati bir necha kun) — AI tekshiruvi videoni shu
   * yerdan yuklab oladi. Manba bermasa — null yoki yo'q.
   */
  videoUrl?: string | null;
}

/**
 * Ko'rishlar manbai. Nest DI tokeni sifatida abstract class (interfeys runtime'da yo'q).
 *
 * Hozir: Apify (`apify.provider.ts`); lokal sinov uchun — `mock.provider.ts`.
 * Meta Graph API ulanadigan bo'lsa, shu interfeysning yana bir amalga oshirilishi qo'shiladi.
 */
export abstract class ReelStatsProvider {
  abstract readonly name: string;

  /**
   * Natija: shortcode → statistika. Instagram'da topilmagan (o'chirilgan, yopiq akkaunt)
   * Reel uchun — null. Manbaning o'zi ishlamasa (tarmoq, token, limit) — xato otadi.
   */
  abstract fetch(shortcodes: string[]): Promise<Map<string, ReelStats | null>>;
}

/** Token sozlanmagan: har bir so'rov xato bilan tugaydi, videolar PENDING holida kutadi. */
export class UnavailableReelStatsProvider extends ReelStatsProvider {
  readonly name = "unavailable";

  constructor(private readonly reason: string) {
    super();
  }

  fetch(): Promise<Map<string, ReelStats | null>> {
    return Promise.reject(new Error(this.reason));
  }
}
