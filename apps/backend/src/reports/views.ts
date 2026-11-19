import { addDays } from "../common/time";

/** Kunlik snapshotning hisobot uchun kerakli qismi (`ReelSnapshot` ham shu ko'rinishga mos). */
export interface ViewPoint {
  /** Tanlov kuni "YYYY-MM-DD" (Asia/Tashkent). */
  date: string;
  views: number;
}

/**
 * `day` kunidagi ko'rishlar: `date <= day` bo'lgan oxirgi snapshot. Ko'rishlar har kuni
 * yig'ilmaydi (masalan, 10 kunda bir marta) — yig'ilmagan kunlarda oldingi qiymat amal qiladi.
 * Bir kunda bir nechta yozuv bo'lsa — keyingisi. Undan oldin snapshot yo'q bo'lsa — null
 * (video shu kungacha hali hisobga olinmagan).
 */
export function viewsOn(history: readonly ViewPoint[], day: string): number | null {
  let found: ViewPoint | null = null;
  for (const s of history) {
    if (s.date <= day && (found === null || s.date >= found.date)) found = s;
  }
  return found === null ? null : found.views;
}

/**
 * `day` kuni yig'ilgan yangi ko'rishlar: shu kun va oldingi kun ko'rishlari farqi
 * (oldin snapshot bo'lmasa — noldan). Instagram sun'iy ko'rishlarni tozalasa, manfiy bo'lishi mumkin.
 */
export function growthOn(history: readonly ViewPoint[], day: string): number {
  const current = viewsOn(history, day);
  if (current === null) return 0;
  return current - (viewsOn(history, addDays(day, -1)) ?? 0);
}

/**
 * Kunlik o'sish xaritasi — faqat snapshot bor kunlar (qolgan kunlarda o'sish 0). Natija
 * `growthOn` bilan bir xil, lekin butun tarix bir o'tishda hisoblanadi (dashboard uchun).
 */
export function growthByDay(history: readonly ViewPoint[]): Map<string, number> {
  // Bir kunga bitta qiymat — keyingisi (`viewsOn` dagi qoida bilan bir xil).
  const byDate = new Map<string, number>();
  for (const s of history) byDate.set(s.date, s.views);
  const growth = new Map<string, number>();
  let previous = 0;
  for (const day of [...byDate.keys()].sort()) {
    const views = byDate.get(day) ?? 0;
    growth.set(day, views - previous);
    previous = views;
  }
  return growth;
}
