import { addDays, contestDay } from "../common/time";
import type { Participant } from "../participants/participants.service";
import type { TargetCase } from "../targets/targets.service";
import { clampDay, eachDay, reportWindow } from "./days";
import { adminReelStatus, isListed } from "./participants";
import { growthByDay, viewsOn } from "./views";

/**
 * Admin panel → Dashboard ko'rsatkichlari (sof funksiya). Tiplar `apps/admin/src/lib/types.ts`
 * → Dashboard bo'limi bilan bir xil. Asosiy qiymatlar — davr oxiridagi holat, `...InRange` —
 * davr ichidagi o'zgarish.
 */

export interface DailyStat {
  date: string;
  /** Shu kuni yig'ilgan yangi ko'rishlar. */
  viewsGrowth: number;
  /** Shu kuni ro'yxatdan o'tganlar. */
  newParticipants: number;
}

export interface DashboardStats {
  range: { from: string; to: string };
  contest: { startsOn: string; endsOn: string };
  dataUpdatedAt: string;
  views: { total: number; growthInRange: number };
  lastDay: { date: string; growth: number; previousGrowth: number | null };
  participants: { total: number; newInRange: number };
  reels: { total: number; accepted: number; pending: number; rejected: number; removed: number; newInRange: number };
  support: { open: number; new: number; inProgress: number; createdInRange: number };
  targets: { total: number; detectedInRange: number };
  daily: DailyStat[];
}

/** Support murojaatidan kerakli qism. */
export interface TicketInfo {
  status: "NEW" | "IN_PROGRESS" | "CLOSED";
  createdAt: Date;
}

export interface DashboardInput {
  participants: readonly Participant[];
  tickets: readonly TicketInfo[];
  cases: readonly Pick<TargetCase, "status" | "detectedOn">[];
  startsOn: string;
  endsOn: string;
  /** Bugungi tanlov kuni (Asia/Tashkent). */
  today: string;
  /** Formati tekshirilgan, `from <= to` (ikkalasi berilgan bo'lsa). */
  from?: string;
  to?: string;
  /** Ko'rishlar oxirgi marta qachon yig'ilgan (ISO). */
  dataUpdatedAt: string;
}

/**
 * Davr tanlov boshidan bugungacha (tugash kunidan oshmagan) oraliqqa qisiladi: `to` berilmasa —
 * oxirgi kun, `from` berilmasa — tanlov boshi.
 *
 * Ko'rishlar barcha videolar bo'yicha (bloklangan, chetlatilgan, keyin rad etilganlarniki ham —
 * oldin yig'ilgan ko'rishlar "jami"da qoladi), shuning uchun jami = davr boshidagi jami + davr
 * ichidagi o'sish. Video va murojaatlar holati — joriy (holat tarixi saqlanmaydi), lekin faqat
 * davr oxirigacha yuborilgan/ochilganlar sanaladi.
 */
export function buildDashboard(input: DashboardInput): DashboardStats {
  const bounds = reportWindow(input.startsOn, input.endsOn, input.today);
  const to = clampDay(input.to ?? bounds.to, bounds.from, bounds.to);
  const from = clampDay(input.from ?? bounds.from, bounds.from, to);
  const inRange = (day: string) => day >= from && day <= to;

  const reels = input.participants.flatMap((p) => (p.reel ? [p.reel] : []));
  const growth = new Map<string, number>();
  for (const reel of reels) {
    for (const [day, g] of growthByDay(reel.history)) growth.set(day, (growth.get(day) ?? 0) + g);
  }
  const growthOn = (day: string) => growth.get(day) ?? 0;

  const registered = input.participants.filter(isListed).map((p) => contestDay(p.createdAt));
  const registeredOn = new Map<string, number>();
  for (const day of registered) registeredOn.set(day, (registeredOn.get(day) ?? 0) + 1);
  const daily = eachDay(from, to).map((date) => ({
    date,
    viewsGrowth: growthOn(date),
    newParticipants: registeredOn.get(date) ?? 0,
  }));

  const submitted = reels
    .map((reel) => ({ day: contestDay(reel.submittedAt), status: adminReelStatus(reel.status) }))
    .filter((r) => r.day <= to);
  const tickets = input.tickets
    .map((t) => ({ day: contestDay(t.createdAt), status: t.status }))
    .filter((t) => t.day <= to);
  const targets = input.cases.filter((c) => c.status !== "DISMISSED" && c.detectedOn <= to);

  return {
    range: { from, to },
    contest: { startsOn: input.startsOn, endsOn: input.endsOn },
    dataUpdatedAt: input.dataUpdatedAt,
    views: {
      total: reels.reduce((sum, reel) => sum + (viewsOn(reel.history, to) ?? 0), 0),
      growthInRange: daily.reduce((sum, d) => sum + d.viewsGrowth, 0),
    },
    lastDay: {
      date: to,
      growth: growthOn(to),
      previousGrowth: to > input.startsOn ? growthOn(addDays(to, -1)) : null,
    },
    participants: {
      total: registered.filter((day) => day <= to).length,
      newInRange: registered.filter(inRange).length,
    },
    reels: {
      total: submitted.length,
      accepted: submitted.filter((r) => r.status === "ACCEPTED").length,
      pending: submitted.filter((r) => r.status === "PENDING").length,
      rejected: submitted.filter((r) => r.status === "REJECTED").length,
      removed: submitted.filter((r) => r.status === "REMOVED").length,
      newInRange: submitted.filter((r) => inRange(r.day)).length,
    },
    support: {
      open: tickets.filter((t) => t.status !== "CLOSED").length,
      new: tickets.filter((t) => t.status === "NEW").length,
      inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
      createdInRange: tickets.filter((t) => inRange(t.day)).length,
    },
    // Ro'yxatdan chiqarilgan (yolg'on signal deb topilgan) holatlar hisoblanmaydi.
    targets: {
      total: targets.length,
      detectedInRange: targets.filter((c) => inRange(c.detectedOn)).length,
    },
    daily,
  };
}
