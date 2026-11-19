/**
 * Yuklanish sahifasi (`index.html` dagi `#splash`): "Olivia" yozuvi qo'lda yozilgandek chiziladi.
 * Ilova tayyor bo'lgach yopiladi, lekin yozuv oxirigacha chizilib ulgurishi uchun kamida
 * `MIN_VISIBLE_MS` ko'rinib turadi (sahifa ochilgandan hisoblanadi).
 */
const MIN_VISIBLE_MS = 4350;
const FADE_MS = 450;

let hidden = false;

export function hideSplash(): void {
  if (hidden) return;
  hidden = true;
  const splash = document.getElementById("splash");
  if (!splash) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = reducedMotion ? 0 : Math.max(0, MIN_VISIBLE_MS - performance.now());
  window.setTimeout(() => {
    splash.classList.add("splash-out");
    // `transitionend` kelmasa ham (masalan, fon tabda) — baribir olib tashlanadi.
    window.setTimeout(() => splash.remove(), FADE_MS + 50);
  }, wait);
}
