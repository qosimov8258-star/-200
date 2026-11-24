/**
 * AI tekshiruvi: namuna rasmni yuborishdan oldin brauzerda tayyorlash.
 *
 * Telefon rasmlari 5–15 MB, 4000 px dan katta bo'ladi — backend esa ko'pi bilan 2 MB qabul qiladi va AI
 * uchun bunchalik katta rasm kerak emas. Shuning uchun rasm `canvas` ga uzun tomoni ≤ 1600 px qilib
 * chiziladi va JPEG (sifat 0,85) `data:` URL sifatida yuboriladi (`POST /admin/ai/draft/references`).
 */
import { formatFileSize } from "./format";
import { AI_LIMITS } from "./types";

/**
 * Tanlanadigan fayl hajmi chegarasi (kichraytirishdan oldin) — 100 MB. Fayl baribir brauzerda
 * 1600 px va ≤ 2 MB JPEG ga keltiriladi, serverga katta fayl bormaydi; chegara faqat brauzer
 * xotirasi uchun (juda katta rasmni ochish qiyin).
 */
export const AI_SOURCE_MAX_BYTES = 100 * 1024 * 1024;
/** Kichraytirilgan rasmning uzun tomoni, px. */
export const AI_IMAGE_MAX_EDGE = 1600;
/** JPEG sifati. */
export const AI_IMAGE_QUALITY = 0.85;
/** Kamdan-kam holat: 0,85 da ham 2 MB dan oshsa — bir marta shu sifat bilan qayta urinadi. */
const FALLBACK_QUALITY = 0.7;

/** Fayl tanlash oynasi uchun. */
export const AI_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/*";

/** Brauzer turini bermaganda kengaytma bo'yicha rasm deb hisoblanadiganlar. */
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;

/** Foydalanuvchiga ko'rsatiladigan (o'zbekcha) xato. */
export class AiImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiImageError";
  }
}

export interface PreparedImage {
  dataUrl: string;
  /** base64 ochilgandagi hajm, bayt. */
  bytes: number;
  width: number;
  height: number;
}

/** Faylni ochmasdan qilinadigan tekshiruv: rasm emas yoki juda katta bo'lsa — xato matni. */
export function aiImageFileError(file: File): string | null {
  const looksLikeImage = file.type ? file.type.startsWith("image/") : IMAGE_EXTENSIONS.test(file.name);
  if (!looksLikeImage) {
    return "Bu rasm emas. JPG, PNG yoki WebP rasm tanlang.";
  }
  if (file.size > AI_SOURCE_MAX_BYTES) {
    return `Rasm juda katta (${formatFileSize(file.size)}). Ko'pi bilan ${formatFileSize(AI_SOURCE_MAX_BYTES)} bo'lsin.`;
  }
  if (file.size === 0) {
    return "Fayl bo'sh. Boshqa rasm tanlang.";
  }
  return null;
}

/** `data:` URL dagi base64 qismning ochilgandagi hajmi. */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** Rasmni ochish: avval `createImageBitmap` (EXIF burilishini hisobga oladi), bo'lmasa — `<img>`. */
async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Ba'zi brauzerlar parametrni yoki formatni qo'llamaydi — `<img>` bilan urinib ko'ramiz.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new AiImageError(
      "Rasmni ochib bo'lmadi: fayl buzilgan yoki brauzer bu formatni o'qiy olmaydi (masalan, iPhone'dagi HEIC). JPG yoki PNG rasm tanlang.",
    );
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

/**
 * Rasmni yuborishga tayyorlash: tekshiruv, uzun tomoni ≤ 1600 px, JPEG 0,85 (shaffof joylar oq).
 * @throws AiImageError — o'zbekcha matn bilan
 */
export async function prepareAiReferenceImage(file: File): Promise<PreparedImage> {
  const problem = aiImageFileError(file);
  if (problem) throw new AiImageError(problem);

  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) {
      throw new AiImageError("Rasmning o'lchamini aniqlab bo'lmadi. Boshqa rasm tanlang.");
    }
    const scale = Math.min(1, AI_IMAGE_MAX_EDGE / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new AiImageError("Brauzer rasmni kichraytira olmadi. Sahifani yangilab, qaytadan urinib ko'ring.");
    }
    // JPEG da shaffoflik yo'q — PNG ning shaffof joylari qora emas, oq bo'lsin.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(decoded.source, 0, 0, width, height);

    for (const quality of [AI_IMAGE_QUALITY, FALLBACK_QUALITY]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (!dataUrl.startsWith("data:image/jpeg")) {
        throw new AiImageError("Brauzer rasmni JPEG ga o'tkaza olmadi. Boshqa brauzerda urinib ko'ring.");
      }
      const bytes = dataUrlBytes(dataUrl);
      if (bytes <= AI_LIMITS.maxReferenceBytes) {
        return { dataUrl, bytes, width, height };
      }
    }
    throw new AiImageError(
      `Rasmni ${formatFileSize(AI_LIMITS.maxReferenceBytes)} gacha kichraytirib bo'lmadi. Boshqa (oddiyroq) rasm tanlang.`,
    );
  } finally {
    decoded.release();
  }
}
