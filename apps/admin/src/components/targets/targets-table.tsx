"use client";

import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/format";
import { PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONES, TARGET_CASE_STATUS_LABELS, TARGET_CASE_STATUS_TONES, TARGET_METHOD_LABELS } from "@/lib/labels";
import type { TargetCaseListItem } from "@/lib/types";

import { isInteractiveTarget } from "../users/users-table";
import { availableTargetActions, targetParticipantName } from "./target-action-dialog";

interface TargetsTableProps {
  items: TargetCaseListItem[];
  /** Dalil oynasini ochish — qaror tugmalari o'sha yerda. */
  onOpen: (item: TargetCaseListItem) => void;
}

export function TargetsTable({ items, onOpen }: TargetsTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Ishtirokchi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Nima topildi
            </th>
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Holat
            </th>
            <th scope="col" className="w-40 px-4 py-2.5">
              <span className="sr-only">Amal</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <TargetRow key={item.id} item={item} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TargetRow({ item, onOpen }: { item: TargetCaseListItem; onOpen: TargetsTableProps["onOpen"] }) {
  const name = targetParticipantName(item) || "Ismsiz";
  // Qaror hali berilmagan (yoki yana qaror berish mumkin) — asosiy tugma.
  const awaitingDecision = availableTargetActions(item).length > 0;

  return (
    // Sichqoncha uchun butun qator bosiladi; klaviaturada — oxirgi ustundagi tugma.
    <tr
      className="cursor-pointer align-top hover:bg-slate-50/70"
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        // Matn belgilanayotgan bo'lsa (masalan, dalilni nusxalash) — oyna ochilmaydi.
        if (window.getSelection()?.toString()) return;
        onOpen(item);
      }}
    >
      <td className="px-4 py-3">
        <p className="font-medium whitespace-nowrap text-slate-900">{name}</p>
        <p className="text-xs whitespace-nowrap text-slate-500">
          {item.participant.instagramUsername ? `@${item.participant.instagramUsername}` : "—"}
        </p>
        {item.participant.status !== "ACTIVE" && (
          <Badge tone={PARTICIPANT_STATUS_TONES[item.participant.status]} className="mt-1">
            {PARTICIPANT_STATUS_LABELS[item.participant.status]}
          </Badge>
        )}
      </td>

      <td className="max-w-lg px-4 py-3">
        <p className="text-slate-700">{item.evidence}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {TARGET_METHOD_LABELS[item.method]}
          <span aria-hidden> · </span>
          <span className="tabular-nums">{formatDate(item.detectedOn)}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
          <a
            href={item.reelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-brand-700 hover:underline"
          >
            Videoni ochish
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">({name}, yangi oynada)</span>
          </a>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap tabular-nums">{formatNumber(item.views)} ko&apos;rish</span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">
            {item.rank !== null ? `${item.rank}-o'rin` : "reytingda yo'q"}
          </span>
        </p>
      </td>

      <td className="px-4 py-3">
        <Badge tone={TARGET_CASE_STATUS_TONES[item.status]}>{TARGET_CASE_STATUS_LABELS[item.status]}</Badge>
      </td>

      <td className="px-4 py-3 text-right">
        <Button variant={awaitingDecision ? "primary" : "secondary"} size="sm" onClick={() => onOpen(item)}>
          {awaitingDecision ? "Ko'rib chiqish" : "Ko'rish"}
          <span className="sr-only">: {name}</span>
        </Button>
      </td>
    </tr>
  );
}
