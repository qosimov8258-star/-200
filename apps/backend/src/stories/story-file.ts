/**
 * Istoriya videosi: Mini App faylni o'zgartirmasdan, so'rov tanasining o'zida (raw) yuboradi,
 * turi — `Content-Type` sarlavhasida. Bu yerda turi, hajmi va fayl boshidagi baytlar tekshiriladi.
 */

export type StoryMime = "video/mp4" | "video/quicktime" | "video/webm";

export const STORY_MIMES: readonly StoryMime[] = ["video/mp4", "video/quicktime", "video/webm"];

/** Bitta istoriya ko'pi bilan 50 MB (nginx'da ham shunga yetadigan chegara bor). */
export const MAX_STORY_BYTES = 50 * 1024 * 1024;
/** Bundan kichik fayl video bo'lishi mumkin emas (bo'sh yoki uzilgan yuklash). */
export const MIN_STORY_BYTES = 1_000;

/** `video/mp4; codecs=...` → `video/mp4`; qo'llab-quvvatlanmaydigan tur — null. */
export function storyMimeOf(contentType: string | undefined): StoryMime | null {
  const base = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return (STORY_MIMES as readonly string[]).includes(base) ? (base as StoryMime) : null;
}

/** MP4 va MOV (ISO BMFF) fayl boshidagi birinchi "atom" nomlari. */
const BMFF_ATOMS = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip"]);
/** WebM (Matroska / EBML) sarlavhasi. */
const EBML_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

/** Fayl boshidagi baytlar e'lon qilingan turga mos keladimi. MP4 va MOV bir-birining o'rnida keladi. */
export function looksLikeVideo(data: Buffer, mime: StoryMime): boolean {
  if (mime === "video/webm") return data.subarray(0, 4).equals(EBML_MAGIC);
  return BMFF_ATOMS.has(data.subarray(4, 8).toString("latin1"));
}

export const storyExtension = (mime: StoryMime): string =>
  mime === "video/webm" ? "webm" : mime === "video/quicktime" ? "mov" : "mp4";
