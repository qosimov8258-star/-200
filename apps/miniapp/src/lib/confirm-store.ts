/**
 * Ilova ichidagi tasdiqlash oynasi (Telegram'dan tashqarida). Brauzerning `window.confirm`
 * oynasi ba'zi joylarda umuman chiqmaydi va darhol `false` qaytaradi (ilovalar ichidagi
 * brauzerlar, ba'zi WebView'lar) — ro'yxatdan o'tish shunda jim to'xtab qolardi. Shuning uchun
 * oynani o'zimiz chizamiz: `ConfirmHost` shu holatga obuna bo'ladi.
 */

export interface ConfirmRequest {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
}

let current: ConfirmRequest | null = null;
let seq = 0;
let hostMounted = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getConfirm = (): ConfirmRequest | null => current;

/** `ConfirmHost` o'rnatilganini bildiradi (o'rnatilmagan bo'lsa — zaxira yo'l). */
export function registerConfirmHost(): () => void {
  hostMounted += 1;
  return () => {
    hostMounted -= 1;
  };
}

/** Oynani ochadi; foydalanuvchi tanlaguncha kutadi. Oldingi ochiq oyna "Bekor qilish" bilan yopiladi. */
export function requestConfirm(message: string): Promise<boolean> {
  if (hostMounted === 0) return Promise.resolve(window.confirm(message));
  current?.resolve(false);
  return new Promise((resolve) => {
    seq += 1;
    const id = seq;
    current = {
      id,
      message,
      resolve: (ok) => {
        if (current?.id !== id) return;
        current = null;
        emit();
        resolve(ok);
      },
    };
    emit();
  });
}
