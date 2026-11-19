"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Lock, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { getAuditLog } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  auditValueLabel,
} from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/navigation";
import type { AdminRole, AuditEntity, AuditLogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 30;
const ENTITIES = Object.keys(AUDIT_ENTITY_LABELS) as AuditEntity[];
const ROLES: AdminRole[] = ["ADMIN", "SUPPORT"];

/** TZ 6: Audit log — Admin va Support harakatlari, faqat o'qish. */
export function AuditView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = (searchParams.get("q") ?? "").slice(0, 100);
  const entity = ENTITIES.find((item) => item === searchParams.get("entity"));
  const role = ROLES.find((item) => item === searchParams.get("role"));
  const pageParam = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

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

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <Lock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
        Barcha Admin va Support harakatlari shu yerga yoziladi: kim, nima, qachon. Yozuvlarni
        o&apos;zgartirib yoki o&apos;chirib bo&apos;lmaydi.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onDebouncedChange={(value) => navigate({ search: value })}
          placeholder="Xodim, obyekt yoki izoh"
          label="Audit logni qidirish"
          className="w-full sm:w-72"
        />
        <Select
          value={entity ?? ""}
          onChange={(event) => navigate({ entity: event.target.value })}
          aria-label="Obyekt turi bo'yicha filtr"
          className="w-full sm:w-52"
        >
          <option value="">Barcha bo&apos;limlar</option>
          {ENTITIES.map((item) => (
            <option key={item} value={item}>
              {AUDIT_ENTITY_LABELS[item]}
            </option>
          ))}
        </Select>
        <Select
          value={role ?? ""}
          onChange={(event) => navigate({ role: event.target.value })}
          aria-label="Xodim roli bo'yicha filtr"
          className="w-full sm:w-52"
        >
          <option value="">Barcha xodimlar</option>
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item]}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={10} />
        ) : isError && !data ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <AlertTriangle className="size-8 text-amber-500" aria-hidden />
            <p className="text-sm text-slate-600">{errorMessage(error)}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Qayta urinish
            </Button>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <ScrollText className="size-8 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-600">Yozuv topilmadi.</p>
          </div>
        ) : data ? (
          <>
            <div
              className={cn("relative overflow-x-auto transition-opacity", isFetching && "opacity-60")}
              aria-busy={isFetching}
            >
              <table className="w-full min-w-[920px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th scope="col" className="w-40 px-4 py-2.5 text-left font-medium">
                      Vaqt
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">
                      Xodim
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">
                      Amal
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">
                      Obyekt
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">
                      O&apos;zgarish va izoh
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((entry) => (
                    <AuditRow key={entry.id} entry={entry} />
                  ))}
                </tbody>
              </table>
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

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const hasChange = entry.before !== "" || entry.after !== "";

  return (
    <tr className="align-top hover:bg-slate-50/70">
      <td className="px-4 py-3 whitespace-nowrap text-slate-600 tabular-nums">
        <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium whitespace-nowrap text-slate-900">{entry.actor.name}</p>
        <Badge tone={entry.actor.role === "ADMIN" ? "brand" : "neutral"}>
          {ROLE_LABELS[entry.actor.role]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-slate-900">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</td>
      <td className="px-4 py-3">
        <Badge tone="neutral">{AUDIT_ENTITY_LABELS[entry.entity]}</Badge>
        <p className="mt-1 text-slate-700">{entry.entityLabel}</p>
      </td>
      <td className="max-w-sm px-4 py-3">
        {hasChange && (
          <p className="flex flex-wrap items-center gap-1 text-slate-700">
            <span>{auditValueLabel(entry.entity, entry.before) || "—"}</span>
            <ArrowRight className="size-3.5 text-slate-400" aria-label="dan" />
            <span className="font-medium">{auditValueLabel(entry.entity, entry.after) || "—"}</span>
          </p>
        )}
        {entry.reason && (
          <p className="mt-1 line-clamp-2 text-slate-500" title={entry.reason}>
            {entry.reason}
          </p>
        )}
      </td>
    </tr>
  );
}
