import type { Lang } from "../common/lang";
import { texts, type BotTexts } from "./texts";
import { textsRu } from "./texts.ru";

/** Ishtirokchi tilidagi bot matnlari (til tanlanmagan bo'lsa — o'zbekcha). */
export function textsFor(lang: Lang | null | undefined): BotTexts {
  return lang === "ru" ? textsRu : texts;
}
