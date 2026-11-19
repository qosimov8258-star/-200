"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { PARTICIPANT_STATUS_LABELS, REEL_STATUS_LABELS } from "@/lib/labels";
import type { ParticipantListResponse, ParticipantStatus, ReelStatus } from "@/lib/types";
import { hasActiveFilters, type UsersFilters } from "@/lib/users-filters";

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

      <Segmented
        label="Holat bo'yicha filtr"
        value={filters.status}
        onChange={onStatusChange}
        options={STATUS_TABS.map((tab) => ({
          value: tab.value,
          label: tab.label,
          count: counts?.[tab.value],
          attention: tab.value === "BLOCKED" || tab.value === "DISQUALIFIED",
        }))}
      />
    </div>
  );
}
