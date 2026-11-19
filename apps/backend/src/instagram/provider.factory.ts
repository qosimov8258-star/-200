import { config } from "../config/config";
import {
  AdLibraryProvider,
  ApifyAdLibraryProvider,
  MockAdLibraryProvider,
  UnavailableAdLibraryProvider,
} from "./ad-library";
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

/** Reklama kutubxonasi manbai: mock rejimda — doim "reklama yo'q". */
export function createAdLibraryProvider(): AdLibraryProvider {
  const { provider, apifyToken } = config.stats;
  if (provider === "mock") return new MockAdLibraryProvider();
  if (!apifyToken) return new UnavailableAdLibraryProvider();
  return new ApifyAdLibraryProvider(apifyToken);
}
