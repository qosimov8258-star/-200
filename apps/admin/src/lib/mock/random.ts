/**
 * Deterministik tasodifiy sonlar generatori (mulberry32). Bir xil `seed`
 * har safar bir xil mock ma'lumot beradi — sahifa yangilanganda raqamlar sakramaydi.
 */
export function createRandom(seed: number) {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,

    /** [min, max] oralig'idagi butun son (ikkalasi ham kiradi). */
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },

    /** `probability` ehtimol bilan true. */
    chance(probability: number): boolean {
      return next() < probability;
    },

    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },

    /** Log-normal taqsimot — ko'rishlar kabi "uzun dumli" qiymatlar uchun. */
    logNormal(mu: number, sigma: number): number {
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return Math.exp(mu + sigma * normal);
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

/** Deterministik xesh (FNV-1a) — har bir yozuv uchun barqaror `seed`. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
