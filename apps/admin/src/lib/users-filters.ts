import type {
  ParticipantListQuery,
  ParticipantSort,
  ParticipantStatus,
  ReelStatus,
  SortOrder,
} from "./types";

/** Ishtirokchilar sahifasining URL da saqlanadigan holati. */
export interface UsersFilters {
  search: string;
  status: ParticipantStatus | "ALL";
  /** `reel` URL parametri: shu holatdagi videosi borlar; "NONE" — video yo'qlar. */
  reel: ReelStatus | "NONE" | "ALL";
  /** Ko'rishlar oralig'i; null — chegara yo'q. */
  minViews: number | null;
  maxViews: number | null;
  sort: ParticipantSort;
  order: SortOrder;
  page: number;
}

export const USERS_PAGE_SIZE = 20;

const PARTICIPANT_STATUSES: ParticipantStatus[] = ["ACTIVE", "WARNED", "BLOCKED", "DISQUALIFIED"];
const REEL_FILTERS: Array<ReelStatus | "NONE"> = ["ACCEPTED", "PENDING", "REJECTED", "REMOVED", "NONE"];
/** "rank" — eski havolalar uchun (ustun endi yo'q, lekin `?sort=rank` ishlayveradi). */
const SORTS: ParticipantSort[] = ["rank", "views", "name"];

/** Har bir ustun bosilganda birinchi qaysi tartibda saralanadi. */
export const DEFAULT_SORT_ORDER: Record<ParticipantSort, SortOrder> = {
  rank: "asc",
  views: "desc",
  name: "asc",
};

export const DEFAULT_USERS_FILTERS: UsersFilters = {
  search: "",
  status: "ALL",
  reel: "ALL",
  minViews: null,
  maxViews: null,
  // Standart — umumiy ko'rishlar bo'yicha, ko'pidan (reytingdagi o'rin bilan deyarli bir xil tartib).
  sort: "views",
  order: "desc",
  page: 1,
};

/** URL dagi ko'rishlar chegarasi: manfiy bo'lmagan butun son, aks holda — yo'q. */
function viewsParam(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return allowed.find((item) => item === value) ?? null;
}

export function parseUsersFilters(params: Pick<URLSearchParams, "get">): UsersFilters {
  const sort = oneOf(params.get("sort"), SORTS) ?? DEFAULT_USERS_FILTERS.sort;
  const page = Number.parseInt(params.get("page") ?? "", 10);

  return {
    search: (params.get("q") ?? "").slice(0, 100),
    status: oneOf(params.get("status"), PARTICIPANT_STATUSES) ?? "ALL",
    reel: oneOf(params.get("reel"), REEL_FILTERS) ?? "ALL",
    minViews: viewsParam(params.get("min")),
    maxViews: viewsParam(params.get("max")),
    sort,
    order: oneOf(params.get("order"), ["asc", "desc"] as const) ?? DEFAULT_SORT_ORDER[sort],
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Standart qiymatlar URL ga yozilmaydi. */
export function usersFiltersToSearch(filters: UsersFilters): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.reel !== "ALL") params.set("reel", filters.reel);
  if (filters.minViews !== null) params.set("min", String(filters.minViews));
  if (filters.maxViews !== null) params.set("max", String(filters.maxViews));
  if (filters.sort !== DEFAULT_USERS_FILTERS.sort) params.set("sort", filters.sort);
  if (filters.order !== DEFAULT_SORT_ORDER[filters.sort]) params.set("order", filters.order);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

export function usersFiltersToQuery(filters: UsersFilters): ParticipantListQuery {
  return {
    search: filters.search.trim() || undefined,
    status: filters.status === "ALL" ? undefined : filters.status,
    reel: filters.reel === "ALL" ? undefined : filters.reel,
    minViews: filters.minViews ?? undefined,
    maxViews: filters.maxViews ?? undefined,
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    pageSize: USERS_PAGE_SIZE,
  };
}

export function hasActiveFilters(filters: UsersFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "ALL" ||
    filters.reel !== "ALL" ||
    filters.minViews !== null ||
    filters.maxViews !== null
  );
}
