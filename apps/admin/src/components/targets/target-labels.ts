import type { TargetState } from "@/lib/types";

/**
 * "Target yoqqanlar" bo'limidagi gap ichida ishlatiladigan qisqa holat so'zlari ("Reklama hozir: bor").
 * Signal usuli nomlari — `lib/labels.ts` dagi `TARGET_METHOD_LABELS`.
 */

/** Oxirgi tekshiruvdagi reklama holati: "Reklama hozir: bor". */
export const AD_STATE_TEXT: Record<TargetState, string> = {
  ON: "bor",
  OFF: "yo'q",
  UNKNOWN: "noma'lum",
};
