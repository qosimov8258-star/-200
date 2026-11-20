"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Trash2, Users } from "lucide-react";

import { ActionMenu } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Segmented } from "@/components/ui/segmented";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { formatDateTime, formatNumber } from "@/lib/format";
import { deleteOwnerParticipant, getOwnerParticipants } from "@/lib/owner-api";
import {
  OWNER_FILTER_LABELS,
  OWNER_REEL_LABELS,
  OWNER_REEL_TONES,
  OWNER_STATUS_LABELS,
  OWNER_STATUS_TONES,
  RISK_LEVEL_SHORT,
  RISK_LEVEL_TONES,
} from "@/lib/owner-labels";
import type { OwnerParticipant, OwnerParticipantFilter } from "@/lib/owner-types";
import { cn } from "@/lib/utils";

import {
  EmptyState,
  ErrorState,
  formatOwnerPhone,
  NoticeBanner,
  OWNER_QUERY_KEY,
  ownerFullName,
  useNotice,
} from "./owner-common";
import { OwnerParticipantDialog } from "./owner-participant-dialog";

type ListFilter = OwnerParticipantFilter | "ALL";

const PAGE_SIZE = 25;
const FILTERS: ListFilter[] = ["ALL", "ACTIVE", "BLOCKED", "DISQUALIFIED", "INCOMPLETE"];

type Overlay = { kind: "edit"; participant: OwnerParticipant } | { kind: "delete"; participant: OwnerParticipant };

/** "Ishtirokchilar" bo'limi: qidiruv, holat filtri, jadval; tahrirlash va butunlay o'chirish. */
export function OwnerParticipants() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ListFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [notice, setNotice] = useNotice();

  const query = {
    status: filter === "ALL" ? undefined : filter,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  };

  const { data, error, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: [OWNER_QUERY_KEY, "participants", query],
    queryFn: () => getOwnerParticipants(query),
    placeholderData: keepPreviousData,
  });

  function done(message: string) {
    setOverlay(null);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: [OWNER_QUERY_KEY] });
  }

  return (
    <div className="space-y-4">
      <NoticeBanner message={notice} />

      <div className="space-y-3">
        <SearchInput
          value={search}
          onDebouncedChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Ism, telefon, @instagram yoki Telegram ID"
          label="Ishtirokchilarni qidirish"
          className="w-full sm:w-96"
        />
        <Segmented
          label="Holat bo'yicha filtr"
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
          options={FILTERS.map((value) => ({
            value,
            label: OWNER_FILTER_LABELS[value],
            count: data?.counts[value],
          }))}
        />
      </div>

      <Card className="overflow-hidden">
        {isPending ? (
          <TableSkeleton rows={8} />
        ) : isError && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState icon={Users} text="Bu bo'limda hech kim yo'q." />
        ) : data ? (
          <>
            <div className={cn("transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
              <ParticipantsTable
                items={data.items}
                onEdit={(participant) => setOverlay({ kind: "edit", participant })}
                onDelete={(participant) => setOverlay({ kind: "delete", participant })}
              />
            </div>
            {data.total > data.pageSize && (
              <div className="border-t border-slate-200 px-4 py-3">
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
              </div>
            )}
          </>
        ) : null}
      </Card>

      {overlay?.kind === "edit" && (
        <OwnerParticipantDialog
          key={`edit:${overlay.participant.id}`}
          participant={overlay.participant}
          onClose={() => setOverlay(null)}
          onDone={(updated) => done(`${ownerFullName(updated)}: o'zgarishlar saqlandi.`)}
        />
      )}
      {overlay?.kind === "delete" && (
        <ConfirmDialog
          key={`delete:${overlay.participant.id}`}
          title="Ishtirokchini butunlay o'chirish"
          variant="danger"
          confirmLabel="Butunlay o'chirish"
          description={
            <>
              <strong className="font-medium text-slate-900">{ownerFullName(overlay.participant)}</strong> va uning
              videosi tizimdan butunlay o&apos;chiriladi: ro&apos;yxat, reyting va barcha bo&apos;limlardan.{" "}
              <strong className="font-medium text-red-700">Bu amalni qaytarib bo&apos;lmaydi.</strong>
            </>
          }
          onConfirm={() => deleteOwnerParticipant(overlay.participant.id)}
          onClose={() => setOverlay(null)}
          onDone={() => done(`${ownerFullName(overlay.participant)} o'chirildi.`)}
        />
      )}
    </div>
  );
}

interface ParticipantsTableProps {
  items: OwnerParticipant[];
  onEdit: (participant: OwnerParticipant) => void;
  onDelete: (participant: OwnerParticipant) => void;
}

const TH = "px-4 py-2.5 text-left font-medium whitespace-nowrap";

function ParticipantsTable({ items, onEdit, onDelete }: ParticipantsTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className={TH}>
              Ishtirokchi
            </th>
            <th scope="col" className={TH}>
              Telefon · yosh
            </th>
            <th scope="col" className={TH}>
              Holat
            </th>
            <th scope="col" className={TH}>
              Video
            </th>
            <th scope="col" className={TH}>
              Xavf
            </th>
            <th scope="col" className={TH}>
              Ro&apos;yxatdan o&apos;tgan
            </th>
            <th scope="col" className="sticky right-0 w-14 bg-slate-50 px-3 py-2.5">
              <span className="sr-only">Amallar</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((participant) => (
            <ParticipantRow key={participant.id} participant={participant} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParticipantRow({
  participant,
  onEdit,
  onDelete,
}: {
  participant: OwnerParticipant;
  onEdit: ParticipantsTableProps["onEdit"];
  onDelete: ParticipantsTableProps["onDelete"];
}) {
  const name = ownerFullName(participant);

  return (
    <tr className="group align-top hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onEdit(participant)}
          className={cn(
            "text-left font-medium whitespace-nowrap hover:text-brand-700 hover:underline",
            participant.firstName ? "text-slate-900" : "text-slate-500 italic",
          )}
        >
          {name}
        </button>
        <p className="text-xs whitespace-nowrap text-slate-500">
          {participant.instagramUsername ? `@${participant.instagramUsername}` : "Instagram ulanmagan"}
        </p>
        <p className="font-mono text-[11px] whitespace-nowrap text-slate-400">ID {participant.id}</p>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-slate-900 tabular-nums">{formatOwnerPhone(participant.phone)}</p>
        <p className="text-xs text-slate-500">{participant.age !== null ? `${participant.age} yosh` : "Yosh kiritilmagan"}</p>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <Badge tone={OWNER_STATUS_TONES[participant.status]}>{OWNER_STATUS_LABELS[participant.status]}</Badge>
          {!participant.profileComplete && <Badge tone="warning">To&apos;liq o&apos;tmagan</Badge>}
        </div>
      </td>

      <td className="px-4 py-3">
        {participant.reel ? (
          <div className="flex flex-col items-start gap-1">
            <a
              href={participant.reel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700 hover:underline"
            >
              Reelni ochish
              <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">({name}, yangi oynada)</span>
            </a>
            <Badge tone={OWNER_REEL_TONES[participant.reel.status]}>{OWNER_REEL_LABELS[participant.reel.status]}</Badge>
            <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
              {formatNumber(participant.views)} ko&apos;rish
              {participant.rank !== null ? ` · ${participant.rank}-o'rin` : " · reytingda yo'q"}
            </p>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Video yuborilmagan</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          {participant.riskLevel ? (
            <Badge tone={RISK_LEVEL_TONES[participant.riskLevel]}>{RISK_LEVEL_SHORT[participant.riskLevel]}</Badge>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
          {participant.openTargetCases > 0 && (
            <span className="text-xs whitespace-nowrap text-red-700">{participant.openTargetCases} ta ochiq target</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500 tabular-nums">
        {formatDateTime(participant.registeredAt)}
      </td>

      <td className="sticky right-0 bg-white px-3 py-3 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.25)] group-hover:bg-slate-50">
        <ActionMenu
          label={`${name} uchun amallar`}
          items={[
            { label: "Tahrirlash", icon: Pencil, onSelect: () => onEdit(participant) },
            { label: "O'chirish", icon: Trash2, danger: true, onSelect: () => onDelete(participant) },
          ]}
        />
      </td>
    </tr>
  );
}
