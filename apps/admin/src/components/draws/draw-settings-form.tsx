"use client";

import { useRef } from "react";
import { CalendarCheck, Eye, Lock, MessageSquareText, ShieldCheck, Users, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { renderDrawMessage, type DrawSettingsInputErrors } from "@/lib/draw-rules";
import { DRAW_DATE_BASIS_LABELS } from "@/lib/labels";
import type { DrawDateBasis, DrawPlaceholder, DrawSettingsInput, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Bot xabari namunasi uchun qiymatlar (sovg'a va joriy bosqich). */
export interface DrawMessageExample {
  prizeTitle: string;
  stage: number | null;
  periodFrom: IsoDate;
  periodTo: IsoDate;
}

interface DrawSettingsFormProps {
  value: DrawSettingsInput;
  errors: DrawSettingsInputErrors;
  onChange: (next: DrawSettingsInput) => void;
  placeholders: DrawPlaceholder[];
  example: DrawMessageExample;
  disabled?: boolean;
}

export const DATE_BASIS_HINTS: Record<DrawDateBasis, string> = {
  POSTED: "Aksiya qoidasi: shu oyda Instagram'ga joylangan Reellargina hisoblanadi.",
  SUBMITTED: "Reel qachon joylanganidan qat'i nazar, shu davrda ilovaga yuborilganlar.",
};

const EXCLUSIONS: Array<{ key: "excludeTargets" | "excludeWarned"; title: string; hint: string }> = [
  {
    key: "excludeTargets",
    title: "Target aniqlanganlar qatnashmasin",
    hint: "Pullik reklama (target) aniqlangan va ro'yxatdan chiqarilmagan ishtirokchilar.",
  },
  {
    key: "excludeWarned",
    title: "Ogohlantirilganlar qatnashmasin",
    hint: "Qoidabuzarlik uchun ogohlantirish olgan ishtirokchilar.",
  },
];

/** Har doim yoqiq qoida — o'chirib bo'lmaydi (voucher bir kishiga bir marta). */
export const PREVIOUS_WINNERS_RULE = "Voucher olganlar qatnashmaydi — bir kishiga aksiya davomida bir marta";

/**
 * Random tanlovning doimiy sozlamalari: Reel sanasi, ko'rishlar oralig'i, g'oliblar va zaxira soni,
 * kimlar qatnashmaydi va g'oliblarga bot xabari. Davr bu yerda emas — u har tanlovda tanlanadi.
 */
export function DrawSettingsForm({
  value,
  errors,
  onChange,
  placeholders,
  example,
  disabled = false,
}: DrawSettingsFormProps) {
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof DrawSettingsInput>(key: K, next: DrawSettingsInput[K]) =>
    onChange({ ...value, [key]: next });

  /** O'rinbosarni kursor turgan joyga qo'yadi. */
  const insertToken = (token: string) => {
    const el = templateRef.current;
    const start = el?.selectionStart ?? value.messageTemplate.length;
    const end = el?.selectionEnd ?? start;
    const text = value.messageTemplate.slice(0, start) + token + value.messageTemplate.slice(end);
    set("messageTemplate", text);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const preview = renderDrawMessage(value.messageTemplate, {
    firstName: "Dilnoza",
    lastName: "Rahimova",
    prizeTitle: example.prizeTitle,
    stage: example.stage,
    periodFrom: example.periodFrom,
    periodTo: example.periodTo,
    views: 24_560,
  });

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      {/* Reel sanasi */}
      <Section icon={CalendarCheck} title="Qaysi Reellar hisoblanadi">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Reel sanasi">
          {(Object.keys(DRAW_DATE_BASIS_LABELS) as DrawDateBasis[]).map((basis) => (
            <button
              key={basis}
              type="button"
              role="radio"
              aria-checked={value.dateBasis === basis}
              onClick={() => set("dateBasis", basis)}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                value.dateBasis === basis
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {DRAW_DATE_BASIS_LABELS[basis]}
                {basis === "POSTED" && <Badge tone="brand">Tavsiya</Badge>}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{DATE_BASIS_HINTS[basis]}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Ko'rishlar */}
      <Section icon={Eye} title="Ko'rishlar oralig'i">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Eng kami" error={errors.minViews}>
            <NumberInput value={value.minViews} onChange={(n) => set("minViews", n)} invalid={Boolean(errors.minViews)} />
          </Field>
          <Field label="Eng ko'pi" error={errors.maxViews}>
            <NumberInput value={value.maxViews} onChange={(n) => set("maxViews", n)} invalid={Boolean(errors.maxViews)} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Davrdagi eng ko&apos;p ko&apos;rilgan bitta tasdiqlangan video hisoblanadi (videolar ko&apos;rishlari
          qo&apos;shilmaydi).
        </p>
      </Section>

      {/* G'oliblar */}
      <Section icon={Users} title="G'oliblar">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="G'oliblar soni" error={errors.winnersCount}>
            <NumberInput
              value={value.winnersCount}
              onChange={(n) => set("winnersCount", n)}
              invalid={Boolean(errors.winnersCount)}
            />
          </Field>
          <Field label="Zaxira" error={errors.reservesCount} hint="G'olib chetlatilsa, navbatdagi zaxira o'rnini oladi.">
            <NumberInput
              value={value.reservesCount}
              onChange={(n) => set("reservesCount", n)}
              invalid={Boolean(errors.reservesCount)}
            />
          </Field>
        </div>
      </Section>

      {/* Istisnolar */}
      <Section icon={ShieldCheck} title="Kimlar qatnashmaydi">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
          <li className="flex items-start gap-3 bg-[#f7f6fb] px-4 py-3.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {PREVIOUS_WINNERS_RULE}{" "}
                <Badge tone="brand" className="ml-1 align-middle">
                  Doim yoqiq
                </Badge>
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Bekor qilinmagan istalgan tanlov g&apos;oliblari keyingi tanlovlarga kirmaydi. O&apos;chirib bo&apos;lmaydi.
              </span>
            </span>
          </li>
          {EXCLUSIONS.map((item) => (
            <li key={item.key}>
              <label className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/40">
                <input
                  type="checkbox"
                  checked={value[item.key]}
                  onChange={(e) => set(item.key, e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">{item.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Bloklangan va diskvalifikatsiya qilinganlar har doim chetda qoladi.</p>
      </Section>

      {/* Bot xabari */}
      <Section icon={MessageSquareText} title="G'oliblarga bot xabari">
        <p className="-mt-1 text-xs text-muted">Natija tasdiqlangach, har bir g&apos;olibga Telegram bot orqali shu matn boradi.</p>
        <div className="flex flex-wrap gap-1.5">
          {placeholders.map((p) => (
            <button
              key={p.token}
              type="button"
              onClick={() => insertToken(p.token)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700"
              title={p.label}
            >
              {p.token}
            </button>
          ))}
        </div>
        <Field label="Matn" error={errors.messageTemplate}>
          <Textarea
            ref={templateRef}
            rows={6}
            value={value.messageTemplate}
            onChange={(e) => set("messageTemplate", e.target.value)}
            aria-invalid={errors.messageTemplate ? true : undefined}
          />
        </Field>
        <DrawMessagePreview text={preview} />
      </Section>
    </fieldset>
  );
}

/** Telegram'dagi ko'rinishi: kulrang fon ustida oq "pufak". */
export function DrawMessagePreview({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#e6ebf1] p-3">
      <p className="mb-2 text-xs font-medium text-slate-500">Telegram&apos;da shunday ko&apos;rinadi:</p>
      <div className="max-w-sm rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm whitespace-pre-line shadow-sm">
        {text}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="size-4 text-brand-600" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="block">
        <span className="mb-1.5 block">{label}</span>
        {children}
      </Label>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function NumberInput({ value, onChange, invalid }: { value: number; onChange: (n: number) => void; invalid: boolean }) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
      aria-invalid={invalid ? true : undefined}
      className="tabular-nums"
    />
  );
}
