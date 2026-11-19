/**
 * Ilova yoki saytdan yozilgan support xabarini operatorlar guruhiga yetkazish. Nest DI tokeni:
 * amalda TelegramService (`app.module.ts` → `useExisting`), testlarda — soxta obyekt.
 * Operator guruhdagi shu xabarga "Reply" qilsa, javob bot orqali ishtirokchiga boradi va
 * yozishmada (ilova/sayt) ham ko'rinadi.
 */
export abstract class SupportRelay {
  /** Guruh ulanmagan bo'lsa — hech narsa qilmaydi (xabar baribir saqlangan). */
  abstract forward(telegramId: number, header: string, text: string): Promise<void>;
}
