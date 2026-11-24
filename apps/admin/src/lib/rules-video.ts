/**
 * Qoida videosi fayli: formatni aniqlash va yuklashdan oldingi tekshiruv (cheklovlar backenddagi
 * bilan bir xil — `RULES_VIDEO_LIMITS`). Komponent, `api.http.ts` va mock API shu yerdan foydalanadi.
 */
import { formatFileSize } from "./format";
import { RULES_VIDEO_LIMITS, type RulesVideoMime } from "./types";

/** Brauzer fayl turini bermasa (yoki umumiy tur bersa) — kengaytma bo'yicha. */
const MIME_BY_EXTENSION: Record<string, RulesVideoMime> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  qt: "video/quicktime",
  webm: "video/webm",
};

function isRulesVideoMime(value: string): value is RulesVideoMime {
  return (RULES_VIDEO_LIMITS.mimeTypes as readonly string[]).includes(value);
}

/**
 * Faylning video turi (backendga `Content-Type` bo'lib ketadi); qo'llab-quvvatlanmasa — null.
 * Brauzer turi bo'sh, `application/octet-stream` yoki boshqa `video/*` bo'lsa (masalan, macOS'da
 * .m4v — `video/x-m4v`), kengaytmaga qaraladi.
 */
export function rulesVideoMimeOf(file: Pick<File, "name" | "type">): RulesVideoMime | null {
  const type = file.type.trim().toLowerCase();
  if (isRulesVideoMime(type)) return type;
  // Rasm, hujjat va boshqa aniq turdagi fayllar — video emas.
  if (type !== "" && type !== "application/octet-stream" && !type.startsWith("video/")) return null;
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return MIME_BY_EXTENSION[extension] ?? null;
}

/** Yuklashdan oldingi tekshiruv: xato matni yoki null (fayl yaroqli). */
export function rulesVideoFileError(file: Pick<File, "name" | "type" | "size">): string | null {
  if (rulesVideoMimeOf(file) === null) {
    return "Faqat MP4, MOV yoki WebM formatidagi video yuklash mumkin.";
  }
  if (file.size === 0) {
    return "Fayl bo'sh. Boshqa video tanlang.";
  }
  if (file.size > RULES_VIDEO_LIMITS.maxBytes) {
    return `Video juda katta (${formatFileSize(file.size)}). Ko'pi bilan ${formatFileSize(RULES_VIDEO_LIMITS.maxBytes)} yuklash mumkin.`;
  }
  return null;
}
