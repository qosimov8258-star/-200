/**
 * Sovrinlar — «OLIVIA» reklama aksiyasi ommaviy ofertasi (25.11.2026, 6-bo'lim) bo'yicha.
 * Javob shakli `apps/miniapp/src/lib/types.ts` → ContestPrizes bilan bir xil.
 * Sanalar — Asia/Tashkent bo'yicha aksiya kunlari, ikkala chegara ham kiradi.
 */
export interface ContestPrizes {
  monthly: {
    title: string;
    amount: number;
    perMonth: number;
    total: number;
    minViews: number;
    maxViews: number;
  };
  stages: { startsOn: string; endsOn: string }[];
  tiers: {
    kind: "tablet" | "phone" | "travel" | "car";
    title: string;
    quantity: number;
    unit: string | null;
    minViews: number;
    maxViews: number | null;
  }[];
  notes: string[];
}

/** Ruscha nomlar va izohlar (oferta ruscha matni bo'yicha) — sonlar va sanalar `contestPrizes` dan. */
export const contestPrizesRu: Pick<ContestPrizes, "notes"> & {
  monthlyTitle: string;
  tierTitles: Record<ContestPrizes["tiers"][number]["kind"], string>;
} = {
  monthlyTitle: "Подарочный ваучер Korzinka",
  tierTitles: {
    tablet: "Планшет",
    phone: "Смартфон iPhone 18 Pro",
    travel: "Туристическая путёвка в Таиланд на 2 человек",
    car: "Автомобиль BYD Chazor",
  },
  notes: [
    "Победители определяются не по рейтингу или месту — в каждом диапазоне путём случайного выбора (random)",
    "Для ежемесячного ваучера суммируются подтверждённые просмотры только тех видео, которые зарегистрированы в этом месячном этапе",
    "Для главного приза суммируются просмотры всех ваших подтверждённых видео, зарегистрированных за время Акции",
    "При выполнении требований можно выигрывать ваучеры в течение нескольких месяцев",
    "Помимо ваучеров можно выиграть только один главный приз; участники с 100 000 и менее просмотров в розыгрыше главных призов не участвуют",
    "Призы не подлежат замене денежным эквивалентом и передаче другому лицу",
  ],
};

/** Mini App uchun tanlangan tildagi sovrinlar (sonlar va sanalar bir xil). */
export function localizePrizes(prizes: ContestPrizes, lang: "uz" | "ru"): ContestPrizes {
  if (lang === "uz") return prizes;
  return {
    ...prizes,
    monthly: { ...prizes.monthly, title: contestPrizesRu.monthlyTitle },
    tiers: prizes.tiers.map((tier) => ({ ...tier, title: contestPrizesRu.tierTitles[tier.kind] })),
    notes: contestPrizesRu.notes,
  };
}

export const contestPrizes: ContestPrizes = {
  // Oferta 6.1.1: oyiga 200 ta, jami 600 ta (6.1.3 dagi "300 nafar" — tashkilotchi qarori bilan 200).
  monthly: {
    title: "Korzinka xarid voucheri",
    amount: 500_000,
    perMonth: 200,
    total: 600,
    minViews: 1_000,
    maxViews: 100_000,
  },
  // Oferta 6.1.2: oylik bosqichlar.
  stages: [
    { startsOn: "2026-11-27", endsOn: "2026-12-26" },
    { startsOn: "2026-12-27", endsOn: "2027-01-26" },
    { startsOn: "2027-01-27", endsOn: "2027-02-27" },
  ],
  // Oferta 6.2.1: umumiy tasdiqlangan ko'rishlar oraliqlari.
  tiers: [
    { kind: "tablet", title: "Planshet", quantity: 25, unit: null, minViews: 100_001, maxViews: 500_000 },
    { kind: "phone", title: "iPhone 18 Pro smartfoni", quantity: 15, unit: null, minViews: 500_001, maxViews: 1_500_000 },
    {
      kind: "travel",
      title: "Tailandga 2 kishilik sayohat yo'llanmasi",
      quantity: 3,
      unit: null,
      minViews: 1_500_001,
      maxViews: 4_000_000,
    },
    { kind: "car", title: "BYD Chazor avtomobili", quantity: 1, unit: null, minViews: 4_000_001, maxViews: null },
  ],
  notes: [
    "G'oliblar reyting yoki o'rin bo'yicha emas — har bir oraliq ichida tasodifiy tanlov (random) orqali aniqlanadi",
    "Oylik voucher uchun faqat shu oylik bosqichda ro'yxatdan o'tkazilgan videolarning tasdiqlangan ko'rishlari qo'shib hisoblanadi",
    "Asosiy sovrin uchun aksiya davomida ro'yxatdan o'tkazilgan barcha tasdiqlangan videolaringiz ko'rishlari qo'shib hisoblanadi",
    "Talablarni bajarsangiz, bir necha oy davomida voucher yutishingiz mumkin",
    "Voucherlardan tashqari faqat bitta asosiy sovrin yutish mumkin; 100 000 va undan kam ko'rishlar asosiy sovrin tanloviga kirmaydi",
    "Sovrinlar pul ekvivalentiga almashtirilmaydi va boshqa shaxsga berilmaydi",
  ],
};
