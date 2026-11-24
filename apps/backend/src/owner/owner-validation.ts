import { adminError, objectBody } from "../admin/admin-http";
import { normalizePhone, type OwnerParticipantPatch } from "../participants/participants.service";
import type { TargetCaseStatus } from "../targets/targets.service";
import {
  OWNER_PARTICIPANT_STATUSES,
  TARGET_CASE_STATUSES,
  type OwnerParticipantStatus,
  type RiskVerdict,
} from "./owner-types";

/**
 * Ega API kiruvchi ma'lumotlari tekshiruvi. Xato — `{ message }` (o'zbekcha): 400 — so'rov
 * shakli noto'g'ri (obyekt emas, noma'lum yoki majburiy maydon yo'q, bo'sh body), 422 — qiymat
 * noto'g'ri. CLAUDE.md: noma'lum maydonlar rad etiladi.
 */

/** Ism/familiya — ro'yxatdan o'tishdagi bilan bir xil (`miniapp/validation.ts`): 2–40 harf, ' - va bo'sh joy. */
const NAME = /^[\p{L}'ʻʼ‘’\- ]{2,40}$/u;
const AGE_MIN = 14;
const AGE_MAX = 100;
/** Kiritilishi mumkin bo'lgan belgilar: raqamlar, +, bo'sh joy, qavs, chiziqcha. */
const PHONE_INPUT = /^[+\d\s()-]{1,30}$/;
const PHONE = /^\+998\d{9}$/;
const NOTE_MAX = 300;
const TELEGRAM_ID = /^\d{1,16}$/;

const PARTICIPANT_FIELDS = ["firstName", "lastName", "age", "phone", "status"] as const;

const invalid = (message: string) => adminError(422, message);

/** Query qiymati — faqat bitta matn (`?a=1&a=2` yoki `?a[b]=1` rad etiladi). */
export function queryText(value: unknown): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  throw adminError(400, "So'rov parametrlari noto'g'ri.");
}

/** `:id` — Telegram ID; noto'g'ri bo'lsa — null (chaqiruvchi 404 qaytaradi). */
export function participantId(id: string): number | null {
  const n = TELEGRAM_ID.test(id) ? Number(id) : Number.NaN;
  return Number.isSafeInteger(n) ? n : null;
}

function name(value: unknown, field: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!NAME.test(text)) throw invalid(`${field} 2–40 ta harfdan iborat bo'lsin.`);
  return text;
}

/** `PATCH /owner/participants/:id` tanasi → o'zgarishlar (faqat berilgan maydonlar, kamida bittasi). */
export function parseParticipantUpdate(body: unknown): OwnerParticipantPatch {
  const b = objectBody(body, PARTICIPANT_FIELDS);
  if (Object.keys(b).length === 0) throw adminError(400, "O'zgartirish uchun kamida bitta maydon yuboring.");
  const patch: OwnerParticipantPatch = {};
  if ("firstName" in b) patch.firstName = name(b.firstName, "Ism");
  // Familiya ixtiyoriy: bo'sh satr — familiyasiz.
  if ("lastName" in b) patch.lastName = b.lastName === "" ? "" : name(b.lastName, "Familiya");
  if ("age" in b) {
    const age = b.age;
    if (typeof age !== "number" || !Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) {
      throw invalid(`Yosh ${AGE_MIN} dan ${AGE_MAX} gacha butun son bo'lsin.`);
    }
    patch.age = age;
  }
  if ("phone" in b) {
    const raw = typeof b.phone === "string" ? b.phone.trim() : "";
    const phone = PHONE_INPUT.test(raw) ? normalizePhone(raw) : "";
    if (!PHONE.test(phone)) throw invalid("Telefon raqami +998 XX XXX XX XX ko'rinishida bo'lsin.");
    patch.phone = phone;
  }
  if ("status" in b) {
    const status = OWNER_PARTICIPANT_STATUSES.find((s): s is OwnerParticipantStatus => s === b.status);
    if (!status) throw invalid("Holat noto'g'ri.");
    patch.status = status;
  }
  return patch;
}

/** `PATCH /owner/targets/:id` tanasi: `{ status, note? }`. */
export function parseTargetUpdate(body: unknown): { status: TargetCaseStatus; note: string | null } {
  const b = objectBody(body, ["status", "note"]);
  if (!("status" in b)) throw adminError(400, "Holat ko'rsatilmagan.");
  const status = TARGET_CASE_STATUSES.find((s) => s === b.status);
  if (!status) throw invalid("Holat noto'g'ri.");
  if (b.note !== undefined && b.note !== null && typeof b.note !== "string") throw invalid("Izoh matn bo'lsin.");
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length > NOTE_MAX) throw invalid(`Izoh ${NOTE_MAX} belgidan oshmasin.`);
  return { status, note: note || null };
}

/** `POST /owner/risk/:id/review` tanasi: `{ verdict: "SAFE" | "WATCH" | null }` (null — belgini olib tashlash). */
export function parseRiskReview(body: unknown): RiskVerdict | null {
  const b = objectBody(body, ["verdict"]);
  if (!("verdict" in b)) throw adminError(400, "Belgi ko'rsatilmagan.");
  if (b.verdict === null) return null;
  if (b.verdict === "SAFE" || b.verdict === "WATCH") return b.verdict;
  throw invalid("Belgi SAFE, WATCH yoki null bo'lishi kerak.");
}

/** `includeSafe` query: "true" / "false" (yoki berilmagan). */
export function parseIncludeSafe(value: string | undefined): boolean {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw adminError(400, "includeSafe true yoki false bo'lishi kerak.");
}
