"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ExternalLink, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { getAiCandidates } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import type { AiCandidate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AI_CANDIDATES_KEY, ErrorAlert } from "./ai-common";

interface CandidatePickerProps {
  /** Hozir tanlanganlar (tartibi saqlanadi). */
  selected: AiCandidate[];
  /** Standart tanlov — eng ko'p ko'rilganlar. */
  defaults: AiCandidate[];
  limit: number;
  onSave: (selected: AiCandidate[]) => void;
  onClose: () => void;
}

/** Sinov uchun videolarni tanlash: qidiruv, belgilash (ko'pi bilan `limit` ta), standartga qaytarish. */
export function CandidatePicker({ selected, defaults, limit, onSave, onClose }: CandidatePickerProps) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<AiCandidate[]>(selected);

  const { data, error, isPending, isError, isFetching } = useQuery({
    queryKey: [...AI_CANDIDATES_KEY, search],
    queryFn: () => getAiCandidates(search || undefined),
    placeholderData: keepPreviousData,
  });

  const pickedCodes = new Set(picked.map((item) => item.shortcode));
  const full = picked.length >= limit;

  function toggle(candidate: AiCandidate) {
    setPicked((current) =>
      current.some((item) => item.shortcode === candidate.shortcode)
        ? current.filter((item) => item.shortcode !== candidate.shortcode)
        : current.length >= limit
          ? current
          : [...current, candidate],
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Sinov uchun videolar"
      description={`Ko'pi bilan ${limit} ta qabul qilingan video. Ro'yxatda eng ko'p ko'rilganlar birinchi.`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink tabular-nums" aria-live="polite">
            Tanlangan: {picked.length} / {limit}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPicked(defaults.slice(0, limit))}>
              <RotateCcw className="size-3.5" aria-hidden />
              Eng ko&apos;p ko&apos;rilgan {limit} tasi
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])} disabled={picked.length === 0}>
              Tozalash
            </Button>
          </div>
        </div>

        {picked.length > 0 && (
          <ul className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto sm:max-h-28" aria-label="Tanlangan videolar">
            {picked.map((item) => (
              <li key={item.shortcode}>
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  className="inline-flex max-w-[16rem] items-center gap-1 rounded-full bg-brand-100 py-1 pr-1.5 pl-2.5 text-xs font-medium text-brand-700 hover:bg-brand-200"
                  aria-label={`${item.fullName} (${item.shortcode}) — olib tashlash`}
                >
                  <span className="truncate">{item.fullName}</span>
                  <X className="size-3.5 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <SearchInput
          value={search}
          onDebouncedChange={setSearch}
          placeholder="Ism yoki telefon"
          label="Videolarni qidirish"
        />

        <div className="max-h-[36vh] overflow-y-auto rounded-xl border border-line sm:max-h-[45vh]">
          {isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : isError && !data ? (
            <ErrorAlert className="m-3">{errorMessage(error)}</ErrorAlert>
          ) : data && data.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Qabul qilingan video topilmadi.</p>
          ) : data ? (
            <ul className={cn("divide-y divide-line transition-opacity", isFetching && "opacity-60")}>
              {data.map((candidate) => {
                const checked = pickedCodes.has(candidate.shortcode);
                const disabled = !checked && full;
                return (
                  <li key={candidate.shortcode} className="flex items-center gap-3 px-3 py-2">
                    <label
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3",
                        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(candidate)}
                        className="size-4 shrink-0 accent-brand-500"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{candidate.fullName}</span>
                        <span className="block text-xs text-slate-500 tabular-nums">
                          {formatNumber(candidate.views)} ko&apos;rish · <span className="font-mono">{candidate.shortcode}</span>
                        </span>
                      </span>
                    </label>
                    <a
                      href={candidate.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md p-1.5 text-brand-700 hover:bg-brand-50"
                      aria-label={`${candidate.fullName} videosini ochish (yangi oynada)`}
                    >
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>

        {picked.length === 0 && (
          <p className="text-xs text-slate-500">
            Kamida bitta video tanlang yoki «Eng ko&apos;p ko&apos;rilgan {limit} tasi» tugmasini bosing.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={() => onSave(picked)} disabled={picked.length === 0}>
            Saqlash
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
