/**
 * MOCK backend: aksiya sovg'alari (Aksiya qoidalari, 6-bo'lim; `prizes` jadvali).
 * Sovg'alar ilovada va Telegram botda shu tartibda ko'rsatiladi. Haqiqiy backendda:
 *   GET    /api/v1/admin/prizes
 *   POST   /api/v1/admin/prizes
 *   PUT    /api/v1/admin/prizes/:id
 *   DELETE /api/v1/admin/prizes/:id
 *   POST   /api/v1/admin/prizes/:id/move
 *   POST   /api/v1/admin/uploads/prize-image   (rasm — obyekt xotirasiga, MinIO/S3)
 *
 * Mock'da rasmlar `data:` URL ko'rinishida `localStorage` da saqlanadi.
 */
import { ApiError } from "../api-error";
import { PRIZE_KIND_LABELS } from "../labels";
import {
  formatPrizeQuantity,
  formatViewsRange,
  PRIZE_IMAGE_TYPES,
  validatePrizeInput,
} from "../prize-rules";
import type {
  AdminUser,
  Prize,
  PrizeImageUpload,
  PrizeInput,
  PrizeMoveDirection,
} from "../types";
import { auditId, readStore, storeFits, writeStore, type MockStore } from "./store";

/** Yuklanadigan (kichraytirilgan) rasm hajmi chegarasi. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

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
    minViews: 4_000_000,
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
    maxViews: 3_500_000,
  },
  {
    id: "prz_iphone",
    title: "iPhone 18 Pro",
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
    minViews: 101_000,
    maxViews: 500_000,
  },
  {
    id: "prz_voucher",
    title: "Korzinka xarid voucheri — 500 000 so'm",
    description:
      "Har oylik bosqich yakunida tasodifiy tanlov (random) orqali beriladi. Aksiya davomida jami 900 ta.",
    imageUrl: null,
    quantity: 300,
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

export function listPrizes(): Prize[] {
  return effectivePrizes();
}

/** Server tomonidagi tekshiruv: faqat ma'lum maydonlar olinadi, matnlar tozalanadi. */
function cleanInput(input: PrizeInput): PrizeInput {
  const clean: PrizeInput = {
    title: String(input.title ?? "").trim(),
    description: String(input.description ?? "").trim(),
    imageUrl: input.imageUrl ?? null,
    quantity: Number(input.quantity),
    kind: input.kind,
    minViews: input.minViews ?? null,
    maxViews: input.maxViews ?? null,
  };
  const errors = Object.values(validatePrizeInput(clean));
  if (errors.length > 0) {
    throw new ApiError(400, errors[0] ?? "Ma'lumot noto'g'ri.");
  }
  return clean;
}

/** Audit uchun qisqa tavsif (rasmning o'zi emas — faqat bor-yo'qligi). */
function describe(prize: PrizeInput): string {
  return [
    prize.title,
    PRIZE_KIND_LABELS[prize.kind],
    formatPrizeQuantity(prize),
    formatViewsRange(prize.minViews, prize.maxViews) ?? "ko'rish sharti yo'q",
    prize.imageUrl ? "rasm bor" : "rasm yo'q",
  ].join("; ");
}

function save(store: MockStore): void {
  if (!storeFits(store)) {
    throw new ApiError(
      413,
      "Brauzer xotirasi to'ldi (mock rejim). Rasmni kichikroq qiling yoki boshqa sovg'a rasmini o'chiring.",
    );
  }
  writeStore(store);
}

function auditEntry(
  actor: AdminUser,
  action: string,
  entityId: string,
  before: string,
  after: string,
): MockStore["audit"][number] {
  return {
    id: auditId(),
    at: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.fullName,
    action,
    entity: "prize",
    entityId,
    before,
    after,
    reason: "",
  };
}

function findPrize(prizes: Prize[], id: string): Prize {
  const prize = prizes.find((item) => item.id === id);
  if (!prize) {
    throw new ApiError(404, "Sovg'a topilmadi. Sahifani yangilang.");
  }
  return prize;
}

export function createPrize(input: PrizeInput, actor: AdminUser): Prize {
  const clean = cleanInput(input);
  const store = readStore();
  const prizes = effectivePrizes(store);
  const prize: Prize = {
    ...clean,
    id: `prz_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    sortOrder: Math.max(0, ...prizes.map((item) => item.sortOrder)) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.fullName,
  };

  save({
    ...store,
    prizes: [...prizes, prize],
    audit: [...store.audit, auditEntry(actor, "prize.create", prize.id, "", describe(prize))],
  });
  return prize;
}

export function updatePrize(id: string, input: PrizeInput, actor: AdminUser): Prize {
  const clean = cleanInput(input);
  const store = readStore();
  const prizes = effectivePrizes(store);
  const current = findPrize(prizes, id);

  const unchanged = (Object.keys(clean) as Array<keyof PrizeInput>).every(
    (key) => clean[key] === current[key],
  );
  if (unchanged) return current;

  const updated: Prize = {
    ...current,
    ...clean,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.fullName,
  };

  save({
    ...store,
    prizes: prizes.map((item) => (item.id === id ? updated : item)),
    audit: [
      ...store.audit,
      auditEntry(actor, "prize.update", id, describe(current), describe(updated)),
    ],
  });
  return updated;
}

export function deletePrize(id: string, actor: AdminUser): void {
  const store = readStore();
  const prizes = effectivePrizes(store);
  const current = findPrize(prizes, id);

  save({
    ...store,
    prizes: prizes.filter((item) => item.id !== id),
    audit: [...store.audit, auditEntry(actor, "prize.delete", id, describe(current), "")],
  });
}

/** Sovg'ani o'z turi (asosiy/oylik) ichida bir pog'ona yuqoriga yoki pastga surish. */
export function movePrize(id: string, direction: PrizeMoveDirection, actor: AdminUser): Prize[] {
  const store = readStore();
  const prizes = effectivePrizes(store);
  const current = findPrize(prizes, id);
  const sameKind = prizes.filter((item) => item.kind === current.kind);
  const index = sameKind.findIndex((item) => item.id === id);
  const neighbor = sameKind[direction === "up" ? index - 1 : index + 1];

  if (!neighbor) {
    throw new ApiError(
      409,
      direction === "up" ? "Sovg'a allaqachon eng yuqorida." : "Sovg'a allaqachon eng pastda.",
    );
  }

  const next = prizes.map((item) => {
    if (item.id === current.id) return { ...item, sortOrder: neighbor.sortOrder };
    if (item.id === neighbor.id) return { ...item, sortOrder: current.sortOrder };
    return item;
  });
  const position = (value: number) => `${value + 1}-o'rin`;

  save({
    ...store,
    prizes: next,
    audit: [
      ...store.audit,
      auditEntry(
        actor,
        "prize.move",
        id,
        position(index),
        position(direction === "up" ? index - 1 : index + 1),
      ),
    ],
  });
  return effectivePrizes({ ...store, prizes: next });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError(400, "Rasmni o'qib bo'lmadi."));
    reader.readAsDataURL(file);
  });
}

export async function uploadPrizeImage(file: Blob): Promise<PrizeImageUpload> {
  if (!(PRIZE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError(400, "Faqat JPG, PNG yoki WebP rasm yuklash mumkin.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(413, "Rasm hajmi juda katta.");
  }
  return { url: await readAsDataUrl(file) };
}
