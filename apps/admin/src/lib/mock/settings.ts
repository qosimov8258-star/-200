/**
 * MOCK backend: tanlov sozlamalari (TZ 6-bo'lim, `contest_settings` jadvali). Haqiqiy backendda:
 *   GET /api/v1/admin/settings
 *   PUT /api/v1/admin/settings
 */
import { ApiError } from "../api-error";
import { addDays, isIsoDate } from "../dates";
import type {
  AdminUser,
  ContestSettings,
  ContestSettingsResponse,
  ContestSettingsUpdate,
  IsoDate,
} from "../types";
import { getContestData } from "./contest";
import { auditId, readStore, writeStore, type MockStore } from "./store";

/** TZ 4-bo'limidagi to'rtta asosiy qoida. */
export const DEFAULT_RULES_UZ = [
  "1. Target mumkin emas. Reelni pullik reklama qilish (target, boost) taqiqlanadi.",
  "2. Ism va familiyani o'zgartirish mumkin emas.",
  "3. Har qanday muammo supportga yoziladi.",
  "4. Sotib olingan mahsulot videosini joylash shart.",
].join("\n");

const DEFAULT_SYNC_TIME = "00:00";
const DEFAULT_MIN_AGE = 18;
const SYNC_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_AGE_RANGE = { min: 14, max: 100 } as const;
const MIN_RULES_LENGTH = 20;
const MAX_RULES_LENGTH = 5000;

/** Boshlang'ich qiymatlar + admin o'zgartirganlari. */
export function effectiveSettings(store: MockStore = readStore()): ContestSettings {
  const data = getContestData();
  const override = store.settings;
  return {
    startsOn: override?.startsOn ?? data.startsOn,
    endsOn: override?.endsOn ?? data.endsOn,
    syncTime: override?.syncTime ?? DEFAULT_SYNC_TIME,
    minAge: override?.minAge ?? DEFAULT_MIN_AGE,
    rulesUz: override?.rulesUz ?? DEFAULT_RULES_UZ,
    rulesRu: override?.rulesRu ?? "",
    rulesVersion: override?.rulesVersion ?? 1,
    updatedAt: override?.updatedAt ?? null,
    updatedBy: override?.updatedBy ?? null,
  };
}

/** Oxirgi yig'ish vaqti: bugungi yig'ish vaqti hali kelmagan bo'lsa — kechagi. */
export function lastSyncAt(today: IsoDate, syncTime: string, now: Date = new Date()): string {
  const todaySync = new Date(`${today}T${syncTime}:00+05:00`);
  const sync = todaySync.getTime() <= now.getTime() ? todaySync : new Date(`${addDays(today, -1)}T${syncTime}:00+05:00`);
  return sync.toISOString();
}

export function getContestSettings(): ContestSettingsResponse {
  const data = getContestData();
  const settings = effectiveSettings();
  return { settings, contestStarted: settings.startsOn <= data.today, today: data.today };
}

function validate(update: ContestSettingsUpdate, current: ContestSettings, today: IsoDate): ContestSettingsUpdate {
  if (!isIsoDate(update.startsOn) || !isIsoDate(update.endsOn)) {
    throw new ApiError(400, "Sana noto'g'ri formatda.");
  }
  if (update.startsOn !== current.startsOn && current.startsOn <= today) {
    throw new ApiError(400, "Tanlov boshlangan — boshlanish sanasini o'zgartirib bo'lmaydi.");
  }
  if (update.endsOn <= update.startsOn) {
    throw new ApiError(400, "Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak.");
  }
  if (update.endsOn !== current.endsOn && update.endsOn < today) {
    throw new ApiError(400, "Tugash sanasini o'tgan kunga qo'yib bo'lmaydi.");
  }
  if (!SYNC_TIME_PATTERN.test(update.syncTime)) {
    throw new ApiError(400, "Yangilanish vaqti SS:DD ko'rinishida bo'lishi kerak.");
  }
  if (
    !Number.isInteger(update.minAge) ||
    update.minAge < MIN_AGE_RANGE.min ||
    update.minAge > MIN_AGE_RANGE.max
  ) {
    throw new ApiError(400, `Minimal yosh ${MIN_AGE_RANGE.min}–${MIN_AGE_RANGE.max} oralig'ida bo'lishi kerak.`);
  }
  const rulesUz = update.rulesUz.trim();
  if (rulesUz.length < MIN_RULES_LENGTH) {
    throw new ApiError(400, `Qoidalar matni kamida ${MIN_RULES_LENGTH} ta belgi bo'lishi kerak.`);
  }
  if (rulesUz.length > MAX_RULES_LENGTH || update.rulesRu.length > MAX_RULES_LENGTH) {
    throw new ApiError(400, `Qoidalar matni ${MAX_RULES_LENGTH} belgidan oshmasligi kerak.`);
  }
  return { ...update, rulesUz, rulesRu: update.rulesRu.trim() };
}

const FIELD_LABELS: Record<keyof ContestSettingsUpdate, string> = {
  startsOn: "boshlanish",
  endsOn: "tugash",
  syncTime: "yangilanish vaqti",
  minAge: "minimal yosh",
  rulesUz: "qoidalar (uz)",
  rulesRu: "qoidalar (ru)",
};

export function updateContestSettings(update: ContestSettingsUpdate, actor: AdminUser): ContestSettingsResponse {
  const store = readStore();
  const current = effectiveSettings(store);
  const clean = validate(update, current, getContestData().today);

  const changed = (Object.keys(FIELD_LABELS) as Array<keyof ContestSettingsUpdate>).filter(
    (key) => clean[key] !== current[key],
  );
  if (changed.length === 0) {
    return getContestSettings();
  }

  const rulesChanged = changed.includes("rulesUz") || changed.includes("rulesRu");
  const nextVersion = rulesChanged ? current.rulesVersion + 1 : current.rulesVersion;
  const at = new Date().toISOString();
  /** Audit uchun faqat o'zgargan maydonlar; qoidalar matni o'rniga versiya. */
  const describe = (settings: ContestSettingsUpdate, version: number) =>
    [
      ...changed
        .filter((key) => key !== "rulesUz" && key !== "rulesRu")
        .map((key) => `${FIELD_LABELS[key]}: ${settings[key]}`),
      ...(rulesChanged ? [`qoidalar v${version}`] : []),
    ].join("; ");

  const nextStore: MockStore = {
    ...store,
    settings: { ...clean, rulesVersion: nextVersion, updatedAt: at, updatedBy: actor.fullName },
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "settings.update",
        entity: "settings",
        entityId: "contest",
        before: describe(current, current.rulesVersion),
        after: describe(clean, nextVersion),
        reason: "",
      },
    ],
  };
  writeStore(nextStore);
  return getContestSettings();
}
