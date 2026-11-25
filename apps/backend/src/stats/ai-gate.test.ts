import assert from "node:assert/strict";
import { test } from "node:test";

import { AiReviewService } from "../ai-review/ai-review.service";
import type { AiResult } from "../ai-review/ai-types";
import { MockReelStatsProvider } from "../instagram/mock.provider";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { AI_CHECK_MAX_MS, AI_WORKER_GRACE_MS, StatsService } from "./stats.service";

/**
 * Yangi video oqimi (`AI_ACCEPTANCE_GATE=true` bo'lsa; standart — o'chiq): Apify videoni topadi
 * (ko'rishlar, egasi, video fayli) → AI mazmunini tekshiradi → ikkalasi ham o'tsa — qabul. AI
 * mahsulotni topmasa yoki ko'ra olmasa — admin ("Qo'lda tekshiruv"). O'chiq bo'lsa yoki mezonlar
 * tasdiqlanmagan bo'lsa — faqat Apify.
 */

const SETTINGS = { model: "claude-opus-5-5", frameIntervalSec: 2, frameHeight: 720, confidenceMin: 0.8, trialSize: 20 };

function setup(opts: { criteria?: boolean; gate?: boolean } = {}) {
  let now = new Date("2026-12-01T05:00:00Z");
  const clock = () => now;
  const participants = new ParticipantsService(new RulesService());
  const provider = new MockReelStatsProvider("https://cdn.test/video.mp4");
  const sent: string[] = [];
  const notifier: ParticipantNotifier = {
    notify: (_chatId, text) => {
      sent.push(text);
      return Promise.resolve();
    },
  };
  const ai = new AiReviewService(participants, provider, {
    settings: SETTINGS,
    clock,
    acceptanceGate: opts.gate ?? true,
  });
  if (opts.criteria !== false) {
    ai.createDraft();
    ai.updateCriteria("Videoda Olivia mahsuloti (qadoq yoki logotip) aniq ko'rinishi kerak.");
    ai.approve("FULL", undefined, "Admin");
  }
  const stats = new StatsService(
    participants,
    provider,
    notifier,
    {
      syncTime: "06:00",
      everyDays: 1,
      verifyDelayMs: 0,
      contestStartsOn: "2026-11-30",
      contestEndsAt: new Date("2027-01-01T07:00:00Z"),
      clock,
    },
    null,
    ai,
  );
  const join = (id: number, shortcode: string) => {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    participants.submitReel(id, `https://www.instagram.com/reel/${shortcode}/`, shortcode);
    stats.queueVerification(id, shortcode);
  };
  const reel = (id: number) => participants.get(id)?.reels.at(-1) ?? null;
  const later = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  /** Worker: navbatdagi ishlarni oladi va AI javobini qaytaradi. */
  const answer = async (status: "APPROVED" | "REJECTED" | "UNCERTAIN", confidence = 0.95) => {
    const jobs = await ai.lease(10);
    const results: AiResult[] = jobs.map((job) => ({
      reviewId: job.reviewId,
      ok: true,
      verdict: {
        status,
        confidence,
        reason: status === "APPROVED" ? "Qadoq aniq ko'rinadi." : "Videoda mahsulot ko'rinmadi.",
        evidence: [],
      },
      usage: { input: 1_000, output: 100, cacheRead: 0, cacheWrite: 0 },
      frames: [],
    }));
    ai.applyResults(results);
    return jobs;
  };
  return { participants, provider, ai, stats, sent, join, reel, later, answer };
}

test("Apify topdi → AI navbatida: video hali qabul qilinmagan, reytingda yo'q", async () => {
  const { provider, ai, stats, join, reel } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 5_000, likes: 200 });
  join(1, "AAAAA1");
  await stats.flushVerification();

  assert.equal(reel(1)?.status, "PENDING", "AI natijasigacha — tekshirilmoqda");
  assert.ok(reel(1)?.aiCheck, "AI kutilmoqda");
  assert.equal(reel(1)?.owner, "ali");
  assert.equal(reel(1)?.history.at(-1)?.views, 5_000, "ko'rishlar allaqachon o'qilgan");
  assert.deepEqual(stats.ranking(), []);
  const jobs = await ai.lease(10);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].shortcode, "AAAAA1");
  assert.equal(jobs[0].videoUrl, "https://cdn.test/video.mp4", "video fayli Apify javobidan — qayta so'ralmaydi");
  assert.equal(provider.requests.length, 1);

  // Navbatdagi tekshiruv AI kutayotgan videoni Apify'dan qayta so'ramaydi.
  stats.queueVerification(1);
  await stats.flushVerification();
  assert.equal(provider.requests.length, 1);
});

test("ikkalasi ham qabul qilsa — video qabul qilinadi va reytingga qo'shiladi", async () => {
  const { provider, stats, sent, join, reel, answer } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 5_000, likes: 200 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  assert.equal(sent.length, 0, "AI natijasigacha xabar yo'q");

  await answer("APPROVED");
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.aiCheck, null);
  assert.equal(reel(1)?.review, null, "qo'lda tekshiruvga tushmadi");
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.views]), [[1, 5_000]]);
  assert.match(sent.at(-1) ?? "", /qabul qilindi/);
  assert.match(sent.at(-1) ?? "", /5 000/);
});

test("AI mahsulotni topmasa yoki shubhali bo'lsa — admin qo'lda tekshiradi", async () => {
  const { provider, stats, sent, join, reel, answer, participants } = setup();
  provider.set("AAAAA1", { owner: "ali", views: 5_000 });
  provider.set("BBBBB2", { owner: "vali", views: 7_000 });
  join(1, "AAAAA1");
  join(2, "BBBBB2");
  await stats.flushVerification();
  await answer("REJECTED");

  for (const id of [1, 2]) {
    assert.equal(reel(id)?.status, "MANUAL_REVIEW");
    assert.equal(reel(id)?.review?.kind, "AI_CHECK");
    assert.equal(reel(id)?.review?.ai?.verdict, "REJECTED");
    assert.equal(reel(id)?.review?.ai?.reason, "Videoda mahsulot ko'rinmadi.");
  }
  assert.match(sent.at(-1) ?? "", /administrator qo'lda tekshiradi/);
  assert.deepEqual(stats.ranking(), []);
  assert.equal(stats.manualReviews().length, 2, "admin panel ro'yxatida");

  // Admin tasdiqladi — ko'rishlari allaqachon bor (0 bo'lib turmaydi).
  stats.decideManualReview("AAAAA1", { approve: true, note: "Mahsulot bor" }, "Admin");
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.deepEqual(stats.ranking().map((e) => [e.participant.telegramId, e.views]), [[1, 5_000]]);
  // Admin rad etdi — "mahsulot ko'rinmadi".
  stats.decideManualReview("BBBBB2", { approve: false, reason: "NO_PRODUCT", note: "" }, "Admin");
  assert.equal(reel(2)?.status, "REJECTED");
  assert.equal(reel(2)?.rejectReason, "NO_PRODUCT");
  assert.match(sent.at(-1) ?? "", /mahsuloti ko'rinmadi/);
  assert.ok(participants.get(2));
});

test("AI ishonchi past (TASDIQLANDI, lekin 0.8 dan kam) — shubhali, adminga", async () => {
  const { provider, stats, join, reel, answer } = setup();
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  await answer("APPROVED", 0.6);
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
  assert.equal(reel(1)?.review?.ai?.verdict, "UNCERTAIN");
  assert.equal(reel(1)?.review?.ai?.confidence, 0.6);
});

test("AI videoni ko'ra olmasa (urinishlar tugadi) — adminga", async () => {
  const { provider, ai, stats, join, reel } = setup();
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  for (let i = 0; i < 3; i++) {
    const jobs = await ai.lease(10);
    ai.applyResults(jobs.map((j) => ({ reviewId: j.reviewId, ok: false, error: "Video yuklanmadi", code: null, retryable: true, usage: null })));
  }
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
  assert.equal(reel(1)?.review?.kind, "AI_CHECK");
  assert.equal(reel(1)?.review?.ai?.verdict, "FAILED");
  assert.equal(reel(1)?.review?.ai?.reason, "Video yuklanmadi");
});

test("AI worker ishlamasa — video 10 daqiqadan keyin adminga o'tadi (cheksiz kutib qolmaydi)", async () => {
  const { provider, stats, join, reel, later } = setup();
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  stats.checkAiWaits();
  assert.equal(reel(1)?.status, "PENDING", "hali kutadi");
  later(AI_WORKER_GRACE_MS);
  stats.checkAiWaits();
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
  assert.equal(reel(1)?.review?.ai?.verdict, "FAILED");
  assert.match(reel(1)?.review?.ai?.reason ?? "", /worker/);
});

test("worker ishlayapti, lekin AI 2 soatda javob bermasa — adminga", async () => {
  const { provider, ai, stats, join, reel, later } = setup();
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  later(AI_CHECK_MAX_MS - 60_000);
  ai.heartbeat();
  stats.checkAiWaits();
  assert.equal(reel(1)?.status, "PENDING");
  later(60_000);
  ai.heartbeat();
  stats.checkAiWaits();
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
});

test("kunlik yig'ish: AI topmagan video Apify topgani uchun o'zi qabul qilinmaydi, ko'rishlari yangilanadi", async () => {
  const { provider, stats, join, reel, answer, later } = setup();
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  await answer("REJECTED");
  later(24 * 60 * 60_000);
  provider.set("AAAAA1", { views: 9_000 });
  await stats.syncAll("admin");
  assert.equal(reel(1)?.status, "MANUAL_REVIEW", "admin hal qiladi");
  assert.equal(reel(1)?.history.at(-1)?.views, 9_000);
});

test("mezonlar tasdiqlanmagan — AI'siz, faqat Apify bo'yicha darhol qabul (avvalgidek)", async () => {
  const { provider, ai, stats, join, reel } = setup({ criteria: false });
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(ai.gateEnabled(), false);
});

test("Apify ishlamasa — video 3 urinishdan keyin adminga o'tadi (tekshirilmoqda'da qolib ketmaydi)", async () => {
  const { provider, stats, join, reel } = setup();
  provider.failing = true;
  join(1, "AAAAA1");
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "PENDING");
  for (let i = 0; i < 2; i++) {
    stats.queueVerification(1);
    await stats.flushVerification();
  }
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
  assert.equal(reel(1)?.review?.kind, "NEW_REEL");
});

test("Apify videoni topdi, lekin ko'rishlar kelmadi — qisqa vaqtda qayta so'raladi, 3-martada adminga", async () => {
  const { provider, stats, join, reel } = setup();
  provider.set("AAAAA1", { views: null });
  join(1, "AAAAA1");
  await stats.flushVerification();
  assert.equal(reel(1)?.status, "PENDING");
  assert.equal(reel(1)?.misses, 1);
  for (let i = 0; i < 2; i++) {
    stats.queueVerification(1);
    await stats.flushVerification();
  }
  assert.equal(reel(1)?.status, "MANUAL_REVIEW");
});

test("yangi mezon versiyasi tasdiqlansa — navbatdagi yangi videolar yo'qolmaydi", async () => {
  const { provider, ai, stats, join, reel, answer } = setup();
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  ai.createDraft();
  ai.updateCriteria("Yangi mezon: mahsulot qadog'i yoki logotipi ko'rinsin.");
  ai.approve("FULL", undefined, "Admin");
  const jobs = await answer("APPROVED");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].version, 2);
  assert.equal(reel(1)?.status, "ACCEPTED");
});

test("standart (AI_ACCEPTANCE_GATE yo'q): mezonlar tasdiqlangan bo'lsa ham AI ulanmaydi — darhol qabul", async () => {
  const { provider, ai, stats, sent, join, reel, answer } = setup({ gate: false });
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  assert.equal(ai.gateEnabled(), false);
  assert.equal(ai.state().acceptanceGate, false);
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.aiCheck ?? null, null);
  assert.match(sent.at(-1) ?? "", /qabul qilindi/);
  // Admin AI bo'limida "Hammasi"ni ishga tushirgan bo'lsa — AI xulosasi faqat yordam, holatni o'zgartirmaydi.
  await answer("REJECTED");
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.review, null);
});

test("AI o'chirilgach, AI natijasini kutib qolgan videolar qabul qilinadi", async () => {
  const { provider, stats, join, reel, participants } = setup({ gate: false });
  provider.set("AAAAA1", { views: 5_000 });
  join(1, "AAAAA1");
  await stats.flushVerification();
  // AI yoqilgan paytda navbatga tushgan video (holat faylidan).
  const r = reel(1);
  assert.ok(r);
  r.status = "PENDING";
  r.aiCheck = { requestedAt: new Date("2026-12-01T05:00:00Z") };
  stats.checkAiWaits();
  assert.equal(reel(1)?.status, "ACCEPTED");
  assert.equal(reel(1)?.aiCheck, null);
  assert.ok(participants.get(1));
});
