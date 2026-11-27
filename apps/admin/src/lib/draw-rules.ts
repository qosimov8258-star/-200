/**
 * Random tanlov qoidalari — mock va UI uchun umumiy (backend: `apps/backend/src/draws/`).
 *
 * Adolat va tekshiriluvchanlik:
 *   1) nomzodlar `participantId` bo'yicha saralanadi (tartib tasodifga bog'liq emas);
 *   2) server tasodifiy `seed` yaratadi va ro'yxatni shu kalit bilan Fisher–Yates usulida aralashtiradi;
 *   3) birinchi N tasi — g'oliblar, keyingi M tasi — zaxira.
 * `seed` va nomzodlar ro'yxati saqlanadi — natijani istalgan payt qayta hisoblab tekshirish mumkin.
 */
import { addDays, isIsoDate } from "./dates";
import type {
  DrawPeriodInput,
  DrawPlaceholder,
  DrawSettings,
  DrawSettingsInput,
  DrawStage,
  IsoDate,
  SavedDrawSettings,
} from "./types";

export const DRAW_LIMITS = {
  winnersMax: 10_000,
  reservesMax: 1_000,
  viewsMax: 1_000_000_000,
  templateMin: 10,
  templateMax: 1_000,
} as const;

/** Oxirgi bosqich shundan qisqa bo'lsa — oldingisiga qo'shiladi. */
const MIN_STAGE_DAYS = 7;

export const DRAW_PLACEHOLDERS: DrawPlaceholder[] = [
  { token: "{ism}", label: "Ism" },
  { token: "{familiya}", label: "Familiya" },
  { token: "{sovrin}", label: "Sovg'a nomi" },
  { token: "{bosqich}", label: "Bosqich" },
  { token: "{davr}", label: "Davr sanalari" },
  { token: "{korishlar}", label: "Ko'rishlar soni" },
];

export const DEFAULT_DRAW_MESSAGE =
  "🎉 Tabriklaymiz, {ism}!\n\nSiz {bosqich} ({davr}) random tanlovida g'olib bo'ldingiz va «{sovrin}» yutdingiz!\n\nSovrinni topshirish bo'yicha operatorimiz tez orada shu chat orqali siz bilan bog'lanadi. Iltimos, botni o'chirmang.";

/** Asosiy sovrinlar tanlovi (oferta 6.2) g'oliblariga xabar — backend bilan bir xil. */
export const DEFAULT_MAIN_DRAW_MESSAGE =
  "🎉 Tabriklaymiz, {ism}!\n\nSiz «OLIVIA» aksiyasining asosiy sovrinlar random tanlovida g'olib bo'ldingiz va «{sovrin}» yutdingiz!\n\nOferta 10.2-bandiga ko'ra 5 kalendar kuni ichida tashkilotchi bilan bog'lanib, sovrinni olish uchun kerakli ma'lumotlarni taqdim eting. Operatorimiz shu chat orqali siz bilan bog'lanadi. Iltimos, botni o'chirmang.";

// ---------------------------------------------------------------------------
// Bosqichlar
// ---------------------------------------------------------------------------

function addMonths(value: IsoDate, months: number): IsoDate {
  const [year, month, day] = value.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/**
 * Tanlov muddatini oylik bosqichlarga bo'ladi: har bosqich boshlanish kunidan bir oy.
 * Masalan (oferta 6.1.2) 27.11.2026–27.02.2027 → 27.11–26.12, 27.12–26.01, 27.01–27.02.
 */
export function contestStages(startsOn: IsoDate, endsOn: IsoDate, today: IsoDate): DrawStage[] {
  const ranges: Array<[IsoDate, IsoDate]> = [];
  for (let i = 0; ; i++) {
    const from = addMonths(startsOn, i);
    if (from > endsOn) break;
    const nextFrom = addMonths(startsOn, i + 1);
    const to = nextFrom > endsOn ? endsOn : addDays(nextFrom, -1);
    ranges.push([from, to]);
  }
  const last = ranges.at(-1);
  if (ranges.length > 1 && last && daysInclusive(last[0], last[1]) < MIN_STAGE_DAYS) {
    ranges.pop();
    const prev = ranges.at(-1);
    if (prev) prev[1] = last[1];
  }
  return ranges.map(([from, to], i) => ({ index: i + 1, startsOn: from, endsOn: to, finished: to < today }));
}

function daysInclusive(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Tekshiruv
// ---------------------------------------------------------------------------

export type DrawSettingsErrors = Partial<Record<keyof DrawSettings, string>>;
export type DrawSettingsInputErrors = Partial<Record<keyof DrawSettingsInput, string>>;

const PLACEHOLDER_PATTERN = /\{[^{}\s]*\}/g;

/** Tanlov sozlamalari: davr + doimiy sozlamalar (`validateDrawSettingsInput`). */
export function validateDrawSettings(settings: DrawSettings): DrawSettingsErrors {
  const errors: DrawSettingsErrors = {};
  if (!isIsoDate(settings.periodFrom)) errors.periodFrom = "Sana noto'g'ri.";
  if (!isIsoDate(settings.periodTo)) errors.periodTo = "Sana noto'g'ri.";
  else if (isIsoDate(settings.periodFrom) && settings.periodTo < settings.periodFrom) {
    errors.periodTo = "Tugash sanasi boshlanishdan oldin bo'lmasin.";
  }
  return { ...errors, ...validateDrawSettingsInput(settings) };
}

/** Doimiy sozlamalar (`PUT /admin/draws/settings`): ko'rishlar, g'oliblar soni va bot xabari. */
export function validateDrawSettingsInput(settings: DrawSettingsInput): DrawSettingsInputErrors {
  const errors: DrawSettingsInputErrors = {};
  const isCount = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;

  if (!isCount(settings.minViews, DRAW_LIMITS.viewsMax)) errors.minViews = "0 yoki musbat butun son.";
  if (!isCount(settings.maxViews, DRAW_LIMITS.viewsMax)) errors.maxViews = "0 yoki musbat butun son.";
  else if (settings.maxViews < settings.minViews) errors.maxViews = "Eng kamidan kichik bo'lmasin.";
  if (!isCount(settings.winnersCount, DRAW_LIMITS.winnersMax) || settings.winnersCount < 1) {
    errors.winnersCount = `1 dan ${DRAW_LIMITS.winnersMax} gacha.`;
  }
  if (!isCount(settings.reservesCount, DRAW_LIMITS.reservesMax)) {
    errors.reservesCount = `0 dan ${DRAW_LIMITS.reservesMax} gacha.`;
  }

  const template = settings.messageTemplate.trim();
  if (template.length < DRAW_LIMITS.templateMin || template.length > DRAW_LIMITS.templateMax) {
    errors.messageTemplate = `${DRAW_LIMITS.templateMin}–${DRAW_LIMITS.templateMax} belgi.`;
  } else {
    const known = new Set(DRAW_PLACEHOLDERS.map((p) => p.token));
    const unknown = (template.match(PLACEHOLDER_PATTERN) ?? []).filter((token) => !known.has(token));
    if (unknown.length > 0) errors.messageTemplate = `Noma'lum o'rinbosar: ${unknown[0]}`;
  }
  return errors;
}

/** Saqlanadigan maydonlargina (`PUT /admin/draws/settings` tanasi — noma'lum maydonlar rad etiladi). */
export function drawSettingsInputOf(source: DrawSettingsInput): DrawSettingsInput {
  return {
    dateBasis: source.dateBasis,
    minViews: source.minViews,
    maxViews: source.maxViews,
    winnersCount: source.winnersCount,
    reservesCount: source.reservesCount,
    excludeWarned: source.excludeWarned,
    excludeTargets: source.excludeTargets,
    messageTemplate: source.messageTemplate,
  };
}

/** Tanlanadigan davr: bosqich (raqami bilan) yoki admin yaratgan davr (`stage: null`). */
export interface DrawPeriodChoice {
  stage: number | null;
  periodFrom: IsoDate;
  periodTo: IsoDate;
}

/** Tanlov uchun to'liq sozlamalar: saqlangan sozlamalar + tanlangan davr. Oldingi g'oliblar har doim chetda. */
export function drawRunSettings(prizeId: string, saved: SavedDrawSettings, period: DrawPeriodChoice): DrawSettings {
  return {
    prizeId,
    stage: period.stage,
    periodFrom: period.periodFrom,
    periodTo: period.periodTo,
    ...drawSettingsInputOf(saved),
    excludePreviousWinners: true,
  };
}

// ---------------------------------------------------------------------------
// Xabar
// ---------------------------------------------------------------------------

const dmy = (iso: IsoDate) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const DRAW_PERIOD_LIMITS = { titleMin: 2, titleMax: 60 } as const;

export type DrawPeriodErrors = Partial<Record<keyof DrawPeriodInput, string>>;

/**
 * Admin yaratadigan davr: nom 2–60 belgi, sanalar to'g'ri, tugash boshlanishdan oldin emas va
 * ikkalasi ham tanlov muddati ichida. Backend `validateDrawPeriod` bilan bir xil qoida.
 */
export function validateDrawPeriod(input: DrawPeriodInput, bounds: { min: IsoDate; max: IsoDate }): DrawPeriodErrors {
  const errors: DrawPeriodErrors = {};
  const title = input.title.trim();
  if (title.length < DRAW_PERIOD_LIMITS.titleMin || title.length > DRAW_PERIOD_LIMITS.titleMax) {
    errors.title = `Davr nomi ${DRAW_PERIOD_LIMITS.titleMin}–${DRAW_PERIOD_LIMITS.titleMax} belgi bo'lsin.`;
  }
  if (!isIsoDate(input.startsOn)) errors.startsOn = "Boshlanish kunini tanlang.";
  else if (!isIsoDate(input.endsOn)) errors.endsOn = "Tugash kunini tanlang.";
  else if (input.endsOn < input.startsOn) errors.endsOn = "Tugash sanasi boshlanishdan oldin bo'lmasin.";
  else if (input.startsOn < bounds.min || input.endsOn > bounds.max) {
    errors.endsOn = `Davr tanlov muddati ichida bo'lsin: ${periodLabel(bounds.min, bounds.max)}.`;
  }
  return errors;
}

export function stageLabel(stage: number | null): string {
  return stage === null ? "maxsus davr" : `${stage}-bosqich`;
}

export function periodLabel(from: IsoDate, to: IsoDate): string {
  return `${dmy(from)} – ${dmy(to)}`;
}

export function renderDrawMessage(
  template: string,
  values: {
    firstName: string;
    lastName: string;
    prizeTitle: string;
    stage: number | null;
    periodFrom: IsoDate;
    periodTo: IsoDate;
    views: number;
  },
): string {
  const map: Record<string, string> = {
    "{ism}": values.firstName,
    "{familiya}": values.lastName,
    "{sovrin}": values.prizeTitle,
    "{bosqich}": stageLabel(values.stage),
    "{davr}": periodLabel(values.periodFrom, values.periodTo),
    "{korishlar}": groupDigits(values.views),
  };
  return template.trim().replace(PLACEHOLDER_PATTERN, (token) => map[token] ?? token);
}

// ---------------------------------------------------------------------------
// Tasodifiy tanlash
// ---------------------------------------------------------------------------

/** 32 belgili hex kalit (brauzer/Node kriptografik generatori). */
export function createSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** FNV-1a (32 bit) → hex. Nomzodlar ro'yxatining qisqa izi uchun. */
export function fingerprint(values: string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const value of values) {
    for (let i = 0; i < value.length; i++) {
      h1 = Math.imul(h1 ^ value.charCodeAt(i), 0x01000193);
      h2 = Math.imul(h2 ^ value.charCodeAt(i), 0x5bd1e995);
    }
    h1 = Math.imul(h1 ^ 0x2c, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/** `seed` dan barqaror psevdotasodifiy sonlar (xoshiro128**). */
function seededRandom(seed: string): () => number {
  const words = [0, 1, 2, 3].map((i) => parseInt(seed.slice(i * 8, i * 8 + 8).padEnd(8, "0"), 16) >>> 0);
  let [a, b, c, d] = words.every((w) => w === 0) ? [1, 2, 3, 4] : words;
  return () => {
    const result = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return result / 4294967296;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Fisher–Yates: `items` o'zgarmaydi, aralashtirilgan nusxa qaytadi. */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const random = seededRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
