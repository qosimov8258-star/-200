import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { ParticipantsService } from "../participants/participants.service";
import { encodeState } from "../persistence/state-codec";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { DEFAULT_DRAW_MESSAGE, DEFAULT_MAIN_DRAW_MESSAGE, DRAW_LIMITS, seededShuffle, type DrawSettings } from "./draw-rules";
import { DrawsService, mainPrizeId, type MainPrizeKind } from "./draws.service";

const at = (day: string) => new Date(`${day}T10:00:00+05:00`);

/** 1-bosqich: 27.11–26.12.2026 (oferta 6.1.2); "bugun" — 27.12 (bosqich tugagan). */
function setup() {
  const participants = new ParticipantsService(new RulesService());
  const sent: { chatId: number; text: string }[] = [];
  const failFor = new Set<number>();
  const notifier: ParticipantNotifier = {
    notify: (chatId, text) => {
      if (failFor.has(chatId)) return Promise.reject(new Error("Forbidden: bot was blocked by the user"));
      sent.push({ chatId, text });
      return Promise.resolve();
    },
  };
  let now = at("2026-12-27");
  const draws = new DrawsService(participants, notifier, { clock: () => now, sendIntervalMs: 0 });
  /** Aksiya tugagan payt — asosiy sovrinlar tanlovi faqat shunda (oferta 6.2.1). */
  const afterEnd = () => {
    now = at("2027-02-28");
  };

  /** Qabul qilingan Reel bilan ishtirokchi. */
  const add = (
    id: number,
    opts: { views?: number; posted?: string; submitted?: string; status?: "ACCEPTED" | "PENDING"; flagged?: boolean } = {},
  ) => {
    participants.setPhone(id, id, `+9989000${String(id).padStart(5, "0")}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
    const reel = participants.submitReel(id, `https://www.instagram.com/reel/CODE${id}/`, `CODE${id}`);
    reel.status = opts.status ?? "ACCEPTED";
    reel.submittedAt = at(opts.submitted ?? opts.posted ?? "2026-12-01");
    reel.postedAt = at(opts.posted ?? "2026-12-01");
    reel.owner = `user${id}`;
    reel.history = [{ date: "2026-12-20", at: at("2026-12-20"), views: opts.views ?? 5_000, likes: 100, comments: 5 }];
    if (opts.flagged) reel.flags = [{ type: "LOW_ENGAGEMENT", date: "2026-12-20", detail: "test" }];
    return participants.get(id)!;
  };

  /** Mavjud ishtirokchining yana bir videosi (standart — 10-dekabrda yuborilgan). */
  const extra = (
    id: number,
    shortcode: string,
    o: {
      views: number;
      posted: string;
      submitted?: string;
      status?: "ACCEPTED" | "PENDING" | "REJECTED";
      flagged?: boolean;
    },
  ) => {
    const reel = participants.submitReel(id, `https://www.instagram.com/reel/${shortcode}/`, shortcode);
    reel.status = o.status ?? "ACCEPTED";
    reel.submittedAt = at(o.submitted ?? "2026-12-10");
    reel.postedAt = at(o.posted);
    reel.owner = `user${id}.${shortcode.toLowerCase()}`;
    reel.history = [{ date: "2026-12-20", at: at("2026-12-20"), views: o.views, likes: 100, comments: 5 }];
    if (o.flagged) reel.flags = [{ type: "LOW_ENGAGEMENT", date: "2026-12-20", detail: "test" }];
    return reel;
  };

  const settings = (patch: Partial<DrawSettings> = {}): DrawSettings => ({
    ...(draws.setup().defaults as DrawSettings),
    winnersCount: 3,
    reservesCount: 2,
    messageTemplate: DEFAULT_DRAW_MESSAGE,
    ...patch,
  });
  /** Asosiy sovrin tanlovining standart sozlamalari (`setup().mainDefaults`). */
  const main = (kind: MainPrizeKind): DrawSettings => {
    const found = draws.setup().mainDefaults.find((d) => d.prizeId === mainPrizeId(kind));
    assert.ok(found, `${kind} uchun standart sozlamalar yo'q`);
    return { ...found };
  };
  return {
    afterEnd, participants, draws, add, extra, settings, main, sent, failFor };
}

const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
  return 0;
};

/** Faqat noldan katta istisnolar. */
const nonZero = (excluded: Record<string, number>) => Object.fromEntries(Object.entries(excluded).filter(([, n]) => n > 0));

test("setup offers the last finished stage and the monthly voucher defaults", () => {
  const { draws } = setup();
  const s = draws.setup();
  assert.equal(s.defaults.prizeId, "monthly");
  assert.equal(s.defaults.stage, 1);
  assert.equal(s.defaults.periodFrom, "2026-11-27");
  assert.equal(s.defaults.periodTo, "2026-12-26");
  assert.equal(s.defaults.dateBasis, "SUBMITTED", "oferta 7.2: shu oyda ilovaga yuborilgan videolar");
  assert.equal(s.defaults.minViews, 1_000);
  assert.equal(s.defaults.maxViews, 100_000);
  assert.equal(s.defaults.winnersCount, 200);
  assert.equal(s.defaults.excludePreviousWinners, false, "voucherni bir necha oy yutish mumkin");
  assert.deepEqual(
    s.stages.map((st) => [st.index, st.startsOn, st.endsOn, st.finished]),
    [
      [1, "2026-11-27", "2026-12-26", true],
      [2, "2026-12-27", "2027-01-26", false],
      [3, "2027-01-27", "2027-02-27", false],
    ],
  );
  // Sovg'alar: oylik voucher va 4 ta asosiy sovrin (eng qimmatidan).
  assert.deepEqual(
    s.prizes.map((p) => [p.id, p.kind, p.quantity, p.minViews, p.maxViews]),
    [
      ["monthly", null, 200, 1_000, 100_000],
      ["main-car", "car", 1, 4_000_001, null],
      ["main-travel", "travel", 3, 1_500_001, 4_000_000],
      ["main-phone", "phone", 15, 500_001, 1_500_000],
      ["main-tablet", "tablet", 25, 100_001, 500_000],
    ],
  );
  assert.equal(s.prizes[0].title, "Korzinka xarid voucheri");
  // Asosiy sovrinlar: butun aksiya davri, ofertadagi oraliq, g'oliblar soni — sovrin soni.
  assert.deepEqual(
    s.mainDefaults.map((d) => [
      d.prizeId,
      d.stage,
      d.periodFrom,
      d.periodTo,
      d.dateBasis,
      d.minViews,
      d.maxViews,
      d.winnersCount,
      d.excludePreviousWinners,
    ]),
    [
      ["main-car", null, "2026-11-27", "2027-02-27", "SUBMITTED", 4_000_001, DRAW_LIMITS.viewsMax, 1, true],
      ["main-travel", null, "2026-11-27", "2027-02-27", "SUBMITTED", 1_500_001, 4_000_000, 3, true],
      ["main-phone", null, "2026-11-27", "2027-02-27", "SUBMITTED", 500_001, 1_500_000, 15, true],
      ["main-tablet", null, "2026-11-27", "2027-02-27", "SUBMITTED", 100_001, 500_000, 25, true],
    ],
  );
  assert.equal(s.mainDefaults[0].messageTemplate, DEFAULT_MAIN_DRAW_MESSAGE);
});

test("only eligible participants enter the pool; the rest are counted by reason", () => {
  const { draws, add, participants, settings } = setup();
  add(1);
  add(2, { posted: "2026-11-20", submitted: "2026-11-30" });
  add(3, { views: 500 });
  add(4, { views: 200_000 });
  add(5, { status: "PENDING" });
  add(6, { flagged: true });
  add(7).status = "BLOCKED";
  void participants;

  // Instagram'da joylangan sana bo'yicha 2-ishtirokchi davrdan tashqarida.
  const posted = draws.preview(settings({ dateBasis: "POSTED" }));
  assert.equal(posted.eligibleCount, 1);
  assert.equal(posted.viewsAsOf, "2026-12-26");
  assert.deepEqual(nonZero(posted.excluded), {
    OUT_OF_PERIOD: 1,
    VIEWS_LOW: 1,
    VIEWS_HIGH: 1,
    NOT_ACCEPTED: 1,
    TARGET: 1,
    STATUS: 1,
  });

  // Standart — ilovaga yuborilgan sana bo'yicha: 2-ishtirokchi ham kiradi; target istisnosi o'chirilsa — 6-si ham.
  assert.equal(draws.preview(settings()).eligibleCount, 2);
  const submitted = draws.preview(settings({ excludeTargets: false }));
  assert.equal(submitted.eligibleCount, 3);
});

test("several Reels (7.2): only Reels dated inside the period count and their views add up", () => {
  const { draws, add, extra, settings } = setup();
  // 1: ikkalasi ham davrda — 600 + 1 300 = 1 900; link va akkaunt — eng ko'p ko'rilganiniki.
  add(1, { views: 600 });
  const oneB = extra(1, "ONEB", { views: 1_300, posted: "2026-12-05" });
  // Davr tugagandan keyingi ko'rishlar hisobga olinmaydi (`viewsAsOf` — davrning oxirgi kuni).
  oneB.history.push({ date: "2026-12-27", at: at("2026-12-27"), views: 90_000, likes: 100, comments: 5 });
  // 2: davrdan tashqaridagi 200 000 hisobga olinmaydi (VIEWS_HIGH emas); rad etilgani ham.
  add(2, { views: 5_000 });
  extra(2, "TWOB", { views: 200_000, posted: "2026-11-20" });
  extra(2, "TWOC", { views: 90_000, posted: "2026-12-05", status: "REJECTED" });
  // 3: qabul qilinganlari davrdan tashqarida, davrdagisi hali tekshirilmagan.
  add(3, { views: 5_000, posted: "2026-11-20" });
  extra(3, "THREEB", { views: 5_000, posted: "2026-12-05", status: "PENDING" });
  // 4: davrdagi videolar har biri chegaradan past, lekin yig'indisi (110 000) oshadi.
  add(4, { views: 60_000 });
  extra(4, "FOURB", { views: 50_000, posted: "2026-12-06" });
  // 5: nakrutka belgisi davrdan tashqaridagi videoda — to'siq emas; 6: davrdagisida — TARGET.
  add(5, { views: 2_000 });
  extra(5, "FIVEB", { views: 2_000, posted: "2026-11-20", flagged: true });
  add(6, { views: 2_000 });
  extra(6, "SIXB", { views: 2_000, posted: "2026-12-06", flagged: true });
  // 7: har biri minimaldan past, yig'indisi (600 + 700 = 1 300) o'tadi.
  add(7, { views: 600 });
  extra(7, "SEVENB", { views: 700, posted: "2026-12-05" });
  // 8: yig'indisi ham (400 + 500 = 900) minimaldan past.
  add(8, { views: 400 });
  extra(8, "EIGHTB", { views: 500, posted: "2026-12-05" });

  const preview = draws.preview(settings({ dateBasis: "POSTED" }));
  assert.equal(preview.totalReels, 17, "barcha yuborilgan videolar");
  assert.deepEqual(nonZero(preview.excluded), { OUT_OF_PERIOD: 1, VIEWS_LOW: 1, VIEWS_HIGH: 1, TARGET: 1 });
  assert.deepEqual(
    preview.sample.map((c) => [c.participantId, c.views, c.reelUrl]).sort(),
    [
      ["1", 1_900, "https://www.instagram.com/reel/ONEB/"],
      ["2", 5_000, "https://www.instagram.com/reel/CODE2/"],
      ["5", 2_000, "https://www.instagram.com/reel/CODE5/"],
      ["7", 1_300, "https://www.instagram.com/reel/SEVENB/"],
    ],
  );
  const one = preview.sample.find((c) => c.participantId === "1");
  assert.deepEqual([one?.instagramUsername, one?.postedOn, one?.submittedOn], ["user1.oneb", "2026-12-05", "2026-12-10"]);

  // Ilovaga yuborilgan sana bo'yicha (standart) qo'shimcha videolar (10-dekabr) davrga kiradi:
  // 2-ishtirokchida 5 000 + 200 000 (VIEWS_HIGH), 5-ishtirokchining belgili videosi ham hisobga olinadi (TARGET).
  const bySubmitted = draws.preview(settings());
  assert.deepEqual(nonZero(bySubmitted.excluded), { OUT_OF_PERIOD: 1, VIEWS_LOW: 1, VIEWS_HIGH: 2, TARGET: 2 });
  assert.deepEqual(
    bySubmitted.sample.map((c) => [c.participantId, c.views]),
    [
      ["1", 1_900],
      ["7", 1_300],
    ],
  );
});

test("a draw picks winners and reserves that anyone can re-check with the seed", () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 10; id++) add(id, { views: 1_000 + id * 100 });
  const draw = draws.run(settings(), "Admin");

  assert.equal(draw.status, "DRAFT");
  assert.equal(draw.winners, 3);
  assert.equal(draw.reserves, 2);
  assert.equal(draw.poolSize, 10);
  assert.match(draw.seed, /^[0-9a-f]{32}$/);

  // Tekshiruv: id bo'yicha saralangan nomzodlarni shu seed bilan aralashtirsak — xuddi shu tartib.
  const ids = Array.from({ length: 10 }, (_, i) => String(i + 1)).sort();
  const replay = seededShuffle(ids, draw.seed);
  assert.deepEqual(
    [...draw.winnerEntries, ...draw.reserveEntries].map((e) => e.candidate.participantId),
    replay.slice(0, 5),
  );

  // Bir davr uchun ikkinchi tanlov — faqat birinchisi bekor qilinsa.
  assert.equal(status(() => draws.run(settings(), "Admin")), 409);
  draws.cancel(draw.id, "Sanalar noto'g'ri", "Admin");
  assert.equal(draws.run(settings(), "Admin").number, 2);
});

test("a removed winner is replaced by the next reserve at the same position", () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 5; id++) add(id);
  const draw = draws.run(settings(), "Admin");
  const removed = draw.winnerEntries[1];
  const reserve = draw.reserveEntries[0];

  assert.equal(status(() => draws.replace(draw.id, removed.candidate.participantId, "yo'q", "Admin")), 400);
  const next = draws.replace(draw.id, removed.candidate.participantId, "Xarid tasdiqlanmadi", "Admin");
  const active = next.winnerEntries.filter((e) => e.state === "ACTIVE");
  assert.equal(active.length, 3);
  assert.equal(active[1].candidate.participantId, reserve.candidate.participantId);
  assert.equal(active[1].position, removed.position);
  assert.equal(next.reserves, 1);

  draws.replace(draw.id, active[0].candidate.participantId, "Qoidabuzarlik aniqlandi", "Admin");
  assert.equal(status(() => draws.replace(draw.id, active[2].candidate.participantId, "Yana bittasi", "Admin")), 409);
});

test("winners are notified through the bot only after confirmation; failures can be retried", async () => {
  const { draws, add, settings, sent, failFor, participants } = setup();
  for (let id = 1; id <= 3; id++) add(id);
  const draw = draws.run(settings({ reservesCount: 0 }), "Admin");
  await assert.rejects(draws.send(draw.id, "Admin"), (e: HttpException) => e.getStatus() === 409);

  draws.confirm(draw.id, "Admin");
  const [a, b, c] = draw.winnerEntries.map((e) => Number(e.candidate.participantId));
  participants.get(a)!.chatId = null;
  failFor.add(b);

  const result = await draws.send(draw.id, "Admin");
  assert.equal(result.status, "SENT");
  assert.deepEqual(result.delivery, { sent: 1, failed: 2, notSent: 0 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, c);
  assert.match(sent[0].text, new RegExp(`Tabriklaymiz, Ism${c}!`));
  assert.match(sent[0].text, /Korzinka xarid voucheri/);
  assert.match(sent[0].text, /1-bosqich \(27\.11\.2026 – 26\.12\.2026\)/);

  // Qayta yuborish — faqat xato bo'lganlarga.
  participants.get(a)!.chatId = a;
  failFor.clear();
  const retry = await draws.send(draw.id, "Admin");
  assert.deepEqual(retry.delivery, { sent: 3, failed: 0, notSent: 0 });
  assert.deepEqual(sent.map((m) => m.chatId).sort(), [a, b, c].sort());
  assert.equal(status(() => draws.cancel(draw.id, "Kech qoldi", "Admin")), 409);
});

test("monthly vouchers (6.1.5): previous winners are not excluded — a participant may win in several months", () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 5; id++) add(id, { posted: "2026-12-01" });
  const first = draws.run(settings({ winnersCount: 2, reservesCount: 0 }), "Admin");
  draws.confirm(first.id, "Admin");

  const custom = { stage: null, periodFrom: "2026-11-27", periodTo: "2026-12-25" } as const;
  // Bayroq yoqib yuborilsa ham — oylik voucherda o'chiriladi: oldingi g'oliblar yana qatnashadi.
  const preview = draws.preview(settings({ ...custom, excludePreviousWinners: true }));
  assert.equal(preview.eligibleCount, 5);
  assert.equal(preview.excluded.PREVIOUS_WINNER, 0);

  const second = draws.run(settings({ ...custom, winnersCount: 5, reservesCount: 0, excludePreviousWinners: true }), "Admin");
  assert.equal(second.settings.excludePreviousWinners, false);
  const firstWinners = first.winnerEntries.map((e) => e.candidate.participantId);
  const secondWinners = new Set(second.winnerEntries.map((e) => e.candidate.participantId));
  assert.ok(firstWinners.every((id) => secondWinners.has(id)), "1-tanlov g'oliblari 2-tanlovda ham yutdi");
});

test("main prizes (6.2): the whole contest, the offer's views range and quantity are forced; views add up", () => {
  const { draws, add, extra, main, settings, afterEnd } = setup();
  afterEnd();
  // 1: 3 000 000 + 1 500 000 = 4 500 000 — avtomobil oralig'ida (har bir video alohida — yo'q).
  add(1, { views: 3_000_000 });
  extra(1, "ONEB", { views: 1_500_000, posted: "2026-12-05" });
  add(2, { views: 4_100_000 });
  add(3, { views: 600_000 }); // iPhone
  add(4, { views: 3_900_000 }); // sayohat
  add(5, { views: 4_000_000 }); // sayohat (yuqori chegara kiradi)
  add(6, { views: 50_000 });

  const carPreview = draws.preview(main("car"));
  assert.equal(carPreview.eligibleCount, 2);
  assert.deepEqual(nonZero(carPreview.excluded), { VIEWS_LOW: 4 });
  assert.deepEqual(
    carPreview.sample.map((c) => [c.participantId, c.views, c.reelUrl]),
    [
      ["1", 4_500_000, "https://www.instagram.com/reel/CODE1/"],
      ["2", 4_100_000, "https://www.instagram.com/reel/CODE2/"],
    ],
  );
  assert.equal(draws.preview(main("travel")).eligibleCount, 2);

  // Admin boshqa qiymatlarni yuborsa ham — ofertadagilar qo'llanadi.
  const car = draws.run(
    settings({
      prizeId: mainPrizeId("car"),
      stage: 1,
      periodFrom: "2026-12-01",
      periodTo: "2026-12-02",
      dateBasis: "POSTED",
      minViews: 0,
      maxViews: 5,
      winnersCount: 50,
      reservesCount: 2,
      excludePreviousWinners: false,
    }),
    "Admin",
  );
  assert.deepEqual(
    [
      car.stage,
      car.periodFrom,
      car.periodTo,
      car.settings.dateBasis,
      car.settings.minViews,
      car.settings.maxViews,
      car.settings.winnersCount,
      car.settings.excludePreviousWinners,
    ],
    [null, "2026-11-27", "2027-02-27", "SUBMITTED", 4_000_001, DRAW_LIMITS.viewsMax, 1, true],
  );
  assert.equal(car.prizeTitle, "BYD Chazor avtomobili");
  assert.deepEqual([car.winners, car.reserves, car.poolSize], [1, 1, 2]);
  assert.equal(car.viewsAsOf, "2027-02-27", "yakuniy holat — aksiyaning oxirgi kuni (7.5)");

  // Har bir sovrin bo'yicha bitta amaldagi tanlov; oylik voucherlar qoldig'iga ta'sir qilmaydi.
  assert.equal(draws.mainDraw("car"), car);
  assert.equal(draws.mainDraw("phone"), null);
  assert.equal(status(() => draws.run(main("car"), "Admin")), 409);
  assert.equal(draws.stock()[0].draft, 0);
  draws.cancel(car.id, "Qayta o'tkaziladi", "Admin");
  assert.equal(draws.mainDraw("car"), null);
  const again = draws.run(main("car"), "Admin");
  assert.equal(draws.mainDraw("car"), again);
});

test("one main prize per person: another main draw's active winners (drafts too) are excluded; vouchers are not affected", () => {
  const { draws, add, extra, main, participants, settings, afterEnd } = setup();
  afterEnd();
  add(2, { views: 4_100_000 });
  add(3, { views: 600_000 });
  add(8, { views: 700_000 });

  const phone = draws.run(main("phone"), "Admin");
  assert.equal(phone.status, "DRAFT");
  assert.deepEqual(phone.winnerEntries.map((e) => e.candidate.participantId).sort(), ["3", "8"]);

  // 3-ishtirokchining ko'rishlari keyin avtomobil oralig'iga o'tdi (+ yangi video 22-dekabrda).
  participants
    .get(3)!
    .reels[0].history.push({ date: "2026-12-21", at: at("2026-12-21"), views: 4_200_000, likes: 100, comments: 5 });
  extra(3, "THREEB", { views: 50_000, posted: "2026-12-22", submitted: "2026-12-22" });

  const car = draws.preview(main("car"));
  assert.deepEqual(car.sample.map((c) => c.participantId), ["2"]);
  assert.deepEqual(nonZero(car.excluded), { VIEWS_LOW: 1, PREVIOUS_WINNER: 1 });

  // Asosiy sovrin g'olibi oylik voucherda qatnashaveradi (davrga kirgan videolari bo'yicha).
  const voucher = draws.preview(settings({ stage: null, periodFrom: "2026-12-22", periodTo: "2026-12-26" }));
  assert.equal(voucher.excluded.PREVIOUS_WINNER, 0);
  assert.deepEqual(voucher.sample.map((c) => [c.participantId, c.views]), [["3", 50_000]]);

  // Bekor qilingan tanlov g'oliblari yana qatnasha oladi.
  draws.cancel(phone.id, "Xato o'tkazildi", "Admin");
  const afterCancel = draws.preview(main("car"));
  assert.equal(afterCancel.eligibleCount, 2);
  assert.equal(afterCancel.excluded.PREVIOUS_WINNER, 0);
});

test("settings are saved once and reused as defaults; invalid ones are refused", () => {
  const { draws } = setup();
  assert.equal(draws.setup().saved, null);
  assert.equal(draws.setup().defaults.dateBasis, "SUBMITTED");
  assert.equal(draws.setup().defaults.excludePreviousWinners, false);

  const input = {
    dateBasis: "POSTED" as const,
    minViews: 2_000,
    maxViews: 90_000,
    winnersCount: 250,
    reservesCount: 20,
    excludeWarned: true,
    excludeTargets: false,
    messageTemplate: "  Tabriklaymiz, {ism}! Siz {sovrin} yutdingiz.  ",
  };
  const saved = draws.saveSettings(input, "Bosh Admin");
  assert.equal(saved.excludePreviousWinners, false);
  assert.equal(saved.updatedBy, "Bosh Admin");
  assert.equal(saved.messageTemplate, "Tabriklaymiz, {ism}! Siz {sovrin} yutdingiz.");

  const s = draws.setup();
  assert.deepEqual(s.saved, saved);
  assert.deepEqual(
    [s.defaults.dateBasis, s.defaults.minViews, s.defaults.maxViews, s.defaults.winnersCount, s.defaults.reservesCount],
    ["POSTED", 2_000, 90_000, 250, 20],
  );
  assert.deepEqual([s.defaults.excludeWarned, s.defaults.excludeTargets, s.defaults.excludePreviousWinners], [true, false, false]);
  // Bosqich va davr har safar alohida tanlanadi — saqlanmaydi.
  assert.equal(s.defaults.stage, 1);

  assert.equal(status(() => draws.saveSettings({ ...input, maxViews: 100 }, "Admin")), 400);
  assert.equal(status(() => draws.saveSettings({ ...input, winnersCount: 0 }, "Admin")), 400);
  assert.equal(status(() => draws.saveSettings({ ...input, messageTemplate: "{noma'lum} 1234567890" }, "Admin")), 400);
  assert.deepEqual(draws.setup().saved, saved, "xato bo'lsa — eskisi qoladi");
});

test("stock: drafts do not reduce the remaining vouchers, confirmed and sent ones do; cancelled are ignored", async () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 6; id++) add(id);

  const fresh = draws.stock()[0];
  assert.equal(fresh.title, "Korzinka xarid voucheri");
  assert.equal(fresh.total, 600);
  assert.equal(fresh.remaining, 600);
  assert.deepEqual(
    fresh.stages.map((s) => [s.index, s.quantity, s.finished]),
    [
      [1, 200, true],
      [2, 200, false],
      [3, 200, false],
    ],
  );

  const draft = draws.run(settings({ reservesCount: 0 }), "Admin");
  let stock = draws.stock()[0];
  assert.deepEqual([stock.draft, stock.remaining], [3, 600]);
  assert.equal(stock.stages[0].draft, 3);

  draws.confirm(draft.id, "Admin");
  stock = draws.stock()[0];
  assert.deepEqual([stock.draft, stock.confirmed, stock.remaining], [0, 3, 597]);

  await draws.send(draft.id, "Admin");
  stock = draws.stock()[0];
  assert.deepEqual([stock.confirmed, stock.sent, stock.remaining], [0, 3, 597]);
  assert.equal(stock.stages[0].sent, 3);

  // Boshqa davr uchun qoralama bekor qilinsa — hisobga kirmaydi.
  const other = draws.run(settings({ stage: null, periodFrom: "2026-11-27", periodTo: "2026-12-25", reservesCount: 0 }), "Admin");
  draws.cancel(other.id, "Sinov uchun edi", "Admin");
  assert.deepEqual(draws.stock()[0], stock);
});

test("admin-made periods: validated inside the contest, no duplicates, listed in setup, editable and deletable", () => {
  const { draws } = setup();
  const created = draws.createPeriod({ title: "  Yangi yil bonusi ", startsOn: "2026-12-20", endsOn: "2027-01-10" }, "Admin");
  assert.equal(created.title, "Yangi yil bonusi");
  assert.deepEqual(draws.setup().periods.map((p) => p.id), [created.id]);

  // Nom qisqa, sanalar teskari, muddatdan tashqarida — 400; bosqich yoki boshqa davr bilan bir xil — 409.
  assert.equal(status(() => draws.createPeriod({ title: "A", startsOn: "2026-12-01", endsOn: "2026-12-05" }, "Admin")), 400);
  assert.equal(status(() => draws.createPeriod({ title: "Teskari", startsOn: "2026-12-05", endsOn: "2026-12-01" }, "Admin")), 400);
  assert.equal(status(() => draws.createPeriod({ title: "Erta", startsOn: "2026-11-26", endsOn: "2026-11-30" }, "Admin")), 400);
  assert.equal(status(() => draws.createPeriod({ title: "Kech", startsOn: "2027-02-20", endsOn: "2027-02-28" }, "Admin")), 400);
  assert.equal(status(() => draws.createPeriod({ title: "Bosqich", startsOn: "2026-11-27", endsOn: "2026-12-26" }, "Admin")), 409);
  assert.equal(status(() => draws.createPeriod({ title: "Takror", startsOn: "2026-12-20", endsOn: "2027-01-10" }, "Admin")), 409);

  const early = draws.createPeriod({ title: "Dekabr boshi", startsOn: "2026-12-01", endsOn: "2026-12-10" }, "Admin");
  assert.deepEqual(draws.listPeriods().map((p) => p.title), ["Dekabr boshi", "Yangi yil bonusi"]);

  // O'zini o'zi bilan solishtirmaydi: shu sanalar bilan nomini o'zgartirish mumkin.
  const renamed = draws.updatePeriod(early.id, { title: "Dekabr 1-dekada", startsOn: "2026-12-01", endsOn: "2026-12-10" }, "Admin");
  assert.equal(renamed.title, "Dekabr 1-dekada");
  assert.equal(renamed.updatedBy, "Admin");

  draws.deletePeriod(created.id, "Admin");
  assert.deepEqual(draws.listPeriods().map((p) => p.id), [early.id]);
  assert.equal(status(() => draws.deletePeriod(created.id, "Admin")), 404);
});

test("stages can be deleted and restored: hidden from setup, stock and the Mini App; used stages are kept", () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 4; id++) add(id);

  const removed = draws.deleteStage(2, "Admin");
  assert.deepEqual([removed.startsOn, removed.endsOn], ["2026-12-27", "2027-01-26"]);
  assert.deepEqual(draws.setup().stages.map((s) => s.index), [1, 3], "raqamlar o'zgarmaydi");
  assert.deepEqual(draws.setup().removedStages.map((s) => s.index), [2]);
  const stock = draws.stock()[0];
  assert.equal(stock.total, 400);
  assert.deepEqual(stock.stages.map((s) => s.index), [1, 3]);
  const prizes = draws.publicPrizes();
  assert.equal(prizes.stages.length, 2);
  assert.equal(prizes.monthly.total, 400);

  // O'chirilgan bosqichni tanlab bo'lmaydi; uning sanalari bilan davr yaratish mumkin.
  assert.equal(status(() => draws.run(settings({ stage: 2, periodFrom: "2026-12-27", periodTo: "2027-01-26" }), "Admin")), 400);
  assert.equal(status(() => draws.deleteStage(2, "Admin")), 404);

  // Tanlov o'tkazilgan bosqich o'chirilmaydi; bekor qilingach — mumkin.
  const draw = draws.run(settings({ reservesCount: 0 }), "Admin");
  assert.equal(draw.stage, 1);
  assert.equal(status(() => draws.deleteStage(1, "Admin")), 409);
  draws.cancel(draw.id, "Sinov uchun edi", "Admin");
  draws.deleteStage(1, "Admin");
  // Oxirgi bosqich qolishi shart.
  assert.equal(status(() => draws.deleteStage(3, "Admin")), 409);

  draws.restoreStage(2, "Admin");
  draws.restoreStage(1, "Admin");
  assert.deepEqual(draws.setup().stages.map((s) => s.index), [1, 2, 3]);
  assert.equal(draws.stock()[0].total, 600);
  assert.equal(status(() => draws.restoreStage(1, "Admin")), 404);
});

test("main prizes are drawn only after the promotion ends (6.2.1); the car draw is not sent from here", async () => {
  const { draws, add, main, afterEnd } = setup();
  add(2, { views: 4_100_000 });
  add(3, { views: 600_000 });
  assert.throws(() => draws.run(main("car"), "Admin"), /tugagach/);
  assert.equal(draws.preview(main("car")).eligibleCount, 1, "oldindan ko'rish mumkin");
  afterEnd();
  const car = draws.run(main("car"), "Admin");
  draws.confirm(car.id, "Admin");
  await assert.rejects(() => draws.send(car.id, "Admin"), /G'oliblar/);
  const phone = draws.confirm(draws.run(main("phone"), "Admin").id, "Admin");
  assert.equal((await draws.send(phone.id, "Admin")).status, "SENT");
  assert.deepEqual(draws.list().map((d) => d.prizeId).sort(), ["main-car", "main-phone"]);
});

test("saved monthly settings from before the offer move to 200 winners, registration date and multi-month wins once", () => {
  const dir = mkdtempSync(join(tmpdir(), "draws-"));
  try {
    const old = {
      draws: [],
      periods: [],
      periodSeq: 0,
      removedStages: [],
      savedSettings: {
        dateBasis: "POSTED",
        minViews: 1_000,
        maxViews: 100_000,
        winnersCount: 300,
        reservesCount: 30,
        excludeWarned: false,
        excludeTargets: true,
        excludePreviousWinners: true,
        messageTemplate: "Tabriklaymiz, {ism}! {sovrin}",
        updatedAt: "2026-11-20T10:00:00.000Z",
        updatedBy: "Admin",
      },
    };
    writeFileSync(join(dir, "state.json"), encodeState({ version: 1, savedAt: new Date(), parts: { draws: old } }));
    const notifier: ParticipantNotifier = { notify: () => Promise.resolve() };
    const open = () => {
      const store = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
      return { store, draws: new DrawsService(new ParticipantsService(new RulesService()), notifier, null, store) };
    };
    const first = open();
    const saved = first.draws.setup().saved;
    assert.deepEqual(
      [saved?.winnersCount, saved?.reservesCount, saved?.dateBasis, saved?.excludePreviousWinners],
      [200, 20, "SUBMITTED", false],
    );
    first.draws.saveSettings({ ...saved!, dateBasis: "POSTED", winnersCount: 150 }, "Admin");
    first.store.flush();
    const second = open().draws.setup().saved;
    assert.deepEqual([second?.winnersCount, second?.dateBasis], [150, "POSTED"], "admin tanlovi qayta o'zgarmaydi");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
