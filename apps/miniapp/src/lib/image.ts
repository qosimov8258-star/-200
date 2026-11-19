/**
 * Skrinshotni yuborishdan oldin siqish: eng uzun tomoni ko'pi bilan `MAX_SIDE` px, JPEG.
 * Qayta chizish rasm ichidagi metama'lumotlarni (EXIF: joylashuv, qurilma) ham olib tashlaydi.
 * Backend 2 MB dan katta rasmni qabul qilmaydi.
 */
const MAX_SIDE = 1600;
const MAX_DATA_URL_CHARS = 2_600_000;
const QUALITIES = [0.82, 0.7, 0.55] as const;

export class ImageError extends Error {}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Ba'zi brauzerlar ayrim turlarni createImageBitmap bilan o'qiy olmaydi — <img> orqali.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressScreenshot(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new ImageError("not an image");
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new ImageError("cannot decode");
  }
  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!width || !height) throw new ImageError("empty image");

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("no canvas");
  // Shaffof PNG qora fon bilan chiqmasin.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  for (const quality of QUALITIES) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl;
  }
  throw new ImageError("too large");
}
