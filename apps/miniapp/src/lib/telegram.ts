/**
 * Telegram Mini App SDK ustidan yupqa, tiplangan qatlam.
 *
 * SDK `index.html` da yuklanadi (`telegram-web-app.js`). Telegram'dan tashqarida
 * (oddiy brauzerda) ham obyekt mavjud bo'ladi, lekin `initData` bo'sh — shunda
 * ilova dev rejimida ishlaydi va Telegram funksiyalari o'rniga zaxira yo'l ishlatiladi.
 */

type HapticImpact = "light" | "medium" | "heavy" | "rigid" | "soft";
type HapticNotice = "error" | "success" | "warning";

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TgInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  version: string;
  platform: string;
  ready(): void;
  expand(): void;
  close(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  disableClosingConfirmation?(): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openTelegramLink(url: string): void;
  requestContact?(callback?: (shared: boolean) => void): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
  showAlert(message: string, callback?: () => void): void;
  onEvent(event: string, handler: () => void): void;
  offEvent(event: string, handler: () => void): void;
  safeAreaInset?: TgInsets;
  contentSafeAreaInset?: TgInsets;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(handler: () => void): void;
    offClick(handler: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: HapticImpact): void;
    selectionChanged(): void;
    notificationOccurred(type: HapticNotice): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const webApp: TgWebApp | undefined = window.Telegram?.WebApp;

/** Ilova haqiqatan Telegram ichida ochilganmi (imzolangan initData bor). */
export const isInTelegram = Boolean(webApp && webApp.initData !== "");

/** Backend foydalanuvchini shu satr orqali taniydi (HMAC bilan tekshiriladi). */
export const initData = isInTelegram ? webApp!.initData : "";

/** Foydalanuvchining Telegram'dagi ismi — faqat ko'rsatish uchun, ishonchli emas. */
export const telegramFirstName = webApp?.initDataUnsafe.user?.first_name ?? null;

const supports = (version: string) =>
  isInTelegram && webApp!.isVersionAtLeast(version);

/** Ilova ochilganda bir marta chaqiriladi. */
export function initTelegram(backgroundColor: string): void {
  if (!webApp || !isInTelegram) return;
  webApp.ready();
  webApp.expand();
  if (supports("6.1")) {
    webApp.setHeaderColor(backgroundColor);
    webApp.setBackgroundColor(backgroundColor);
  }
  if (supports("7.10")) webApp.setBottomBarColor?.(backgroundColor);
  // Ro'yxatni pastga surganda ilova yopilib ketmasin.
  if (supports("7.7")) webApp.disableVerticalSwipes?.();
  applySafeArea();
  webApp.onEvent("safeAreaChanged", applySafeArea);
  webApp.onEvent("contentSafeAreaChanged", applySafeArea);
}

/** Telegram'ning tizim va o'z panellari uchun bo'sh joyni CSS o'zgaruvchilarga yozadi. */
function applySafeArea(): void {
  const root = document.documentElement.style;
  const system = webApp?.safeAreaInset;
  const content = webApp?.contentSafeAreaInset;
  root.setProperty("--tg-top", `${(system?.top ?? 0) + (content?.top ?? 0)}px`);
  root.setProperty(
    "--tg-bottom",
    `${(system?.bottom ?? 0) + (content?.bottom ?? 0)}px`,
  );
}

export const haptic = {
  tap: () => isInTelegram && webApp!.HapticFeedback.impactOccurred("light"),
  select: () => isInTelegram && webApp!.HapticFeedback.selectionChanged(),
  success: () =>
    isInTelegram && webApp!.HapticFeedback.notificationOccurred("success"),
  error: () => isInTelegram && webApp!.HapticFeedback.notificationOccurred("error"),
};

/** Tasdiqlash oynasi: Telegram'da — tizim oynasi, brauzerda — `confirm`. */
export function confirmDialog(message: string): Promise<boolean> {
  if (isInTelegram) {
    return new Promise((resolve) => webApp!.showConfirm(message, resolve));
  }
  return Promise.resolve(window.confirm(message));
}

/** Tashqi havola (masalan, Reel'ni Instagram'da ochish) — Telegram'dan tashqarida ochiladi. */
export function openExternal(url: string): void {
  if (isInTelegram) webApp!.openLink(url);
  else window.open(url, "_blank", "noopener");
}

/** Telegram ichidagi havola (bot chati). */
export function openTelegram(url: string): void {
  if (isInTelegram) webApp!.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
}

/**
 * Telefon raqamini so'raydi. Telegram raqamni botga yuboradi (Mini App'ga emas);
 * backend uni bot orqali oladi va foydalanuvchiga bog'laydi.
 * Natija: `true` — foydalanuvchi ulashdi, `false` — rad etdi, `null` — imkoniyat yo'q.
 */
export function requestContact(): Promise<boolean | null> {
  if (!isInTelegram || !supports("6.9") || !webApp!.requestContact) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => webApp!.requestContact!(resolve));
}

export function closeMiniApp(): void {
  if (isInTelegram) webApp!.close();
}

/** Telegram'ning "Orqaga" tugmasi (yuqori chap burchakda). */
export function showBackButton(handler: () => void): () => void {
  if (!isInTelegram) return () => {};
  webApp!.BackButton.onClick(handler);
  webApp!.BackButton.show();
  return () => {
    webApp!.BackButton.offClick(handler);
    webApp!.BackButton.hide();
  };
}
