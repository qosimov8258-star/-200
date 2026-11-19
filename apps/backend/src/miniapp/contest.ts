/**
 * Tanlovning boshlang'ich sozlamalari — server birinchi marta ishga tushganda. Keyin ular admin
 * paneldan (Sozlamalar) tahrirlanadi va `ContestSettingsService` orqali diskda saqlanadi.
 */
export const contestDefaults = {
  /**
   * Tanlov boshlanadigan kun (Asia/Tashkent). Ko'rishlar shu kundan boshlab har
   * `STATS_SYNC_EVERY_DAYS` kunda yig'iladi: 25-noyabr → 5-dekabr, 15-dekabr, 25-dekabr …
   */
  startsOn: "2026-11-25",
  /**
   * Tanlovning oxirgi kuni (Asia/Tashkent, shu kun ham kiradi) — tanlov shu kun oxirida tugaydi.
   * Sovg'alarning oxirgi bosqichi bilan bir xil (`prizes.ts` → 2027-01-25 – 2027-02-25).
   */
  endsOn: "2027-02-25",
  prizeName: "BYD Chazor",
  /** Ro'yxatdan o'tish uchun minimal yosh (PLAN.md Q3). */
  minAge: 18,
};
