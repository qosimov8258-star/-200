"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MoreDetails } from "@/components/ui/more-details";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { PARTICIPANT_STATUS_LABELS, REEL_FILTER_LABELS } from "@/lib/labels";
import type { ParticipantListResponse, ParticipantStatus, ReelStatus } from "@/lib/types";
import { hasActiveFilters, type UsersFilters } from "@/lib/users-filters";

import { ViewsRangeFilter } from "./views-range-filter";

/**
 * Holat yorliqlari. "Diskvalifikatsiya qilingan" yorliqda qisqaroq — "Chetlatilgan"
 * (`PARTICIPANT_STATUS_LABELS` o'zgarmaydi: u amallar tarixida ham ishlatiladi).
 */
const TAB_LABEL_OVERRIDES: Partial<Record<ParticipantStatus, string>> = {
  DISQUALIFIED: "Chetlatilgan",
};

const STATUS_TABS: Array<{ value: UsersFilters["status"]; label: string }> = [
  { value: "ALL", label: "Hammasi" },
  ...(["ACTIVE", "WARNED", "BLOCKED", "DISQUALIFIED"] as ParticipantStatus[]).map((status) => ({
    value: status,
    label: TAB_LABEL_OVERRIDES[status] ?? PARTICIPANT_STATUS_LABELS[status],
  })),
];

/** Ishtirokchida shu holatdagi kamida bitta video bormi; "NONE" — umuman video yo'q. */
const REEL_OPTIONS: Array<{ value: UsersFilters["reel"]; label: string }> = [
  { value: "ALL", label: "Videolar: hammasi" },
  ...(["ACCEPTED", "PENDING", "REJECTED", "REMOVED", "NONE"] as Array<ReelStatus | "NONE">).map(
    (value) => ({ value, label: REEL_FILTER_LABELS[value] }),
  ),
];

/** "Batafsil" ichidagi yoqilgan filtrlar soni (video holati, ko'rishlar oralig'i). */
function detailFilterCount(filters: UsersFilters): number {
  let count = 0;
  if (filters.reel !== "ALL") count += 1;
  if (filters.minViews !== null || filters.maxViews !== null) count += 1;
  return count;
}

interface UsersToolbarProps {
  filters: UsersFilters;
  counts?: ParticipantListResponse["statusCounts"];
  onSearchChange: (search: string) => void;
  onStatusChange: (status: UsersFilters["status"]) => void;
  onReelChange: (reel: UsersFilters["reel"]) => void;
  onViewsChange: (range: { min: number | null; max: number | null }) => void;
  onRefreshViews: () => void;
  onClear: () => void;
}

/**
 * Asosiy ish — bitta odamni topish: qidiruv va holat yorliqlari doim ko'rinadi. Kamroq kerak
 * bo'ladigan filtrlar va pullik "Ko'rishlarni hoziroq yangilash" — "Batafsil" ichida (filtr
 * yoqilgan bo'lsa — o'zi ochiq turadi).
 */
export function UsersToolbar({
  filters,
  counts,
  onSearchChange,
  onStatusChange,
  onReelChange,
  onViewsChange,
  onRefreshViews,
  onClear,
}: UsersToolbarProps) {
  const detailCount = detailFilterCount(filters);
  // Sahifa ochilganda (masalan, havoladan) filtr yoqilgan bo'lsa — "Batafsil" ochiq. Keyin uni faqat
  // foydalanuvchi ochib-yopadi: filtr o'chirilganda bo'lim to'satdan yopilib qolmaydi.
  const [detailsInitiallyOpen] = useState(detailCount > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          onDebouncedChange={onSearchChange}
          placeholder="Ism, telefon yoki @instagram yozing"
          label="Ishtirokchilarni qidirish"
          className="w-full sm:w-[28rem]"
        />

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

      <MoreDetails
        title="Batafsil: video holati, ko'rishlar oralig'i, ko'rishlarni yangilash"
        meta={detailCount > 0 ? `· ${detailCount} ta filtr yoqilgan` : undefined}
        defaultOpen={detailsInitiallyOpen}
        contentClassName="flex flex-wrap items-center gap-3"
      >
        <Select
          value={filters.reel}
          onChange={(event) => onReelChange(event.target.value as UsersFilters["reel"])}
          aria-label="Videolar holati bo'yicha filtr"
          className="w-full sm:w-60"
        >
          {REEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <ViewsRangeFilter
          min={filters.minViews}
          max={filters.maxViews}
          onChange={onViewsChange}
          className="w-full sm:w-80"
        />

        <Button variant="secondary" onClick={onRefreshViews} className="h-10 w-full sm:ml-auto sm:w-auto">
          <RefreshCw className="size-4" aria-hidden />
          Ko&apos;rishlarni hoziroq yangilash (pullik)
        </Button>
      </MoreDetails>
    </div>
  );
}
