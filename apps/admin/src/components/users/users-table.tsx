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
  UserX,
} from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import { PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONES } from "@/lib/labels";
import type {
  ParticipantAction,
  ParticipantListItem,
  ParticipantSort,
  SortOrder,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { ReelCountBadges } from "./reel-count-badges";

interface UsersTableProps {
  items: ParticipantListItem[];
  sort: ParticipantSort;
  order: SortOrder;
  onSortChange: (sort: ParticipantSort) => void;
  onAction: (item: ParticipantListItem, action: ParticipantAction) => void;
  /** "Videolar" oynasini ochish (ism, video soni yoki qatorning bo'sh joyi bosilganda). */
  onShowReels: (item: ParticipantListItem) => void;
}

export function fullName(item: Pick<ParticipantListItem, "firstName" | "lastName">): string {
  return `${item.firstName} ${item.lastName}`;
}

export function UsersTable({
  items,
  sort,
  order,
  onSortChange,
  onAction,
  onShowReels,
}: UsersTableProps) {
  const sortProps = { activeSort: sort, order, onSortChange };

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <SortableHeader
              sort="rank"
              label="O'rin"
              hint="Eng ko'p ko'rilgan videosining reytingdagi o'rni (reytingda har bir video alohida qator)"
              className="w-20"
              {...sortProps}
            />
            <SortableHeader sort="name" label="Ishtirokchi" {...sortProps} />
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Telefon
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Instagram
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Videolar
            </th>
            <SortableHeader
              sort="views"
              label="Ko'rishlar"
              hint="Eng ko'p ko'rilgan bitta qabul qilingan videosi (videolar ko'rishlari qo'shilmaydi)"
              align="right"
              {...sortProps}
            />
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
            <UserRow key={item.id} item={item} onAction={onAction} onShowReels={onShowReels} />
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
  /** Ustun nimani ko'rsatishi (sichqoncha ustida). */
  hint?: string;
  align?: "left" | "right";
  className?: string;
}

function SortableHeader({
  sort,
  label,
  activeSort,
  order,
  onSortChange,
  hint,
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
        title={hint}
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

/** Bosilgan joy qatordagi tugma, havola yoki menyu bo'lsa — qator bosilishi hisoblanmaydi. */
function isInteractiveTarget(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, label, [role='menu']") !== null
  );
}

function UserRow({
  item,
  onAction,
  onShowReels,
}: {
  item: ParticipantListItem;
  onAction: UsersTableProps["onAction"];
  onShowReels: UsersTableProps["onShowReels"];
}) {
  const name = fullName(item);

  return (
    // Sichqoncha uchun butun qator bosiladi; klaviaturada — ism tugmasi (Tab + Enter).
    <tr
      className="cursor-pointer hover:bg-slate-50/70"
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        // Matn belgilanayotgan bo'lsa (masalan, telefonni nusxalash) — oyna ochilmaydi.
        if (window.getSelection()?.toString()) return;
        onShowReels(item);
      }}
    >
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
        <button
          type="button"
          onClick={() => onShowReels(item)}
          className="rounded text-left font-medium whitespace-nowrap text-slate-900 hover:text-brand-700 hover:underline"
        >
          {name}
          <span className="sr-only"> — videolarini ko&apos;rish</span>
        </button>
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
          // Akkaunt videolardan aniqlanadi (tekshirilgan, rad etilmagan video bo'lmasa — yo'q).
          <span className="text-slate-400">Aniqlanmagan</span>
        )}
      </td>

      <td className="px-4 py-3">
        {item.reels.total === 0 ? (
          <span className="text-slate-300">
            —<span className="sr-only">video yuborilmagan</span>
          </span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => onShowReels(item)}
              className="rounded font-medium whitespace-nowrap text-brand-700 tabular-nums hover:underline"
            >
              {formatNumber(item.reels.total)} ta video
              <span className="sr-only"> — {name}, ro&apos;yxatni ochish</span>
            </button>
            <ReelCountBadges counts={item.reels} />
          </div>
        )}
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap text-slate-900 tabular-nums">
        {item.reels.total > 0 ? formatNumber(item.views) : <span className="text-slate-300">—</span>}
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
