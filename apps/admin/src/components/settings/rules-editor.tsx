"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Info,
  Pencil,
  Play,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { getContestRules, getRulesVideo, updateContestRules } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { RULES_LIMITS, type ContestRules, type RulesSection } from "@/lib/types";
import { cn } from "@/lib/utils";

import { RULES_VIDEO_QUERY_KEY } from "./rules-video-card";

const L = RULES_LIMITS;
const NOTICE_TIMEOUT_MS = 5000;

/** Qoidalar shu sanadagi imzolangan ommaviy ofertadan boshlangan. */
const OFFER_SIGNED_ON = "25.11.2026";

/**
 * Muharrir faqat o'zbekcha bo'limlarni saqlaydi: rus tilidagi ishtirokchilar backend'dagi ruscha
 * matnni (`sectionsRu`) ko'radi, yuklab olinadigan PDF oferta ham alohida fayl.
 */
const UZ_ONLY_WARNING =
  "Bu yerda faqat o'zbekcha matn o'zgaradi. Ruscha matn va yuklab olinadigan PDF oferta o'zgarmaydi — ularni dasturchi orqali yangilang.";

const EDIT_BUTTON_ID = "rules-edit-button";

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

type SectionState = "new" | "changed" | null;

/** Bo'lim tahrir boshidagi holatiga nisbatan: yangi qo'shilgan, o'zgargan yoki o'zgarmagan. */
function sectionState(original: RulesSection | undefined, section: RulesSection): SectionState {
  if (!original) return "new";
  const same = original.title.trim() === section.title.trim() && original.body.trim() === section.body.trim();
  return same ? null : "changed";
}

/** Saqlashdan oldin qisqa xulosa: "2 ta bo'lim o'zgardi · 1 ta yangi bo'lim · tartib o'zgardi". */
function changeSummary(initial: DraftSection[], draft: DraftSection[]): string | null {
  const originals = new Map(initial.map((s) => [s.key, s]));
  const draftKeys = new Set(draft.map((s) => s.key));
  let changed = 0;
  let added = 0;
  for (const section of draft) {
    const state = sectionState(originals.get(section.key), section);
    if (state === "new") added += 1;
    else if (state === "changed") changed += 1;
  }
  const keptOrder = initial.filter((s) => draftKeys.has(s.key)).map((s) => s.key);
  const draftOrder = draft.filter((s) => originals.has(s.key)).map((s) => s.key);
  const removed = initial.length - keptOrder.length;

  const parts: string[] = [];
  if (changed) parts.push(`${changed} ta bo'lim o'zgardi`);
  if (added) parts.push(`${added} ta yangi bo'lim`);
  if (removed) parts.push(`${removed} ta bo'lim o'chirildi`);
  if (keptOrder.join() !== draftOrder.join()) parts.push("tartib o'zgardi");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Sozlamalar → Qoidalar matni (ommaviy oferta). Sukut bo'yicha ko'rish rejimi: bo'limlar ro'yxati va
 * telefon ko'rinishi. "Matnni tahrirlash" bosilgach — har bo'lim yig'iladigan blok: tahrirlash,
 * qo'shish, o'chirish va tartiblash. Qoida videosi — alohida bo'lim (`RulesVideoCard`).
 */
export function RulesEditor() {
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
            Qoidalar saqlandi — o&apos;zbek tilidagi ishtirokchilar yangi matnni ko&apos;radi.
          </div>
        )}
      </div>
      {/* Saqlangandan keyin forma yangi qiymatlardan (ko'rish rejimida) qayta boshlanadi. */}
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
  // Tahrir boshidagi bo'limlar — "o'zgardi" belgisi va "bekor qilish" shu kalitlar bilan ishlaydi.
  const [initialDraft] = useState(() => toDraft(rules.sections));
  const [draft, setDraft] = useState<DraftSection[]>(initialDraft);
  const [editing, setEditing] = useState(false);
  const [openKeys, setOpenKeys] = useState<ReadonlySet<number>>(() => new Set());
  const [requireReconsent, setRequireReconsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const originals = new Map(initialDraft.map((s) => [s.key, s]));
  const sections = toSections(draft);
  const dirty = JSON.stringify(sections) !== JSON.stringify(rules.sections);
  const errors = draft.map(sectionErrors);
  const hasErrors = errors.some((e) => e.title || e.body);
  const summary = changeSummary(initialDraft, draft);
  const canSave = dirty || requireReconsent;

  const setOpen = (key: number, open: boolean) =>
    setOpenKeys((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

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
    const key = nextKey++;
    setDraft((d) => [...d, { key, title: `${d.length + 1}. `, body: "" }]);
    setOpen(key, true);
    // Yangi bo'lim ochiq chiziladi — fokus darhol uning sarlavhasiga.
    requestAnimationFrame(() => document.getElementById(`rule-title-${key}`)?.focus());
  };

  function startEditing() {
    onEdit();
    setEditing(true);
    requestAnimationFrame(() => listRef.current?.querySelector("summary")?.focus());
  }

  function stopEditing() {
    setDraft(initialDraft);
    setRequireReconsent(false);
    setShowErrors(false);
    setOpenKeys(new Set());
    setEditing(false);
    requestAnimationFrame(() => document.getElementById(EDIT_BUTTON_ID)?.focus());
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setShowErrors(true);
    if (hasErrors) {
      // Xatoli bo'limlar ochiladi va fokus birinchi xato maydonga o'tadi.
      setOpenKeys((current) => {
        const next = new Set(current);
        draft.forEach((s, i) => {
          if (errors[i].title || errors[i].body) next.add(s.key);
        });
        return next;
      });
      requestAnimationFrame(() =>
        listRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    if (canSave) setConfirming(true);
  }

  const errorCount = errors.filter((e) => e.title || e.body).length;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500" title={`Qoidalar versiyasi: ${rules.version}`}>
                {rules.updatedAt ? (
                  <>
                    Oxirgi o&apos;zgarish:{" "}
                    <time dateTime={rules.updatedAt} className="tabular-nums">
                      {formatDateTime(rules.updatedAt)}
                    </time>
                    {rules.updatedBy && ` · ${rules.updatedBy}`}
                  </>
                ) : (
                  "Hali o'zgartirilmagan"
                )}
              </p>
              {editing ? (
                <Badge tone="warning">Tahrirlanmoqda</Badge>
              ) : (
                <Button id={EDIT_BUTTON_ID} variant="secondary" onClick={startEditing}>
                  <Pencil className="size-4" aria-hidden />
                  Matnni tahrirlash
                </Button>
              )}
            </div>

            <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              <span>{UZ_ONLY_WARNING}</span>
            </p>

            <p className="flex items-start gap-2 text-sm text-slate-600">
              <IosIcon icon={Info} tint="blue" size={22} />
              <span>
                Bu — {OFFER_SIGNED_ON} dagi ommaviy oferta. Ishtirokchi uni ro&apos;yxatdan o&apos;tishda
                o&apos;qib, rozilik beradi. Faqat yuristlar bilan kelishilgan o&apos;zgarishlarni kiriting.
              </span>
            </p>

            {editing ? (
              <>
                <ol ref={listRef} aria-label="Qoidalar bo'limlari (tahrirlash)" className="space-y-2">
                  {draft.map((section, index) => {
                    const err = showErrors ? errors[index] : {};
                    const invalid = Boolean(err.title || err.body);
                    const state = sectionState(originals.get(section.key), section);
                    const number = index + 1;
                    return (
                      <li key={section.key}>
                        <details
                          open={openKeys.has(section.key)}
                          onToggle={(event) => setOpen(section.key, event.currentTarget.open)}
                          className={cn(
                            "group rounded-lg border bg-white",
                            invalid ? "border-red-300" : "border-slate-200",
                          )}
                        >
                          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
                            <ChevronRight
                              className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-ink">
                              {section.title.trim() || `${number}-bo'lim (sarlavhasiz)`}
                            </span>
                            {state === "new" && <Badge tone="brand">yangi</Badge>}
                            {state === "changed" && <Badge tone="warning">o&apos;zgardi</Badge>}
                            {invalid && <Badge tone="danger">xato</Badge>}
                          </summary>
                          <div className="space-y-3 border-t border-slate-200 bg-slate-50/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                {number}-bo&apos;lim
                              </span>
                              <span className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`${number}-bo'limni yuqoriga`}
                                  disabled={index === 0}
                                  onClick={() => move(index, -1)}
                                >
                                  <ArrowUp className="size-4" aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`${number}-bo'limni pastga`}
                                  disabled={index === draft.length - 1}
                                  onClick={() => move(index, 1)}
                                >
                                  <ArrowDown className="size-4" aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`${number}-bo'limni o'chirish`}
                                  disabled={draft.length <= L.minSections}
                                  onClick={() => remove(section.key)}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </span>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`rule-title-${section.key}`}>Sarlavha</Label>
                              <Input
                                id={`rule-title-${section.key}`}
                                placeholder="Masalan: 6. Sovrinni topshirish"
                                value={section.title}
                                maxLength={L.titleMax}
                                onChange={(e) => patch(section.key, { title: e.target.value })}
                                aria-invalid={err.title ? true : undefined}
                                className="font-semibold"
                              />
                              {err.title && <p className="text-xs text-red-600">{err.title}</p>}
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`rule-body-${section.key}`}>Matn</Label>
                              <Textarea
                                id={`rule-body-${section.key}`}
                                placeholder="Qoida matni"
                                rows={Math.min(10, Math.max(3, Math.ceil(section.body.length / 70)))}
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
                        </details>
                      </li>
                    );
                  })}
                </ol>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={add} disabled={draft.length >= L.maxSections}>
                    <Plus className="size-4" aria-hidden />
                    Bo&apos;lim qo&apos;shish
                  </Button>
                  {draft.length >= L.maxSections && (
                    <span className="text-xs text-slate-500">Ko&apos;pi bilan {L.maxSections} ta bo&apos;lim</span>
                  )}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-amber-600"
                    checked={requireReconsent}
                    onChange={(e) => setRequireReconsent(e.target.checked)}
                  />
                  <span>
                    <span className="block font-semibold">
                      Hamma ishtirokchidan qaytadan rozilik so&apos;ralsin
                    </span>
                    <span className="mt-0.5 block text-xs text-amber-800">
                      Ilovani keyingi ochishda yangi qoidalarni o&apos;qib, qaytadan «roziman» belgisini
                      qo&apos;yishadi. Imlo xatosi uchun belgilamang.
                    </span>
                  </span>
                </label>

                {showErrors && hasErrors && (
                  <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="size-4 shrink-0" aria-hidden />
                    {errorCount} ta bo&apos;limda bo&apos;sh yoki juda uzun maydon bor — to&apos;g&apos;rilang.
                  </p>
                )}

                {summary && <p className="text-sm text-slate-600">O&apos;zgarishlar: {summary}.</p>}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={stopEditing}>
                    {canSave ? "O'zgarishlarni bekor qilish" : "Tahrirni yopish"}
                  </Button>
                  <Button type="submit" disabled={!canSave}>
                    Qoidalarni saqlash
                  </Button>
                </div>
              </>
            ) : (
              <ol aria-label="Qoidalar bo'limlari" className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {rules.sections.map((section, index) => (
                  <li key={index}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-ink hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
                        <ChevronRight
                          className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">{section.title}</span>
                      </summary>
                      <p className="px-3 pb-3 pl-9 text-sm leading-relaxed whitespace-pre-line text-slate-700">
                        {section.body}
                      </p>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Preview sections={sections} />
      </div>

      {confirming && (
        <ConfirmDialog
          title="Qoidalar saqlansinmi?"
          description={
            <div className="space-y-2">
              <p>
                {requireReconsent
                  ? "Hamma ishtirokchi qaytadan rozilik beradi: ilovani keyingi ochishda yangi qoidalarni o'qib, «roziman» belgisini qo'yadi."
                  : "O'zbek tilidagi ishtirokchilar yangi matnni darhol ko'radi. Qayta rozilik so'ralmaydi."}
              </p>
              {summary && <p>O&apos;zgarishlar: {summary}.</p>}
              <p className="text-amber-800">{UZ_ONLY_WARNING}</p>
            </div>
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

/** Ishtirokchi ilovada qanday ko'rishini taxminan ko'rsatadi (video bo'lsa — eng tepada). */
function Preview({ sections }: { sections: RulesSection[] }) {
  const { data: video } = useQuery({ queryKey: RULES_VIDEO_QUERY_KEY, queryFn: getRulesVideo });
  return (
    <aside className="lg:sticky lg:top-24" aria-label="Ilovada ko'rinishi (o'zbekcha)">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <Smartphone className="size-3.5" aria-hidden />
        Ilovada ko&apos;rinishi (o&apos;zbekcha)
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
