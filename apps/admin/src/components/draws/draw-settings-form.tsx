"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  CalendarRange,
  Eye,
  Gift,
  MessageSquareText,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { IosIcon, type IosTint } from "@/components/ui/ios-icon";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteDrawPeriod } from "@/lib/api";
import { diffDays, isIsoDate } from "@/lib/dates";
import { periodLabel, renderDrawMessage, type DrawSettingsErrors } from "@/lib/draw-rules";
import { formatDayMonth, formatNumber } from "@/lib/format";
import { DRAW_DATE_BASIS_LABELS } from "@/lib/labels";
import type { DrawDateBasis, DrawPeriod, DrawSettings, DrawSetup, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DrawPeriodDialog } from "./draw-period-dialog";

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

/**
 * Random tanlov sozlamalari — uchta karta: asosiy sozlamalar (sovg'a, davr, ko'rishlar, g'oliblar soni),
 * "Kimlar qatnashmaydi" va "G'oliblarga bot xabari".
 */
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

  const queryClient = useQueryClient();
  /** Davr oynasi: `period: null` — yangi davr. */
  const [periodDialog, setPeriodDialog] = useState<{ period: DrawPeriod | null } | null>(null);
  const [deleting, setDeleting] = useState<DrawPeriod | null>(null);

  const isPeriodActive = (period: DrawPeriod) =>
    value.stage === null && value.periodFrom === period.startsOn && value.periodTo === period.endsOn;

  const selectPeriod = (period: DrawPeriod) =>
    onChange({ ...value, stage: null, periodFrom: period.startsOn, periodTo: period.endsOn });

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
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sozlamalar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Davr">
              {setup.stages.map((stage) => (
                <Chip key={stage.index} active={value.stage === stage.index} onClick={() => selectStage(stage.index)}>
                  <span className="font-semibold">{stage.index}-bosqich</span>
                  <span className="text-xs opacity-75">
                    {formatDayMonth(stage.startsOn)} – {formatDayMonth(stage.endsOn)}
                  </span>
                  <StateBadge state={periodState(stage.startsOn, stage.endsOn, setup.today)} />
                </Chip>
              ))}
              {setup.periods.map((period) => (
                <PeriodChip
                  key={period.id}
                  period={period}
                  today={setup.today}
                  active={isPeriodActive(period)}
                  onSelect={() => selectPeriod(period)}
                  onEdit={() => setPeriodDialog({ period })}
                  onDelete={() => setDeleting(period)}
                />
              ))}
              <button
                type="button"
                onClick={() => setPeriodDialog({ period: null })}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-white px-3.5 py-1.5 text-sm font-medium text-brand-600 transition hover:border-brand-500 hover:bg-brand-50"
              >
                <CalendarPlus className="size-4" aria-hidden />
                Davr yaratish
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#f7f6fb] px-3.5 py-2.5 text-sm">
              <CalendarRange className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="text-muted">Tanlangan davr:</span>
              <span className="font-semibold text-ink tabular-nums">{periodLabel(value.periodFrom, value.periodTo)}</span>
              {isIsoDate(value.periodFrom) && isIsoDate(value.periodTo) && value.periodTo >= value.periodFrom && (
                <span className="text-muted">· {formatNumber(diffDays(value.periodFrom, value.periodTo) + 1)} kun</span>
              )}
            </div>
            {(errors.periodFrom || errors.periodTo) && (
              <p className="text-xs text-red-600">{errors.periodFrom ?? errors.periodTo}</p>
            )}
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

        </CardContent>
      </Card>

      {/* Istisnolar */}
      <SectionCard
        icon={ShieldCheck}
        tint="red"
        title="Kimlar qatnashmaydi"
        description="Bloklangan va diskvalifikatsiya qilinganlar har doim chetda qoladi."
      >
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
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
      </SectionCard>

      {/* Bot xabari */}
      <SectionCard
        icon={MessageSquareText}
        tint="cyan"
        title="G'oliblarga bot xabari"
        description="G'oliblar tasdiqlangach, har biriga Telegram bot orqali shu matn yuboriladi."
      >
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
        <div className="rounded-2xl bg-[#e6ebf1] p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">Telegram&apos;da shunday ko&apos;rinadi:</p>
          <div className="max-w-sm rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm whitespace-pre-line shadow-sm">
            {preview}
          </div>
        </div>
      </SectionCard>

      {periodDialog && (
        <DrawPeriodDialog
          setup={setup}
          period={periodDialog.period}
          onClose={() => setPeriodDialog(null)}
          onSaved={(saved) => {
            // Yangi davr — darhol tanlanadi; tahrirlangan davr tanlangan bo'lsa — sanalari yangilanadi.
            const wasActive = periodDialog.period ? isPeriodActive(periodDialog.period) : true;
            if (wasActive) selectPeriod(saved);
            setPeriodDialog(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Davrni o'chirish"
          description={
            <>
              «{deleting.title}» ({periodLabel(deleting.startsOn, deleting.endsOn)}) davri ro&apos;yxatdan
              o&apos;chiriladi. Unda o&apos;tkazilgan tanlovlar o&apos;zgarmaydi.
            </>
          }
          confirmLabel="O'chirish"
          variant="danger"
          onConfirm={() => deleteDrawPeriod(deleting.id)}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null);
            void queryClient.invalidateQueries({ queryKey: ["draw-setup"] });
            void queryClient.invalidateQueries({ queryKey: ["audit-log"] });
          }}
        />
      )}
    </fieldset>
  );
}

type PeriodState = "finished" | "current" | "upcoming";

function periodState(startsOn: IsoDate, endsOn: IsoDate, today: IsoDate): PeriodState {
  if (endsOn < today) return "finished";
  return startsOn > today ? "upcoming" : "current";
}

const STATE_LABELS: Record<PeriodState, string> = {
  finished: "tugagan",
  current: "davom etmoqda",
  upcoming: "boshlanmagan",
};

function StateBadge({ state }: { state: PeriodState }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 text-[10px] font-semibold",
        state === "finished" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700",
      )}
    >
      {STATE_LABELS[state]}
    </span>
  );
}

/** Admin yaratgan davr: tanlash tugmasi va yonida tahrirlash / o'chirish. */
function PeriodChip({
  period,
  today,
  active,
  onSelect,
  onEdit,
  onDelete,
}: {
  period: DrawPeriod;
  today: IsoDate;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const iconButton = cn(
    "grid size-7 place-items-center rounded-full transition",
    active ? "text-white/80 hover:bg-white/15 hover:text-white" : "text-muted hover:bg-brand-50 hover:text-ink",
  );
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border py-0.5 pr-1 pl-0.5 text-sm transition",
        active ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onSelect}
        className="inline-flex items-center gap-2 rounded-full py-1 pr-1.5 pl-2.5"
      >
        <span className="max-w-[12rem] truncate font-semibold">{period.title}</span>
        <span className="text-xs opacity-75">
          {formatDayMonth(period.startsOn)} – {formatDayMonth(period.endsOn)}
        </span>
        <StateBadge state={periodState(period.startsOn, period.endsOn, today)} />
      </button>
      <button type="button" onClick={onEdit} aria-label={`«${period.title}» davrini tahrirlash`} title="Tahrirlash" className={iconButton}>
        <Pencil className="size-3.5" aria-hidden />
      </button>
      <button type="button" onClick={onDelete} aria-label={`«${period.title}» davrini o'chirish`} title="O'chirish" className={iconButton}>
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

/** Alohida karta: iOS ikonka, sarlavha va izoh, ostida mazmun. */
function SectionCard({
  icon,
  tint,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  tint: IosTint;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex items-start gap-3">
        <IosIcon icon={icon} tint={tint} size={34} />
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
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
