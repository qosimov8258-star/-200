/**
 * Tanlovning boshlang'ich sozlamalari — server birinchi marta ishga tushganda. Keyin ular admin
 * paneldan (Sozlamalar) tahrirlanadi va `ContestSettingsService` orqali diskda saqlanadi.
 */
export const contestDefaults = {
  /**
   * Aksiya boshlanadigan kun (Asia/Tashkent) — ommaviy oferta 2.5: 2026-yil 27-noyabr. Ko'rishlar shu
   * kundan boshlab Sozlamalardagi davr bo'yicha yig'iladi.
   */
  startsOn: "2026-11-27",
  /**
   * Aksiyaning oxirgi kuni (Asia/Tashkent, shu kun ham kiradi) — oferta 2.5: 2027-yil 27-fevral.
   * Oxirgi oylik bosqich bilan bir xil (`prizes.ts`).
   */
  endsOn: "2027-02-27",
  prizeName: "BYD Chazor",
  /** Ro'yxatdan o'tish uchun minimal yosh (PLAN.md Q3). */
  minAge: 18,
};
