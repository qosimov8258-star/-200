import type { BotCommand } from "grammy/types";

import type { Lang } from "../common/lang";
import { texts, type BotTexts } from "./texts";
import { textsRu } from "./texts.ru";

/** Til so'rovi — til hali tanlanmagan, shuning uchun ikkala tilda. */
export const LANGUAGE_PROMPT = "🌐 Tilni tanlang\n🌐 Выберите язык";

/** Til tanlash tugmalari (har biri o'z tilida). */
export const LANGUAGE_BUTTONS: Readonly<Record<Lang, string>> = { uz: "🇺🇿 O'zbekcha", ru: "🇷🇺 Русский" };

/** Bot buyruqlari ro'yxati ("/" menyusi) — bitta, ikkala tilda. */
export const BOT_COMMANDS: readonly BotCommand[] = [
  { command: "start", description: "Boshlash / Начать" },
  { command: "lang", description: "Tilni o'zgartirish / Сменить язык" },
];

/** Ishtirokchi tilidagi bot matnlari (til tanlanmagan bo'lsa — o'zbekcha). */
export function textsFor(lang: Lang | null | undefined): BotTexts {
  return lang === "ru" ? textsRu : texts;
}
