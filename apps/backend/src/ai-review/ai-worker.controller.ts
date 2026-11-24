import { createHash, timingSafeEqual } from "node:crypto";

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { objectBody } from "../admin/admin-http";
import { config } from "../config/config";
import { AiReviewService } from "./ai-review.service";
import {
  AI_FAILURE_CODES,
  toModelVerdict,
  type AiJob,
  type AiOpenBatch,
  type AiResult,
  type AiUsage,
  type AiWorkerConfig,
} from "./ai-types";

export const AI_WORKER_TOKEN = Symbol("AI_WORKER_TOKEN");

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/**
 * Worker himoyasi: `X-Worker-Token` sarlavhasi `AI_WORKER_TOKEN` ga teng bo'lishi kerak (vaqt
 * bo'yicha xavfsiz solishtirish). Token sozlanmagan bo'lsa — API butunlay yopiq.
 */
@Injectable()
export class AiWorkerGuard implements CanActivate {
  constructor(@Inject(AI_WORKER_TOKEN) private readonly token: string | null) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) throw new HttpException({ message: "AI worker API yopiq (AI_WORKER_TOKEN yo'q)." }, 403);
    const given = context.switchToHttp().getRequest<Request>().header("x-worker-token") ?? "";
    if (!timingSafeEqual(digest(given), digest(this.token))) {
      throw new HttpException({ message: "Worker tokeni noto'g'ri." }, 401);
    }
    return true;
  }
}

export const aiWorkerTokenProvider = { provide: AI_WORKER_TOKEN, useFactory: () => config.ai.workerToken };

const bad = (message: string) => new HttpException({ message }, 400);

function count(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw bad(`${field} noto'g'ri.`);
  return value;
}

function usageOf(value: unknown): AiUsage {
  const u = objectBody(value, ["input", "output", "cacheRead", "cacheWrite"]);
  return {
    input: count(u.input, "usage.input"),
    output: count(u.output, "usage.output"),
    cacheRead: count(u.cacheRead, "usage.cacheRead"),
    cacheWrite: count(u.cacheWrite, "usage.cacheWrite"),
  };
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) throw bad(`${field} noto'g'ri.`);
  return value;
}

/** Worker natijasi — qat'iy tekshiruv (noma'lum maydon rad etiladi). */
export function parseResult(value: unknown): AiResult {
  const head = objectBody(value, ["reviewId", "ok", "verdict", "usage", "frames", "error", "code", "retryable"]);
  const reviewId = text(head.reviewId, "reviewId", 64);
  if (head.ok === true) {
    const body = objectBody(value, ["reviewId", "ok", "verdict", "usage", "frames"]);
    const verdict = toModelVerdict(body.verdict);
    if (!verdict) throw bad("verdict noto'g'ri.");
    if (!Array.isArray(body.frames) || body.frames.length > 8) throw bad("frames noto'g'ri.");
    const frames = body.frames.map((f) => {
      const frame = objectBody(f, ["second", "dataUrl"]);
      if (typeof frame.second !== "number" || !Number.isFinite(frame.second) || frame.second < 0) {
        throw bad("frames.second noto'g'ri.");
      }
      return { second: frame.second, dataUrl: text(frame.dataUrl, "frames.dataUrl", 3_000_000) };
    });
    return { reviewId, ok: true, verdict, usage: usageOf(body.usage), frames };
  }
  if (head.ok === false) {
    const body = objectBody(value, ["reviewId", "ok", "error", "code", "retryable", "usage"]);
    const code = body.code === null || body.code === undefined ? null : AI_FAILURE_CODES.find((c) => c === body.code);
    if (code === undefined) throw bad("code noto'g'ri.");
    if (typeof body.retryable !== "boolean") throw bad("retryable noto'g'ri.");
    return {
      reviewId,
      ok: false,
      error: text(body.error, "error", 2_000),
      code,
      retryable: body.retryable,
      usage: body.usage === null || body.usage === undefined ? null : usageOf(body.usage),
    };
  }
  throw bad("ok noto'g'ri.");
}

/**
 * Worker ↔ backend (`/api/v1/internal/ai/*`). nginx bu yo'lni tashqariga ochmaydi — worker
 * backend'ga Docker tarmog'i ichida (`http://backend:3000`) murojaat qiladi.
 */
@Controller("internal/ai")
@UseGuards(AiWorkerGuard)
export class AiWorkerController {
  constructor(private readonly ai: AiReviewService) {}

  @Post("heartbeat")
  @HttpCode(200)
  heartbeat(): { runVersion: number | null } {
    return this.ai.heartbeat();
  }

  /** `POST /internal/ai/lease` body `{ limit }` → navbatdagi ishlar. */
  @Post("lease")
  @HttpCode(200)
  async lease(@Body() body: unknown): Promise<{ jobs: AiJob[] }> {
    const limit = objectBody(body, ["limit"]).limit;
    if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 50) throw bad("limit 1–50.");
    return { jobs: await this.ai.lease(limit) };
  }

  /** `POST /internal/ai/release` body `{ reviewIds, error }` — urinish hisoblanmaydi. */
  @Post("release")
  @HttpCode(200)
  release(@Body() body: unknown): { released: number } {
    const b = objectBody(body, ["reviewIds", "error"]);
    if (!Array.isArray(b.reviewIds) || b.reviewIds.length === 0 || b.reviewIds.length > 1000) {
      throw bad("reviewIds noto'g'ri.");
    }
    return this.ai.release(
      b.reviewIds.map((id) => text(id, "reviewIds", 64)),
      text(b.error, "error", 2_000),
    );
  }

  @Get("config/:version")
  workerConfig(@Param("version", ParseIntPipe) version: number): AiWorkerConfig {
    const found = this.ai.workerConfig(version);
    if (!found) throw new HttpException({ message: "Versiya topilmadi." }, 404);
    return found;
  }

  @Get("config/:version/references/:id")
  reference(
    @Param("version", ParseIntPipe) version: number,
    @Param("id") id: string,
    @Res() res: Response,
  ): void {
    const image = this.ai.workerReference(version, id);
    if (!image) throw new HttpException({ message: "Rasm topilmadi." }, 404);
    res.setHeader("Content-Type", image.mime);
    res.setHeader("Cache-Control", "no-store");
    res.end(image.data);
  }

  /** `POST /internal/ai/batches` body `{ batchId, reviewIds }`. */
  @Post("batches")
  @HttpCode(200)
  registerBatch(@Body() body: unknown): { registered: number } {
    const b = objectBody(body, ["batchId", "reviewIds"]);
    if (!Array.isArray(b.reviewIds) || b.reviewIds.length === 0 || b.reviewIds.length > 1000) {
      throw bad("reviewIds noto'g'ri.");
    }
    const ids = b.reviewIds.map((id) => text(id, "reviewIds", 64));
    return this.ai.registerBatch(text(b.batchId, "batchId", 120), ids);
  }

  @Get("batches/open")
  openBatches(): { batches: AiOpenBatch[] } {
    return { batches: this.ai.openBatches() };
  }

  @Post("batches/:id/close")
  @HttpCode(200)
  closeBatch(@Param("id") id: string): { requeued: number } {
    return this.ai.closeBatch(id);
  }

  /** `POST /internal/ai/results` body `{ results: AiResult[] }` (bir so'rovda 50 tagacha). */
  @Post("results")
  @HttpCode(200)
  results(@Body() body: unknown): { applied: number; ignored: number } {
    const raw = objectBody(body, ["results"]).results;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) throw bad("results noto'g'ri.");
    return this.ai.applyResults(raw.map(parseResult));
  }
}
