const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);
const MEDIA_SEGMENTS = new Set(["reel", "reels", "p"]);
const SHORTCODE = /^[A-Za-z0-9_-]{5,}$/;

/**
 * Instagram Reel linkidan shortcode ni ajratadi; yaroqsiz bo'lsa — null.
 *
 * Qabul qilinadi: `https://www.instagram.com/reel/<code>/`, `.../reels/<code>`,
 * `.../p/<code>` va `.../<username>/reel/<code>`. Yakuniy tekshiruv (video mavjudligi,
 * egasi) baribir serverda qilinadi. Mini App dagi `apps/miniapp/src/lib/reel-url.ts` bilan bir xil (keyin `packages/shared` ga ko'chiriladi).
 */
export function parseReelShortcode(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const mediaIndex = segments.findIndex((s) => MEDIA_SEGMENTS.has(s));
  if (mediaIndex < 0 || mediaIndex > 1 || mediaIndex + 1 >= segments.length) {
    return null;
  }
  const code = segments[mediaIndex + 1];
  return SHORTCODE.test(code) ? code : null;
}

/** Kuzatuv parametrlarisiz, bir xil ko'rinishdagi link. */
export const canonicalReelUrl = (shortcode: string) =>
  `https://www.instagram.com/reel/${shortcode}/`;
