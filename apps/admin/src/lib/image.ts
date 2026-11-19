/**
 * Rasmni yuklashdan oldin brauzerda tayyorlash: uzun tomoni `MAX_SIDE` dan oshmaydi
 * va siqiladi. Telefon kamerasidagi 5–10 MB rasm ~150–400 KB ga tushadi, shuning
 * uchun yuklash tez va ilovada ham tez ochiladi.
 *
 * JPG -> JPG. PNG va WebP -> WebP (shaffof fon saqlanadi — masalan, fonsiz avtomobil
 * rasmi); brauzer WebP yarata olmasa -> PNG.
 */
import { ApiError } from "./api-error";
import { PRIZE_IMAGE_MAX_SOURCE_BYTES, PRIZE_IMAGE_TYPES } from "./prize-rules";

const MAX_SIDE = 1280;
const QUALITY = 0.85;
/** Bundan kichik va o'lchami mos rasm o'zgartirilmaydi. */
const KEEP_AS_IS_BYTES = 400 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ApiError(400, "Rasmni ochib bo'lmadi. Boshqa fayl tanlang."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

export async function prepareImage(file: File): Promise<Blob> {
  if (!(PRIZE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError(400, "Faqat JPG, PNG yoki WebP rasm tanlang.");
  }
  if (file.size > PRIZE_IMAGE_MAX_SOURCE_BYTES) {
    throw new ApiError(400, "Rasm 15 MB dan katta. Kichikroq rasm tanlang.");
  }

  const image = await loadImage(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (longest === 0) {
    throw new ApiError(400, "Rasmni ochib bo'lmadi. Boshqa fayl tanlang.");
  }
  if (longest <= MAX_SIDE && file.size <= KEEP_AS_IS_BYTES) {
    return file;
  }

  const scale = Math.min(1, MAX_SIDE / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new ApiError(400, "Brauzer rasmni qayta ishlay olmadi.");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (file.type === "image/jpeg") {
    const jpeg = await canvasToBlob(canvas, "image/jpeg");
    if (jpeg) return jpeg;
  } else {
    const webp = await canvasToBlob(canvas, "image/webp");
    if (webp && webp.type === "image/webp") return webp;
    const png = await canvasToBlob(canvas, "image/png");
    if (png) return png;
  }
  throw new ApiError(400, "Brauzer rasmni qayta ishlay olmadi.");
}
