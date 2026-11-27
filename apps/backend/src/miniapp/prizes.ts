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
