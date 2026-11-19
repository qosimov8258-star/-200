import { Body, Controller, Get, HttpCode, HttpException, Param, Post, UseGuards } from "@nestjs/common";

import type { DrawSettings } from "../draws/draw-rules";
import { DrawsService } from "../draws/draws.service";
import { AdminTokenGuard } from "./admin-token.guard";

/** Admin login qurilguncha harakat qiluvchi xodim nomi. */
const ACTOR = "Admin";

const SETTINGS_FIELDS: Record<keyof DrawSettings, "string" | "number" | "boolean" | "stage" | "basis"> = {
  prizeId: "string",
  stage: "stage",
  periodFrom: "string",
  periodTo: "string",
  dateBasis: "basis",
  minViews: "number",
  maxViews: "number",
  winnersCount: "number",
  reservesCount: "number",
  excludeWarned: "boolean",
  excludeTargets: "boolean",
  excludePreviousWinners: "boolean",
  messageTemplate: "string",
};

const bad = (message: string) => new HttpException({ message }, 400);

function objectOf(body: unknown, allowed: string[]): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw bad("So'rov tanasi noto'g'ri.");
  const extra = Object.keys(body).find((k) => !allowed.includes(k));
  if (extra) throw bad(`Noma'lum maydon: ${extra}`);
  return body as Record<string, unknown>;
}

/** Barcha maydonlar majburiy, turi tekshiriladi, noma'lum maydon rad etiladi (CLAUDE.md). */
function parseSettings(body: unknown): DrawSettings {
  const b = objectOf(body, Object.keys(SETTINGS_FIELDS));
  for (const [key, kind] of Object.entries(SETTINGS_FIELDS)) {
    const v = b[key];
    const ok =
      kind === "stage"
        ? v === null || (typeof v === "number" && Number.isInteger(v))
        : kind === "basis"
          ? v === "POSTED" || v === "SUBMITTED"
          : typeof v === kind;
    if (!ok) throw bad(`Maydon noto'g'ri: ${key}`);
  }
  return b as unknown as DrawSettings;
}

function parseReason(body: unknown, extra: string[] = []): Record<string, unknown> & { reason: string } {
  const b = objectOf(body, ["reason", ...extra]);
  if (typeof b.reason !== "string") throw bad("Sabab yozilmagan.");
  return b as Record<string, unknown> & { reason: string };
}

/**
 * Oylik voucherlar uchun random tanlov (admin panel → Random tanlov).
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getDrawSetup` … `sendDraw` bilan bir xil.
 */
@Controller("admin/draws")
@UseGuards(AdminTokenGuard)
export class AdminDrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Get("setup")
  setup() {
    return this.draws.setup();
  }

  @Post("preview")
  @HttpCode(200)
  preview(@Body() body: unknown) {
    return this.draws.preview(parseSettings(body));
  }

  @Post()
  run(@Body() body: unknown) {
    return this.draws.run(parseSettings(body), ACTOR);
  }

  @Get()
  list() {
    return this.draws.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.draws.get(id);
  }

  @Post(":id/replace")
  @HttpCode(200)
  replace(@Param("id") id: string, @Body() body: unknown) {
    const b = parseReason(body, ["participantId"]);
    if (typeof b.participantId !== "string") throw bad("Ishtirokchi ko'rsatilmagan.");
    return this.draws.replace(id, b.participantId, b.reason, ACTOR);
  }

  @Post(":id/confirm")
  @HttpCode(200)
  confirm(@Param("id") id: string) {
    return this.draws.confirm(id, ACTOR);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Param("id") id: string, @Body() body: unknown) {
    return this.draws.cancel(id, parseReason(body).reason, ACTOR);
  }

  /** G'oliblarga Telegram bot orqali (ketma-ket, ~25 xabar/soniya). */
  @Post(":id/send")
  @HttpCode(200)
  send(@Param("id") id: string) {
    return this.draws.send(id, ACTOR);
  }
}
