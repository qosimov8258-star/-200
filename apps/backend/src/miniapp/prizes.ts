/**
 * Sovrinlar. Javob shakli `apps/miniapp/src/lib/types.ts` → ContestPrizes bilan bir xil.
 *
 * VAQTINCHA kodda (tanlov qoidalari kabi keyin admin paneldan tahrirlanadi).
 * Sanalar — Asia/Tashkent bo'yicha tanlov kunlari, ikkala chegara ham kiradi.
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
  monthly: {
    title: "Korzinka voucheri",
    amount: 500_000,
    perMonth: 300,
    total: 900,
    minViews: 1_000,
    maxViews: 100_000,
  },
  stages: [
    { startsOn: "2026-11-25", endsOn: "2026-12-24" },
    { startsOn: "2026-12-25", endsOn: "2027-01-24" },
    { startsOn: "2027-01-25", endsOn: "2027-02-25" },
  ],
  tiers: [
    { kind: "tablet", title: "Planshet", quantity: 25, unit: null, minViews: 101_000, maxViews: 500_000 },
    { kind: "phone", title: "iPhone 18 Pro", quantity: 15, unit: null, minViews: 500_001, maxViews: 1_500_000 },
    {
      kind: "travel",
      title: "Tailandga 2 kishilik sayohat",
      quantity: 3,
      unit: "yo'llanma",
      minViews: 1_500_001,
      maxViews: 3_500_000,
    },
    { kind: "car", title: "BYD Chazor avtomobili", quantity: 1, unit: null, minViews: 4_000_000, maxViews: null },
  ],
  notes: [
    "Talablarni bajarsangiz, har oy voucher yutishingiz mumkin",
    "Voucherlardan tashqari bitta asosiy sovrinni ham yutishingiz mumkin",
    "Bitta ishtirokchiga faqat bitta asosiy sovrin beriladi",
    "Oylik sovrin uchun faqat shu oyda yuklangan Reellar hisoblanadi",
    "Asosiy sovrin uchun aksiya davomidagi barcha tasdiqlangan Reellaringiz ko'rishlari qo'shiladi",
    "Sovrinlar pulga almashtirilmaydi va boshqa odamga berilmaydi",
  ],
};
