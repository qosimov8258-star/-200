"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Ban, Crosshair, ExternalLink, LockOpen, UserX } from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import { PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONES } from "@/lib/labels";
import type { ParticipantAction, ParticipantListItem, ParticipantSort, SortOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PrizeRangeChip, prizeRangeFor, showsPrizeRange, usePrizeRanges } from "./prize-ranges";
import { ReelCountBadges } from "./reel-count-badges";

/** Reytingdagi o'rin nimani anglatadi (o'rin belgisi ustida). */
const RANK_HINT =
  "Ishtirokchilar reytingidagi o'rni — umumiy ko'rishlar bo'yicha (faqat ma'lumot: g'oliblar random aniqlanadi)";

/** "Target" belgisi ustidagi izoh. */
export const TARGET_HINT = "Videoga pullik reklama (target) yoqilgani aniqlangan";

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
  return `${item.firstName} ${item.lastName}`.trim();
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
  const prizeRanges = usePrizeRanges();

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <SortableHeader sort="name" label="Ishtirokchi" {...sortProps} />
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Videolar
            </th>
            <SortableHeader
              sort="views"
              label="Ko'rishlar"
              hint="Umumiy tasdiqlangan ko'rishlar — barcha qabul qilingan videolari yig'indisi (oferta 7.1)"
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
            <UserRow
              key={item.id}
              item={item}
              prizeRanges={prizeRanges}
              onAction={onAction}
              onShowReels={onShowReels}
            />
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

/** Bosilgan joy qatordagi tugma, havola yoki maydonmi (qator bosilishi bilan aralashmasin). */
export function isInteractiveTarget(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest("a, button, input, select, textarea, label, summary, [role='menu']") !== null
  );
}

function UserRow({
  item,
  prizeRanges,
  onAction,
  onShowReels,
}: {
  item: ParticipantListItem;
  prizeRanges: ReturnType<typeof usePrizeRanges>;
  onAction: UsersTableProps["onAction"];
  onShowReels: UsersTableProps["onShowReels"];
}) {
  const name = fullName(item);
  const hasReels = item.reels.total > 0;
  const prizeRange = hasReels && showsPrizeRange(item.status) ? prizeRangeFor(prizeRanges, item.views) : null;

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
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onShowReels(item)}
          className="rounded text-left font-medium text-slate-900 hover:text-brand-700 hover:underline"
        >
          {name}
          <span className="sr-only"> — videolarini ko&apos;rish</span>
        </button>

        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500">
          {item.phone && <span className="whitespace-nowrap text-slate-700 tabular-nums">{item.phone}</span>}
          {item.phone && (
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
          )}
          {item.instagramUsername ? (
            <a
              href={`https://www.instagram.com/${encodeURIComponent(item.instagramUsername)}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700 hover:underline"
            >
              @{item.instagramUsername}
              <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">(Instagramda, yangi oynada)</span>
            </a>
          ) : (
            // Akkaunt videolardan aniqlanadi (tekshirilgan, rad etilmagan video bo'lmasa — yo'q).
            <span className="text-slate-400">
              <span className="sr-only">Instagram: </span>video tekshirilgach chiqadi
            </span>
          )}
        </p>

        <p className="text-xs whitespace-nowrap text-slate-500">
          {/* Yosh endi so'ralmaydi (0 — kiritilmagan); eski ishtirokchilarda ko'rinadi. */}
          {item.age > 0 && `${item.age} yosh · `}
          {formatDate(item.registeredOn)} dan
        </p>
      </td>

      <td className="px-4 py-3">
        {!hasReels ? (
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

      <td className="px-4 py-3 text-right">
        {!hasReels ? (
          <span className="text-slate-300">—</span>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              {item.rank !== null && (
                <span className="text-xs text-slate-400 tabular-nums" title={RANK_HINT}>
                  <span aria-hidden>#{item.rank}</span>
                  <span className="sr-only">reytingda {item.rank}-o&apos;rin,</span>
                </span>
              )}
              <span className="font-medium text-slate-900 tabular-nums">{formatNumber(item.views)}</span>
            </span>
            {prizeRange && <PrizeRangeChip kind={prizeRange.kind} />}
          </div>
        )}
      </td>

      <td className="px-4 py-3">
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge tone={PARTICIPANT_STATUS_TONES[item.status]}>{PARTICIPANT_STATUS_LABELS[item.status]}</Badge>
          {item.hasTarget && (
            <Badge tone="warning" className="gap-1" title={TARGET_HINT}>
              <Crosshair className="size-3" aria-hidden />
              Target (reklama)
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
      <span className="px-2 text-slate-300" title="Tanlovdan chetlatilgan — amal yo'q">
        —<span className="sr-only">Tanlovdan chetlatilgan — amal yo&apos;q</span>
      </span>
    );
  }

  const items: ActionMenuItem[] = [
    item.status === "BLOCKED"
      ? { label: "Blokdan chiqarish", icon: LockOpen, onSelect: () => onAction(item, "unblock") }
      : { label: "Bloklash", icon: Ban, onSelect: () => onAction(item, "block") },
    {
      label: "Tanlovdan chetlatish (diskvalifikatsiya)",
      icon: UserX,
      danger: true,
      onSelect: () => onAction(item, "disqualify"),
    },
  ];

  return <ActionMenu label={`${name} uchun amallar`} items={items} />;
}
