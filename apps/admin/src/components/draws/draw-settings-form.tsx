"use client";

import { useRef } from "react";
import { CalendarRange, Eye, Gift, MessageSquareText, ShieldCheck, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { renderDrawMessage, type DrawSettingsErrors } from "@/lib/draw-rules";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { DRAW_DATE_BASIS_LABELS } from "@/lib/labels";
import type { DrawDateBasis, DrawSettings, DrawSetup } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DrawSettingsFormProps {
  setup: DrawSetup;
  value: DrawSettings;
  errors: DrawSettingsErrors;
  onChange: (next: DrawSettings) => void;
  disabled?: boolean;
}

const DATE_BASIS_HINTS: Record<DrawDateBasis, string> = {
  POSTED: "Aksiya qoidasi: oylik sovrin uchun faqat shu oyda yuklangan Reellar hisoblanadi.",
  SUBMITTED: "Reel qachon joylanganidan qat'i nazar, shu davrda ilovaga yuborilganlar.",
};

const EXCLUSIONS: Array<{
  key: "excludeTargets" | "excludeWarned" | "excludePreviousWinners";
  title: string;
  hint: string;
}> = [
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
  {
    key: "excludePreviousWinners",
    title: "Oldingi bosqich g'oliblari qatnashmasin",
    hint: "Qoidaga ko'ra har oy yutish mumkin — odatda o'chiq turadi.",
  },
];

/** Random tanlov sozlamalari: sovg'a, davr, ko'rishlar, g'oliblar soni, istisnolar, bot xabari. */
export function DrawSettingsForm({ setup, value, errors, onChange, disabled = false }: DrawSettingsFormProps) {
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof DrawSettings>(key: K, next: DrawSettings[K]) => onChange({ ...value, [key]: next });
  const prize = setup.prizes.find((item) => item.id === value.prizeId);

  const selectPrize = (prizeId: string) => {
    const next = setup.prizes.find((item) => item.id === prizeId);
    onChange({
      ...value,
      prizeId,
      minViews: next?.minViews ?? value.minViews,
      maxViews: next?.maxViews ?? value.maxViews,
      winnersCount: next?.quantity ?? value.winnersCount,
      reservesCount: next ? Math.ceil(next.quantity / 10) : value.reservesCount,
    });
  };

  const selectStage = (index: number | null) => {
    const stage = setup.stages.find((item) => item.index === index);
    onChange({
      ...value,
      stage: index,
      periodFrom: stage?.startsOn ?? value.periodFrom,
      periodTo: stage?.endsOn ?? value.periodTo,
    });
  };

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
    prizeTitle: prize?.title ?? "Sovg'a",
    stage: value.stage,
    periodFrom: value.periodFrom,
    periodTo: value.periodTo,
    views: 24_560,
  });

  return (
    <fieldset disabled={disabled} className="space-y-6">
      {/* Sovg'a */}
      <Section icon={Gift} title="Sovg'a">
        <Select value={value.prizeId} onChange={(e) => selectPrize(e.target.value)} aria-label="Oylik sovg'a">
          {setup.prizes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} — oyiga {formatNumber(item.quantity)} ta
            </option>
          ))}
        </Select>
        {setup.prizes.length === 0 && (
          <p className="text-sm text-amber-700">Sovg&apos;alar bo&apos;limida oylik sovg&apos;a yo&apos;q — avval qo&apos;shing.</p>
        )}
      </Section>

      {/* Davr */}
      <Section icon={CalendarRange} title="Davr">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bosqich">
          {setup.stages.map((stage) => (
            <Chip key={stage.index} active={value.stage === stage.index} onClick={() => selectStage(stage.index)}>
              <span className="font-semibold">{stage.index}-bosqich</span>
              <span className="text-xs opacity-75">
                {formatDayMonth(stage.startsOn)} – {formatDayMonth(stage.endsOn)}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  stage.finished ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
                )}
              >
                {stage.finished ? "tugagan" : stage.startsOn > setup.today ? "boshlanmagan" : "davom etmoqda"}
              </span>
            </Chip>
          ))}
          <Chip active={value.stage === null} onClick={() => selectStage(null)}>
            <span className="font-semibold">Boshqa davr</span>
          </Chip>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Boshlanish" error={errors.periodFrom}>
            <Input
              type="date"
              value={value.periodFrom}
              readOnly={value.stage !== null}
              onChange={(e) => set("periodFrom", e.target.value)}
              aria-invalid={errors.periodFrom ? true : undefined}
            />
          </Field>
          <Field label="Tugash (shu kun ham kiradi)" error={errors.periodTo}>
            <Input
              type="date"
              value={value.periodTo}
              readOnly={value.stage !== null}
              onChange={(e) => set("periodTo", e.target.value)}
              aria-invalid={errors.periodTo ? true : undefined}
            />
          </Field>
        </div>
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
              <span className="block text-sm font-semibold">{DRAW_DATE_BASIS_LABELS[basis]}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{DATE_BASIS_HINTS[basis]}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Ko'rishlar */}
      <Section icon={Eye} title="Tasdiqlangan ko'rishlar (oy davomida)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Eng kami" error={errors.minViews}>
            <NumberInput value={value.minViews} onChange={(n) => set("minViews", n)} invalid={Boolean(errors.minViews)} />
          </Field>
          <Field label="Eng ko'pi" error={errors.maxViews}>
            <NumberInput value={value.maxViews} onChange={(n) => set("maxViews", n)} invalid={Boolean(errors.maxViews)} />
          </Field>
        </div>
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
          <Field
            label="Zaxira"
            error={errors.reservesCount}
            hint="G'olib chetlatilsa, navbatdagi zaxira uning o'rnini oladi."
          >
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
        <p className="text-xs text-slate-500">
          Bloklangan va diskvalifikatsiya qilinganlar har doim chetda qoladi.
        </p>
        <div className="space-y-2">
          {EXCLUSIONS.map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300"
            >
              <input
                type="checkbox"
                checked={value[item.key]}
                onChange={(e) => set(item.key, e.target.checked)}
                className="mt-0.5 size-4 accent-brand-600"
              />
              <span>
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-slate-500">{item.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      {/* Bot xabari */}
      <Section icon={MessageSquareText} title="G'oliblarga bot xabari">
        <div className="flex flex-wrap gap-1.5">
          {setup.placeholders.map((p) => (
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
        <div className="rounded-xl bg-[#e6ebf1] p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Telegram&apos;da shunday ko&apos;rinadi:</p>
          <div className="max-w-sm rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm whitespace-pre-line shadow-sm">
            {preview}
          </div>
        </div>
      </Section>
    </fieldset>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Gift; title: string; children: React.ReactNode }) {
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      {children}
    </button>
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
