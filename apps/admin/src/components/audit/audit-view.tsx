"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ScrollText, SearchX } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MoreDetails } from "@/components/ui/more-details";
import { PageHint } from "@/components/ui/page-hint";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getAuditLog } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { addDays, CONTEST_TIME_ZONE, todayIso } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  auditText,
  auditValueLabel,
} from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/navigation";
import type { AdminRole, AuditEntity, AuditLogEntry, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;
const ROLES: AdminRole[] = ["ADMIN", "SUPPORT"];

/** Segmentdagi "Hammasi" — bo'lim filtri yo'q. */
const ALL = "all";
type EntityChip = AuditEntity | typeof ALL;

/** Ko'p ishlatiladigan bo'limlar — chip sifatida. */
const MAIN_ENTITY_OPTIONS: SegmentedOption<EntityChip>[] = [
  { value: ALL, label: "Hammasi" },
  { value: "winner", label: "G'oliblar" },
  { value: "voucher_draw", label: "Tanlovlar" },
  { value: "reel", label: "Videolar" },
  { value: "participant", label: "Ishtirokchilar" },
  { value: "settings", label: "Sozlamalar" },
  { value: "support_ticket", label: "Support" },
];

/**
 * Qolgan bo'limlar — "Boshqa" ro'yxatida. Istoriyalar bo'limi olib tashlangan: eski yozuvlar
 * "Hammasi" da ko'rinadi, lekin alohida filtr kerak emas.
 */
const OTHER_ENTITIES: AuditEntity[] = ["prize", "target_case", "telegram_message", "auth"];

const FILTER_ENTITIES: AuditEntity[] = [
  ...MAIN_ENTITY_OPTIONS.flatMap((option) => (option.value === ALL ? [] : [option.value])),
  ...OTHER_ENTITIES,
];

/** Shundan uzun izoh ikki qatorga qisqartiriladi va "To'liq o'qish" tugmasi chiqadi. */
const REASON_CLAMP_CHARS = 140;

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: CONTEST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO vaqt -> "14:05" (Toshkent vaqti). */
const formatTime = (value: string) => timeFormat.format(new Date(value));

/** Kun sarlavhasi: "Bugun", "Kecha", "25-noyabr" (boshqa yil bo'lsa — "2025-yil 25-noyabr"). */
function dayLabel(day: IsoDate, today: IsoDate): string {
  if (day === today) return "Bugun";
  if (day === addDays(today, -1)) return "Kecha";
  const [year, month, date] = day.split("-").map(Number);
  const label = `${date}-${MONTHS[month - 1] ?? ""}`;
  return day.slice(0, 4) === today.slice(0, 4) ? label : `${year}-yil ${label}`;
}

interface DayGroup {
  day: IsoDate;
  entries: AuditLogEntry[];
}

/** Joriy sahifadagi yozuvlarni Toshkent kuni bo'yicha guruhlaydi (server tartibi saqlanadi). */
function groupByDay(items: AuditLogEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const entry of items) {
    const day = todayIso(new Date(entry.at));
    const last = groups.at(-1);
    if (last && last.day === day) last.entries.push(entry);
    else groups.push({ day, entries: [entry] });
  }
  return groups;
}

/** Amallar tarixi (TZ 6: audit log) — Admin va Support harakatlari, faqat o'qish. */
export function AuditView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = (searchParams.get("q") ?? "").slice(0, 100);
  const entity = FILTER_ENTITIES.find((item) => item === searchParams.get("entity"));
  const role = ROLES.find((item) => item === searchParams.get("role"));
  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const filtered = Boolean(search || entity || role);
  // Filtrsiz, lekin oxirgi sahifadan keyingi sahifa (masalan, eski havola) — "hali hech narsa yo'q" emas.
  const pastLastPage = !filtered && page > 1;
  const otherEntity = entity && OTHER_ENTITIES.includes(entity) ? entity : undefined;
  // Rol filtri bilan ochilgan sahifada "Batafsil filtr" ochiq turadi; rol tozalanganda o'zi yopilmasin.
  const [roleFilterOpen] = useState(() => Boolean(role));

  const query = { search: search || undefined, entity, actorRole: role, page, pageSize: PAGE_SIZE };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["audit-log", query],
    queryFn: () => getAuditLog(query),
    placeholderData: keepPreviousData,
  });

  function navigate(patch: { search?: string; entity?: string; role?: string; page?: number }) {
    const next = { search, entity: entity ?? "", role: role ?? "", page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search);
    if (next.entity) params.set("entity", next.entity);
    if (next.role) params.set("role", next.role);
    if (next.page > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const clearFilters = () => navigate({ search: "", entity: "", role: "" });

  const today = todayIso();
  const groups = data ? groupByDay(data.items) : [];

  return (
    <div className="space-y-4">
      <PageHint>
        Xodimlar panelda nima qilgani: kim, qachon, nima qildi. Bu yerda faqat ko&apos;riladi —
        yozuvlarni o&apos;zgartirib ham, o&apos;chirib ham bo&apos;lmaydi.
      </PageHint>

      <div className="space-y-3">
        <SearchInput
          value={search}
          onDebouncedChange={(value) => navigate({ search: value })}
          placeholder="Xodim, ishtirokchi yoki izoh"
          label="Amallar tarixidan qidirish"
          className="w-full sm:w-80"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Bo'lim bo'yicha filtr"
            size="sm"
            options={MAIN_ENTITY_OPTIONS}
            value={otherEntity ? null : (entity ?? ALL)}
            onChange={(value) => navigate({ entity: value === ALL ? "" : value })}
          />
          <Select
            value={otherEntity ?? ""}
            onChange={(event) => navigate({ entity: event.target.value })}
            aria-label="Boshqa bo'limlar bo'yicha filtr"
            className={cn(
              "w-full sm:w-48 [&>select]:h-8 [&>select]:rounded-full [&>select]:text-xs",
              otherEntity && "[&>select]:border-brand-500 [&>select]:font-medium",
            )}
          >
            <option value="">Boshqa bo&apos;limlar…</option>
            {OTHER_ENTITIES.map((item) => (
              <option key={item} value={item}>
                {AUDIT_ENTITY_LABELS[item]}
              </option>
            ))}
          </Select>
        </div>

        <MoreDetails
          title="Batafsil filtr"
          meta={role ? ROLE_LABELS[role] : "xodim roli bo'yicha"}
          defaultOpen={roleFilterOpen}
          className="sm:max-w-sm"
        >
          <div className="space-y-1.5">
            <Label htmlFor="audit-role-filter">Xodim roli</Label>
            <Select
              id="audit-role-filter"
              value={role ?? ""}
              onChange={(event) => navigate({ role: event.target.value })}
            >
              <option value="">Barcha xodimlar</option>
              {ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_LABELS[item]}
                </option>
              ))}
            </Select>
          </div>
        </MoreDetails>
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={10} />
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <IosIcon icon={AlertTriangle} tint="orange" size={48} />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <IosIcon icon={filtered || pastLastPage ? SearchX : ScrollText} tint="gray" size={48} />
            <p className="text-sm text-slate-600">
              {filtered
                ? "Bu filtr bo'yicha hech narsa topilmadi."
                : pastLastPage
                  ? "Bu sahifada yozuv yo'q."
                  : "Hali hech kim hech narsa qilmagan."}
            </p>
            {filtered && (
              <Button variant="secondary" onClick={clearFilters}>
                Filtrlarni tozalash
              </Button>
            )}
            {pastLastPage && (
              <Button variant="secondary" onClick={() => navigate({ page: 1 })}>
                Birinchi sahifaga
              </Button>
            )}
          </div>
        ) : data ? (
          <>
            <div className={cn("transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
              {/* Telefon: kartalar ro'yxati. */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {groups.map((group) => (
                  <section key={group.day} aria-label={dayLabel(group.day, today)}>
                    <h2 className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
                      {dayLabel(group.day, today)}
                    </h2>
                    <ul className="divide-y divide-slate-100">
                      {group.entries.map((entry) => (
                        <li key={entry.id} className="space-y-1.5 px-4 py-3 text-sm">
                          <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
                            <span className="min-w-0 truncate">
                              <span className="font-medium text-slate-700">{entry.actor.name}</span> ·{" "}
                              {ROLE_LABELS[entry.actor.role]}
                            </span>
                            <EntryTime at={entry.at} />
                          </div>
                          <AuditSummary entry={entry} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              {/* Kattaroq ekran: uch ustunli jadval, kunlar bo'yicha guruhlangan. */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th scope="col" className="w-20 px-4 py-2.5 text-left font-medium">
                        Vaqt
                      </th>
                      <th scope="col" className="w-48 px-4 py-2.5 text-left font-medium">
                        Kim
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-left font-medium">
                        Nima qildi
                      </th>
                    </tr>
                  </thead>
                  {groups.map((group) => (
                    <tbody key={group.day} className="divide-y divide-slate-100 border-b border-slate-100">
                      <tr className="bg-slate-50/70">
                        <th
                          scope="rowgroup"
                          colSpan={3}
                          className="px-4 py-2 text-left text-xs font-semibold text-slate-500"
                        >
                          {dayLabel(group.day, today)}
                        </th>
                      </tr>
                      {group.entries.map((entry) => (
                        <AuditRow key={entry.id} entry={entry} />
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={(nextPage) => {
                  navigate({ page: nextPage });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}

/** Soat va daqiqa; to'liq sana va vaqt — sichqoncha ustiga olib borilganda. */
function EntryTime({ at }: { at: string }) {
  return (
    <time dateTime={at} title={formatDateTime(at)} className="shrink-0 text-slate-500 tabular-nums">
      {formatTime(at)}
    </time>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <tr className="align-top hover:bg-slate-50/70">
      <td className="px-4 py-3 whitespace-nowrap">
        <EntryTime at={entry.at} />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{entry.actor.name}</p>
        <p className="text-xs text-slate-500">{ROLE_LABELS[entry.actor.role]}</p>
      </td>
      <td className="px-4 py-3">
        <AuditSummary entry={entry} />
      </td>
    </tr>
  );
}

/** "Nima qildi": bitta gap (amal — obyekt), ostida o'zgarish va izoh. Xom qiymatlar `auditText` orqali. */
function AuditSummary({ entry }: { entry: AuditLogEntry }) {
  const action = AUDIT_ACTION_LABELS[entry.action] ?? entry.action;
  const target = auditText(entry.entityLabel);
  const hasChange = entry.before !== "" || entry.after !== "";
  const before = auditText(auditValueLabel(entry.entity, entry.before));
  const after = auditText(auditValueLabel(entry.entity, entry.after));

  return (
    <div className="min-w-0 space-y-1">
      <p className="break-words text-slate-900">
        <span className="font-semibold">{action}</span>
        {target && (
          <>
            <span className="text-slate-400"> — </span>
            <span className="font-semibold">{target}</span>
          </>
        )}
        <span className="ml-2 text-xs text-slate-400">{AUDIT_ENTITY_LABELS[entry.entity] ?? entry.entity}</span>
      </p>
      {hasChange && (
        <p className="flex flex-wrap items-center gap-1 text-slate-600">
          <span className="sr-only">Avval: </span>
          <span>{before || "—"}</span>
          <ArrowRight className="size-3.5 text-slate-400" aria-hidden />
          <span className="sr-only">, keyin: </span>
          <span className="font-medium text-slate-800">{after || "—"}</span>
        </p>
      )}
      {entry.reason && <ReasonText text={auditText(entry.reason)} />}
    </div>
  );
}

/** Izoh: uzun bo'lsa ikki qator, tugma bilan to'liq ochiladi. */
function ReasonText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > REASON_CLAMP_CHARS;

  return (
    <div>
      <p className={cn("break-words whitespace-pre-line text-slate-500", long && !expanded && "line-clamp-2")}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="mt-0.5 rounded text-xs font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {expanded ? "Qisqartirish" : "To'liq o'qish"}
        </button>
      )}
    </div>
  );
}
