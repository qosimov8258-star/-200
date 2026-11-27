/**
 * "G'oliblar" bo'limi manzillari. Ikki tab: "Asosiy sovrinlar" (`/winner`) va "Voucher"
 * (`/winner?tab=voucher`) — voucher random tanlovi shu tab ichida, ochiq tanlov natijasi
 * `&draw=<id>`. Eski `/draws` havolalari shu manzillarga yo'naltiriladi (`app/draws/`).
 */

export const WINNER_PATH = "/winner";

export type WinnerTab = "main" | "voucher";

/** `?tab=` qiymati; eski `vouchers` ham "Voucher" tabini ochadi. */
export function winnerTabOf(value: string | null): WinnerTab {
  return value === "voucher" || value === "vouchers" ? "voucher" : "main";
}

/** "Voucher" tabi; `drawId` berilsa — shu tanlov natijasi ochiq. */
export function voucherTabHref(drawId?: string | null): string {
  const draw = drawId ? `&draw=${encodeURIComponent(drawId)}` : "";
  return `${WINNER_PATH}?tab=voucher${draw}`;
}

/**
 * Tanlov natijasi manzili: asosiy sovrin (`main-*`) — "Asosiy sovrinlar" tabida (`/winner?draw=<id>`),
 * oylik voucher — "Voucher" tabida. `prize` berilsa — barabandagi tanlangan sovrin saqlanadi.
 */
export function drawHref(draw: { id: string; prizeId: string }, prize?: string | null): string {
  const base = draw.prizeId.startsWith("main-")
    ? `${WINNER_PATH}?draw=${encodeURIComponent(draw.id)}`
    : voucherTabHref(draw.id);
  return prize ? `${base}&prize=${encodeURIComponent(prize)}` : base;
}
