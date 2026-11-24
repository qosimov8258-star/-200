"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Info, Play, Plus, Smartphone, Trash2 } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getContestRules, getRulesVideo, updateContestRules } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { RULES_LIMITS, type ContestRules, type RulesSection } from "@/lib/types";

import { RULES_VIDEO_QUERY_KEY, RulesVideoCard } from "./rules-video-card";

const L = RULES_LIMITS;

/** Forma ichida bo'limlarni barqaror kalit bilan saqlaymiz (tartib o'zgarsa ham fokus yo'qolmasin). */
interface DraftSection extends RulesSection {
  key: number;
}

let nextKey = 1;
const toDraft = (sections: RulesSection[]): DraftSection[] =>
  sections.map((s) => ({ ...s, key: nextKey++ }));
const toSections = (draft: DraftSection[]): RulesSection[] =>
  draft.map(({ title, body }) => ({ title: title.trim(), body: body.trim() }));

function sectionErrors(s: RulesSection): { title?: string; body?: string } {
  const title = s.title.trim().length;
  const body = s.body.trim().length;
  return {
    title: title < L.titleMin ? "Sarlavhani kiriting." : title > L.titleMax ? `Ko'pi bilan ${L.titleMax} belgi.` : undefined,
    body: body < L.bodyMin ? "Matnni kiriting." : body > L.bodyMax ? `Ko'pi bilan ${L.bodyMax} belgi.` : undefined,
  };
}

const NOTICE_TIMEOUT_MS = 5000;

/**
 * Sozlamalar → Tanlov qoidalari: tepada qoida videosi (Mini App'da ham bo'limlardan oldin turadi),
 * ostida bo'limlarni tahrirlash, qo'shish, o'chirish va tartiblash.
 */
export function RulesEditor() {
  return (
    <div className="space-y-4">
      <RulesVideoCard />
      <RulesSectionsEditor />
    </div>
  );
}

function RulesSectionsEditor() {
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: ["rules"],
    queryFn: getContestRules,
  });
  // Saqlangach forma qayta yaratiladi, shuning uchun xabar holati shu yerda.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  if (isPending) {
    return (
      <Card className="flex justify-center py-16">
        <Spinner />
      </Card>
    );
  }
  if (isError || !data) {
    return (
      <Card className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <IosIcon icon={AlertTriangle} tint="orange" size={48} />
        <p className="text-sm text-slate-600">{errorMessage(error)}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Qayta urinish
        </Button>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div role="status" aria-live="polite">
        {saved && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Qoidalar saqlandi — ishtirokchilar Mini App&apos;da yangi matnni ko&apos;radi.
          </div>
        )}
      </div>
      {/* Saqlangandan keyin forma yangi qiymatlardan qayta boshlanadi. */}
      <RulesForm
        key={`${data.version}-${data.updatedAt ?? "initial"}`}
        rules={data}
        onEdit={() => setSaved(false)}
        onSaved={() => setSaved(true)}
      />
    </div>
  );
}

function RulesForm({
  rules,
  onEdit,
  onSaved,
}: {
  rules: ContestRules;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<DraftSection[]>(() => toDraft(rules.sections));
  const [requireReconsent, setRequireReconsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const sections = toSections(draft);
  const dirty = JSON.stringify(sections) !== JSON.stringify(rules.sections);
  const errors = draft.map(sectionErrors);
  const hasErrors = errors.some((e) => e.title || e.body);

  const patch = (key: number, change: Partial<RulesSection>) => {
    onEdit();
    setDraft((d) => d.map((s) => (s.key === key ? { ...s, ...change } : s)));
  };
  const move = (index: number, delta: -1 | 1) => {
    onEdit();
    setDraft((d) => {
      const next = [...d];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  };
  const remove = (key: number) => {
    onEdit();
    setDraft((d) => d.filter((s) => s.key !== key));
  };
  const add = () => {
    onEdit();
    setDraft((d) => [...d, { key: nextKey++, title: `${d.length + 1}. `, body: "" }]);
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!hasErrors && (dirty || requireReconsent)) setConfirming(true);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Tanlov qoidalari</CardTitle>
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <Badge tone="brand">Versiya {rules.version}</Badge>
              {rules.updatedAt && (
                <span>
                  Oxirgi o&apos;zgarish: {formatDateTime(rules.updatedAt)} · {rules.updatedBy}
                </span>
              )}
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-slate-600">
              <IosIcon icon={Info} tint="blue" size={22} />
              Qoidalar ishtirokchiga Telegram Mini App&apos;da ro&apos;yxatdan o&apos;tishda va
              &quot;Tanlov qoidalari&quot; sahifasida ko&apos;rsatiladi. Rozilik bermasdan ishtirok
              etib bo&apos;lmaydi.
            </p>

            <ol className="space-y-3">
              {draft.map((section, index) => {
                const err = showErrors ? errors[index] : {};
                return (
                  <li key={section.key} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {index + 1}-bo&apos;lim
                      </span>
                      <span className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${index + 1}-bo'limni yuqoriga`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${index + 1}-bo'limni pastga`}
                          disabled={index === draft.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${index + 1}-bo'limni o'chirish`}
                          disabled={draft.length <= L.minSections}
                          onClick={() => remove(section.key)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor={`rule-title-${section.key}`} className="sr-only">
                          Sarlavha
                        </Label>
                        <Input
                          id={`rule-title-${section.key}`}
                          placeholder="Sarlavha, masalan: 6. Sovrinni topshirish"
                          value={section.title}
                          maxLength={L.titleMax}
                          onChange={(e) => patch(section.key, { title: e.target.value })}
                          aria-invalid={err.title ? true : undefined}
                          className="font-semibold"
                        />
                        {err.title && <p className="text-xs text-red-600">{err.title}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`rule-body-${section.key}`} className="sr-only">
                          Matn
                        </Label>
                        <Textarea
                          id={`rule-body-${section.key}`}
                          placeholder="Qoida matni"
                          rows={Math.min(8, Math.max(3, Math.ceil(section.body.length / 70)))}
                          value={section.body}
                          maxLength={L.bodyMax}
                          onChange={(e) => patch(section.key, { body: e.target.value })}
                          aria-invalid={err.body ? true : undefined}
                        />
                        <p className={err.body ? "text-xs text-red-600" : "text-right text-xs text-slate-400"}>
                          {err.body ?? `${section.body.trim().length} / ${L.bodyMax}`}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <Button variant="secondary" onClick={add} disabled={draft.length >= L.maxSections}>
              <Plus className="size-4" aria-hidden />
              Bo&apos;lim qo&apos;shish
            </Button>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-amber-600"
                checked={requireReconsent}
                onChange={(e) => setRequireReconsent(e.target.checked)}
              />
              <span>
                <span className="font-semibold">Muhim o&apos;zgarish — qayta rozilik so&apos;ralsin.</span>{" "}
                Versiya {rules.version + 1} ga oshadi va barcha ishtirokchilar Mini App&apos;ni keyingi
                ochishda yangilangan qoidalarga qaytadan rozilik beradi. Imlo xatosini tuzatish kabi
                kichik o&apos;zgarishlar uchun belgilamang.
              </span>
            </label>

            {showErrors && hasErrors && (
              <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                Bo&apos;sh yoki juda uzun maydonlarni to&apos;g&apos;rilang.
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={!dirty && !requireReconsent}
                onClick={() => {
                  setDraft(toDraft(rules.sections));
                  setRequireReconsent(false);
                  setShowErrors(false);
                }}
              >
                O&apos;zgarishlarni bekor qilish
              </Button>
              <Button type="submit" disabled={!dirty && !requireReconsent}>
                Qoidalarni saqlash
              </Button>
            </div>
          </CardContent>
        </Card>

        <Preview sections={sections} />
      </div>

      {confirming && (
        <ConfirmDialog
          title={requireReconsent ? "Qoidalar yangilansinmi?" : "Qoidalar saqlansinmi?"}
          description={
            requireReconsent
              ? `Versiya ${rules.version + 1} bo'ladi. Barcha ishtirokchilar Mini App'ni ochganda yangilangan qoidalarga qaytadan rozilik berishi kerak bo'ladi.`
              : "Ishtirokchilar yangilangan matnni darhol ko'radi. Qayta rozilik so'ralmaydi."
          }
          confirmLabel="Saqlash"
          onConfirm={() => updateContestRules({ sections, requireReconsent })}
          onClose={() => setConfirming(false)}
          onDone={async () => {
            setConfirming(false);
            onSaved();
            await queryClient.invalidateQueries({ queryKey: ["rules"] });
            await queryClient.invalidateQueries({ queryKey: ["audit-log"] });
          }}
        />
      )}
    </form>
  );
}

/** Ishtirokchi Mini App'da qanday ko'rishini taxminan ko'rsatadi (video bo'lsa — eng tepada). */
function Preview({ sections }: { sections: RulesSection[] }) {
  const { data: video } = useQuery({ queryKey: RULES_VIDEO_QUERY_KEY, queryFn: getRulesVideo });
  return (
    <aside className="lg:sticky lg:top-24">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <Smartphone className="size-3.5" aria-hidden />
        Ilovada ko&apos;rinishi
      </p>
      <div className="max-h-[640px] overflow-y-auto rounded-[28px] border-[6px] border-slate-800 bg-[#f1f2f4] p-4">
        <h3 className="mb-3 text-xl font-bold tracking-tight text-[#1e1f22]">Tanlov qoidalari</h3>
        {video && (
          <div className="mb-3 flex aspect-video flex-col items-center justify-center gap-1.5 rounded-[22px] bg-slate-900 text-xs text-white/70">
            <span className="flex size-10 items-center justify-center rounded-full bg-white/15">
              <Play className="size-5 fill-white text-white" aria-hidden />
            </span>
            Qoida videosi
          </div>
        )}
        <div className="space-y-4 rounded-[22px] bg-white p-4">
          {sections.map((s, i) => (
            <section key={i}>
              <h4 className="text-sm font-semibold text-[#1e1f22]">{s.title || "Sarlavha"}</h4>
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-[#1e1f22]">
                {s.body || "Matn"}
              </p>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
