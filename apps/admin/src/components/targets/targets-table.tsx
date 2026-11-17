"use client";

import { Ban, ExternalLink, FileSearch, ShieldAlert, Undo2 } from "lucide-react";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import {
  PARTICIPANT_STATUS_LABELS,
  PARTICIPANT_STATUS_TONES,
  TARGET_CASE_STATUS_LABELS,
  TARGET_CASE_STATUS_TONES,
  TARGET_METHOD_LABELS,
  TARGET_STATE_LABELS,
  TARGET_STATE_TONES,
} from "@/lib/labels";
import type { TargetAction, TargetCaseListItem } from "@/lib/types";

import { availableTargetActions, TARGET_ACTION_LABELS } from "./target-action-dialog";

const ACTION_ICONS = { warn: ShieldAlert, disqualify: Ban, dismiss: Undo2 } as const;

interface TargetsTableProps {
  items: TargetCaseListItem[];
  onShowEvidence: (item: TargetCaseListItem) => void;
  onAction: (item: TargetCaseListItem, action: TargetAction) => void;
}

export function TargetsTable({ items, onShowEvidence, onAction }: TargetsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Reel
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Aniqlangan
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Dalil
            </th>
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
            <TargetRow
              key={item.id}
              item={item}
              onShowEvidence={onShowEvidence}
              onAction={onAction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TargetRow({
  item,
  onShowEvidence,
  onAction,
}: {
  item: TargetCaseListItem;
  onShowEvidence: TargetsTableProps["onShowEvidence"];
  onAction: TargetsTableProps["onAction"];
}) {
  const name = `${item.participant.firstName} ${item.participant.lastName}`;
  const actions = availableTargetActions(item);

  const menuItems: ActionMenuItem[] = [
    { label: "Dalilni ko'rish", icon: FileSearch, onSelect: () => onShowEvidence(item) },
    ...actions.map((action) => ({
      label: TARGET_ACTION_LABELS[action],
      icon: ACTION_ICONS[action],
      danger: action === "disqualify",
      onSelect: () => onAction(item, action),
    })),
  ];

  return (
    <tr className="align-top hover:bg-slate-50/70">
      <td className="px-4 py-3">
        <p className="font-medium whitespace-nowrap text-slate-900">{name}</p>
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
          {item.participant.phone}
        </p>
        <p className="text-xs text-slate-500">
          {item.participant.instagramUsername ? `@${item.participant.instagramUsername}` : "—"}
        </p>
        {item.participant.status !== "ACTIVE" && (
          <Badge tone={PARTICIPANT_STATUS_TONES[item.participant.status]} className="mt-1">
            {PARTICIPANT_STATUS_LABELS[item.participant.status]}
          </Badge>
        )}
      </td>

      <td className="px-4 py-3">
        <a
          href={item.reelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 whitespace-nowrap text-brand-700 hover:underline"
        >
          Reelni ochish
          <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">({name}, yangi oynada)</span>
        </a>
        <p className="text-xs whitespace-nowrap text-slate-500 tabular-nums">
          {formatNumber(item.views)} ko&apos;rish
          {item.rank !== null ? ` · ${item.rank}-o'rin` : " · reytingda yo'q"}
        </p>
      </td>

      <td className="px-4 py-3">
        <p className="whitespace-nowrap text-slate-900 tabular-nums">{formatDate(item.detectedOn)}</p>
        <p className="text-xs whitespace-nowrap text-slate-500">{TARGET_METHOD_LABELS[item.method]}</p>
      </td>

      <td className="max-w-72 px-4 py-3">
        <p className="text-slate-700">{item.evidence}</p>
        <button
          type="button"
          onClick={() => onShowEvidence(item)}
          className="mt-1 text-xs font-medium text-brand-700 hover:underline"
        >
          Batafsil
          <span className="sr-only"> ({name} dalili)</span>
        </button>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1.5">
          <Badge tone={TARGET_CASE_STATUS_TONES[item.status]}>
            {TARGET_CASE_STATUS_LABELS[item.status]}
          </Badge>
          <span className="text-xs whitespace-nowrap text-slate-500">
            Target:{" "}
            <Badge tone={TARGET_STATE_TONES[item.currentState]}>
              {TARGET_STATE_LABELS[item.currentState]}
            </Badge>
          </span>
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <ActionMenu label={`${name} uchun amallar`} items={menuItems} />
      </td>
    </tr>
  );
}
