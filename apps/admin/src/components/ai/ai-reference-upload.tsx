"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { addAiReference } from "@/lib/api";
import { errorMessage, isUnauthorized } from "@/lib/api-error";
import { AI_IMAGE_ACCEPT, AiImageError, prepareAiReferenceImage } from "@/lib/ai-image";
import { AI_LIMITS } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ErrorAlert, useSetAiState } from "./ai-common";

interface Progress {
  index: number;
  total: number;
  stage: "prepare" | "send";
}

interface UploadResult {
  added: number;
  errors: string[];
}

interface ReferenceUploadProps {
  /** Qoralamadagi rasmlar soni. */
  count: number;
  /** Rasmlar hali yo'q — katta "bo'sh joy" tugmasi. */
  variant: "button" | "empty";
}

/**
 * Namuna rasm qo'shish: bir yoki bir nechta fayl tanlanadi, har biri brauzerda kichraytiriladi
 * (`prepareAiReferenceImage`) va navbat bilan yuboriladi. Yangi rasm turi — "Ko'rinishi shart",
 * izohsiz; ularni kartada o'zgartirish mumkin.
 */
export function ReferenceUpload({ count, variant }: ReferenceUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const setState = useSetAiState();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const slots = Math.max(0, AI_LIMITS.maxReferences - count);

  const upload = useMutation({
    mutationFn: async (files: File[]): Promise<UploadResult> => {
      const problems: string[] = [];
      const accepted = files.slice(0, slots);
      if (files.length > accepted.length) {
        problems.push(
          `Ko'pi bilan ${AI_LIMITS.maxReferences} ta rasm (Claude bitta so'rovda 600 tagacha rasm qabul qiladi, video kadrlari bilan birga) — ${files.length - accepted.length} tasi qo'shilmadi.`,
        );
      }
      let added = 0;
      for (const [index, file] of accepted.entries()) {
        try {
          setProgress({ index: index + 1, total: accepted.length, stage: "prepare" });
          const prepared = await prepareAiReferenceImage(file);
          setProgress({ index: index + 1, total: accepted.length, stage: "send" });
          setState(await addAiReference({ dataUrl: prepared.dataUrl, kind: "MUST", note: "" }));
          added += 1;
        } catch (error) {
          // Sessiya tugagan bo'lsa — butun amal to'xtaydi (panel login sahifasiga o'tadi).
          if (isUnauthorized(error)) throw error;
          const message = error instanceof AiImageError ? error.message : errorMessage(error);
          problems.push(`«${file.name}»: ${message}`);
        }
      }
      return { added, errors: problems };
    },
    onSuccess: async ({ added, errors: problems }) => {
      setErrors(problems);
      if (added > 0) await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (error) => setErrors([errorMessage(error)]),
    onSettled: () => setProgress(null),
  });

  function pick() {
    inputRef.current?.click();
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Shu faylni qayta tanlash ham `change` bersin.
    event.target.value = "";
    if (files.length === 0 || upload.isPending) return;
    setErrors([]);
    upload.mutate(files);
  }

  const busyText = progress
    ? `${progress.stage === "prepare" ? "Rasm tayyorlanmoqda" : "Yuborilmoqda"}${
        progress.total > 1 ? ` (${progress.index}/${progress.total})` : ""
      }…`
    : null;
  const full = slots === 0;

  return (
    <div className="space-y-3">
      {variant === "empty" ? (
        <button
          type="button"
          onClick={pick}
          disabled={upload.isPending}
          className={cn(
            "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center transition-colors",
            "hover:border-brand-300 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-70",
          )}
        >
          <ImagePlus className="size-8 text-brand-500" aria-hidden />
          <span className="text-sm font-medium text-ink">{busyText ?? "Rasm qo'shish"}</span>
          <span className="max-w-md text-xs text-slate-500">
            Mahsulot rasmlarini tanlang — videoda nima ko&apos;rinishi kerakligini AI shu rasmlar bo&apos;yicha
            taniydi. Bir nechta rasmni birdaniga tanlash mumkin.
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button variant="secondary" onClick={pick} loading={upload.isPending} disabled={full}>
            {!upload.isPending && <ImagePlus className="size-4" aria-hidden />}
            {busyText ?? "Rasm qo'shish"}
          </Button>
          {full && (
            <span className="text-xs text-slate-500">
              {AI_LIMITS.maxReferences} ta rasm — Claude chegarasi. Yangisini qo&apos;shish uchun birortasini o&apos;chiring.
            </span>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={AI_IMAGE_ACCEPT}
        multiple
        className="hidden"
        tabIndex={-1}
        aria-label="Namuna rasm tanlash"
        onChange={handleChange}
      />

      {errors.length > 0 && (
        <ErrorAlert>
          {errors.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </ErrorAlert>
      )}
    </div>
  );
}
