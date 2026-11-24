"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/api-error";
import { updateOwnerParticipant } from "@/lib/owner-api";
import { OWNER_STATUS_LABELS } from "@/lib/owner-labels";
import type { OwnerParticipant, OwnerParticipantStatus, OwnerParticipantUpdate } from "@/lib/owner-types";

import { ownerFullName } from "./owner-common";

const STATUSES: OwnerParticipantStatus[] = ["ACTIVE", "BLOCKED", "DISQUALIFIED"];

interface FormValues {
  firstName: string;
  lastName: string;
  age: string;
  phone: string;
  status: OwnerParticipantStatus;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

/** "+998 90 123 45 67", "90 123 45 67" -> "+998901234567"; noto'g'ri bo'lsa — null (backend ham shunday normallashtiradi). */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  return null;
}

/** Ism/familiya: 2–40 ta harf, apostrof (barcha variantlari), chiziqcha va bo'sh joy. */
const NAME_PATTERN = /^[\p{L}'ʻʼ‘’`\- ]{2,40}$/u;

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function initialValues(participant: OwnerParticipant): FormValues {
  return {
    firstName: participant.firstName ?? "",
    lastName: participant.lastName ?? "",
    age: participant.age !== null ? String(participant.age) : "",
    phone: participant.phone ?? "",
    status: participant.status,
  };
}

/**
 * Kontrakt qoidalari bo'yicha tekshiradi va FAQAT o'zgargan maydonlarni qaytaradi.
 * Bo'sh qoldirilgan (avval ham bo'sh bo'lgan) maydon yuborilmaydi.
 */
function buildUpdate(
  participant: OwnerParticipant,
  values: FormValues,
): { update: OwnerParticipantUpdate; errors: FieldErrors } {
  const update: OwnerParticipantUpdate = {};
  const errors: FieldErrors = {};

  const nameField = (key: "firstName" | "lastName", label: string) => {
    const value = cleanName(values[key]);
    const original = participant[key] ?? "";
    if (value === original) return;
    // Familiya ixtiyoriy — o'chirib qo'yish mumkin.
    if (key === "lastName" && value === "") {
      update.lastName = "";
      return;
    }
    if (!NAME_PATTERN.test(value) || !/\p{L}/u.test(value)) {
      errors[key] = `${label}: 2–40 ta harf (apostrof, chiziqcha va bo'sh joy mumkin, raqam yo'q).`;
      return;
    }
    update[key] = value;
  };
  nameField("firstName", "Ism");
  nameField("lastName", "Familiya");

  const ageText = values.age.trim();
  const originalAge = participant.age !== null ? String(participant.age) : "";
  if (ageText !== originalAge) {
    const age = Number(ageText);
    if (!ageText || !Number.isInteger(age) || age < 14 || age > 100) {
      errors.age = "Yosh 14 dan 100 gacha butun son bo'lsin.";
    } else {
      update.age = age;
    }
  }

  const phoneText = values.phone.trim();
  if (phoneText !== (participant.phone ?? "")) {
    const phone = normalizePhone(phoneText);
    if (!phone) {
      errors.phone = "Telefon +998 XX XXX XX XX ko'rinishida bo'lsin.";
    } else if (phone !== participant.phone) {
      update.phone = phone;
    }
  }

  if (values.status !== participant.status) {
    update.status = values.status;
  }

  // Ro'yxatdan o'tmagan (ismi yo'q) ishtirokchiga ism yozilsa — yosh ham birga (backend talabi).
  // Familiya ixtiyoriy (ro'yxatdan o'tishda endi so'ralmaydi).
  if (participant.firstName === null && update.firstName !== undefined) {
    if (update.age === undefined && !errors.age) errors.age = "Ism bilan birga yoshni ham kiriting.";
  }

  return { update, errors };
}

interface OwnerParticipantDialogProps {
  participant: OwnerParticipant;
  onClose: () => void;
  onDone: (updated: OwnerParticipant) => void;
}

/** Ism, familiya, yosh, telefon va holatni tahrirlash. Ko'rishlarni tahrirlab bo'lmaydi. */
export function OwnerParticipantDialog({ participant, onClose, onDone }: OwnerParticipantDialogProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(participant));
  const [showErrors, setShowErrors] = useState(false);

  const { update, errors } = buildUpdate(participant, values);
  const changed = Object.keys(update).length > 0;
  const hasErrors = Object.keys(errors).length > 0;
  /** Biror maydon boshlang'ich qiymatdan farq qiladi (xato bo'lsa ham — xabar ko'rsatilsin). */
  const dirty = changed || hasErrors;
  const visibleErrors: FieldErrors = showErrors ? errors : {};

  const mutation = useMutation({
    mutationFn: () => updateOwnerParticipant(participant.id, update),
    onSuccess: (updated) => onDone(updated),
  });

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!hasErrors && changed) mutation.mutate();
  }

  const field = (key: keyof FormValues) => ({
    id: `owner-edit-${key}`,
    disabled: mutation.isPending,
    "aria-invalid": visibleErrors[key] ? true : undefined,
    "aria-describedby": visibleErrors[key] ? `owner-edit-${key}-error` : undefined,
  });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Ishtirokchini tahrirlash"
      description={
        <>
          <strong className="font-medium text-slate-900">{ownerFullName(participant)}</strong>
          <span className="ml-1.5 font-mono text-xs text-slate-400">ID {participant.id}</span>
          <span className="mt-1 block text-xs">Faqat o&apos;zgartirilgan maydonlar saqlanadi.</span>
        </>
      }
      busy={mutation.isPending}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {mutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{errorMessage(mutation.error)}</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="owner-edit-firstName">Ism</Label>
            <Input
              {...field("firstName")}
              data-autofocus
              autoComplete="off"
              maxLength={40}
              value={values.firstName}
              onChange={(event) => set("firstName", event.target.value)}
            />
            <FieldError id="owner-edit-firstName-error" message={visibleErrors.firstName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-edit-lastName">Familiya</Label>
            <Input
              {...field("lastName")}
              autoComplete="off"
              maxLength={40}
              value={values.lastName}
              onChange={(event) => set("lastName", event.target.value)}
            />
            <FieldError id="owner-edit-lastName-error" message={visibleErrors.lastName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-edit-age">Yosh</Label>
            <Input
              {...field("age")}
              type="number"
              inputMode="numeric"
              min={14}
              max={100}
              value={values.age}
              onChange={(event) => set("age", event.target.value)}
            />
            <FieldError id="owner-edit-age-error" message={visibleErrors.age} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-edit-phone">Telefon</Label>
            <Input
              {...field("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+998901234567"
              value={values.phone}
              onChange={(event) => set("phone", event.target.value)}
            />
            <FieldError id="owner-edit-phone-error" message={visibleErrors.phone} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-edit-status">Holat</Label>
          <Select
            {...field("status")}
            value={values.status}
            onChange={(event) => {
              const next = STATUSES.find((status) => status === event.target.value);
              if (next) set("status", next);
            }}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {OWNER_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500">
            Bloklangan va chetlatilganlar reytingda ko&apos;rinmaydi. Holatni istalgan tomonga qaytarish mumkin.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
          {!dirty && <span className="text-xs text-slate-400 sm:mr-auto">Hali hech narsa o&apos;zgarmadi</span>}
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={!dirty}>
            Saqlash
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600">
      {message}
    </p>
  );
}
