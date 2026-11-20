import assert from "node:assert/strict";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import type { ParticipantNotifier } from "../telegram/notifier";
import { DEFAULT_DRAW_MESSAGE, seededShuffle, type DrawSettings } from "./draw-rules";
import { DrawsService } from "./draws.service";

const at = (day: string) => new Date(`${day}T10:00:00+05:00`);

/** 1-bosqich: 25.11–24.12.2026; "bugun" — 26.12 (bosqich tugagan). */
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
  const draws = new DrawsService(participants, notifier, { clock: () => at("2026-12-26"), sendIntervalMs: 0 });

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

  const settings = (patch: Partial<DrawSettings> = {}): DrawSettings => ({
    ...(draws.setup().defaults as DrawSettings),
    winnersCount: 3,
    reservesCount: 2,
    messageTemplate: DEFAULT_DRAW_MESSAGE,
    ...patch,
  });
  return { participants, draws, add, settings, sent, failFor };
}

const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
  return 0;
};

test("setup offers the last finished stage and the monthly voucher defaults", () => {
  const { draws } = setup();
  const s = draws.setup();
  assert.equal(s.defaults.stage, 1);
  assert.equal(s.defaults.periodFrom, "2026-11-25");
  assert.equal(s.defaults.periodTo, "2026-12-24");
  assert.equal(s.defaults.minViews, 1_000);
  assert.equal(s.defaults.maxViews, 100_000);
  assert.equal(s.defaults.winnersCount, 300);
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

  const posted = draws.preview(settings());
  assert.equal(posted.eligibleCount, 1);
  assert.equal(posted.viewsAsOf, "2026-12-24");
  assert.deepEqual(
    Object.fromEntries(Object.entries(posted.excluded).filter(([, n]) => n > 0)),
    { OUT_OF_PERIOD: 1, VIEWS_LOW: 1, VIEWS_HIGH: 1, NOT_ACCEPTED: 1, TARGET: 1, STATUS: 1 },
  );

  // Ilovaga yuborilgan sana bo'yicha 2-ishtirokchi ham kiradi; target istisnosi o'chirilsa — 6-si ham.
  const submitted = draws.preview(settings({ dateBasis: "SUBMITTED", excludeTargets: false }));
  assert.equal(submitted.eligibleCount, 3);
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
  assert.match(sent[0].text, /Korzinka voucheri/);
  assert.match(sent[0].text, /1-bosqich \(25\.11\.2026 – 24\.12\.2026\)/);

  // Qayta yuborish — faqat xato bo'lganlarga.
  participants.get(a)!.chatId = a;
  failFor.clear();
  const retry = await draws.send(draw.id, "Admin");
  assert.deepEqual(retry.delivery, { sent: 3, failed: 0, notSent: 0 });
  assert.deepEqual(sent.map((m) => m.chatId).sort(), [a, b, c].sort());
  assert.equal(status(() => draws.cancel(draw.id, "Kech qoldi", "Admin")), 409);
});

test("previous winners can be excluded from the next stage", () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 4; id++) add(id, { posted: "2026-12-01" });
  const first = draws.run(settings({ winnersCount: 2, reservesCount: 0 }), "Admin");
  draws.confirm(first.id, "Admin");

  const custom = { stage: null, periodFrom: "2026-11-25", periodTo: "2026-12-25" } as const;
  const preview = draws.preview(settings({ ...custom, excludePreviousWinners: true }));
  assert.equal(preview.eligibleCount, 2);
  assert.equal(preview.excluded.PREVIOUS_WINNER, 2);
});

test("stock: drafts do not reduce the remaining vouchers, confirmed and sent ones do; cancelled are ignored", async () => {
  const { draws, add, settings } = setup();
  for (let id = 1; id <= 6; id++) add(id);

  const fresh = draws.stock()[0];
  assert.equal(fresh.total, 900);
  assert.equal(fresh.remaining, 900);
  assert.deepEqual(
    fresh.stages.map((s) => [s.index, s.quantity, s.finished]),
    [
      [1, 300, true],
      [2, 300, false],
      [3, 300, false],
    ],
  );

  const draft = draws.run(settings({ reservesCount: 0 }), "Admin");
  let stock = draws.stock()[0];
  assert.deepEqual([stock.draft, stock.remaining], [3, 900]);
  assert.equal(stock.stages[0].draft, 3);

  draws.confirm(draft.id, "Admin");
  stock = draws.stock()[0];
  assert.deepEqual([stock.draft, stock.confirmed, stock.remaining], [0, 3, 897]);

  await draws.send(draft.id, "Admin");
  stock = draws.stock()[0];
  assert.deepEqual([stock.confirmed, stock.sent, stock.remaining], [0, 3, 897]);
  assert.equal(stock.stages[0].sent, 3);

  // Boshqa davr uchun qoralama bekor qilinsa — hisobga kirmaydi.
  const other = draws.run(settings({ stage: null, periodFrom: "2026-11-25", periodTo: "2026-12-25", reservesCount: 0 }), "Admin");
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
  assert.equal(status(() => draws.createPeriod({ title: "Erta", startsOn: "2026-11-01", endsOn: "2026-11-30" }, "Admin")), 400);
  assert.equal(status(() => draws.createPeriod({ title: "Bosqich", startsOn: "2026-11-25", endsOn: "2026-12-24" }, "Admin")), 409);
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
  assert.deepEqual([removed.startsOn, removed.endsOn], ["2026-12-25", "2027-01-24"]);
  assert.deepEqual(draws.setup().stages.map((s) => s.index), [1, 3], "raqamlar o'zgarmaydi");
  assert.deepEqual(draws.setup().removedStages.map((s) => s.index), [2]);
  const stock = draws.stock()[0];
  assert.equal(stock.total, 600);
  assert.deepEqual(stock.stages.map((s) => s.index), [1, 3]);
  const prizes = draws.publicPrizes();
  assert.equal(prizes.stages.length, 2);
  assert.equal(prizes.monthly.total, 600);

  // O'chirilgan bosqichni tanlab bo'lmaydi; uning sanalari bilan davr yaratish mumkin.
  assert.equal(status(() => draws.run(settings({ stage: 2, periodFrom: "2026-12-25", periodTo: "2027-01-24" }), "Admin")), 400);
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
  assert.equal(draws.stock()[0].total, 900);
  assert.equal(status(() => draws.restoreStage(1, "Admin")), 404);
});
