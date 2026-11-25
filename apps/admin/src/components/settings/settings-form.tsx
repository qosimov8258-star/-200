"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { updateContestSettings } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import type { ContestSettingsResponse, ContestSettingsUpdate } from "@/lib/types";

const SYNC_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Ko'rishlar yig'ish davri (kun). Boshqa qiymat saqlangan bo'lsa — ro'yxatga qo'shiladi. */
const SYNC_PERIODS: Array<{ days: number; label: string }> = [
  { days: 7, label: "Haftada bir marta" },
  { days: 1, label: "Har kuni" },
  { days: 3, label: "Har 3 kunda" },
  { days: 14, label: "Ikki haftada bir marta" },
];

const periodLabel = (days: number) =>
  SYNC_PERIODS.find((p) => p.days === days)?.label ?? `Har ${days} kunda`;

type FieldErrors = Partial<Record<keyof ContestSettingsUpdate, string>>;

function toForm(data: ContestSettingsResponse): ContestSettingsUpdate {
  const { startsOn, endsOn, syncTime, syncEveryDays, minAge } = data.settings;
  return { startsOn, endsOn, syncTime, syncEveryDays, minAge };
}

/** Brauzerda tezkor tekshiruv; yakuniy tekshiruv serverda. */
function validate(form: ContestSettingsUpdate, data: ContestSettingsResponse): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.startsOn) errors.startsOn = "Sanani kiriting.";
  if (!form.endsOn) errors.endsOn = "Sanani kiriting.";
  else if (form.startsOn && form.endsOn <= form.startsOn) {
    errors.endsOn = "Tugash sanasi boshlanishdan keyin bo'lishi kerak.";
  } else if (form.endsOn !== data.settings.endsOn && form.endsOn < data.today) {
    errors.endsOn = "O'tgan kunni tanlab bo'lmaydi.";
  }
  if (!SYNC_TIME_PATTERN.test(form.syncTime)) errors.syncTime = "Vaqtni SS:DD ko'rinishida kiriting.";
  if (!Number.isInteger(form.minAge) || form.minAge < 14 || form.minAge > 100) {
    errors.minAge = "14 dan 100 gacha butun son.";
  }
  return errors;
}

interface SettingsFormProps {
  data: ContestSettingsResponse;
  /** Saqlangach (forma yangi qiymatlar bilan qayta ochiladi). */
  onSaved: () => void;
}

/** TZ 6: Sozlamalar — tanlov muddati, yangilanish vaqti va davri, minimal yosh. Qoidalar — `RulesEditor`. */
export function SettingsForm({ data, onSaved }: SettingsFormProps) {
  const queryClient = useQueryClient();
  const initial = toForm(data);
  const [form, setForm] = useState<ContestSettingsUpdate>(initial);
  const [showErrors, setShowErrors] = useState(false);

  const errors = validate(form, data);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = (Object.keys(initial) as Array<keyof ContestSettingsUpdate>).some(
    (key) => form[key] !== initial[key],
  );

  const mutation = useMutation({
    mutationFn: () => updateContestSettings(form),
    onSuccess: async (response) => {
      queryClient.setQueryData(["settings"], response);
      // Muddat va yangilanish vaqti boshqa bo'limlarda ham ko'rinadi.
      await Promise.all(
        ["dashboard", "daily-rating", "winner", "audit-log"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onSaved();
    },
  });

  function update<K extends keyof ContestSettingsUpdate>(key: K, value: ContestSettingsUpdate[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!hasErrors && dirty) {
      mutation.mutate();
    }
  }

  const fieldError = (key: keyof ContestSettingsUpdate) => (showErrors ? errors[key] : undefined);

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {mutation.isError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorMessage(mutation.error)}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tanlov muddati</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="startsOn"
            label="Boshlanish sanasi"
            error={fieldError("startsOn")}
            hint={data.contestStarted ? "Tanlov boshlangan — o'zgartirib bo'lmaydi." : undefined}
          >
            <Input
              id="startsOn"
              type="date"
              value={form.startsOn}
              disabled={data.contestStarted || mutation.isPending}
              onChange={(event) => update("startsOn", event.target.value)}
              aria-invalid={fieldError("startsOn") ? true : undefined}
            />
          </Field>
          <Field
            id="endsOn"
            label="Tugash sanasi"
            error={fieldError("endsOn")}
            hint="G'olib shu kungi reyting bo'yicha aniqlanadi."
          >
            <Input
              id="endsOn"
              type="date"
              value={form.endsOn}
              min={data.today}
              disabled={mutation.isPending}
              onChange={(event) => update("endsOn", event.target.value)}
              aria-invalid={fieldError("endsOn") ? true : undefined}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yangilanish va ishtirok sharti</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            id="syncEveryDays"
            label="Ko'rishlar yangilanish davri"
            error={fieldError("syncEveryDays")}
            hint="Ko'rishlar va reyting tanlov boshidan shu davrda bir yangilanadi (Apify narxi davrga qarab). Yangi video yuborilganda darhol tekshiriladi."
          >
            <Select
              id="syncEveryDays"
              value={String(form.syncEveryDays)}
              disabled={mutation.isPending}
              onChange={(event) => update("syncEveryDays", Number.parseInt(event.target.value, 10))}
            >
              {SYNC_PERIODS.some((p) => p.days === initial.syncEveryDays) ? null : (
                <option value={initial.syncEveryDays}>{periodLabel(initial.syncEveryDays)}</option>
              )}
              {SYNC_PERIODS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="syncTime"
            label="Ko'rishlar yig'iladigan vaqt (Toshkent)"
            error={fieldError("syncTime")}
            hint={`${periodLabel(form.syncEveryDays)} shu vaqtda ko'rishlar yig'iladi va reyting yangilanadi.`}
          >
            <Input
              id="syncTime"
              type="time"
              value={form.syncTime}
              disabled={mutation.isPending}
              onChange={(event) => update("syncTime", event.target.value)}
              aria-invalid={fieldError("syncTime") ? true : undefined}
            />
          </Field>
          <Field
            id="minAge"
            label="Minimal yosh"
            error={fieldError("minAge")}
            hint="Ro'yxatdan o'tishda tekshiriladi (PLAN.md Q3)."
          >
            <Input
              id="minAge"
              type="number"
              inputMode="numeric"
              min={14}
              max={100}
              value={Number.isNaN(form.minAge) ? "" : form.minAge}
              disabled={mutation.isPending}
              onChange={(event) => update("minAge", Number.parseInt(event.target.value, 10))}
              aria-invalid={fieldError("minAge") ? true : undefined}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          disabled={!dirty || mutation.isPending}
          onClick={() => {
            setForm(initial);
            setShowErrors(false);
            mutation.reset();
          }}
        >
          O&apos;zgarishlarni bekor qilish
        </Button>
        <Button type="submit" loading={mutation.isPending} disabled={!dirty}>
          Saqlash
        </Button>
      </div>
    </form>
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
