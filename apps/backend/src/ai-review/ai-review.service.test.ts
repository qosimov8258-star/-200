import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { AiReviewService, MAX_REFERENCES } from "./ai-review.service";
import { costUsd, parseModelVerdict, type AiResult } from "./ai-types";
import { parseResult } from "./ai-worker.controller";

/** JPEG boshiga o'xshash rasm (`parseScreenshot` sehrli baytlar va hajmni tekshiradi). */
const jpeg = (fill = 1): string => {
  const data = Buffer.alloc(2_000, fill);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(data);
  return `data:image/jpeg;base64,${data.toString("base64")}`;
};

const SETTINGS = { model: "claude-opus-5-5", frameIntervalSec: 2, frameHeight: 720, confidenceMin: 0.8, trialSize: 20 };
const USAGE = { input: 70_000, output: 1_500, cacheRead: 5_000, cacheWrite: 0 };

function setup(count = 25) {
  let now = new Date("2026-12-01T10:00:00Z");
  const participants = new ParticipantsService(new RulesService());
  const provider = new MockReelStatsProvider("https://cdn.test/video.mp4");
  const addReel = (id: number, views: number) => {
    if (!participants.get(id)?.firstName) {
      participants.setPhone(id, id, `+9989000${String(id).padStart(5, "0")}`);
      participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
      participants.acceptRules(id, 1);
    }
    const code = `CODE${id}x${views}`;
    const reel = participants.submitReel(id, `https://www.instagram.com/reel/${code}/`, code);
    reel.status = "ACCEPTED";
    reel.history = [{ date: "2026-12-01", at: now, views, likes: 10, comments: 1 }];
    return code;
  };
  // Ko'rishlar: 1 → 1000, 2 → 2000, ... — eng ko'p ko'rilgani oxirgi ishtirokchi.
  for (let id = 1; id <= count; id += 1) addReel(id, id * 1_000);
  const ai = new AiReviewService(participants, provider, { settings: SETTINGS, clock: () => now });
  const later = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { participants, provider, ai, addReel, later };
}

const status = (fn: () => unknown): number | string => {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpException) {
      const body = e.getResponse() as { code?: string };
      return body.code ?? e.getStatus();
    }
    throw e;
  }
  return "OK";
};

const ok = (reviewId: string, verdict: Partial<{ status: string; confidence: number }> = {}): AiResult => ({
  reviewId,
  ok: true,
  verdict: {
    status: (verdict.status ?? "APPROVED") as "APPROVED",
    confidence: verdict.confidence ?? 0.95,
    reason: "Mahsulot aniq ko'rinadi.",
    evidence: [
      { second: 12, description: "Qadoq logotipi" },
      { second: 30, description: "Mahsulot qo'lda" },
    ],
  },
  usage: USAGE,
  frames: [{ second: 12, dataUrl: jpeg(7) }],
});

test("draft: mezon, namuna rasmlar va tasdiqlash shartlari", () => {
  const { ai } = setup(3);
  assert.equal(status(() => ai.updateCriteria("x")), "NO_DRAFT", "qoralamasiz tahrirlash yo'q");
  assert.equal(ai.createDraft(), true);
  assert.equal(ai.createDraft(), false, "ikkinchi qoralama ochilmaydi");
  assert.equal(ai.state().draft?.version, 1);

  assert.equal(status(() => ai.approve("FULL", undefined, "Admin")), "DRAFT_EMPTY");
  assert.equal(status(() => ai.addReference("data:image/gif;base64,AAAA", "MUST", "")), "BAD_IMAGE");
  const ref = ai.addReference(jpeg(), "MUST", "  Mahsulot qadog'i  ");
  assert.equal(ref.note, "Mahsulot qadog'i");
  assert.equal(ai.updateReference(ref.id, { kind: "MUST_NOT" }).kind, "MUST_NOT");
  assert.ok(ai.referenceImage(ref.id)?.data.length);
  for (let i = 1; i < MAX_REFERENCES; i += 1) ai.addReference(jpeg(i), "INFO", "");
  assert.equal(status(() => ai.addReference(jpeg(), "INFO", "")), "TOO_MANY");

  ai.updateCriteria("Videoda zavod mahsuloti ko'rinsin.");
  const result = ai.approve("FULL", undefined, "Admin");
  assert.deepEqual(result, { version: 1, queued: 3 });
  const state = ai.state();
  assert.equal(state.draft, null);
  assert.equal(state.active?.status, "APPROVED");
  assert.equal(state.active?.approvedBy, "Admin");
  assert.equal(state.run?.mode, "FULL");
  assert.equal(state.progress.total, 3);
  assert.equal(state.progress.queued, 3);
  assert.equal(status(() => ai.updateCriteria("o'zgartirish")), "NO_DRAFT", "tasdiqlangan versiya muhrlangan");
  assert.equal(ai.workerConfig(1)?.references.length, MAX_REFERENCES);
  assert.equal(ai.workerConfig(1)?.settings.model, "claude-opus-5-5");
});

test("sinov: standart — eng ko'p ko'rilgan 20 ta; tanlangan kodlar tekshiriladi", () => {
  const { ai } = setup(25);
  ai.createDraft();
  ai.updateCriteria("Mahsulot ko'rinishi shart.");
  assert.equal(status(() => ai.approve("TRIAL", ["NOPE1"], "Admin")), "NOT_FOUND");
  assert.equal(status(() => ai.approve("TRIAL", Array.from({ length: 21 }, (_, i) => `X${i}`), "Admin")), 422);
  const r = ai.approve("TRIAL", [], "Admin");
  assert.equal(r.queued, 20);
  const shortcodes = ai.list({}).map((x) => x.reel.views);
  assert.equal(Math.min(...shortcodes), 6_000, "eng kam ko'rilgan 5 tasi sinovga kirmaydi");

  const candidates = ai.candidates("");
  assert.equal(candidates[0].views, 25_000, "nomzodlar — ko'p ko'rilgani birinchi");
  assert.equal(ai.candidates("ism3").length, 1);
});

test("worker: lease → natija, ishonch qoidasi, dalil kadri va narx", async () => {
  const { ai } = setup(3);
  ai.createDraft();
  ai.updateCriteria("Mahsulot ko'rinishi shart.");
  ai.approve("FULL", undefined, "Admin");

  const jobs = await ai.lease(10);
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].videoUrl, "https://cdn.test/video.mp4");
  assert.equal(jobs[0].attempt, 1);
  assert.equal((await ai.lease(10)).length, 0, "olingan ishlar qayta berilmaydi");
  assert.equal(ai.state().progress.processing, 3);
  assert.equal(ai.state().worker.online, true);

  const [a, b, c] = jobs;
  const applied = ai.applyResults([
    ok(a.reviewId, { status: "APPROVED", confidence: 0.95 }),
    ok(b.reviewId, { status: "REJECTED", confidence: 0.7 }),
    ok("unknown", {}),
  ]);
  assert.deepEqual(applied, { applied: 2, ignored: 1 });
  assert.equal(ai.item(a.reviewId)?.verdict, "APPROVED");
  assert.equal(ai.item(b.reviewId)?.verdict, "UNCERTAIN", "ishonch 0.8 dan past — SHUBHALI");
  assert.deepEqual(
    ai.item(a.reviewId)?.evidence.map((e) => [e.second, e.hasFrame]),
    [
      [12, true],
      [30, false],
    ],
  );
  assert.ok(ai.frame(a.reviewId, 12));
  assert.equal(ai.frame(a.reviewId, 30), null);

  const progress = ai.state().progress;
  assert.equal(progress.done, 2);
  assert.equal(progress.processing, 1);
  assert.equal(progress.approved, 1);
  assert.equal(progress.uncertain, 1);
  assert.equal(progress.inputTokens, 140_000);
  // (70k × $4 + 1.5k × $20 + 5k × $0.2) / 1M × 50% = $0.1555 bitta video uchun.
  assert.equal(ai.item(a.reviewId)?.costUsd, 0.1555);
  assert.equal(progress.costUsd, 0.311);

  // Takroriy natija (eskirgan) e'tiborsiz.
  assert.deepEqual(ai.applyResults([ok(a.reviewId)]), { applied: 0, ignored: 1 });

  // Qo'lda qaror yakuniy natijani almashtiradi.
  const decided = ai.decide(b.reviewId, "APPROVED", "Mahsulot bor, qorong'i kadr", "Admin");
  assert.equal(decided.before, "UNCERTAIN");
  assert.equal(decided.item.finalVerdict, "APPROVED");
  assert.equal(decided.item.verdict, "UNCERTAIN");
  assert.equal(ai.state().progress.approved, 2);
  assert.equal(ai.state().progress.manual, 1);
  assert.equal(ai.list({ verdict: "APPROVED" }).length, 2);
  assert.equal(ai.list({ state: "PROCESSING" })[0].id, c.reviewId);
});

test("worker: xato — 3 marta urinish, muddati o'tgan manzil yangilanadi, Apify ishlamasa kutadi", async () => {
  const { ai, provider } = setup(1);
  ai.createDraft();
  ai.updateCriteria("Mahsulot ko'rinishi shart.");
  ai.approve("FULL", undefined, "Admin");

  provider.failing = true;
  assert.equal((await ai.lease(5)).length, 0);
  assert.equal(ai.state().progress.queued, 1, "Apify ishlamasa — navbatda qoladi");
  assert.equal(ai.list({})[0].attempts, 0, "urinish hisoblanmaydi");
  provider.failing = false;

  const fail = (reviewId: string, code: "VIDEO_URL_EXPIRED" | "MODEL" | null = null): AiResult => ({
    reviewId,
    ok: false,
    error: "Yuklab bo'lmadi",
    code,
    retryable: true,
    usage: null,
  });
  let [job] = await ai.lease(5);
  const fetchesBefore = provider.requests.length;
  assert.deepEqual(ai.release([job.reviewId], "Claude kaliti noto'g'ri"), { released: 1 });
  assert.equal(ai.list({})[0].attempts, 0, "release — urinish hisoblanmaydi");
  [job] = await ai.lease(5);
  assert.equal(job.attempt, 1);
  ai.applyResults([fail(job.reviewId, "VIDEO_URL_EXPIRED")]);
  assert.equal(ai.state().progress.queued, 1);
  [job] = await ai.lease(5);
  assert.equal(provider.requests.length, fetchesBefore + 1, "eskirgan manzil Apify'dan qayta olinadi");
  assert.equal(job.attempt, 2);
  ai.applyResults([fail(job.reviewId)]);
  [job] = await ai.lease(5);
  assert.equal(job.attempt, 3);
  ai.applyResults([{ ...fail(job.reviewId, "MODEL"), usage: USAGE }]);
  const item = ai.list({})[0];
  assert.equal(item.state, "FAILED", "3 urinishdan keyin — xato");
  assert.equal(item.error, "Yuklab bo'lmadi");
  assert.ok((item.costUsd ?? 0) > 0, "muvaffaqiyatsiz so'rov narxi ham hisoblanadi");
  assert.equal(ai.state().progress.failed, 1);
});

test("worker: Instagram'da topilmagan video va muddati o'tgan lease", async () => {
  const { ai, provider, participants, later } = setup(2);
  ai.createDraft();
  ai.updateCriteria("Mahsulot ko'rinishi shart.");
  ai.approve("FULL", undefined, "Admin");
  const lost = participants.get(1)!.reels[0].shortcode;
  provider.set(lost, null);

  const jobs = await ai.lease(5);
  assert.equal(jobs.length, 1, "topilmagan video ishga berilmaydi");
  assert.match(ai.list({ state: "QUEUED" })[0].error ?? "", /topilmadi/);

  later(3 * 60 * 60 * 1000); // worker javob bermadi (lease 2 soat)
  assert.equal(ai.state().progress.processing, 1, "holat so'ralganda muddat tekshirilmaydi");
  await ai.lease(0);
  const back = ai.list({}).find((r) => r.id === jobs[0].reviewId);
  assert.equal(back?.state, "PROCESSING", "muddati o'tgan ish navbatga qaytib, yana olindi");
  assert.equal(back?.attempts, 2);
  assert.equal(ai.state().worker.online, true);
  later(10 * 60 * 1000);
  assert.equal(ai.state().worker.online, false, "3 daqiqadan ortiq jim — worker o'chiq");
});

test("batch: ro'yxatga olish, ochiq batch'lar va yopilganda natijasizlar qayta navbatga", async () => {
  const { ai } = setup(3);
  ai.createDraft();
  ai.updateCriteria("Mahsulot ko'rinishi shart.");
  ai.approve("FULL", undefined, "Admin");
  const jobs = await ai.lease(3);
  assert.equal(status(() => ai.registerBatch("bad id!", [jobs[0].reviewId])), 400);
  assert.deepEqual(ai.registerBatch("msgbatch_01", jobs.map((j) => j.reviewId)), { registered: 3 });
  assert.equal(status(() => ai.registerBatch("msgbatch_01", [jobs[0].reviewId])), 409);

  ai.applyResults([ok(jobs[0].reviewId)]);
  const [open] = ai.openBatches();
  assert.equal(open.batchId, "msgbatch_01");
  assert.deepEqual(open.reviewIds, [jobs[1].reviewId, jobs[2].reviewId]);

  ai.applyResults([ok(jobs[1].reviewId)]);
  assert.deepEqual(ai.closeBatch("msgbatch_01"), { requeued: 1 });
  assert.equal(ai.openBatches().length, 0);
  assert.equal(ai.item(jobs[2].reviewId)?.state, "QUEUED");
  assert.equal(ai.state().progress.done, 2);
});

test("sinovdan keyin hammasi; keyin qabul qilingan videolar o'zi navbatga tushadi", () => {
  const { ai, addReel } = setup(25);
  assert.equal(status(() => ai.runAll("Admin")), "NO_ACTIVE");
  ai.createDraft();
  ai.updateCriteria("Mahsulot ko'rinishi shart.");
  ai.approve("TRIAL", undefined, "Admin");
  addReel(26, 500);
  assert.equal(ai.state().progress.total, 20, "sinovda yangi video qo'shilmaydi");
  const all = ai.runAll("Admin");
  assert.deepEqual(all, { version: 1, queued: 6, changed: true });
  assert.equal(ai.state().run?.mode, "FULL");
  addReel(27, 700);
  assert.equal(ai.state().progress.total, 27, "FULL rejimda yangi qabul qilingan video navbatga");
  assert.equal(ai.runAll("Admin").changed, false);
});

test("yangi versiya: nusxa, umumiy fayllar saqlanadi, eski navbat bekor qilinadi", async () => {
  const { ai } = setup(3);
  ai.createDraft();
  const ref = ai.addReference(jpeg(), "MUST", "Qadoq");
  ai.approve("FULL", undefined, "Admin");
  await ai.lease(1);

  ai.createDraft();
  const draft = ai.state().draft!;
  assert.equal(draft.version, 2);
  assert.equal(draft.references.length, 1);
  assert.notEqual(draft.references[0].id, ref.id);
  ai.removeReference(draft.references[0].id);
  assert.ok(ai.referenceImage(ref.id), "1-versiyaning rasmi o'chmaydi");

  ai.updateCriteria("Yangi mezon: mahsulot va logotip.");
  ai.approve("FULL", undefined, "Admin");
  const state = ai.state();
  assert.equal(state.active?.version, 2);
  assert.equal(state.run?.version, 2);
  assert.equal(state.progress.total, 3, "2-versiya bo'yicha hamma video");
  assert.equal(ai.list({}).every((r) => r.version === 2), true);
  assert.equal(ai.workerConfig(1)?.references.length, 1, "eski versiya o'zgarmaydi");
});

test("worker natijasi qat'iy tekshiriladi", () => {
  const valid = {
    reviewId: "abc",
    ok: true,
    verdict: { status: "APPROVED", confidence: 1.4, reason: "ok", evidence: [{ second: 2.4, description: "x" }] },
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    frames: [],
  };
  const parsed = parseResult(valid);
  assert.equal(parsed.ok && parsed.verdict.confidence, 1, "ishonch 0..1 ga qisiladi");
  assert.equal(parsed.ok && parsed.verdict.evidence[0].second, 2);
  assert.throws(() => parseResult({ ...valid, extra: 1 }));
  assert.throws(() => parseResult({ ...valid, verdict: { ...valid.verdict, status: "MAYBE" } }));
  assert.throws(() => parseResult({ ...valid, usage: { input: -1, output: 1, cacheRead: 0, cacheWrite: 0 } }));
  assert.throws(() => parseResult({ reviewId: "abc", ok: false, error: "x", code: "WHAT", retryable: true }));
  const failed = parseResult({ reviewId: "abc", ok: false, error: "x", code: null, retryable: false });
  assert.equal(failed.ok, false);
});

test("model javobi va narx", () => {
  assert.equal(parseModelVerdict("not json"), null);
  assert.equal(parseModelVerdict('{"status":"APPROVED"}'), null);
  const v = parseModelVerdict('{"status":"REJECTED","confidence":0.9,"reason":"Mahsulot yo\'q","evidence":[]}');
  assert.equal(v?.status, "REJECTED");
  // 1M kirish tokeni Opus 5.5 da $4, batch — 50%.
  assert.equal(costUsd("claude-opus-5-5", { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 }), 2);
  assert.equal(costUsd("claude-opus-5-5", { input: 0, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000 }), 14.1);
});
