"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { PARTICIPANT_STATUS_LABELS, REEL_STATUS_LABELS } from "@/lib/labels";
import type { ParticipantListResponse, ParticipantStatus, ReelStatus } from "@/lib/types";
import { hasActiveFilters, type UsersFilters } from "@/lib/users-filters";
import { cn } from "@/lib/utils";

const STATUS_TABS: Array<{ value: UsersFilters["status"]; label: string }> = [
  { value: "ALL", label: "Hammasi" },
  ...(["ACTIVE", "WARNED", "BLOCKED", "DISQUALIFIED"] as ParticipantStatus[]).map((status) => ({
    value: status,
    label: PARTICIPANT_STATUS_LABELS[status],
  })),
];

const REEL_OPTIONS: Array<{ value: UsersFilters["reel"]; label: string }> = [
  { value: "ALL", label: "Reel: hammasi" },
  ...(["ACCEPTED", "PENDING", "REJECTED", "REMOVED"] as ReelStatus[]).map((status) => ({
    value: status,
    label: `Reel: ${REEL_STATUS_LABELS[status].toLowerCase()}`,
  })),
  { value: "NONE", label: "Reel yubormaganlar" },
];

interface UsersToolbarProps {
  filters: UsersFilters;
  counts?: ParticipantListResponse["statusCounts"];
  onSearchChange: (search: string) => void;
  onStatusChange: (status: UsersFilters["status"]) => void;
  onReelChange: (reel: UsersFilters["reel"]) => void;
  onClear: () => void;
}

export function UsersToolbar({
  filters,
  counts,
  onSearchChange,
  onStatusChange,
  onReelChange,
  onClear,
}: UsersToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          onDebouncedChange={onSearchChange}
          placeholder="Ism, telefon yoki @instagram"
          label="Ishtirokchilarni qidirish"
          className="w-full sm:w-80"
        />

        <Select
          value={filters.reel}
          onChange={(event) => onReelChange(event.target.value as UsersFilters["reel"])}
          aria-label="Reel holati bo'yicha filtr"
          className="w-full sm:w-56"
        >
          {REEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="size-4" aria-hidden />
            Filtrlarni tozalash
          </Button>
        )}
      </div>

      <div role="group" aria-label="Holat bo'yicha filtr" className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = filters.status === tab.value;
          const count = counts?.[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100",
              )}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {formatNumber(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
