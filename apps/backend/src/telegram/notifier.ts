/**
 * Telegram orqali boradigan xabarnoma turlari — `apps/admin/src/lib/types.ts` → TelegramMessageKind
 * bilan bir xil. REEL_REVIEW — qo'lda tekshiruvga o'tdi / tiklandi / qo'lda tasdiqlandi;
 * VOUCHER_WIN — random tanlov g'olibi; WINNER — asosiy g'olib; OTHER — qolganlari.
 */
export type TelegramMessageKind =
  | "REEL_ACCEPTED"
  | "REEL_REJECTED"
  | "RANK_CHANGED"
  | "WARNING"
  | "SUPPORT_REPLY"
  | "REEL_REVIEW"
  | "VOUCHER_WIN"
  | "WINNER"
  | "OTHER";

export const TELEGRAM_MESSAGE_KINDS: readonly TelegramMessageKind[] = [
  "REEL_ACCEPTED",
  "REEL_REJECTED",
  "RANK_CHANGED",
  "WARNING",
  "SUPPORT_REPLY",
  "REEL_REVIEW",
  "VOUCHER_WIN",
  "WINNER",
  "OTHER",
];

/**
 * Ishtirokchiga bot orqali xabar yuborish. Nest DI tokeni: amalda TelegramService
 * (`app.module.ts` → `useExisting`), testlarda — oddiy soxta obyekt.
 *
 * Har bir xabar Telegram jurnaliga (admin panel → "Telegram") `kind` bilan yoziladi;
 * berilmasa — "OTHER". Yuborib bo'lmasa — xato chaqiruvchiga qaytariladi.
 */
export abstract class ParticipantNotifier {
  abstract notify(chatId: number, text: string, kind?: TelegramMessageKind): Promise<void>;
}
