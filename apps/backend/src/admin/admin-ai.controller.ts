import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";

import {
  AiReviewService,
  CRITERIA_MAX,
  MAX_TRIAL,
  NOTE_MAX,
  VERDICT_LABEL,
  type AiCandidate,
  type AiReviewItem,
  type AiState,
} from "../ai-review/ai-review.service";
import { AI_REF_KINDS, AI_REVIEW_STATES, AI_VERDICTS, type AiRefKind } from "../ai-review/ai-types";
import { AuditService } from "../audit/audit.service";
import { MAX_SCREENSHOT_CHARS } from "../targets/screenshot";
import { adminError, objectBody, oneOf, paginate, requiredText, searchTerm, type Page } from "./admin-http";
import type { AdminUser } from "./auth/admin-accounts";
import { AdminAuthGuard, CurrentAdmin } from "./auth/admin-auth.guard";
import { actorOf } from "./auth/admin-auth.service";

const DEFAULT_PAGE_SIZE = 20;
const DECISION_NOTE_MIN = 3;
const DECISION_NOTE_MAX = 500;

/** Query qiymati — faqat bitta matn (`?a=1&a=2` yoki `?a[b]=1` rad etiladi). */
function queryText(value: unknown): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  throw adminError(400, "So'rov parametrlari noto'g'ri.");
}

function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw adminError(400, `${field} noto'g'ri.`);
  if (value.trim().length > max) throw adminError(422, `${field} ${max} belgidan oshmasin.`);
  return value;
}

function refKind(value: unknown): AiRefKind {
  const kind = AI_REF_KINDS.find((k) => k === value);
  if (!kind) throw adminError(400, "Rasm turi noto'g'ri.");
  return kind;
}

const KIND_LABEL: Record<AiRefKind, string> = {
  MUST: "Ko'rinishi shart",
  MUST_NOT: "Bo'lmasligi kerak",
  INFO: "Ma'lumot uchun",
};

/**
 * Admin panel → AI: videolarni AI bilan tekshirish mezonlari, sinov/to'liq ishga tushirish,
 * natijalar va qo'lda qaror. Faqat ADMIN. Har bir o'zgarish audit logga yoziladi.
 */
@Controller("admin/ai")
@UseGuards(AdminAuthGuard)
export class AdminAiController {
  constructor(
    private readonly ai: AiReviewService,
    private readonly audit: AuditService,
  ) {}

  @Get("state")
  state(): AiState {
    return this.ai.state();
  }

  /** `POST /admin/ai/draft` — "Yangi versiya" (faol versiyadan nusxa). */
  @Post("draft")
  @HttpCode(200)
  createDraft(@CurrentAdmin() admin: AdminUser): AiState {
    if (this.ai.createDraft()) {
      const draft = this.ai.state().draft;
      this.audit.record({
        actor: actorOf(admin),
        action: "ai.draft.update",
        entity: "settings",
        entityId: `ai-v${draft?.version ?? 0}`,
        entityLabel: `AI mezonlari, ${draft?.version ?? 0}-versiya`,
        before: "",
        after: "Yangi qoralama",
        reason: "",
      });
    }
    return this.ai.state();
  }

  /** `PUT /admin/ai/draft` body `{ criteria }`. */
  @Put("draft")
  updateDraft(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): AiState {
    const criteria = optionalText(objectBody(body, ["criteria"]).criteria, "Mezon matni", CRITERIA_MAX);
    if (criteria === undefined) throw adminError(400, "Mezon matni yozilmagan.");
    const { before, after } = this.ai.updateCriteria(criteria);
    if (before !== after) {
      const version = this.ai.state().draft?.version ?? 0;
      this.audit.record({
        actor: actorOf(admin),
        action: "ai.draft.update",
        entity: "settings",
        entityId: `ai-v${version}`,
        entityLabel: `AI mezonlari, ${version}-versiya`,
        before: before.slice(0, 500),
        after: after.slice(0, 500),
        reason: "",
      });
    }
    return this.ai.state();
  }

  /** `POST /admin/ai/draft/references` body `{ dataUrl, kind, note }`. */
  @Post("draft/references")
  @HttpCode(200)
  addReference(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): AiState {
    const b = objectBody(body, ["dataUrl", "kind", "note"]);
    if (typeof b.dataUrl !== "string" || b.dataUrl.length > MAX_SCREENSHOT_CHARS) {
      throw adminError(422, "Rasm yaroqsiz: JPEG, PNG yoki WebP, 2 MB gacha bo'lsin.", "BAD_IMAGE");
    }
    const kind = refKind(b.kind);
    const note = optionalText(b.note, "Izoh", NOTE_MAX) ?? "";
    const ref = this.ai.addReference(b.dataUrl, kind, note);
    const version = this.ai.state().draft?.version ?? 0;
    this.audit.record({
      actor: actorOf(admin),
      action: "ai.reference.add",
      entity: "settings",
      entityId: `ai-v${version}`,
      entityLabel: `AI mezonlari, ${version}-versiya`,
      before: "",
      after: `${KIND_LABEL[ref.kind]}: ${ref.note || "izohsiz"}`,
      reason: "",
    });
    return this.ai.state();
  }

  /** `PATCH /admin/ai/draft/references/:id` body `{ kind?, note? }`. */
  @Patch("draft/references/:id")
  updateReference(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): AiState {
    const b = objectBody(body, ["kind", "note"]);
    const patch = {
      kind: b.kind === undefined ? undefined : refKind(b.kind),
      note: optionalText(b.note, "Izoh", NOTE_MAX),
    };
    const before = this.ai.state().draft?.references.find((r) => r.id === id);
    const ref = this.ai.updateReference(id, patch);
    if (before && (before.kind !== ref.kind || before.note !== ref.note)) {
      const version = this.ai.state().draft?.version ?? 0;
      this.audit.record({
        actor: actorOf(admin),
        action: "ai.draft.update",
        entity: "settings",
        entityId: `ai-v${version}`,
        entityLabel: `AI mezonlari, ${version}-versiya`,
        before: `${KIND_LABEL[before.kind]}: ${before.note || "izohsiz"}`,
        after: `${KIND_LABEL[ref.kind]}: ${ref.note || "izohsiz"}`,
        reason: "",
      });
    }
    return this.ai.state();
  }

  @Delete("draft/references/:id")
  removeReference(@Param("id") id: string, @CurrentAdmin() admin: AdminUser): AiState {
    const ref = this.ai.removeReference(id);
    const version = this.ai.state().draft?.version ?? 0;
    this.audit.record({
      actor: actorOf(admin),
      action: "ai.reference.remove",
      entity: "settings",
      entityId: `ai-v${version}`,
      entityLabel: `AI mezonlari, ${version}-versiya`,
      before: `${KIND_LABEL[ref.kind]}: ${ref.note || "izohsiz"}`,
      after: "",
      reason: "",
    });
    return this.ai.state();
  }

  /** Namuna rasm (`<img src>` uchun; sessiya cookie'si bilan). */
  @Get("references/:id/image")
  referenceImage(@Param("id") id: string, @Res() res: Response): void {
    const image = this.ai.referenceImage(id);
    if (!image) throw adminError(404, "Rasm topilmadi.", "NOT_FOUND");
    res.setHeader("Content-Type", image.mime);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(image.data);
  }

  /** `GET /admin/ai/candidates?search=` — sinov uchun videolar. */
  @Get("candidates")
  candidates(@Query("search") search?: unknown): AiCandidate[] {
    return this.ai.candidates(searchTerm(queryText(search)));
  }

  /** `POST /admin/ai/approve` body `{ mode, trialShortcodes? }`. */
  @Post("approve")
  @HttpCode(200)
  approve(@Body() body: unknown, @CurrentAdmin() admin: AdminUser): AiState {
    const b = objectBody(body, ["mode", "trialShortcodes"]);
    if (b.mode !== "TRIAL" && b.mode !== "FULL") throw adminError(400, "Rejim noto'g'ri.");
    let trial: string[] | undefined;
    if (b.trialShortcodes !== undefined) {
      if (!Array.isArray(b.trialShortcodes) || b.trialShortcodes.length > MAX_TRIAL) {
        throw adminError(422, `Sinov uchun ko'pi bilan ${MAX_TRIAL} ta video tanlang.`);
      }
      trial = b.trialShortcodes.map((code) => {
        if (typeof code !== "string" || !/^[A-Za-z0-9_-]{5,40}$/.test(code)) throw adminError(400, "Video kodi noto'g'ri.");
        return code;
      });
    }
    const { version, queued } = this.ai.approve(b.mode, trial, admin.fullName);
    this.audit.record({
      actor: actorOf(admin),
      action: "ai.approve",
      entity: "settings",
      entityId: `ai-v${version}`,
      entityLabel: `AI mezonlari, ${version}-versiya`,
      before: "Qoralama",
      after: `Tasdiqlandi — ${b.mode === "TRIAL" ? "sinov" : "hammasi"}, ${queued} ta video navbatda`,
      reason: "",
    });
    return this.ai.state();
  }

  /** `POST /admin/ai/run-all` — sinovdan keyin hamma videolar. */
  @Post("run-all")
  @HttpCode(200)
  runAll(@CurrentAdmin() admin: AdminUser): AiState {
    const { version, queued, changed } = this.ai.runAll(admin.fullName);
    if (changed || queued > 0) {
      this.audit.record({
        actor: actorOf(admin),
        action: "ai.run_all",
        entity: "settings",
        entityId: `ai-v${version}`,
        entityLabel: `AI mezonlari, ${version}-versiya`,
        before: changed ? "Sinov" : "Hammasi",
        after: `Hammasi — ${queued} ta video navbatga qo'shildi`,
        reason: "",
      });
    }
    return this.ai.state();
  }

  /** `GET /admin/ai/reviews?verdict=&state=&search=&page=&pageSize=`. */
  @Get("reviews")
  reviews(
    @Query("verdict") verdict?: unknown,
    @Query("state") state?: unknown,
    @Query("search") search?: unknown,
    @Query("page") page?: unknown,
    @Query("pageSize") pageSize?: unknown,
  ): Page<AiReviewItem> {
    const rows = this.ai.list({
      verdict: oneOf(queryText(verdict), AI_VERDICTS, "Natija"),
      state: oneOf(queryText(state), AI_REVIEW_STATES, "Holat"),
      search: searchTerm(queryText(search)),
    });
    return paginate(rows, queryText(page), queryText(pageSize), DEFAULT_PAGE_SIZE);
  }

  /** Dalil kadri (JPEG). */
  @Get("reviews/:id/frames/:second")
  frame(@Param("id") id: string, @Param("second") second: string, @Res() res: Response): void {
    const n = /^\d{1,6}$/.test(second) ? Number(second) : NaN;
    const data = Number.isNaN(n) ? null : this.ai.frame(id, n);
    if (!data) throw adminError(404, "Kadr topilmadi.", "NOT_FOUND");
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(data);
  }

  /** `POST /admin/ai/reviews/:id/decision` body `{ decision, note }`. */
  @Post("reviews/:id/decision")
  @HttpCode(200)
  decide(@Param("id") id: string, @Body() body: unknown, @CurrentAdmin() admin: AdminUser): AiReviewItem {
    const b = objectBody(body, ["decision", "note"]);
    if (b.decision !== "APPROVED" && b.decision !== "REJECTED") throw adminError(400, "Qaror noto'g'ri.");
    const note = requiredText(b.note, "Izoh", DECISION_NOTE_MIN, DECISION_NOTE_MAX);
    const { before, item, fullName, shortcode } = this.ai.decide(id, b.decision, note, admin.fullName);
    this.audit.record({
      actor: actorOf(admin),
      action: "ai.decision",
      entity: "reel",
      entityId: shortcode,
      entityLabel: fullName,
      before: before ? `AI: ${VERDICT_LABEL[before]}` : "AI: natija yo'q",
      after: `Qo'lda: ${VERDICT_LABEL[b.decision]}`,
      reason: note,
    });
    return item;
  }
}
