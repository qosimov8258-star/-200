/** Shikoyat skrinshoti: Mini App rasmni JPEG ga siqib, `data:` URL ko'rinishida yuboradi. */
export type ScreenshotMime = "image/jpeg" | "image/png" | "image/webp";

export interface Screenshot {
  mime: ScreenshotMime;
  data: Buffer;
}

/** Siqilgan skrinshot odatda 150–600 KB; undan kattasi qabul qilinmaydi. */
export const MAX_SCREENSHOT_BYTES = 2_000_000;
/** `data:` URL (base64) uchun matn uzunligi chegarasi — JSON tanasi shundan oshmaydi. */
export const MAX_SCREENSHOT_CHARS = Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) + 64;
const MIN_SCREENSHOT_BYTES = 1_000;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/** Fayl boshidagi "sehrli" baytlar e'lon qilingan turga mos kelishi kerak. */
function matchesMime(data: Buffer, mime: ScreenshotMime): boolean {
  switch (mime) {
    case "image/jpeg":
      return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/png":
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
  }
}

/** `data:image/...;base64,...` → rasm; yaroqsiz, juda kichik yoki katta bo'lsa — null. */
export function parseScreenshot(dataUrl: string): Screenshot | null {
  if (dataUrl.length > MAX_SCREENSHOT_CHARS) return null;
  const match = DATA_URL.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] as ScreenshotMime;
  const data = Buffer.from(match[2], "base64");
  if (data.length < MIN_SCREENSHOT_BYTES || data.length > MAX_SCREENSHOT_BYTES) return null;
  return matchesMime(data, mime) ? { mime, data } : null;
}

export const screenshotExtension = (mime: ScreenshotMime): string =>
  mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
