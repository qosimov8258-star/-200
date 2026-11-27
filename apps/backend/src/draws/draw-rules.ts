/**
 * Random tanlov qoidalari. Admin paneldagi `apps/admin/src/lib/draw-rules.ts` bilan bir xil
 * (keyin `packages/shared` ga ko'chiriladi).
 *
 * Tekshiriluvchanlik: nomzodlar id bo'yicha saralanadi, server kriptografik `seed` yaratadi va
 * ro'yxatni shu kalit bilan Fisher–Yates usulida aralashtiradi; birinchi N — g'oliblar, keyingi M —
 * zaxira. `seed` va nomzodlar izi saqlanadi — natijani istalgan payt qayta hisoblash mumkin.
 */
export type DrawDateBasis = "POSTED" | "SUBMITTED";

export interface DrawSettings {
  prizeId: string;
  /** Bosqich raqami (1 dan); null — qo'lda kiritilgan davr. */
  stage: number | null;
  periodFrom: string;
  periodTo: string;
  dateBasis: DrawDateBasis;
  minViews: number;
  maxViews: number;
  winnersCount: number;
  reservesCount: number;
  excludeWarned: boolean;
  /** Target yoki nakrutka belgisi bor videolar. */
  excludeTargets: boolean;
  excludePreviousWinners: boolean;
  messageTemplate: string;
}

/**
 * Doimiy (bir marta tasdiqlanadigan, keyin tahrirlanadigan) oylik voucher tanlovi sozlamalari — har bir
 * tanlovda faqat bosqich/davr tanlanadi. Oferta 6.1.5: voucherni bir necha oy yutish mumkin, shuning
 * uchun oldingi bosqichlar g'oliblari chetlatilmaydi (`excludePreviousWinners: false`).
 */
export type SavedDrawSettings = Omit<DrawSettings, "prizeId" | "stage" | "periodFrom" | "periodTo" | "excludePreviousWinners"> & {
  excludePreviousWinners: boolean;
  updatedAt: string;
  updatedBy: string;
};

/** `PUT /admin/draws/settings` tanasi. */
export type DrawSettingsInput = Omit<SavedDrawSettings, "excludePreviousWinners" | "updatedAt" | "updatedBy">;

export const DRAW_LIMITS = {
  winnersMax: 10_000,
  reservesMax: 1_000,
  viewsMax: 1_000_000_000,
  templateMin: 10,
  templateMax: 1_000,
} as const;

export const DRAW_PLACEHOLDERS = [
  { token: "{ism}", label: "Ism" },
  { token: "{familiya}", label: "Familiya" },
  { token: "{sovrin}", label: "Sovg'a nomi" },
  { token: "{bosqich}", label: "Bosqich" },
  { token: "{davr}", label: "Davr sanalari" },
  { token: "{korishlar}", label: "Ko'rishlar soni" },
] as const;

export const DEFAULT_DRAW_MESSAGE =
  "🎉 Tabriklaymiz, {ism}!\n\nSiz {bosqich} ({davr}) random tanlovida g'olib bo'ldingiz va «{sovrin}» yutdingiz!\n\nSovrinni topshirish bo'yicha operatorimiz tez orada shu chat orqali siz bilan bog'lanadi. Iltimos, botni o'chirmang.";

/** Asosiy sovrinlar tanlovi (oferta 6.2) g'oliblariga xabar. */
export const DEFAULT_MAIN_DRAW_MESSAGE =
  "🎉 Tabriklaymiz, {ism}!\n\nSiz «OLIVIA» aksiyasining asosiy sovrinlar random tanlovida g'olib bo'ldingiz va «{sovrin}» yutdingiz!\n\nOferta 10.2-bandiga ko'ra 5 kalendar kuni ichida tashkilotchi bilan bog'lanib, sovrinni olish uchun kerakli ma'lumotlarni taqdim eting. Operatorimiz shu chat orqali siz bilan bog'lanadi. Iltimos, botni o'chirmang.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_PATTERN = /\{[^{}\s]*\}/g;

const isIsoDate = (value: string) =>
  ISO_DATE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Birinchi xato matni; hammasi to'g'ri bo'lsa — null. */
export function validateDrawSettings(s: DrawSettings): string | null {
  const isCount = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;
  if (!isIsoDate(s.periodFrom) || !isIsoDate(s.periodTo)) return "Davr sanasi noto'g'ri.";
  if (s.periodTo < s.periodFrom) return "Tugash sanasi boshlanishdan oldin bo'lmasin.";
  if (!isCount(s.minViews, DRAW_LIMITS.viewsMax) || !isCount(s.maxViews, DRAW_LIMITS.viewsMax)) {
    return "Ko'rishlar chegarasi 0 yoki musbat butun son bo'lishi kerak.";
  }
  if (s.maxViews < s.minViews) return "Ko'rishlarning eng ko'pi eng kamidan kichik bo'lmasin.";
  if (!isCount(s.winnersCount, DRAW_LIMITS.winnersMax) || s.winnersCount < 1) {
    return `G'oliblar soni 1 dan ${DRAW_LIMITS.winnersMax} gacha.`;
  }
  if (!isCount(s.reservesCount, DRAW_LIMITS.reservesMax)) return `Zaxira 0 dan ${DRAW_LIMITS.reservesMax} gacha.`;
  const template = s.messageTemplate.trim();
  if (template.length < DRAW_LIMITS.templateMin || template.length > DRAW_LIMITS.templateMax) {
    return `Xabar matni ${DRAW_LIMITS.templateMin}–${DRAW_LIMITS.templateMax} belgi bo'lishi kerak.`;
  }
  const known = new Set<string>(DRAW_PLACEHOLDERS.map((p) => p.token));
  const unknown = (template.match(PLACEHOLDER_PATTERN) ?? []).find((token) => !known.has(token));
  return unknown ? `Noma'lum o'rinbosar: ${unknown}` : null;
}

/** Admin o'zi yaratadigan davr (kalendardan tanlanadi). */
export interface DrawPeriodInput {
  title: string;
  startsOn: string;
  endsOn: string;
}

export const DRAW_PERIOD_LIMITS = { titleMin: 2, titleMax: 60 } as const;

/**
 * Davrni tekshiradi: nom 2–60 belgi, sanalar to'g'ri, tugash boshlanishdan oldin emas va ikkalasi ham
 * tanlov muddati ichida. Xato bo'lsa — foydalanuvchiga ko'rsatiladigan matn, aks holda null.
 */
export function validateDrawPeriod(p: DrawPeriodInput, bounds: { min: string; max: string }): string | null {
  const title = p.title.trim();
  if (title.length < DRAW_PERIOD_LIMITS.titleMin || title.length > DRAW_PERIOD_LIMITS.titleMax) {
    return `Davr nomi ${DRAW_PERIOD_LIMITS.titleMin}–${DRAW_PERIOD_LIMITS.titleMax} belgi bo'lsin.`;
  }
  if (!isIsoDate(p.startsOn) || !isIsoDate(p.endsOn)) return "Sana noto'g'ri.";
  if (p.endsOn < p.startsOn) return "Tugash sanasi boshlanishdan oldin bo'lmasin.";
  if (p.startsOn < bounds.min || p.endsOn > bounds.max) {
    return `Davr tanlov muddati ichida bo'lsin: ${periodLabel(bounds.min, bounds.max)}.`;
  }
  return null;
}

const dmy = (iso: string) => iso.split("-").reverse().join(".");
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const stageLabel = (stage: number | null) => (stage === null ? "maxsus davr" : `${stage}-bosqich`);
export const periodLabel = (from: string, to: string) => `${dmy(from)} – ${dmy(to)}`;

export function renderDrawMessage(
  template: string,
  v: {
    firstName: string;
    lastName: string;
    prizeTitle: string;
    stage: number | null;
    periodFrom: string;
    periodTo: string;
    views: number;
  },
): string {
  const map: Record<string, string> = {
    "{ism}": v.firstName,
    "{familiya}": v.lastName,
    "{sovrin}": v.prizeTitle,
    "{bosqich}": stageLabel(v.stage),
    "{davr}": periodLabel(v.periodFrom, v.periodTo),
    "{korishlar}": groupDigits(v.views),
  };
  return template.trim().replace(PLACEHOLDER_PATTERN, (token) => map[token] ?? token);
}

// --- Aralashtirish (admin paneldagi bilan bir xil algoritm) ------------------

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** `seed` (hex) dan barqaror psevdotasodifiy sonlar — xoshiro128**. */
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
