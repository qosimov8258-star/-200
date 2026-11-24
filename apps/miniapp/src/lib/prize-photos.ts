import carFallback from "../assets/hero_car.webp";

/**
 * Sovg'alarning haqiqiy rasmlari: `src/assets/prizes/<nom>.<webp|png|jpg>`
 * (car, phone, tablet, travel, voucher). Fayl bo'lmasa — null (mashina uchun eski rasm).
 * Bosh sahifa va "Sovg'alar" ekrani ikkalasi ham shu yerdan oladi.
 */
const PHOTOS = import.meta.glob<string>("../assets/prizes/*.{webp,png,jpg,jpeg}", {
  eager: true,
  import: "default",
});

export type PrizePhotoKey = "car" | "phone" | "tablet" | "travel" | "voucher";

export function prizePhoto(key: PrizePhotoKey): string | null {
  const entry = Object.entries(PHOTOS).find(([path]) => path.split("/").pop()?.split(".")[0] === key);
  return entry ? entry[1] : key === "car" ? carFallback : null;
}

/**
 * Rasmning o'z foni bormi: shaffof yoki oq fonli (car, phone, tablet — foni qirqilgan) —
 * `object-contain`; fonli (travel, voucher — och pushti/bej) — plitkani to'ldiradi (`object-cover`),
 * "Sovg'alar" ekranida esa chetlari yumshoq so'nadi.
 */
export const PRIZE_PHOTO_HAS_BACKGROUND: Record<PrizePhotoKey, boolean> = {
  car: false,
  phone: false,
  tablet: false,
  travel: true,
  voucher: true,
};
