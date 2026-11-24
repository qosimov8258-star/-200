import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import type Anthropic from "@anthropic-ai/sdk";

import { AiReviewService } from "../ai-review/ai-review.service";
import { parseResult } from "../ai-review/ai-worker.controller";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { BackendClient } from "./backend-client";
import { MockBatchProvider, type BatchOutcome, type BatchProvider, type BatchRequest } from "./batch-provider";
import { AiWorker } from "./worker";
import type { WorkerConfig } from "./worker-config";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;
const dir = mkdtempSync(join(tmpdir(), "ai-worker-test-"));
let server: Server;
let base = "";

before(() => {
  if (!hasFfmpeg) return;
  // 9 soniyalik vertikal (1080×1920) sinov videosi va namuna rasm.
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=duration=9:size=1080x1920:rate=25", "-pix_fmt", "yuv420p", join(dir, "video.mp4")]);
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc=size=2400x1600", "-frames:v", "1", join(dir, "ref.png")]);
  server = createServer((req, res) => {
    if (req.url === "/video.mp4") {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      res.end(readFileSync(join(dir, "video.mp4")));
    } else {
      res.writeHead(404).end();
    }
  });
  return new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    }),
  );
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Worker'ning HTTP so'rovlarini to'g'ridan-to'g'ri servisga yo'naltiradi (Nest'siz). */
function backendFetch(ai: AiReviewService): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
    let m: RegExpExecArray | null;
    if (path === "/internal/ai/heartbeat") return json(ai.heartbeat());
    if (path === "/internal/ai/lease") return json({ jobs: await ai.lease(Number(body.limit)) });
    if (path === "/internal/ai/release") return json(ai.release(body.reviewIds as string[], String(body.error)));
    if ((m = /^\/internal\/ai\/config\/(\d+)\/references\/(\w+)$/.exec(path))) {
      return new Response(new Uint8Array(ai.workerReference(Number(m[1]), m[2])!.data), { status: 200 });
    }
    if ((m = /^\/internal\/ai\/config\/(\d+)$/.exec(path))) return json(ai.workerConfig(Number(m[1])));
    if (path === "/internal/ai/batches") return json(ai.registerBatch(String(body.batchId), body.reviewIds as string[]));
    if (path === "/internal/ai/batches/open") return json({ batches: ai.openBatches() });
    if ((m = /^\/internal\/ai\/batches\/([\w-]+)\/close$/.exec(path))) return json(ai.closeBatch(m[1]));
    if (path === "/internal/ai/results") return json(ai.applyResults((body.results as unknown[]).map(parseResult)));
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}

const silent = { log: () => undefined, warn: () => undefined, error: () => undefined };

test("worker: video → kadrlar → batch → natija va dalil kadrlari", { skip: !hasFfmpeg && "ffmpeg yo'q" }, async () => {
  const participants = new ParticipantsService(new RulesService());
  const stats = new MockReelStatsProvider(`${base}/video.mp4`);
  for (const id of [1, 2, 3]) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    const reel = participants.submitReel(id, `https://www.instagram.com/reel/CODE${id}/`, `CODE${id}`);
    reel.status = "ACCEPTED";
    reel.history = [{ date: "2026-12-01", at: new Date(), views: id * 100, likes: 1, comments: 0 }];
  }
  // 3-ishtirokchining videosi CDN'da yo'q (manzil eskirgan).
  stats.set("CODE3", { videoUrl: `${base}/expired.mp4` });

  const ai = new AiReviewService(participants, stats, {
    settings: { model: "claude-opus-5-5", frameIntervalSec: 2, frameHeight: 720, confidenceMin: 0.8, trialSize: 20 },
  });
  ai.createDraft();
  ai.updateCriteria("Videoda zavod mahsuloti ko'rinsin.");
  ai.addReference(`data:image/png;base64,${readFileSync(join(dir, "ref.png")).toString("base64")}`, "MUST", "Qadoq");
  ai.approve("FULL", undefined, "Admin");

  const workDir = join(dir, "work");
  const options: WorkerConfig = {
    provider: "mock",
    anthropicApiKey: null,
    backendUrl: "http://backend.test/api/v1",
    workerToken: "t",
    workDir,
    pollSeconds: 1,
    batchSize: 20,
    maxInFlight: 200,
    maxFrames: 150,
    maxBatchMb: 150,
    effort: "medium",
    mockDelaySeconds: 0,
  };
  const submitted: BatchRequest[][] = [];
  const provider = new MockBatchProvider(0);
  const submit = provider.submit.bind(provider);
  provider.submit = (requests) => {
    submitted.push(requests);
    return submit(requests);
  };
  const worker = new AiWorker(options, new BackendClient(options.backendUrl, "t", backendFetch(ai)), provider, silent);

  await worker.tick(); // lease → yuklash → kadrlar → batch
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].length, 2, "eskirgan manzilli video batch'ga kirmaydi");
  const params = submitted[0][0].params;
  const content = params.messages[0].content as (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[];
  const labels = content.flatMap((b) => (b.type === "text" && /^\[t=\d+s\]$/.test(b.text) ? [b.text] : []));
  assert.deepEqual(labels, ["[t=0s]", "[t=2s]", "[t=4s]", "[t=6s]", "[t=8s]"], "har 2 soniyada kadr");
  assert.equal(content.filter((b) => b.type === "image").length, 6, "1 namuna + 5 kadr");
  const cached = content.findIndex((b) => b.cache_control);
  assert.equal(content[cached].type, "image", "kesh belgisi — oxirgi namuna rasmda");
  assert.equal(content.slice(cached + 1).some((b) => b.cache_control), false);
  assert.equal(params.model, "claude-opus-5-5");
  assert.deepEqual(params.output_config?.format?.type, "json_schema");
  assert.equal(ai.state().progress.processing, 2);
  assert.equal(ai.list({ state: "QUEUED" })[0]?.reel.shortcode, "CODE3");

  await worker.tick(); // batch tugadi → natijalar; CODE3 qayta urinish
  await worker.tick();
  await worker.tick();
  const progress = ai.state().progress;
  assert.equal(progress.done, 2);
  assert.equal(progress.failed, 1, "3 urinishdan keyin — xato");
  assert.ok(progress.inputTokens > 0 && progress.costUsd > 0);

  const done = ai.list({ state: "DONE" });
  for (const item of done) {
    assert.ok(item.verdict);
    const withFrame = item.evidence.find((e) => e.hasFrame);
    assert.ok(withFrame, "dalil kadri saqlangan");
    const frame = ai.frame(item.id, withFrame.second)!;
    const framePath = join(dir, "frame.jpg");
    writeFileSync(framePath, frame);
    const size = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", framePath])
      .toString()
      .trim();
    assert.equal(size, "720,1280", "720p: qisqa tomoni 720");
  }
  const failed = ai.list({ state: "FAILED" })[0];
  assert.match(failed.error ?? "", /eskirgan/);
  assert.deepEqual(
    readdirSync(workDir).filter((n) => n !== "refs"),
    [],
    "vaqtinchalik kadrlar o'chirilgan",
  );
});

test("worker: refusal — SHUBHALI; uzilgan/buzilgan javob — qayta; so'rov xatosi — FAILED", { skip: !hasFfmpeg && "ffmpeg yo'q" }, async () => {
  const participants = new ParticipantsService(new RulesService());
  const stats = new MockReelStatsProvider(`${base}/video.mp4`);
  for (const id of [1, 2, 3, 4]) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    const reel = participants.submitReel(id, `https://www.instagram.com/reel/CODE${id}/`, `CODE${id}`);
    reel.status = "ACCEPTED";
    reel.history = [{ date: "2026-12-01", at: new Date(), views: (5 - id) * 100, likes: 1, comments: 0 }];
  }
  const ai = new AiReviewService(participants, stats, {
    settings: { model: "claude-opus-5-5", frameIntervalSec: 2, frameHeight: 720, confidenceMin: 0.8, trialSize: 20 },
  });
  ai.createDraft();
  ai.updateCriteria("Videoda zavod mahsuloti ko'rinsin.");
  ai.approve("FULL", undefined, "Admin");

  const usage = { input: 6_000, output: 16_000, cacheRead: 0, cacheWrite: 0 };
  const outcomes: Record<string, BatchOutcome> = {
    CODE1: { type: "succeeded", stopReason: "refusal", text: null, usage },
    CODE2: { type: "succeeded", stopReason: "max_tokens", text: null, usage },
    CODE3: { type: "succeeded", stopReason: "end_turn", text: "{not json", usage },
    CODE4: { type: "errored", errorType: "invalid_request_error", message: "image too large" },
  };
  const byReview = new Map<string, string>();
  const requests = new Map<string, BatchRequest[]>();
  const provider: BatchProvider = {
    name: "stub",
    submit: (reqs) => {
      const id = `stub_${requests.size + 1}`;
      requests.set(id, reqs);
      return Promise.resolve(id);
    },
    status: () => Promise.resolve("ended"),
    async *results(batchId) {
      for (const r of requests.get(batchId) ?? []) yield { customId: r.custom_id, outcome: outcomes[byReview.get(r.custom_id)!] };
    },
  };
  for (const item of ai.list({})) byReview.set(item.id, item.reel.shortcode);
  const options: WorkerConfig = {
    provider: "mock",
    anthropicApiKey: null,
    backendUrl: "http://backend.test/api/v1",
    workerToken: "t",
    workDir: join(dir, "work2"),
    pollSeconds: 1,
    batchSize: 20,
    maxInFlight: 200,
    maxFrames: 150,
    maxBatchMb: 150,
    effort: "medium",
    mockDelaySeconds: 0,
  };
  const worker = new AiWorker(options, new BackendClient(options.backendUrl, "t", backendFetch(ai)), provider, silent);
  await worker.tick(); // yuborish
  await worker.tick(); // natijalar
  const byCode = new Map(ai.list({}).map((i) => [i.reel.shortcode, i]));
  assert.equal(byCode.get("CODE1")?.state, "DONE");
  assert.equal(byCode.get("CODE1")?.verdict, "UNCERTAIN", "xavfsizlik filtri — qo'lda ko'rilsin");
  assert.match(byCode.get("CODE1")?.reason ?? "", /qo'lda/);
  // CODE2/CODE3 qayta navbatga tushib, shu aylanishda yana olingan bo'lishi mumkin.
  for (const code of ["CODE2", "CODE3"]) {
    const item = byCode.get(code)!;
    assert.notEqual(item.state, "FAILED", `${code}: qayta urinish`);
    assert.ok((item.costUsd ?? 0) > 0, `${code}: sarflangan tokenlar hisoblanadi`);
  }
  assert.equal(byCode.get("CODE4")?.state, "FAILED", "so'rovning o'zi xato — qayta yuborilmaydi");
  assert.match(byCode.get("CODE4")?.error ?? "", /invalid_request_error/);
});
