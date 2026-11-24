import { mkdir, readdir, readFile, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import {
  parseModelVerdict,
  type AiJob,
  type AiModelVerdict,
  type AiResult,
  type AiUsage,
  type AiWorkerConfig,
} from "../ai-review/ai-types";
import { BackendClient, BackendError } from "./backend-client";
import { ProviderUnavailableError, type BatchOutcome, type BatchProvider, type BatchRequest } from "./batch-provider";
import { downloadVideo, extractFrames, JobError, nearestFrame, normalizeReference } from "./frames";
import { buildRequest, requestBytes, sharedBlocks, type PreparedReference } from "./prompt";
import type { WorkerConfig } from "./worker-config";

/** Bitta so'rov hajmi chegarasi (rasmlar base64 bilan). */
const MAX_REQUEST_BYTES = 24 * 1024 * 1024;
/** Kalit/limit muammosida shuncha kutiladi. */
const PAUSE_ON_PROVIDER_ERROR_MS = 10 * 60_000;
/** Yuborilgan batch'ning kadrlari shuncha saqlanadi (batch 24 soatda tugaydi). */
const KEEP_FRAMES_MS = 48 * 60 * 60 * 1000;
/** Bir vaqtda nechta video yuklanadi va kadrlarga ajratiladi. */
const PREPARE_CONCURRENCY = 2;
/** Claude: bitta so'rovda 600 tagacha rasm (namuna rasmlar + kadrlar); ozgina zaxira bilan. */
const MAX_IMAGES_PER_REQUEST = 590;
/** Namuna rasmlarning so'rovdagi umumiy hajmi (base64 dan oldin) — qolgani kadrlarga. */
const REFERENCES_BUDGET_BYTES = 9 * 1024 * 1024;
/** Namuna rasm uzun tomoni: rasm qancha ko'p bo'lsa, shuncha kichik (token va hajm tejaladi). */
const REFERENCE_SIZES = [1568, 1024, 768, 512, 384, 256] as const;

/** Rasm soniga qarab boshlang'ich o'lcham (ko'pincha shu bilan sig'adi — qayta kodlash kerak bo'lmaydi). */
export function referenceSizeFor(count: number): number {
  if (count <= 16) return 1568;
  if (count <= 40) return 1024;
  if (count <= 100) return 768;
  if (count <= 250) return 512;
  return 384;
}

export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface PreparedJob {
  job: AiJob;
  dir: string;
  request: BatchRequest;
  bytes: number;
}

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * AI worker: navbatdan videolarni oladi → yuklab, ffmpeg bilan kadrlarga ajratadi → Claude
 * Message Batches API'ga yuboradi → tugagan batch natijalarini backend'ga yozadi.
 *
 * Har bir video uchun kadrlar `workDir/<reviewId>/` da natija kelguncha turadi (dalil kadrlari
 * shulardan olinadi), keyin o'chiriladi. Video faylning o'zi kadrlar ajratilgach darhol o'chadi.
 */
export class AiWorker {
  private readonly configs = new Map<number, { config: AiWorkerConfig; references: PreparedReference[] }>();
  private pausedUntil = 0;
  private cleaned = false;
  stopping = false;

  constructor(
    private readonly options: WorkerConfig,
    private readonly backend: BackendClient,
    private readonly provider: BatchProvider,
    private readonly logger: Logger,
  ) {}

  /** Bitta aylanish: tugagan batch'lar → yangi ishlar. */
  async tick(): Promise<void> {
    await this.backend.heartbeat();
    await mkdir(this.options.workDir, { recursive: true });
    const open = await this.pollBatches();
    if (!this.cleaned) {
      await this.cleanup(open);
      this.cleaned = true;
    }
    if (this.stopping || Date.now() < this.pausedUntil) return;
    const inFlight = open.reduce((sum, b) => sum + b.pending, 0);
    const room = Math.min(this.options.batchSize, this.options.maxInFlight - inFlight);
    if (room <= 0) return;
    const jobs = await this.backend.lease(room);
    if (jobs.length > 0) await this.process(jobs);
  }

  // --- Natijalar ---------------------------------------------------------------------------

  /** Ochiq batch'lar: tugaganlarining natijasi yoziladi. Natija — hali kutilayotganlar. */
  private async pollBatches(): Promise<{ batchId: string; reviewIds: string[]; pending: number }[]> {
    const open = await this.backend.openBatches();
    const waiting: { batchId: string; reviewIds: string[]; pending: number }[] = [];
    for (const batch of open) {
      if (batch.reviewIds.length === 0) {
        await this.backend.closeBatch(batch.batchId);
        continue;
      }
      let status;
      try {
        status = await this.provider.status(batch.batchId);
      } catch (err) {
        this.logger.warn(`Batch ${batch.batchId} holati olinmadi: ${errorText(err)}`);
        waiting.push({ batchId: batch.batchId, reviewIds: batch.reviewIds, pending: batch.reviewIds.length });
        continue;
      }
      if (status === "in_progress" || status === "canceling") {
        waiting.push({ batchId: batch.batchId, reviewIds: batch.reviewIds, pending: batch.reviewIds.length });
        continue;
      }
      if (status === "ended") await this.collect(batch.batchId, new Set(batch.reviewIds));
      else this.logger.warn(`Batch ${batch.batchId} topilmadi — videolar qayta navbatga qo'yiladi.`);
      const { requeued } = await this.backend.closeBatch(batch.batchId);
      for (const id of batch.reviewIds) await this.removeDir(id);
      this.logger.log(`Batch ${batch.batchId} yopildi${requeued > 0 ? `, ${requeued} ta video qayta navbatda` : ""}.`);
    }
    return waiting;
  }

  private async collect(batchId: string, expected: Set<string>): Promise<void> {
    let count = 0;
    for await (const { customId, outcome } of this.provider.results(batchId)) {
      if (!expected.has(customId)) continue;
      const result = await this.toResult(customId, outcome);
      try {
        await this.backend.results([result]);
      } catch (err) {
        // Dalil kadrlari JSON chegarasidan (3 MB) oshsa — natija kadrlarsiz yoziladi, aks holda
        // har aylanishda shu batch qayta-qayta o'qilib qolardi.
        if (!(err instanceof BackendError && err.status === 413 && result.ok)) throw err;
        await this.backend.results([{ ...result, frames: [] }]);
      }
      await this.removeDir(customId);
      count += 1;
    }
    this.logger.log(`Batch ${batchId}: ${count} ta natija yozildi.`);
  }

  private async toResult(reviewId: string, outcome: BatchOutcome): Promise<AiResult> {
    const fail = (error: string, retryable: boolean, usage: AiUsage | null = null): AiResult => ({
      reviewId,
      ok: false,
      error,
      code: "MODEL",
      retryable,
      usage,
    });
    switch (outcome.type) {
      case "expired":
        return fail("Batch 24 soatda ishlanmadi (muddati o'tdi) — qayta yuboriladi.", true);
      case "canceled":
        return fail("Batch bekor qilindi.", true);
      case "errored":
        // invalid_request — so'rovning o'zi xato (qayta yuborish foyda bermaydi).
        return fail(`Claude xatosi (${outcome.errorType}): ${outcome.message}`, outcome.errorType !== "invalid_request_error");
      case "succeeded": {
        if (outcome.stopReason === "refusal") {
          // Xavfsizlik filtri javob bermadi — moderator qo'lda ko'rsin.
          return this.success(reviewId, {
            status: "UNCERTAIN",
            confidence: 0,
            reason: "AI bu videoni baholamadi (xavfsizlik filtri). Iltimos, qo'lda ko'ring.",
            evidence: [],
          }, outcome.usage);
        }
        if (outcome.stopReason === "max_tokens") return fail("Javob uzunlik chegarasida uzildi.", true, outcome.usage);
        const verdict = outcome.text ? parseModelVerdict(outcome.text) : null;
        if (!verdict) return fail("Claude javobi kutilgan JSON ko'rinishida emas.", true, outcome.usage);
        return this.success(reviewId, verdict, outcome.usage);
      }
    }
  }

  /** Dalil soniyalari haqiqiy kadrlarga moslanadi va o'sha kadrlar natijaga qo'shiladi. */
  private async success(reviewId: string, verdict: AiModelVerdict, usage: AiUsage): Promise<AiResult> {
    const dir = this.dirOf(reviewId);
    const available = await this.frameSeconds(dir);
    const evidence = verdict.evidence.map((e) => ({ ...e, second: nearestFrame(available, e.second) ?? e.second }));
    const frames: { second: number; dataUrl: string }[] = [];
    for (const second of new Set(evidence.map((e) => e.second))) {
      if (!available.some((f) => f.second === second)) continue;
      const data = await readFile(join(dir, `f-${second}.jpg`));
      frames.push({ second, dataUrl: `data:image/jpeg;base64,${data.toString("base64")}` });
    }
    return { reviewId, ok: true, verdict: { ...verdict, evidence }, usage, frames };
  }

  // --- Yangi ishlar ------------------------------------------------------------------------

  private async process(jobs: AiJob[]): Promise<void> {
    const byVersion = new Map<number, AiJob[]>();
    for (const job of jobs) byVersion.set(job.version, [...(byVersion.get(job.version) ?? []), job]);
    for (const [version, group] of byVersion) {
      let shared;
      try {
        shared = await this.versionConfig(version);
      } catch (err) {
        await this.release(group, `Versiya sozlamasi olinmadi: ${errorText(err)}`);
        continue;
      }
      const prepared = await this.prepareAll(group, shared.config, sharedBlocks(shared.config, shared.references));
      await this.submit(prepared);
    }
  }

  private async prepareAll(
    jobs: AiJob[],
    config: AiWorkerConfig,
    shared: ReturnType<typeof sharedBlocks>,
  ): Promise<PreparedJob[]> {
    const sharedBytes = Buffer.byteLength(JSON.stringify(shared));
    const prepared: PreparedJob[] = [];
    const queue = [...jobs];
    const workers = Array.from({ length: PREPARE_CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        if (this.stopping) {
          await this.release([job], "Worker to'xtatildi.");
          continue;
        }
        try {
          prepared.push(await this.prepare(job, config, shared, sharedBytes));
        } catch (err) {
          const e = err instanceof JobError ? err : new JobError(errorText(err), "VIDEO_DECODE", true);
          this.logger.warn(`${job.shortcode}: ${e.message}`);
          await this.removeDir(job.reviewId);
          await this.backend.results([
            { reviewId: job.reviewId, ok: false, error: e.message, code: e.code, retryable: e.retryable, usage: null },
          ]);
        }
      }
    });
    await Promise.all(workers);
    return prepared;
  }

  private async prepare(
    job: AiJob,
    config: AiWorkerConfig,
    shared: ReturnType<typeof sharedBlocks>,
    sharedBytes: number,
  ): Promise<PreparedJob> {
    const dir = this.dirOf(job.reviewId);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const video = join(dir, "video.mp4");
    try {
      await downloadVideo(job.videoUrl, video);
      const extracted = await extractFrames(video, join(dir, "frames"), {
        intervalSec: config.settings.frameIntervalSec,
        shortSide: config.settings.frameHeight,
        // Namuna rasmlar ko'p bo'lsa — kadrlar soni qolgan joyga moslanadi (oraliq kattalashadi).
        maxFrames: Math.max(20, Math.min(this.options.maxFrames, MAX_IMAGES_PER_REQUEST - config.references.length)),
        // base64 ≈ 4/3 hajm; umumiy qism (namuna rasmlar) ham shu so'rovda.
        maxTotalBytes: Math.floor(((MAX_REQUEST_BYTES - sharedBytes) * 3) / 4) - 200_000,
      });
      const frames = [];
      for (const f of extracted.frames) {
        frames.push({ second: f.second, base64: (await readFile(f.path)).toString("base64") });
      }
      // Kadrlar `dir/f-<soniya>.jpg` ga — natija kelganda dalil kadrlari shu yerdan olinadi.
      for (const f of extracted.frames) await rename(f.path, join(dir, `f-${f.second}.jpg`));
      await rm(join(dir, "frames"), { recursive: true, force: true });
      const params = buildRequest(config, shared, frames, extracted, this.options.effort);
      const bytes = requestBytes(params);
      if (bytes > MAX_REQUEST_BYTES) throw new JobError("So'rov hajmi chegaradan katta", "TOO_LARGE", false);
      return { job, dir, request: { custom_id: job.reviewId, params }, bytes };
    } finally {
      await rm(video, { force: true });
    }
  }

  /** Hajm bo'yicha bir nechta batch'ga bo'linadi (har biri ≤ AI_MAX_BATCH_MB). */
  private async submit(prepared: PreparedJob[]): Promise<void> {
    const limit = this.options.maxBatchMb * 1024 * 1024;
    const chunks: PreparedJob[][] = [];
    let current: PreparedJob[] = [];
    let size = 0;
    for (const p of prepared) {
      if (current.length > 0 && size + p.bytes > limit) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(p);
      size += p.bytes;
    }
    if (current.length > 0) chunks.push(current);

    for (const chunk of chunks) {
      const ids = chunk.map((p) => p.job.reviewId);
      let batchId: string;
      try {
        batchId = await this.provider.submit(chunk.map((p) => p.request));
      } catch (err) {
        if (err instanceof ProviderUnavailableError) {
          this.pausedUntil = Date.now() + PAUSE_ON_PROVIDER_ERROR_MS;
          this.logger.error(`${err.message} — 10 daqiqa kutiladi.`);
        } else {
          this.logger.error(`Batch yaratilmadi: ${errorText(err)}`);
        }
        await this.release(chunk.map((p) => p.job), `Claude'ga yuborib bo'lmadi: ${errorText(err)}`);
        continue;
      }
      await this.registerWithRetry(batchId, ids);
      const mb = (chunk.reduce((s, p) => s + p.bytes, 0) / 1024 / 1024).toFixed(1);
      this.logger.log(`Batch ${batchId}: ${chunk.length} ta video yuborildi (${mb} MB).`);
    }
  }

  /** Batch Claude'da yaratildi — backend uni albatta bilishi kerak (aks holda natija yo'qoladi). */
  private async registerWithRetry(batchId: string, ids: string[]): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.backend.registerBatch(batchId, ids);
        return;
      } catch (err) {
        if (attempt >= 10) {
          this.logger.error(`Batch ${batchId} backend'ga yozilmadi: ${errorText(err)} — videolar keyinroq qayta ishlanadi.`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, 2_000 * attempt)));
      }
    }
  }

  private async release(jobs: AiJob[], error: string): Promise<void> {
    if (jobs.length === 0) return;
    for (const job of jobs) await this.removeDir(job.reviewId);
    try {
      await this.backend.release(
        jobs.map((j) => j.reviewId),
        error,
      );
    } catch (err) {
      this.logger.warn(`Ishlar navbatga qaytarilmadi (lease muddati tugagach o'zi qaytadi): ${errorText(err)}`);
    }
  }

  /**
   * Versiya sozlamasi va namuna rasmlar (JPEG) — versiya muhrlangan, keshlanadi. Rasmlar soni
   * cheklanmagan: ko'p bo'lsa kichikroq o'lchamda yuboriladi, umumiy hajm `REFERENCES_BUDGET_BYTES`
   * dan oshmasin (so'rovda kadrlarga ham joy qolsin).
   */
  private async versionConfig(version: number): Promise<{ config: AiWorkerConfig; references: PreparedReference[] }> {
    const cached = this.configs.get(version);
    if (cached) return cached;
    const config = await this.backend.config(version);
    const raws: Buffer[] = [];
    for (const ref of config.references) raws.push(await this.backend.reference(version, ref.id));

    const dir = join(this.options.workDir, "refs");
    const first = REFERENCE_SIZES.indexOf(referenceSizeFor(raws.length) as (typeof REFERENCE_SIZES)[number]);
    let jpegs: Buffer[] = [];
    let size: number = REFERENCE_SIZES[first];
    for (const candidate of REFERENCE_SIZES.slice(first)) {
      size = candidate;
      jpegs = await mapLimit(raws, 4, (raw, i) => normalizeReference(raw, dir, `v${version}-${i}`, candidate));
      if (jpegs.reduce((sum, j) => sum + j.length, 0) <= REFERENCES_BUDGET_BYTES) break;
    }
    const references = config.references.map((ref, i) => ({
      id: ref.id,
      kind: ref.kind,
      note: ref.note,
      base64: jpegs[i].toString("base64"),
    }));
    if (references.length > 0) {
      const mb = (jpegs.reduce((sum, j) => sum + j.length, 0) / 1024 / 1024).toFixed(1);
      this.logger.log(`Versiya ${version}: ${references.length} ta namuna rasm, ${size} px, ${mb} MB.`);
    }
    const entry = { config, references };
    this.configs.set(version, entry);
    return entry;
  }

  // --- Fayllar -----------------------------------------------------------------------------

  private dirOf(reviewId: string): string {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(reviewId)) throw new Error(`reviewId noto'g'ri: ${reviewId}`);
    return join(this.options.workDir, reviewId);
  }

  private async frameSeconds(dir: string): Promise<{ second: number }[]> {
    try {
      return (await readdir(dir))
        .map((name) => /^f-(\d+)\.jpg$/.exec(name))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => ({ second: Number(m[1]) }));
    } catch {
      return [];
    }
  }

  private async removeDir(reviewId: string): Promise<void> {
    await rm(this.dirOf(reviewId), { recursive: true, force: true });
  }

  /** Ishga tushganda: ochiq batch'larga tegishli bo'lmagan yoki juda eski papkalar o'chiriladi. */
  private async cleanup(open: { reviewIds: string[] }[]): Promise<void> {
    const keep = new Set(open.flatMap((b) => b.reviewIds));
    for (const name of await readdir(this.options.workDir)) {
      if (name === "refs") continue;
      const path = join(this.options.workDir, name);
      const age = Date.now() - (await stat(path)).mtimeMs;
      if (!keep.has(name) || age > KEEP_FRAMES_MS) await rm(path, { recursive: true, force: true });
    }
  }
}

/** `items` ustida bir vaqtda ko'pi bilan `limit` ta ish; natija tartibi saqlanadi. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i], i);
  });
  await Promise.all(workers);
  return results;
}
