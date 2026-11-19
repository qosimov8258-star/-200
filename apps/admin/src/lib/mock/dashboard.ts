/**
 * MOCK backend: dashboard ko'rsatkichlarini mock tanlov ma'lumotlaridan hisoblaydi.
 * Haqiqiy backendda bu `GET /api/v1/admin/dashboard` javobi bo'ladi.
 */
import { ApiError } from "../api-error";
import { addDays, clampDate, eachDay, isIsoDate } from "../dates";
import type { DashboardQuery, DashboardStats, IsoDate } from "../types";
import { getContestData, reelStatusOn, ticketStatusOn } from "./contest";
import { effectiveSettings, lastSyncAt } from "./settings";
import { readStore } from "./store";
import { supportStatusToday } from "./support";
import { targetCaseStatus } from "./targets";

/**
 * Ko'rishlar har bir Reel kuzatilgan kunlar (qabul qilingandan o'chirilguncha)
 * bo'yicha yig'iladi. Keyinroq o'chirilgan yoki diskvalifikatsiya bo'lgan
 * Reellarning oldin yig'ilgan ko'rishlari ham "jami"da qoladi — shunda
 * jami = davr boshidagi jami + davr ichidagi o'sish.
 */
export function computeDashboardStats(query: DashboardQuery): DashboardStats {
  if ((query.from && !isIsoDate(query.from)) || (query.to && !isIsoDate(query.to))) {
    throw new ApiError(400, "Sana noto'g'ri formatda.");
  }
  if (query.from && query.to && query.from > query.to) {
    throw new ApiError(400, "Davr boshi oxiridan keyin bo'lishi mumkin emas.");
  }

  const data = getContestData();
  const to = clampDate(query.to ?? data.today, data.startsOn, data.today);
  const from = clampDate(query.from ?? data.startsOn, data.startsOn, to);
  const days = eachDay(from, to);

  const growthOn = (date: IsoDate): number =>
    data.reels.reduce((sum, reel) => sum + (reel.growthByDay.get(date) ?? 0), 0);

  const daily = days.map((date) => ({
    date,
    viewsGrowth: growthOn(date),
    newParticipants: data.participants.filter((item) => item.registeredOn === date).length,
  }));

  const totalViews = eachDay(data.startsOn, to).reduce((sum, date) => sum + growthOn(date), 0);

  const reelStatuses = data.reels.map((reel) => reelStatusOn(reel, to));
  // Bugungi holatda xodimlarning o'zgarishlari (javob, yopish) ham hisobga olinadi.
  const store = readStore();
  const ticketStatuses = data.tickets.map((ticket) =>
    to === data.today ? supportStatusToday(ticket, store) : ticketStatusOn(ticket, to),
  );
  const activeTargets = data.targets.filter(
    (target) => targetCaseStatus(target, store) !== "DISMISSED",
  );
  const settings = effectiveSettings(store);
  const inRange = (date: IsoDate) => date >= from && date <= to;

  return {
    range: { from, to },
    contest: { startsOn: settings.startsOn, endsOn: settings.endsOn },
    // Ko'rishlar har kuni Sozlamalardagi vaqtda (Toshkent) yig'iladi.
    dataUpdatedAt: lastSyncAt(data.today, settings.syncTime),
    views: {
      total: totalViews,
      growthInRange: daily.reduce((sum, day) => sum + day.viewsGrowth, 0),
    },
    lastDay: {
      date: to,
      growth: growthOn(to),
      previousGrowth: to > data.startsOn ? growthOn(addDays(to, -1)) : null,
    },
    participants: {
      total: data.participants.filter((item) => item.registeredOn <= to).length,
      newInRange: data.participants.filter((item) => inRange(item.registeredOn)).length,
    },
    reels: {
      total: reelStatuses.filter((status) => status !== null).length,
      accepted: reelStatuses.filter((status) => status === "ACCEPTED").length,
      pending: reelStatuses.filter((status) => status === "PENDING").length,
      rejected: reelStatuses.filter((status) => status === "REJECTED").length,
      removed: reelStatuses.filter((status) => status === "REMOVED").length,
      newInRange: data.reels.filter((reel) => inRange(reel.submittedOn)).length,
    },
    support: {
      open: ticketStatuses.filter((status) => status === "NEW" || status === "IN_PROGRESS").length,
      new: ticketStatuses.filter((status) => status === "NEW").length,
      inProgress: ticketStatuses.filter((status) => status === "IN_PROGRESS").length,
      createdInRange: data.tickets.filter((ticket) => inRange(ticket.createdOn)).length,
    },
    // Ro'yxatdan chiqarilgan (yolg'on signal deb topilgan) targetlar hisoblanmaydi.
    targets: {
      total: activeTargets.filter((target) => target.detectedOn <= to).length,
      detectedInRange: activeTargets.filter((target) => inRange(target.detectedOn)).length,
    },
    daily,
  };
}
