import { addDays, isIsoDate } from "./dates";
import type { DashboardQuery, IsoDate } from "./types";

export type PeriodPreset = "today" | "7d" | "30d" | "all";

export type Period =
  | { kind: "preset"; preset: PeriodPreset }
  | { kind: "custom"; from: IsoDate; to: IsoDate };

export const PERIOD_PRESETS: ReadonlyArray<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Bugun" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
  { value: "all", label: "Butun tanlov" },
];

const DEFAULT_PRESET: PeriodPreset = "7d";

export const DEFAULT_PERIOD: Period = { kind: "preset", preset: DEFAULT_PRESET };

function isPreset(value: string | null): value is PeriodPreset {
  return PERIOD_PRESETS.some((preset) => preset.value === value);
}

/** URL dagi `?period=7d` yoki `?from=...&to=...` dan davrni o'qish. */
export function parsePeriod(params: Pick<URLSearchParams, "get">): Period {
  const from = params.get("from");
  const to = params.get("to");
  if (isIsoDate(from) && isIsoDate(to) && from <= to) {
    return { kind: "custom", from, to };
  }

  const preset = params.get("period");
  return isPreset(preset) ? { kind: "preset", preset } : DEFAULT_PERIOD;
}

/** Davrni URL query qatoriga aylantirish (standart davr uchun — bo'sh). */
export function periodToSearch(period: Period): string {
  if (period.kind === "custom") {
    return new URLSearchParams({ from: period.from, to: period.to }).toString();
  }
  if (period.preset === DEFAULT_PRESET) {
    return "";
  }
  return new URLSearchParams({ period: period.preset }).toString();
}

/** Davrni API so'roviga aylantirish. */
export function periodToQuery(period: Period, today: IsoDate): DashboardQuery {
  if (period.kind === "custom") {
    return { from: period.from, to: period.to };
  }
  switch (period.preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "all":
      return { to: today };
  }
}

/** Kartalardagi "davr ichida" yozuvi uchun. */
export function periodPhrase(period: Period): string {
  if (period.kind === "custom") {
    return "tanlangan davrda";
  }
  switch (period.preset) {
    case "today":
      return "bugun";
    case "7d":
      return "so'nggi 7 kunda";
    case "30d":
      return "so'nggi 30 kunda";
    case "all":
      return "tanlov boshidan";
  }
}
