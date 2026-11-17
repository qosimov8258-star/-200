"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  Crosshair,
  Crown,
  ExternalLink,
  LockOpen,
  Users2,
  UserX,
} from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import {
  PARTICIPANT_STATUS_LABELS,
  PARTICIPANT_STATUS_TONES,
  REEL_STATUS_LABELS,
  REEL_STATUS_TONES,
} from "@/lib/labels";
import type {
  ParticipantAction,
  ParticipantListItem,
  ParticipantSort,
  SortOrder,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface UsersTableProps {
  items: ParticipantListItem[];
  sort: ParticipantSort;
  order: SortOrder;
  onSortChange: (sort: ParticipantSort) => void;
  onAction: (item: ParticipantListItem, action: ParticipantAction) => void;
}

export function fullName(item: Pick<ParticipantListItem, "firstName" | "lastName">): string {
  return `${item.firstName} ${item.lastName}`;
}

export function UsersTable({ items, sort, order, onSortChange, onAction }: UsersTableProps) {
  const sortProps = { activeSort: sort, order, onSortChange };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <SortableHeader sort="rank" label="O'rin" className="w-20" {...sortProps} />
            <SortableHeader sort="name" label="Ishtirokchi" {...sortProps} />
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Telefon
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Instagram
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Reel
            </th>
            <SortableHeader sort="views" label="Ko'rishlar" align="right" {...sortProps} />
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Holat
            </th>
            <th scope="col" className="w-14 px-4 py-2.5">
              <span className="sr-only">Amallar</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <UserRow key={item.id} item={item} onAction={onAction} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saralanadigan ustun sarlavhasi
// ---------------------------------------------------------------------------

interface SortableHeaderProps {
  sort: ParticipantSort;
  label: string;
  activeSort: ParticipantSort;
  order: SortOrder;
  onSortChange: (sort: ParticipantSort) => void;
  align?: "left" | "right";
  className?: string;
}

function SortableHeader({
  sort,
  label,
  activeSort,
  order,
  onSortChange,
  align = "left",
  className,
}: SortableHeaderProps) {
  const active = sort === activeSort;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-2.5 font-medium", align === "right" ? "text-right" : "text-left", className)}
    >
      <button
        type="button"
        onClick={() => onSortChange(sort)}
        className={cn(
          "inline-flex items-center gap-1 rounded hover:text-slate-900",
          active && "text-slate-900",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "text-slate-300")} aria-hidden />
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Qator
// ---------------------------------------------------------------------------

function UserRow({
  item,
  onAction,
}: {
  item: ParticipantListItem;
  onAction: UsersTableProps["onAction"];
}) {
  const name = fullName(item);

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-4 py-3 tabular-nums">
        {item.rank === null ? (
          <span className="text-slate-300">
            —<span className="sr-only">reytingda yo&apos;q</span>
          </span>
        ) : item.rank === 1 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
            <Crown className="size-4 text-amber-500" aria-hidden />1
            <span className="sr-only">(avtomobilga da&apos;vogar)</span>
          </span>
        ) : (
          <span className="font-medium text-slate-900">{item.rank}</span>
        )}
      </td>

      <td className="px-4 py-3">
        <p className="font-medium whitespace-nowrap text-slate-900">{name}</p>
        <p className="text-xs whitespace-nowrap text-slate-500">
          {item.age} yosh · {formatDate(item.registeredOn)} dan
        </p>
      </td>

      <td className="px-4 py-3 whitespace-nowrap text-slate-700 tabular-nums">{item.phone}</td>

      <td className="px-4 py-3">
        {item.instagramUsername ? (
          <a
            href={`https://www.instagram.com/${item.instagramUsername}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700 hover:underline"
          >
            @{item.instagramUsername}
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">(yangi oynada)</span>
          </a>
        ) : (
          <span className="text-slate-400">Ulanmagan</span>
        )}
      </td>

      <td className="px-4 py-3">
        {item.reel ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={REEL_STATUS_TONES[item.reel.status]}>
              {REEL_STATUS_LABELS[item.reel.status]}
            </Badge>
            <a
              href={item.reel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-0.5 text-slate-400 hover:text-brand-700"
              aria-label={`${name} Reelini yangi oynada ochish`}
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
            {item.reel.collabWith && (
              <Badge
                tone="brand"
                className="gap-1"
                title="Instagram Collab — hamkorlikda joylangan (ruxsat etiladi)"
              >
                <Users2 className="size-3" aria-hidden />
                {item.reel.collabWith.isFactory
                  ? "Collab: zavod"
                  : `Collab: @${item.reel.collabWith.username}`}
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-slate-400">Yuborilmagan</span>
        )}
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap text-slate-900 tabular-nums">
        {item.reel ? formatNumber(item.views) : <span className="text-slate-300">—</span>}
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge tone={PARTICIPANT_STATUS_TONES[item.status]}>
            {PARTICIPANT_STATUS_LABELS[item.status]}
          </Badge>
          {item.hasTarget && (
            <Badge tone="warning" className="gap-1">
              <Crosshair className="size-3" aria-hidden />
              Target
            </Badge>
          )}
        </span>
      </td>

      <td className="px-4 py-3 text-right">
        <RowActions item={item} name={name} onAction={onAction} />
      </td>
    </tr>
  );
}

function RowActions({
  item,
  name,
  onAction,
}: {
  item: ParticipantListItem;
  name: string;
  onAction: UsersTableProps["onAction"];
}) {
  if (item.status === "DISQUALIFIED") {
    return (
      <span className="px-2 text-slate-300" title="Diskvalifikatsiya qilingan — amal yo'q">
        —
      </span>
    );
  }

  const items: ActionMenuItem[] = [
    item.status === "BLOCKED"
      ? { label: "Blokdan chiqarish", icon: LockOpen, onSelect: () => onAction(item, "unblock") }
      : { label: "Bloklash", icon: Ban, onSelect: () => onAction(item, "block") },
    {
      label: "Diskvalifikatsiya qilish",
      icon: UserX,
      danger: true,
      onSelect: () => onAction(item, "disqualify"),
    },
  ];

  return <ActionMenu label={`${name} uchun amallar`} items={items} />;
}
