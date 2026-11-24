import { ReelStatsProvider, type ReelStats } from "./reel-stats";

/**
 * SOXTA ko'rishlar — faqat lokal sinov va testlar uchun (`STATS_PROVIDER=mock`).
 *
 * Har bir shortcode uchun barqaror boshlang'ich qiymat, har so'rovda ko'rishlar
 * biroz oshadi. Testlarda `set()` bilan aniq natija berish mumkin.
 */
export class MockReelStatsProvider extends ReelStatsProvider {
  readonly name = "mock";
  /** AI tekshiruvini lokal sinash uchun hamma videolarga beriladigan fayl manzili (`STATS_MOCK_VIDEO_URL`). */
  constructor(private readonly videoUrl: string | null = null) {
    super();
  }

  private readonly fixed = new Map<string, ReelStats | null>();
  private readonly calls = new Map<string, number>();
  /** Testlar uchun: necha marta va qaysi shortcode'lar so'ralgani. */
  readonly requests: string[][] = [];
  /** Testlar uchun: true bo'lsa — manba ishlamayotgandek xato otadi. */
  failing = false;

  /** Shortcode uchun aniq natija (null — Instagram'da topilmadi). */
  set(shortcode: string, stats: Partial<ReelStats> | null): void {
    this.fixed.set(shortcode, stats === null ? null : { ...this.generate(shortcode, 0), ...stats, shortcode });
  }

  fetch(shortcodes: string[]): Promise<Map<string, ReelStats | null>> {
    this.requests.push([...shortcodes]);
    if (this.failing) return Promise.reject(new Error("Mock manba ishlamayapti"));
    const result = new Map<string, ReelStats | null>();
    for (const code of shortcodes) {
      const n = this.calls.get(code) ?? 0;
      this.calls.set(code, n + 1);
      result.set(code, this.fixed.has(code) ? (this.fixed.get(code) ?? null) : this.generate(code, n));
    }
    return Promise.resolve(result);
  }

  private generate(shortcode: string, call: number): ReelStats {
    const seed = [...shortcode].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 100_003, 7);
    const views = Math.round((2_000 + (seed % 40_000)) * (1 + call * 0.18));
    return {
      shortcode,
      owner: `mock_${shortcode.toLowerCase()}`,
      isVideo: true,
      views,
      likes: Math.round(views * 0.045),
      comments: Math.round(views * 0.002),
      postedAt: new Date(Date.now() - 86_400_000),
      videoUrl: this.videoUrl,
    };
  }
}
