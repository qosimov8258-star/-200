import type { QueryClient } from "@tanstack/react-query";

import { errorCode } from "./api-error";

/**
 * Saytga kirish (yoki ro'yxatdan o'tish) muvaffaqiyatli bo'lgach — barcha so'rovlar qayta yuklanadi.
 * Brauzer sessiya cookie'sini qabul qilmagan bo'lsa (masalan, Safari "Barcha cookie'larni
 * bloklash"), `me` hamon 401 qaytaradi — shunda `true`: oyna yopilmaydi, foydalanuvchiga
 * cookie'larni yoqish aytiladi (tugma cheksiz aylanib yoki kutish cheksiz davom etib qolmasin).
 */
export async function sessionRejected(queryClient: QueryClient): Promise<boolean> {
  await queryClient.invalidateQueries();
  const me = queryClient.getQueryState(["me"]);
  return me?.status === "error" && errorCode(me.error) === "UNAUTHORIZED";
}
