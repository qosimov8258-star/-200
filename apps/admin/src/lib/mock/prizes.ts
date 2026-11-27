/**
 * MOCK: aksiya sovg'alari (Aksiya qoidalari, 6-bo'lim). Admin panelda alohida "Sovg'alar" bo'limi
 * yo'q — ro'yxatdan faqat Random tanlov (oylik sovg'a) foydalanadi. Haqiqiy backendda sovg'alar
 * `apps/backend/src/miniapp/prizes.ts` da.
 */
import type { Prize } from "../types";
import { readStore, type MockStore } from "./store";

type SeedPrize = Omit<Prize, "sortOrder" | "updatedAt" | "updatedBy">;

/** Boshlang'ich ro'yxat — Aksiya qoidalari, 6.1 va 6.2-bandlar. Rasmlarni admin yuklaydi. */
const SEED_PRIZES: SeedPrize[] = [
  {
    id: "prz_car",
    title: "BYD Chazor avtomobili",
    description: "",
    imageUrl: null,
    quantity: 1,
    kind: "MAIN",
    minViews: 4_000_001,
    maxViews: null,
  },
  {
    id: "prz_trip",
    title: "Tailandga 2 kishilik sayohat yo'llanmasi",
    description: "",
    imageUrl: null,
    quantity: 3,
    kind: "MAIN",
    minViews: 1_500_001,
    maxViews: 4_000_000,
  },
  {
    id: "prz_iphone",
    title: "iPhone 18 Pro smartfoni",
    description: "",
    imageUrl: null,
    quantity: 15,
    kind: "MAIN",
    minViews: 500_001,
    maxViews: 1_500_000,
  },
  {
    id: "prz_tablet",
    title: "Planshet",
    description: "",
    imageUrl: null,
    quantity: 25,
    kind: "MAIN",
    minViews: 100_001,
    maxViews: 500_000,
  },
  {
    id: "prz_voucher",
    title: "Korzinka xarid voucheri — 500 000 so'm",
    description:
      "Har oylik bosqich yakunida tasodifiy tanlov (random) orqali beriladi. Aksiya davomida jami 600 ta (oferta 6.1).",
    imageUrl: null,
    quantity: 200,
    kind: "MONTHLY",
    minViews: 1_000,
    maxViews: 100_000,
  },
];

function seedPrizes(): Prize[] {
  return SEED_PRIZES.map((prize, index) => ({
    ...prize,
    sortOrder: index + 1,
    updatedAt: null,
    updatedBy: null,
  }));
}

/** Admin o'zgartirgan ro'yxat yoki boshlang'ichi, tartib bo'yicha. */
export function effectivePrizes(store: MockStore = readStore()): Prize[] {
  return [...(store.prizes ?? seedPrizes())].sort((a, b) => a.sortOrder - b.sortOrder);
}
