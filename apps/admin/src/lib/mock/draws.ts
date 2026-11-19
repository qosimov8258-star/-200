/**
 * MOCK backend: oylik voucherlar uchun random tanlov. Haqiqiy backendda:
 *   GET  /api/v1/admin/draws/setup
 *   POST /api/v1/admin/draws/preview
 *   POST /api/v1/admin/draws
 *   GET  /api/v1/admin/draws
 *   GET  /api/v1/admin/draws/:id
 *   POST /api/v1/admin/draws/:id/replace
 *   POST /api/v1/admin/draws/:id/confirm
 *   POST /api/v1/admin/draws/:id/cancel
 *   POST /api/v1/admin/draws/:id/send      (g'oliblarga Telegram bot orqali)
 */
import { ApiError } from "../api-error";
import { addDays } from "../dates";
import {
  contestStages,
  createSeed,
  DEFAULT_DRAW_MESSAGE,
  DRAW_PLACEHOLDERS,
  fingerprint,
  periodLabel,
  seededShuffle,
  stageLabel,
  validateDrawPeriod,
  validateDrawSettings,
} from "../draw-rules";
import { formatNumber } from "../format";
import type {
  AdminUser,
  DrawCancelRequest,
  DrawCandidate,
  DrawEntry,
  DrawPeriod,
  DrawPeriodInput,
  DrawExclusion,
  DrawPreview,
  DrawReplaceRequest,
  DrawSettings,
  DrawSetup,
  DrawStatus,
  DrawStock,
  IsoDate,
  Prize,
  VoucherDraw,
  VoucherDrawSummary,
} from "../types";
import { getContestData, reelStatusOn, type MockReel } from "./contest";
import { effectivePrizes } from "./prizes";
import { hashString } from "./random";
import { effectiveStatus } from "./ranking";
import { effectiveSettings } from "./settings";
import { auditId, readStore, storeFits, writeStore, type MockStore } from "./store";
import { activeTargetParticipants } from "./targets";

const SAMPLE_SIZE = 20;
const MIN_REASON_LENGTH = 5;
/** Mock: birinchi yuborishda botni bloklagan ishtirokchilar ulushi (%). */
const MOCK_FAIL_PERCENT = 4;
/** Mock: qayta yuborganda ham yetkazilmaydiganlar (botni butunlay o'chirgan). */
const MOCK_PERMANENT_FAIL_PERCENT = 1;

const EXCLUSIONS: DrawExclusion[] = [
  "NOT_ACCEPTED",
  "OUT_OF_PERIOD",
  "VIEWS_LOW",
  "VIEWS_HIGH",
  "STATUS",
  "WARNED",
  "TARGET",
  "PREVIOUS_WINNER",
];

// ---------------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------------

function monthlyPrizes(store: MockStore): Prize[] {
  return effectivePrizes(store).filter((prize) => prize.kind === "MONTHLY");
}

function stages(store: MockStore) {
  const data = getContestData();
  const settings = effectiveSettings(store);
  return contestStages(settings.startsOn, settings.endsOn, data.today);
}

/** Mock'da Instagram'da joylangan sana yo'q — ilovaga yuborilishidan 0–2 kun oldin deb olamiz. */
function postedOn(reel: MockReel): IsoDate {
  return addDays(reel.submittedOn, -(hashString(reel.id) % 3));
}

/** `date` kunigacha (shu kun ham) yig'ilgan oxirgi ko'rishlar. */
function viewsOn(reel: MockReel, date: IsoDate): number {
  let views = 0;
  for (const [day, total] of reel.viewsByDay) {
    if (day > date) break;
    views = total;
  }
  return views;
}

function drawsOf(store: MockStore): VoucherDraw[] {
  return store.draws ?? [];
}

function findDraw(store: MockStore, id: string): VoucherDraw {
  const draw = drawsOf(store).find((item) => item.id === id);
  if (!draw) throw new ApiError(404, "Tanlov topilmadi.");
  return draw;
}

/** Shu sovg'ani oldingi (bekor qilinmagan, tasdiqlangan) tanlovlarda yutganlar. */
function previousWinnerIds(store: MockStore, prizeId: string, exceptId?: string): Set<string> {
  const ids = new Set<string>();
  for (const draw of drawsOf(store)) {
    if (draw.id === exceptId || draw.settings.prizeId !== prizeId) continue;
    if (draw.status !== "CONFIRMED" && draw.status !== "SENT") continue;
    for (const entry of draw.winnerEntries) {
      if (entry.state === "ACTIVE") ids.add(entry.candidate.participantId);
    }
  }
  return ids;
}

/** Bir xil sovg'a va davr uchun bekor qilinmagan tanlov. */
function activeDrawFor(store: MockStore, settings: DrawSettings): VoucherDraw | null {
  return (
    drawsOf(store).find(
      (draw) =>
        draw.status !== "CANCELLED" &&
        draw.settings.prizeId === settings.prizeId &&
        draw.settings.periodFrom === settings.periodFrom &&
        draw.settings.periodTo === settings.periodTo,
    ) ?? null
  );
}

function cleanSettings(settings: DrawSettings, store: MockStore): DrawSettings {
  const clean: DrawSettings = {
    prizeId: String(settings.prizeId),
    stage: settings.stage === null ? null : Number(settings.stage),
    periodFrom: String(settings.periodFrom),
    periodTo: String(settings.periodTo),
    dateBasis: settings.dateBasis === "SUBMITTED" ? "SUBMITTED" : "POSTED",
    minViews: Number(settings.minViews),
    maxViews: Number(settings.maxViews),
    winnersCount: Number(settings.winnersCount),
    reservesCount: Number(settings.reservesCount),
    excludeWarned: Boolean(settings.excludeWarned),
    excludeTargets: Boolean(settings.excludeTargets),
    excludePreviousWinners: Boolean(settings.excludePreviousWinners),
    messageTemplate: String(settings.messageTemplate ?? "").trim(),
  };
  const errors = Object.values(validateDrawSettings(clean));
  if (errors.length > 0) throw new ApiError(400, errors[0] ?? "Sozlamalar noto'g'ri.");
  if (!monthlyPrizes(store).some((prize) => prize.id === clean.prizeId)) {
    throw new ApiError(400, "Oylik sovg'a tanlanmagan.");
  }
  if (clean.stage !== null && !stages(store).some((stage) => stage.index === clean.stage)) {
    throw new ApiError(400, "Bunday bosqich yo'q.");
  }
  return clean;
}

interface Pool {
  viewsAsOf: IsoDate;
  totalReels: number;
  eligible: DrawCandidate[];
  excluded: Record<DrawExclusion, number>;
}

/** Talabga javob beradigan nomzodlar va chetda qolganlar soni (birinchi sabab bo'yicha). */
function buildPool(settings: DrawSettings, store: MockStore, exceptDrawId?: string): Pool {
  const data = getContestData();
  const viewsAsOf = settings.periodTo < data.today ? settings.periodTo : data.today;
  const participants = new Map(data.participants.map((item) => [item.id, item]));
  const targets = activeTargetParticipants(store, viewsAsOf);
  const previous = settings.excludePreviousWinners
    ? previousWinnerIds(store, settings.prizeId, exceptDrawId)
    : new Set<string>();
  const excluded = Object.fromEntries(EXCLUSIONS.map((key) => [key, 0])) as Record<DrawExclusion, number>;
  const eligible: DrawCandidate[] = [];

  for (const reel of data.reels) {
    const participant = participants.get(reel.participantId);
    if (!participant) continue;
    const exclude = (reason: DrawExclusion) => {
      excluded[reason] += 1;
    };
    if (reelStatusOn(reel, viewsAsOf) !== "ACCEPTED") {
      exclude("NOT_ACCEPTED");
      continue;
    }
    const posted = postedOn(reel);
    const day = settings.dateBasis === "POSTED" ? posted : reel.submittedOn;
    if (day < settings.periodFrom || day > settings.periodTo) {
      exclude("OUT_OF_PERIOD");
      continue;
    }
    const views = viewsOn(reel, viewsAsOf);
    if (views < settings.minViews) {
      exclude("VIEWS_LOW");
      continue;
    }
    if (views > settings.maxViews) {
      exclude("VIEWS_HIGH");
      continue;
    }
    const status = effectiveStatus(participant, store);
    if (status === "BLOCKED" || status === "DISQUALIFIED") {
      exclude("STATUS");
      continue;
    }
    if (settings.excludeWarned && status === "WARNED") {
      exclude("WARNED");
      continue;
    }
    if (settings.excludeTargets && targets.has(participant.id)) {
      exclude("TARGET");
      continue;
    }
    if (previous.has(participant.id)) {
      exclude("PREVIOUS_WINNER");
      continue;
    }
    eligible.push({
      participantId: participant.id,
      firstName: participant.firstName,
      lastName: participant.lastName,
      phone: participant.phone,
      instagramUsername: participant.instagramUsername,
      reelUrl: reel.url,
      views,
      postedOn: posted,
      submittedOn: reel.submittedOn,
    });
  }

  // Tartib tasodifga bog'liq bo'lmasin — natijani qayta hisoblash uchun.
  eligible.sort((a, b) => a.participantId.localeCompare(b.participantId));
  return { viewsAsOf, totalReels: data.reels.length, eligible, excluded };
}

function summarize(draw: VoucherDraw): VoucherDrawSummary {
  const winners = draw.winnerEntries.filter((entry) => entry.state === "ACTIVE");
  return {
    id: draw.id,
    number: draw.number,
    prizeTitle: draw.prizeTitle,
    stage: draw.stage,
    periodFrom: draw.periodFrom,
    periodTo: draw.periodTo,
    status: draw.status,
    winners: winners.length,
    reserves: draw.reserveEntries.filter((entry) => entry.state === "ACTIVE").length,
    poolSize: draw.poolSize,
    createdAt: draw.createdAt,
    createdBy: draw.createdBy,
    delivery: {
      sent: winners.filter((entry) => entry.notify.status === "SENT").length,
      failed: winners.filter((entry) => entry.notify.status === "FAILED").length,
      notSent: winners.filter((entry) => entry.notify.status === "NOT_SENT").length,
    },
  };
}

/** Saqlashdan oldin xulosa maydonlarini yangilaydi. */
function withSummary(draw: VoucherDraw): VoucherDraw {
  return { ...draw, ...summarize(draw) };
}

function save(store: MockStore, draw: VoucherDraw, audit: Omit<MockStore["audit"][number], "id" | "at">): VoucherDraw {
  const next = withSummary(draw);
  const draws = drawsOf(store).some((item) => item.id === next.id)
    ? drawsOf(store).map((item) => (item.id === next.id ? next : item))
    : [...drawsOf(store), next];
  const updated: MockStore = {
    ...store,
    draws,
    audit: [...store.audit, { ...audit, id: auditId(), at: new Date().toISOString() }],
  };
  if (!storeFits(updated)) {
    throw new ApiError(413, "Brauzer xotirasi to'ldi — eski tanlovlarni o'chirish uchun mock ma'lumotni tozalang.");
  }
  writeStore(updated);
  return next;
}

const describe = (draw: VoucherDraw) =>
  `#${draw.number}: ${draw.prizeTitle}, ${stageLabel(draw.stage)} (${periodLabel(draw.periodFrom, draw.periodTo)})`;

// ---------------------------------------------------------------------------
// Ochiq funksiyalar
// ---------------------------------------------------------------------------

export function getDrawSetup(): DrawSetup {
  const store = readStore();
  const data = getContestData();
  const allStages = stages(store);
  const prizes = monthlyPrizes(store);
  // Oxirgi tugagan bosqich; hali hech biri tugamagan bo'lsa — joriysi.
  const stage =
    [...allStages].reverse().find((item) => item.finished) ??
    allStages.find((item) => item.startsOn <= data.today && data.today <= item.endsOn) ??
    allStages[0];
  const prize = prizes[0];

  return {
    today: data.today,
    stages: allStages,
    prizes: prizes.map(({ id, title, quantity, minViews, maxViews }) => ({ id, title, quantity, minViews, maxViews })),
    defaults: {
      prizeId: prize?.id ?? "",
      stage: stage?.index ?? null,
      periodFrom: stage?.startsOn ?? data.today,
      periodTo: stage?.endsOn ?? data.today,
      dateBasis: "POSTED",
      minViews: prize?.minViews ?? 0,
      maxViews: prize?.maxViews ?? 100_000,
      winnersCount: prize?.quantity ?? 1,
      reservesCount: Math.ceil((prize?.quantity ?? 10) / 10),
      excludeWarned: false,
      excludeTargets: true,
      excludePreviousWinners: false,
      messageTemplate: DEFAULT_DRAW_MESSAGE,
    },
    placeholders: DRAW_PLACEHOLDERS,
    periods: periodsOf(store),
  };
}

// ---------------------------------------------------------------------------
// Admin kalendardan yaratadigan davrlar
// ---------------------------------------------------------------------------

function periodsOf(store: MockStore): DrawPeriod[] {
  return [...(store.drawPeriods ?? [])].sort(
    (a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title),
  );
}

const describePeriod = (period: DrawPeriodInput) => `${period.title} (${periodLabel(period.startsOn, period.endsOn)})`;

/** Tanlov muddati ichida, bosqich yoki boshqa davr bilan sanalari bir xil emas (backend bilan bir xil). */
function checkPeriod(store: MockStore, input: DrawPeriodInput, exceptId?: string): DrawPeriodInput {
  const allStages = stages(store);
  const bounds = { min: allStages[0]?.startsOn ?? input.startsOn, max: allStages.at(-1)?.endsOn ?? input.endsOn };
  const errors = validateDrawPeriod(input, bounds);
  const first = Object.values(errors)[0];
  if (first) throw new ApiError(400, first);
  const clean = { title: input.title.trim(), startsOn: input.startsOn, endsOn: input.endsOn };
  const sameDates = (item: { startsOn: IsoDate; endsOn: IsoDate }) =>
    item.startsOn === clean.startsOn && item.endsOn === clean.endsOn;
  const stage = allStages.find(sameDates);
  if (stage) throw new ApiError(409, `Bu sanalar ${stage.index}-bosqich bilan bir xil — bosqichni tanlang.`);
  const twin = periodsOf(store).find((item) => item.id !== exceptId && sameDates(item));
  if (twin) throw new ApiError(409, `Bu sanalar uchun «${twin.title}» davri allaqachon bor.`);
  return clean;
}

function savePeriods(
  store: MockStore,
  drawPeriods: DrawPeriod[],
  audit: Omit<MockStore["audit"][number], "id" | "at">,
): void {
  writeStore({
    ...store,
    drawPeriods,
    audit: [...store.audit, { ...audit, id: auditId(), at: new Date().toISOString() }],
  });
}

export function createDrawPeriod(input: DrawPeriodInput, actor: AdminUser): DrawPeriod {
  const store = readStore();
  const clean = checkPeriod(store, input);
  const period: DrawPeriod = {
    id: `per_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    ...clean,
    createdAt: new Date().toISOString(),
    createdBy: actor.fullName,
    updatedAt: null,
    updatedBy: null,
  };
  savePeriods(store, [...(store.drawPeriods ?? []), period], {
    actorId: actor.id,
    actorName: actor.fullName,
    action: "draw.period.create",
    entity: "voucher_draw",
    entityId: period.id,
    before: "",
    after: describePeriod(period),
    reason: "",
  });
  return period;
}

export function updateDrawPeriod(id: string, input: DrawPeriodInput, actor: AdminUser): DrawPeriod {
  const store = readStore();
  const old = periodsOf(store).find((item) => item.id === id);
  if (!old) throw new ApiError(404, "Davr topilmadi.");
  const next: DrawPeriod = {
    ...old,
    ...checkPeriod(store, input, id),
    updatedAt: new Date().toISOString(),
    updatedBy: actor.fullName,
  };
  savePeriods(
    store,
    (store.drawPeriods ?? []).map((item) => (item.id === id ? next : item)),
    {
      actorId: actor.id,
      actorName: actor.fullName,
      action: "draw.period.update",
      entity: "voucher_draw",
      entityId: id,
      before: describePeriod(old),
      after: describePeriod(next),
      reason: "",
    },
  );
  return next;
}

/** O'tkazilgan tanlovlar o'z sanalarini saqlaydi — davr o'chsa ham ular o'zgarmaydi. */
export function deleteDrawPeriod(id: string, actor: AdminUser): void {
  const store = readStore();
  const old = periodsOf(store).find((item) => item.id === id);
  if (!old) throw new ApiError(404, "Davr topilmadi.");
  savePeriods(
    store,
    (store.drawPeriods ?? []).filter((item) => item.id !== id),
    {
      actorId: actor.id,
      actorName: actor.fullName,
      action: "draw.period.delete",
      entity: "voucher_draw",
      entityId: id,
      before: describePeriod(old),
      after: "",
      reason: "",
    },
  );
}

export function previewDraw(input: DrawSettings): DrawPreview {
  const store = readStore();
  const settings = cleanSettings(input, store);
  const pool = buildPool(settings, store);
  const data = getContestData();
  const prize = monthlyPrizes(store).find((item) => item.id === settings.prizeId);

  const warnings: string[] = [];
  const existing = activeDrawFor(store, settings);
  if (existing) {
    warnings.push(
      `Bu davr uchun #${existing.number} tanlov allaqachon o'tkazilgan. Yangisini o'tkazish uchun avval uni bekor qiling.`,
    );
  }
  if (settings.periodTo >= data.today) {
    warnings.push("Davr hali tugamagan — ko'rishlar bugungi holat bo'yicha olinadi va keyin o'zgarishi mumkin.");
  }
  if (pool.eligible.length === 0) {
    warnings.push("Talabga javob beradigan nomzod yo'q — sozlamalarni tekshiring.");
  } else if (pool.eligible.length <= settings.winnersCount) {
    warnings.push(
      `Nomzodlar (${formatNumber(pool.eligible.length)}) g'oliblar sonidan (${formatNumber(settings.winnersCount)}) ko'p emas — barcha nomzodlar g'olib bo'ladi, zaxira qolmaydi.`,
    );
  } else if (pool.eligible.length < settings.winnersCount + settings.reservesCount) {
    warnings.push(
      `Zaxira to'liq emas: ${formatNumber(pool.eligible.length - settings.winnersCount)} ta (${formatNumber(settings.reservesCount)} ta o'rniga).`,
    );
  }
  if (prize && prize.quantity !== settings.winnersCount) {
    warnings.push(
      `Bu sovg'a oyiga ${formatNumber(prize.quantity)} ta, siz ${formatNumber(settings.winnersCount)} ta g'olib tanlayapsiz.`,
    );
  }

  return {
    viewsAsOf: pool.viewsAsOf,
    totalReels: pool.totalReels,
    eligibleCount: pool.eligible.length,
    excluded: pool.excluded,
    poolHash: fingerprint(pool.eligible.map((item) => item.participantId)),
    sample: [...pool.eligible].sort((a, b) => b.views - a.views).slice(0, SAMPLE_SIZE),
    warnings,
  };
}

export function runDraw(input: DrawSettings, actor: AdminUser): VoucherDraw {
  const store = readStore();
  const settings = cleanSettings(input, store);
  const existing = activeDrawFor(store, settings);
  if (existing) {
    throw new ApiError(409, `Bu davr uchun #${existing.number} tanlov allaqachon bor — avval uni bekor qiling.`);
  }
  const pool = buildPool(settings, store);
  if (pool.eligible.length === 0) throw new ApiError(400, "Talabga javob beradigan nomzod yo'q.");

  const prize = monthlyPrizes(store).find((item) => item.id === settings.prizeId);
  const seed = createSeed();
  const shuffled = seededShuffle(pool.eligible, seed);
  const entry = (candidate: DrawCandidate, position: number): DrawEntry => ({
    position,
    state: "ACTIVE",
    candidate,
    replaced: null,
    promotedFor: null,
    notify: { status: "NOT_SENT", at: null, error: null },
  });
  const winners = shuffled.slice(0, settings.winnersCount).map((c, i) => entry(c, i + 1));
  const reserves = shuffled
    .slice(settings.winnersCount, settings.winnersCount + settings.reservesCount)
    .map((c, i) => entry(c, i + 1));

  const now = new Date().toISOString();
  const number = drawsOf(store).reduce((max, item) => Math.max(max, item.number), 0) + 1;
  const draw: VoucherDraw = {
    id: `drw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    number,
    prizeTitle: prize?.title ?? settings.prizeId,
    stage: settings.stage,
    periodFrom: settings.periodFrom,
    periodTo: settings.periodTo,
    status: "DRAFT",
    winners: 0,
    reserves: 0,
    poolSize: pool.eligible.length,
    createdAt: now,
    createdBy: actor.fullName,
    delivery: { sent: 0, failed: 0, notSent: 0 },
    settings,
    viewsAsOf: pool.viewsAsOf,
    seed,
    poolHash: fingerprint(pool.eligible.map((item) => item.participantId)),
    winnerEntries: winners,
    reserveEntries: reserves,
    confirmed: null,
    sent: null,
    cancelled: null,
  };

  return save(store, draw, {
    actorId: actor.id,
    actorName: actor.fullName,
    action: "draw.run",
    entity: "voucher_draw",
    entityId: draw.id,
    before: "",
    after: `${describe(draw)}: ${formatNumber(winners.length)} g'olib, ${formatNumber(reserves.length)} zaxira, ${formatNumber(pool.eligible.length)} nomzod`,
    reason: `seed ${seed}`,
  });
}

/** Voucherlar qoldig'i — har bir oylik sovg'a uchun (bosqichlar bo'yicha ham). */
export function getDrawStock(): DrawStock[] {
  const store = readStore();
  const allStages = stages(store);
  const live = drawsOf(store)
    .map(withSummary)
    .filter((draw) => draw.status !== "CANCELLED");

  return monthlyPrizes(store).map((prize) => {
    const own = live.filter((draw) => draw.settings.prizeId === prize.id);
    const count = (status: DrawStatus, stage?: number) =>
      own
        .filter((draw) => draw.status === status && (stage === undefined || draw.stage === stage))
        .reduce((sum, draw) => sum + draw.winners, 0);
    const total = prize.quantity * allStages.length;
    const sent = count("SENT");
    const confirmed = count("CONFIRMED");
    return {
      prizeId: prize.id,
      title: prize.title,
      total,
      sent,
      confirmed,
      draft: count("DRAFT"),
      remaining: Math.max(0, total - sent - confirmed),
      stages: allStages.map((stage) => ({
        ...stage,
        quantity: prize.quantity,
        sent: count("SENT", stage.index),
        confirmed: count("CONFIRMED", stage.index),
        draft: count("DRAFT", stage.index),
      })),
    };
  });
}

export function listDraws(): VoucherDrawSummary[] {
  return drawsOf(readStore())
    .map(summarize)
    .sort((a, b) => b.number - a.number);
}

export function getDraw(id: string): VoucherDraw {
  return withSummary(findDraw(readStore(), id));
}

export function replaceDrawWinner(id: string, request: DrawReplaceRequest, actor: AdminUser): VoucherDraw {
  const store = readStore();
  const draw = findDraw(store, id);
  const reason = String(request.reason ?? "").trim();
  if (draw.status === "CANCELLED") throw new ApiError(409, "Tanlov bekor qilingan.");
  if (reason.length < MIN_REASON_LENGTH) throw new ApiError(400, "Sababni yozing (kamida 5 belgi).");

  const index = draw.winnerEntries.findIndex(
    (entry) => entry.state === "ACTIVE" && entry.candidate.participantId === request.participantId,
  );
  if (index < 0) throw new ApiError(404, "Bu ishtirokchi faol g'oliblar orasida yo'q.");
  const reserve = draw.reserveEntries.find((entry) => entry.state === "ACTIVE");
  if (!reserve) throw new ApiError(409, "Zaxira qolmadi — o'rniga beradigan nomzod yo'q.");

  const now = new Date().toISOString();
  const old = draw.winnerEntries[index];
  const replacedEntry: DrawEntry = {
    ...old,
    state: "REPLACED",
    replaced: { at: now, by: actor.fullName, reason, replacementId: reserve.candidate.participantId },
  };
  const promoted: DrawEntry = {
    position: old.position,
    state: "ACTIVE",
    candidate: reserve.candidate,
    replaced: null,
    promotedFor: old.candidate.participantId,
    notify: { status: "NOT_SENT", at: null, error: null },
  };
  const winnerEntries = [...draw.winnerEntries];
  winnerEntries.splice(index, 1, replacedEntry, promoted);

  const next: VoucherDraw = {
    ...draw,
    winnerEntries,
    reserveEntries: draw.reserveEntries.map((entry) =>
      entry === reserve ? { ...entry, state: "PROMOTED", promotedFor: old.candidate.participantId } : entry,
    ),
  };
  const name = (c: DrawCandidate) => `${c.firstName} ${c.lastName}`;
  return save(store, next, {
    actorId: actor.id,
    actorName: actor.fullName,
    action: "draw.replace",
    entity: "voucher_draw",
    entityId: draw.id,
    before: `${old.position}-g'olib: ${name(old.candidate)}`,
    after: `${old.position}-g'olib: ${name(reserve.candidate)} (zaxira #${reserve.position})`,
    reason,
  });
}

export function confirmDraw(id: string, actor: AdminUser): VoucherDraw {
  const store = readStore();
  const draw = findDraw(store, id);
  if (draw.status !== "DRAFT") throw new ApiError(409, "Faqat qoralama holatidagi tanlov tasdiqlanadi.");
  return save(
    store,
    { ...draw, status: "CONFIRMED", confirmed: { at: new Date().toISOString(), by: actor.fullName } },
    {
      actorId: actor.id,
      actorName: actor.fullName,
      action: "draw.confirm",
      entity: "voucher_draw",
      entityId: draw.id,
      before: "DRAFT",
      after: "CONFIRMED",
      reason: "",
    },
  );
}

export function cancelDraw(id: string, request: DrawCancelRequest, actor: AdminUser): VoucherDraw {
  const store = readStore();
  const draw = findDraw(store, id);
  const reason = String(request.reason ?? "").trim();
  if (draw.status !== "DRAFT" && draw.status !== "CONFIRMED") {
    throw new ApiError(409, "G'oliblarga xabar yuborilgan tanlovni bekor qilib bo'lmaydi.");
  }
  if (reason.length < MIN_REASON_LENGTH) throw new ApiError(400, "Sababni yozing (kamida 5 belgi).");
  return save(
    store,
    { ...draw, status: "CANCELLED", cancelled: { at: new Date().toISOString(), by: actor.fullName, reason } },
    {
      actorId: actor.id,
      actorName: actor.fullName,
      action: "draw.cancel",
      entity: "voucher_draw",
      entityId: draw.id,
      before: draw.status,
      after: "CANCELLED",
      reason,
    },
  );
}

/** Faol g'oliblarga (hali yuborilmagan yoki xato bo'lganlarga) bot orqali xabar. */
export function sendDraw(id: string, actor: AdminUser): VoucherDraw {
  const store = readStore();
  const draw = findDraw(store, id);
  if (draw.status !== "CONFIRMED" && draw.status !== "SENT") {
    throw new ApiError(409, "Avval natijani tasdiqlang.");
  }
  const now = new Date().toISOString();
  let sent = 0;
  let failed = 0;
  const winnerEntries = draw.winnerEntries.map((entry): DrawEntry => {
    if (entry.state !== "ACTIVE" || entry.notify.status === "SENT") return entry;
    const roll = hashString(`${draw.id}:${entry.candidate.participantId}`) % 100;
    const fails = entry.notify.status === "FAILED" ? roll < MOCK_PERMANENT_FAIL_PERCENT : roll < MOCK_FAIL_PERCENT;
    if (fails) {
      failed += 1;
      return { ...entry, notify: { status: "FAILED", at: now, error: "Ishtirokchi botni bloklagan" } };
    }
    sent += 1;
    return { ...entry, notify: { status: "SENT", at: now, error: null } };
  });
  if (sent + failed === 0) throw new ApiError(409, "Yuboriladigan xabar qolmadi.");

  return save(
    store,
    { ...draw, status: "SENT", winnerEntries, sent: draw.sent ?? { at: now, by: actor.fullName } },
    {
      actorId: actor.id,
      actorName: actor.fullName,
      action: "draw.send",
      entity: "voucher_draw",
      entityId: draw.id,
      before: draw.status,
      after: `${formatNumber(sent)} ta yuborildi${failed > 0 ? `, ${formatNumber(failed)} ta xato` : ""}`,
      reason: "",
    },
  );
}
