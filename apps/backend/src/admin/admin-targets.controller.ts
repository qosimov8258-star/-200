import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";

import { TargetsService, type TargetAction, type TargetStatusFilter } from "../targets/targets.service";
import { AdminTokenGuard } from "./admin-token.guard";

/** Admin login qurilguncha harakat qiluvchi xodim nomi. */
const ACTOR = "Admin";
const STATUSES: TargetStatusFilter[] = ["NEW", "WARNED", "DISQUALIFIED", "DISMISSED", "OPEN"];
const ACTIONS: TargetAction[] = ["warn", "disqualify", "dismiss"];

const bad = (message: string) => new HttpException({ message }, 400);

function positiveInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw bad(`${name} musbat butun son bo'lishi kerak`);
  return n;
}

/**
 * Target (pullik reklama) holatlari — admin panel "Target yoqqanlar" bo'limi.
 * Kontrakt `apps/admin/src/lib/api.ts` dagi `getTargetCases` / `getTargetCase` / `resolveTargetCase` bilan bir xil.
 */
@Controller("admin/targets")
@UseGuards(AdminTokenGuard)
export class AdminTargetsController {
  constructor(private readonly targets: TargetsService) {}

  @Get()
  list(
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    if (status !== undefined && status !== "" && !STATUSES.includes(status as TargetStatusFilter)) {
      throw bad("Holat noto'g'ri");
    }
    return this.targets.list({
      status: status ? (status as TargetStatusFilter) : undefined,
      search: search?.slice(0, 100),
      page: positiveInt(page, "page"),
      pageSize: positiveInt(pageSize, "pageSize"),
    });
  }

  /** Reklama kutubxonasi: oxirgi tekshiruv natijasi va keyingi rejadagi kun. */
  @Get("check")
  lastCheck() {
    return {
      running: this.targets.isChecking,
      lastCheck: this.targets.lastCheck,
      nextCheckOn: this.targets.nextCheckOn(),
    };
  }

  /** Reklama kutubxonasini hoziroq tekshirish (reyting yetakchilari). Tugashini kutadi. */
  @Post("check")
  @HttpCode(200)
  check() {
    return this.targets.checkAds("admin");
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.targets.get(id);
  }

  /** Shikoyat skrinshoti (rasm). Admin panel uni Authorization sarlavhasi bilan yuklab ko'rsatadi. */
  @Get(":id/attachments/:attachmentId")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Cache-Control", "private, no-store")
  attachment(@Param("id") id: string, @Param("attachmentId") attachmentId: string) {
    const image = this.targets.attachment(id, attachmentId);
    return new StreamableFile(image.data, { type: image.mime, length: image.data.length, disposition: "inline" });
  }

  /** Body: `{ action: "warn" | "disqualify" | "dismiss", reason }`. Noma'lum maydon rad etiladi. */
  @Post(":id/resolve")
  @HttpCode(200)
  act(@Param("id") id: string, @Body() body: unknown) {
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw bad("So'rov tanasi noto'g'ri");
    const { action, reason, ...rest } = body as Record<string, unknown>;
    if (Object.keys(rest).length > 0) throw bad(`Noma'lum maydon: ${Object.keys(rest)[0]}`);
    if (!ACTIONS.includes(action as TargetAction)) throw bad("Amal noto'g'ri");
    if (typeof reason !== "string") throw bad("Sabab yozilmagan");
    return this.targets.act(id, action as TargetAction, reason, ACTOR);
  }
}
