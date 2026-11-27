/**
 * MOCK backend: tanlov qoidalari. Haqiqiy backendda:
 *   GET /api/v1/admin/rules
 *   PUT /api/v1/admin/rules
 * (`apps/backend/src/admin/admin-rules.controller.ts`)
 */
import { ApiError } from "../api-error";
import { RULES_LIMITS, type AdminUser, type ContestRules, type ContestRulesUpdate, type RulesSection } from "../types";
import { OFFER_UZ } from "./offer-text";
import { auditId, readStore, writeStore } from "./store";

/** Boshlang'ich qoidalar — ommaviy oferta matni (backend va Mini App'dagi bilan bir xil). */
export const DEFAULT_RULES_SECTIONS: RulesSection[] = OFFER_UZ;

export function getContestRules(): ContestRules {
  return (
    readStore().rules ?? {
      version: 1,
      sections: DEFAULT_RULES_SECTIONS,
      updatedAt: null,
      updatedBy: null,
    }
  );
}

function validate(sections: RulesSection[]): RulesSection[] {
  const L = RULES_LIMITS;
  if (sections.length < L.minSections) {
    throw new ApiError(400, "Kamida bitta bo'lim bo'lishi kerak.");
  }
  if (sections.length > L.maxSections) {
    throw new ApiError(400, `Ko'pi bilan ${L.maxSections} ta bo'lim.`);
  }
  return sections.map((s, i) => {
    const title = s.title.trim();
    const body = s.body.trim();
    if (title.length < L.titleMin || title.length > L.titleMax) {
      throw new ApiError(400, `${i + 1}-bo'lim: sarlavha ${L.titleMin}–${L.titleMax} belgi bo'lishi kerak.`);
    }
    if (body.length < L.bodyMin || body.length > L.bodyMax) {
      throw new ApiError(400, `${i + 1}-bo'lim: matn ${L.bodyMin}–${L.bodyMax} belgi bo'lishi kerak.`);
    }
    return { title, body };
  });
}

export function updateContestRules(update: ContestRulesUpdate, actor: AdminUser): ContestRules {
  const store = readStore();
  const current = getContestRules();
  const sections = validate(update.sections);
  const changed = JSON.stringify(sections) !== JSON.stringify(current.sections);
  if (!changed && !update.requireReconsent) return current;

  const at = new Date().toISOString();
  const next: ContestRules = {
    version: update.requireReconsent ? current.version + 1 : current.version,
    sections,
    updatedAt: at,
    updatedBy: actor.fullName,
  };
  const describe = (r: ContestRules) => `v${r.version}, ${r.sections.length} ta bo'lim`;
  // Qaysi bo'limlar o'zgargani (tartib raqami bo'yicha) — audit yozuvini o'qishli qilish uchun.
  const edited = sections
    .map((s, i) => {
      const old = current.sections[i];
      return !old || old.title !== s.title || old.body !== s.body ? i + 1 : null;
    })
    .filter((n): n is number => n !== null);
  const removed = Math.max(0, current.sections.length - sections.length);
  const summary = [
    edited.length > 0 ? `o'zgargan/qo'shilgan bo'limlar: ${edited.join(", ")}` : null,
    removed > 0 ? `o'chirilgan: ${removed} ta` : null,
  ]
    .filter(Boolean)
    .join("; ");
  writeStore({
    ...store,
    rules: next,
    audit: [
      ...store.audit,
      {
        id: auditId(),
        at,
        actorId: actor.id,
        actorName: actor.fullName,
        action: "rules.update",
        entity: "settings",
        entityId: "rules",
        before: describe(current),
        after: summary ? `${describe(next)} (${summary})` : describe(next),
        reason: update.requireReconsent ? "Muhim o'zgarish — qayta rozilik so'raldi" : "",
      },
    ],
  });
  return next;
}
