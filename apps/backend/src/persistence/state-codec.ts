/**
 * Holat faylini JSON ga yozish va o'qish. Oddiy `JSON.stringify` `Date` ni matnga aylantiradi va
 * o'qilganda u matn bo'lib qoladi — bu yerda `Date` lar `{ "$date": <ms> }` ko'rinishida yoziladi
 * va o'qilganda yana `Date` bo'ladi. Ishtirokchilar yozgan matnda `$date` kaliti uchrasa ham
 * xavf yo'q: obyekt faqat bitta `$date` raqamli kalitdan iborat bo'lsagina `Date` deb olinadi,
 * foydalanuvchi matni esa obyekt kaliti bo'lib yozilmaydi.
 */
interface DateTag {
  $date: number;
}

function isDateTag(value: unknown): value is DateTag {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === "$date" && typeof (value as DateTag).$date === "number";
}

export function encodeState(value: unknown): string {
  return JSON.stringify(value, function replacer(this: unknown, key: string, current: unknown) {
    // `current` — `toJSON` dan keyingi qiymat (Date uchun — matn); asl qiymat `this[key]` da.
    const raw = (this as Record<string, unknown>)[key];
    if (raw instanceof Date) return { $date: raw.getTime() } satisfies DateTag;
    return current;
  });
}

export function decodeState(text: string): unknown {
  return JSON.parse(text, (_key, value: unknown) => (isDateTag(value) ? new Date(value.$date) : value));
}
