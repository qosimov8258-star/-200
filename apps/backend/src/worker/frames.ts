import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { AiFailureCode } from "../ai-review/ai-types";

/** Video yuklab olishdagi chegaralar. Reel odatda 5–60 MB. */
const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const FFMPEG_TIMEOUT_MS = 5 * 60_000;
/** JPEG sifati (ffmpeg `-q:v`: 2 — eng yaxshi, 31 — eng yomon). Hajm oshsa — pasaytiriladi. */
const QUALITY_STEPS = [4, 8, 14] as const;

/** Worker xatosi: backend'ga shu kod va "qayta urinish mumkinmi" bilan yuboriladi. */
export class JobError extends Error {
  constructor(
    message: string,
    readonly code: AiFailureCode,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface Frame {
  /** Videodagi vaqt, soniya (butun). */
  second: number;
  path: string;
  bytes: number;
}

export interface ExtractedFrames {
  durationSec: number;
  intervalSec: number;
  frames: Frame[];
  totalBytes: number;
}

export interface FrameOptions {
  intervalSec: number;
  /** Qisqa tomoni (720 = 720p); kichik videolar kattalashtirilmaydi. */
  shortSide: number;
  maxFrames: number;
  /** Hamma kadrlar hajmi chegarasi, bayt (so'rov hajmi uchun). */
  maxTotalBytes: number;
}

/** Videoni faylga yuklab oladi. 403/404/410 — CDN manzili eskirgan (backend yangisini oladi). */
export async function downloadVideo(url: string, target: string, fetchFn: typeof fetch = fetch): Promise<number> {
  let res: Response;
  try {
    res = await fetchFn(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: "follow" });
  } catch (err) {
    throw new JobError(`Videoni yuklab bo'lmadi: ${(err as Error).message}`, "VIDEO_DOWNLOAD", true);
  }
  if ([403, 404, 410].includes(res.status)) {
    throw new JobError(`Video manzili eskirgan (HTTP ${res.status})`, "VIDEO_URL_EXPIRED", true);
  }
  if (!res.ok || !res.body) throw new JobError(`Videoni yuklab bo'lmadi (HTTP ${res.status})`, "VIDEO_DOWNLOAD", true);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_VIDEO_BYTES) throw new JobError("Video juda katta (300 MB dan ortiq)", "TOO_LARGE", false);

  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      received += chunk.length;
      if (received > MAX_VIDEO_BYTES) done(new JobError("Video juda katta (300 MB dan ortiq)", "TOO_LARGE", false));
      else done(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), limit, createWriteStream(target));
  } catch (err) {
    if (err instanceof JobError) throw err;
    throw new JobError(`Videoni yuklab bo'lmadi: ${(err as Error).message}`, "VIDEO_DOWNLOAD", true);
  }
  return received;
}

/** Tashqi dasturni ishga tushiradi; stdout qaytadi. */
function run(command: string, args: string[], timeoutMs = FFMPEG_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2_000)));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`${command} ishga tushmadi: ${err.message}`));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} xato bilan tugadi (${signal ?? code}): ${stderr.trim().split("\n").at(-1) ?? ""}`));
    });
  });
}

/** Video davomiyligi, soniya. */
export async function probeDuration(video: string): Promise<number> {
  let out: string;
  try {
    out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video]);
  } catch (err) {
    throw new JobError(`Video o'qilmadi: ${(err as Error).message}`, "VIDEO_DECODE", false);
  }
  const duration = Number.parseFloat(out.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new JobError("Video davomiyligi aniqlanmadi", "VIDEO_DECODE", false);
  return duration;
}

/** Qisqa tomonni `shortSide` ga tushiradi (kattalashtirmaydi), juft o'lcham. */
const scaleFilter = (shortSide: number): string =>
  `scale=w='if(lt(iw,ih),min(${shortSide},iw),-2)':h='if(lt(iw,ih),-2,min(${shortSide},ih))'`;

/**
 * Har `intervalSec` soniyada bitta kadr (0, 2, 4, …), JPEG. Uzun videoda kadrlar soni `maxFrames`
 * dan oshmasligi uchun oraliq kattalashadi. Umumiy hajm chegaradan oshsa — avval JPEG sifati,
 * keyin o'lcham pasaytiriladi (TZ: "limitdan oshsa kadrlarni bo'l/kichraytir").
 */
export async function extractFrames(video: string, outDir: string, options: FrameOptions): Promise<ExtractedFrames> {
  const durationSec = await probeDuration(video);
  const intervalSec = Math.max(options.intervalSec, Math.ceil((durationSec / options.maxFrames) * 10) / 10);
  const sizes = [options.shortSide, Math.round((options.shortSide * 0.75) / 2) * 2];
  for (const shortSide of sizes) {
    for (const quality of QUALITY_STEPS) {
      await rm(outDir, { recursive: true, force: true });
      await mkdir(outDir, { recursive: true });
      try {
        await run("ffmpeg", [
          "-v",
          "error",
          "-nostdin",
          "-i",
          video,
          "-an",
          "-vf",
          `fps=1/${intervalSec},${scaleFilter(shortSide)}`,
          "-frames:v",
          String(options.maxFrames),
          "-q:v",
          String(quality),
          join(outDir, "raw-%05d.jpg"),
        ]);
      } catch (err) {
        throw new JobError(`Kadrlarni ajratib bo'lmadi: ${(err as Error).message}`, "VIDEO_DECODE", false);
      }
      const frames = await collect(outDir, intervalSec);
      if (frames.length === 0) throw new JobError("Videodan kadr olinmadi", "VIDEO_DECODE", false);
      const totalBytes = frames.reduce((sum, f) => sum + f.bytes, 0);
      if (totalBytes <= options.maxTotalBytes) return { durationSec, intervalSec, frames, totalBytes };
    }
  }
  throw new JobError("Kadrlar hajmi so'rov chegarasidan katta", "TOO_LARGE", false);
}

/** `raw-00001.jpg` → `f-0.jpg` (nomida soniya) — natija kelganda dalil kadrini topish oson. */
async function collect(dir: string, intervalSec: number): Promise<Frame[]> {
  const names = (await readdir(dir)).filter((n) => /^raw-\d{5}\.jpg$/.test(n)).sort();
  const frames: Frame[] = [];
  for (const [index, name] of names.entries()) {
    const second = Math.round(index * intervalSec);
    if (frames.at(-1)?.second === second) continue;
    const path = join(dir, `f-${second}.jpg`);
    await rename(join(dir, name), path);
    frames.push({ second, path, bytes: (await stat(path)).size });
  }
  for (const name of await readdir(dir)) if (name.startsWith("raw-")) await rm(join(dir, name), { force: true });
  return frames;
}

/**
 * Namuna rasmni JPEG ga o'tkazadi, uzun tomoni ≤ 1568 px (ko'p rasmli so'rovda har bir rasm
 * o'lchami cheklangan; admin yuklagan PNG/WebP ham shu yerda bir xil ko'rinishga keladi).
 */
export async function normalizeReference(input: Buffer, workDir: string, name: string): Promise<Buffer> {
  await mkdir(workDir, { recursive: true });
  const src = join(workDir, `${name}.src`);
  const out = join(workDir, `${name}.jpg`);
  await writeFile(src, input);
  try {
    await run("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-i",
      src,
      "-vf",
      "scale=w='min(1568,iw)':h='min(1568,ih)':force_original_aspect_ratio=decrease",
      "-frames:v",
      "1",
      "-q:v",
      "3",
      out,
    ]);
    return await readFile(out);
  } finally {
    await rm(src, { force: true });
    await rm(out, { force: true });
  }
}

/** Kadrning soniyasiga eng yaqin olingan kadr. */
export function nearestFrame(frames: readonly { second: number }[], second: number): number | null {
  let best: number | null = null;
  for (const f of frames) {
    if (best === null || Math.abs(f.second - second) < Math.abs(best - second)) best = f.second;
  }
  return best;
}
