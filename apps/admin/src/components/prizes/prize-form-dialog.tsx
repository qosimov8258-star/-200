"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPrize, updatePrize, uploadPrizeImage } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatNumber } from "@/lib/format";
import { prepareImage } from "@/lib/image";
import { PRIZE_KIND_LABELS } from "@/lib/labels";
import { PRIZE_KINDS, PRIZE_LIMITS, validatePrizeInput } from "@/lib/prize-rules";
import type { Prize, PrizeInput, PrizeKind } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormState {
  title: string;
  description: string;
  kind: PrizeKind;
  /** Raqamli maydonlar matn sifatida: bo'sh qoldirish va "4 000 000" deb yozish mumkin. */
  quantity: string;
  minViews: string;
  maxViews: string;
}

/** Yangi tanlangan, hali yuklanmagan rasm. */
interface PendingImage {
  blob: Blob;
  previewUrl: string;
}

/** Mavjud qiymatlar o'qishga qulay ko'rinishda: 4000000 -> "4 000 000". */
function toFormState(prize: Prize | undefined): FormState {
  return {
    title: prize?.title ?? "",
    description: prize?.description ?? "",
    kind: prize?.kind ?? "MAIN",
    quantity: prize ? formatNumber(prize.quantity) : "1",
    minViews: prize?.minViews != null ? formatNumber(prize.minViews) : "",
    maxViews: prize?.maxViews != null ? formatNumber(prize.maxViews) : "",
  };
}

/** "4 000 000" -> 4000000; bo'sh -> null; raqam bo'lmasa -> NaN (tekshiruv xato ko'rsatadi). */
function parseCount(value: string): number | null {
  // `\s` oddiy va bo'linmaydigan bo'sh joylarni ham qamraydi (formatNumber ajratuvchisi).
  const digits = value.replace(/\s/g, "");
  if (digits === "") return null;
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

function toInput(form: FormState, imageUrl: string | null): PrizeInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    kind: form.kind,
    quantity: parseCount(form.quantity) ?? Number.NaN,
    minViews: parseCount(form.minViews),
    maxViews: parseCount(form.maxViews),
    imageUrl,
  };
}

interface PrizeFormDialogProps {
  /** Tahrirlanadigan sovg'a; yo'q bo'lsa — yangi sovg'a qo'shiladi. */
  prize?: Prize;
  onClose: () => void;
  onSaved: (prize: Prize) => void;
}

export function PrizeFormDialog({ prize, onClose, onSaved }: PrizeFormDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const [form, setForm] = useState<FormState>(() => toFormState(prize));
  const [imageUrl, setImageUrl] = useState<string | null>(prize?.imageUrl ?? null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // Oldingi ko'rinish (preview) manzili brauzer xotirasidan bo'shatiladi.
  useEffect(() => {
    if (!pendingImage) return;
    return () => URL.revokeObjectURL(pendingImage.previewUrl);
  }, [pendingImage]);

  const input = toInput(form, imageUrl);
  const errors = validatePrizeInput(input);
  const hasErrors = Object.keys(errors).length > 0;
  const fieldError = (key: keyof PrizeInput) => (showErrors ? errors[key] : undefined);

  const mutation = useMutation({
    mutationFn: async () => {
      // Rasm sovg'a saqlanayotganda yuklanadi — oyna bekor qilinsa, keraksiz fayl qolmaydi.
      const finalImageUrl = pendingImage ? (await uploadPrizeImage(pendingImage.blob)).url : imageUrl;
      const payload: PrizeInput = { ...input, imageUrl: finalImageUrl };
      return prize ? updatePrize(prize.id, payload) : createPrize(payload);
    },
    onSuccess: async (saved) => {
      await Promise.all(
        ["prizes", "audit-log"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      onSaved(saved);
    },
  });

  const busy = mutation.isPending || preparingImage;
  const previewSrc = pendingImage?.previewUrl ?? imageUrl;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    setPreparingImage(true);
    try {
      const blob = await prepareImage(file);
      setPendingImage({ blob, previewUrl: URL.createObjectURL(blob) });
    } catch (error) {
      setImageError(errorMessage(error));
    } finally {
      setPreparingImage(false);
    }
  }

  function removeImage() {
    setPendingImage(null);
    setImageUrl(null);
    setImageError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!hasErrors && !preparingImage) {
      mutation.mutate();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={prize ? "Sovg'ani tahrirlash" : "Yangi sovg'a"}
      description="Sovg'a ilovada va Telegram botda ko'rsatiladi."
      busy={mutation.isPending}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage(mutation.error)}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={fileInputId}>Rasm</Label>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              if (!busy) void handleFile(event.dataTransfer.files[0]);
            }}
            className={cn(
              "relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-md border border-dashed bg-slate-50",
              dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300",
            )}
          >
            {preparingImage ? (
              <span className="flex items-center gap-2 text-sm text-slate-500" role="status">
                <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
                Rasm tayyorlanmoqda…
              </span>
            ) : previewSrc ? (
              <Image
                src={previewSrc}
                alt="Sovg'a rasmi"
                fill
                unoptimized
                sizes="32rem"
                className="object-contain p-2"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="flex size-full flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-700"
              >
                <ImagePlus className="size-8 text-slate-400" aria-hidden />
                <span className="text-sm font-medium">Rasm tanlash yoki shu yerga tashlash</span>
                <span className="text-xs text-slate-400">JPG, PNG yoki WebP · 15 MB gacha</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              // Xuddi shu faylni qayta tanlash ham ishlashi uchun.
              event.target.value = "";
            }}
          />
          {previewSrc && !preparingImage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <RefreshCw className="size-4" aria-hidden />
                Almashtirish
              </Button>
              <Button variant="ghost" size="sm" onClick={removeImage} disabled={busy}>
                <Trash2 className="size-4" aria-hidden />
                Olib tashlash
              </Button>
            </div>
          )}
          {imageError ? (
            <p className="text-xs text-red-600" role="alert">
              {imageError}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Katta rasm avtomatik kichraytiriladi. Fonsiz PNG rasm ham bo&apos;ladi.
            </p>
          )}
        </div>

        <Field id="prize-title" label="Sovg'a nomi" error={fieldError("title")}>
          <Input
            id="prize-title"
            data-autofocus
            value={form.title}
            maxLength={PRIZE_LIMITS.titleMax}
            placeholder="Masalan: BYD Chazor avtomobili"
            disabled={mutation.isPending}
            onChange={(event) => update("title", event.target.value)}
            aria-invalid={fieldError("title") ? true : undefined}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="prize-quantity"
            label="Soni"
            error={fieldError("quantity")}
            hint={form.kind === "MONTHLY" ? "Bir oyda nechta beriladi." : "Nechta beriladi."}
          >
            <Input
              id="prize-quantity"
              inputMode="numeric"
              value={form.quantity}
              disabled={mutation.isPending}
              onChange={(event) => update("quantity", event.target.value)}
              aria-invalid={fieldError("quantity") ? true : undefined}
            />
          </Field>
          <Field id="prize-kind" label="Turi" error={fieldError("kind")}>
            <Select
              id="prize-kind"
              value={form.kind}
              disabled={mutation.isPending}
              onChange={(event) => update("kind", event.target.value as PrizeKind)}
            >
              {PRIZE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {PRIZE_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-slate-700">
            Kerakli ko&apos;rishlar soni <span className="font-normal text-slate-500">(ixtiyoriy)</span>
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="prize-min-views" className="text-xs font-normal text-slate-500">
                Dan
              </Label>
              <Input
                id="prize-min-views"
                inputMode="numeric"
                placeholder="101 000"
                value={form.minViews}
                disabled={mutation.isPending}
                onChange={(event) => update("minViews", event.target.value)}
                aria-invalid={fieldError("minViews") ? true : undefined}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prize-max-views" className="text-xs font-normal text-slate-500">
                Gacha
              </Label>
              <Input
                id="prize-max-views"
                inputMode="numeric"
                placeholder="500 000"
                value={form.maxViews}
                disabled={mutation.isPending}
                onChange={(event) => update("maxViews", event.target.value)}
                aria-invalid={fieldError("maxViews") ? true : undefined}
              />
            </div>
          </div>
          <p
            className={
              fieldError("minViews") || fieldError("maxViews")
                ? "text-xs text-red-600"
                : "text-xs text-slate-500"
            }
          >
            {fieldError("minViews") ??
              fieldError("maxViews") ??
              "\"Gacha\" bo'sh qolsa — \"va undan ko'p\" deb ko'rsatiladi."}
          </p>
        </fieldset>

        <Field id="prize-description" label="Izoh (ixtiyoriy)" error={fieldError("description")}>
          <Textarea
            id="prize-description"
            rows={3}
            value={form.description}
            maxLength={PRIZE_LIMITS.descriptionMax}
            placeholder="Masalan: tasodifiy tanlov (random) orqali beriladi."
            disabled={mutation.isPending}
            onChange={(event) => update("description", event.target.value)}
            aria-invalid={fieldError("description") ? true : undefined}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={preparingImage}>
            {prize ? "Saqlash" : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {(error || hint) && (
        <p className={error ? "text-xs text-red-600" : "text-xs text-slate-500"}>{error ?? hint}</p>
      )}
    </div>
  );
}
