"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2, FileText, Film, type LucideIcon } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHint } from "@/components/ui/page-hint";
import { Spinner } from "@/components/ui/spinner";
import { getContestSettings } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";

import { RulesEditor } from "./rules-editor";
import { RulesVideoCard } from "./rules-video-card";
import { SettingsForm } from "./settings-form";

const NOTICE_TIMEOUT_MS = 5000;

interface SettingsSectionInfo {
  id: string;
  icon: LucideIcon;
  title: string;
}

/** Sahifadagi uch mustaqil bo'lim — har biri alohida saqlanadi; tepadagi havolalar shu `id` larga. */
const SECTIONS = {
  period: { id: "muddat", icon: CalendarRange, title: "Tanlov muddati" },
  video: { id: "video", icon: Film, title: "Qoida videosi" },
  rules: { id: "qoidalar", icon: FileText, title: "Qoidalar matni" },
} satisfies Record<string, SettingsSectionInfo>;

/** TZ 6: Sozlamalar — tanlov muddati, qoida videosi va qoidalar (oferta) matni. */
export function SettingsView() {
  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-3">
        <PageHint>
          Bu yerda: tanlov sanalari, qoida videosi va qoidalar (oferta) matni. Har bo&apos;lim alohida
          saqlanadi.
        </PageHint>
        <nav aria-label="Sozlamalar bo'limlari" className="flex flex-wrap gap-2">
          {Object.values(SECTIONS).map(({ id, icon: Icon, title }) => (
            <a
              key={id}
              href={`#${id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-200 hover:bg-brand-50/50 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Icon className="size-4 text-brand-600" aria-hidden />
              {title}
            </a>
          ))}
        </nav>
      </div>

      <SettingsSection {...SECTIONS.period}>
        <ContestPeriodSection />
      </SettingsSection>
      <SettingsSection {...SECTIONS.video}>
        <RulesVideoCard />
      </SettingsSection>
      <SettingsSection {...SECTIONS.rules}>
        <RulesEditor />
      </SettingsSection>
    </div>
  );
}

/** Bo'lim: sarlavha (ikonka bilan) va mazmun. Tepadagi havola shu yerga olib keladi. */
function SettingsSection({
  id,
  icon: Icon,
  title,
  children,
}: SettingsSectionInfo & { children: React.ReactNode }) {
  const headingId = `${id}-title`;
  return (
    // Yopishqoq yuqori menyu sarlavhani yopib qo'ymasin.
    <section id={id} aria-labelledby={headingId} className="scroll-mt-28 space-y-3">
      <h2 id={headingId} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-ink">
        <Icon className="size-5 text-brand-600" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Tanlov muddati (va "Batafsil" ichidagi yangilanish sozlamalari) — o'z yuklanishi va xatosi bilan. */
function ContestPeriodSection() {
  const { data, error, isPending, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: getContestSettings,
  });
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
    <div className="space-y-3">
      <div role="status" aria-live="polite">
        {saved && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Tanlov muddati va yangilanish sozlamalari saqlandi.
          </div>
        )}
      </div>
      {/* Saqlangandan keyin forma yangi qiymatlardan qayta boshlanadi. */}
      <SettingsForm
        key={data.settings.updatedAt ?? "initial"}
        data={data}
        onSaved={() => setSaved(true)}
      />
    </div>
  );
}
