/**
 * Ishtirokchiga bot orqali xabar yuborish. Nest DI tokeni: amalda TelegramService
 * (`app.module.ts` → `useExisting`), testlarda — oddiy soxta obyekt.
 */
export abstract class ParticipantNotifier {
  abstract notify(chatId: number, text: string): Promise<void>;
}
