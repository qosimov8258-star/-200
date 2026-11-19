import { MIN_AGE } from "../participants/participants.service";

/**
 * Tanlov sozlamalari. VAQTINCHA kodda; Faza 1 da `contest_settings`
 * jadvaliga ko'chadi va admin paneldan tahrirlanadi.
 */
export const contestSettings = {
  /**
   * Tanlov boshlanadigan kun (Asia/Tashkent). Ko'rishlar shu kundan boshlab har
   * `STATS_SYNC_EVERY_DAYS` kunda yig'iladi: 25-noyabr → 5-dekabr, 15-dekabr, 25-dekabr …
   */
  startsOn: "2026-11-25",
  /**
   * Tanlov tugash vaqti (UTC): 25-fevral kun oxiri, Toshkent (= 26-fevral 00:00 +05:00).
   * Sovg'alarning oxirgi bosqichi bilan bir xil (`prizes.ts` → 2027-01-25 – 2027-02-25).
   */
  endsAt: "2027-02-25T19:00:00.000Z",
  prizeName: "BYD Chazor",
  minAge: MIN_AGE,
};
