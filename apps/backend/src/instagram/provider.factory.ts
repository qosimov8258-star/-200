import { config } from "../config/config";
import { ApifyReelStatsProvider } from "./apify.provider";
import { MockReelStatsProvider } from "./mock.provider";
import { ReelStatsProvider, UnavailableReelStatsProvider } from "./reel-stats";

/** `STATS_PROVIDER` bo'yicha ko'rishlar manbai. Token yo'q bo'lsa — jim soxtaga o'tmaydi. */
export function createReelStatsProvider(): ReelStatsProvider {
  const { provider, apifyToken } = config.stats;
  if (provider === "mock") return new MockReelStatsProvider();
  if (!apifyToken) {
    return new UnavailableReelStatsProvider("APIFY_API_TOKEN berilmagan (apps/backend/.env)");
  }
  return new ApifyReelStatsProvider(apifyToken);
}
