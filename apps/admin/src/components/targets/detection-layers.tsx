"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Handshake, Library, Megaphone, RefreshCw, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { checkTargetsNow, getTargetCheckStatus } from "@/lib/api";
import { errorMessage } from "@/lib/api-error";
import { formatDate, formatDayTime, formatNumber } from "@/lib/format";
import type { TargetAdsCheckReport } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Reklama kutubxonasi tekshiruvi natijasining qisqa matni. */
function reportText(report: TargetAdsCheckReport): string {
  const who = report.reason === "admin" ? "qo'lda" : "avtomatik";
  if (report.error) return `${formatDayTime(report.at)} (${who}) — xato: ${report.error}`;
  return `${formatDayTime(report.at)} (${who}): ${formatNumber(report.checked)} ta akkaunt, ${formatNumber(report.found)} ta faol reklama`;
}

function Layer({
  step,
  icon: Icon,
  title,
  children,
  footer,
  className,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 bg-white p-5", className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{step}-qatlam</p>
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">{children}</p>
      {footer && <div className="mt-auto">{footer}</div>}
    </div>
  );
}

/**
 * Target qanday aniqlanadi: to'rt qatlam. Instagram boshqa akkauntning reklama tarixini
 * bermaydi — shuning uchun avtomatik signallar va shikoyatlar g'olibni yuzma-yuz tekshirish
 * bilan yakunlanadi.
 */
export function DetectionLayers({ onChecked }: { onChecked: (message: string) => void }) {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["target-check"], queryFn: getTargetCheckStatus });

  const check = useMutation({
    mutationFn: checkTargetsNow,
    onSuccess: async (report) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["target-check"] }),
        queryClient.invalidateQueries({ queryKey: ["target-cases"] }),
      ]);
      onChecked(
        report.error
          ? `Tekshiruv xato bilan tugadi: ${report.error}`
          : `Reklama kutubxonasi tekshirildi: ${formatNumber(report.checked)} ta akkaunt, ${formatNumber(report.found)} ta faol reklama.`,
      );
    },
  });

  const lastCheck = status.data?.lastCheck ?? null;
  const nextCheckOn = status.data?.nextCheckOn ?? null;
  const running = check.isPending || status.data?.running === true;

  return (
    // 1 px oraliq + fon rangi — har qanday ustunlar sonida ingichka ajratgich chiziqlar.
    <Card className="grid gap-px overflow-hidden bg-line lg:grid-cols-2 xl:grid-cols-4">
      <Layer
        step={1}
        icon={Library}
        title="Meta reklama kutubxonasi"
        footer={
          <div className="space-y-2">
            <p className="text-xs text-muted" aria-live="polite">
              {running
                ? "Tekshirilmoqda… (1–3 daqiqa)"
                : lastCheck
                  ? `Oxirgi: ${reportText(lastCheck)}`
                  : "Hali tekshirilmagan"}
            </p>
            {nextCheckOn && !running && (
              <p className="text-xs text-muted">Keyingi avtomatik: {formatDate(nextCheckOn)}</p>
            )}
            {check.isError && <p className="text-xs text-red-600">{errorMessage(check.error)}</p>}
            <Button variant="secondary" size="sm" loading={running} onClick={() => check.mutate()}>
              {!running && <RefreshCw className="size-3.5" aria-hidden />}
              Hozir tekshirish
            </Button>
          </div>
        }
      >
        Reytingning yetakchilari oyiga bir marta — har oylik bosqich oxirida tekshiriladi:
        akkauntda faol reklama bo&apos;lsa — holat ochiladi va dalil havolasi saqlanadi. Kerak
        bo&apos;lsa, istalgan vaqtda qo&apos;lda tekshirish mumkin.
      </Layer>

      <Layer step={2} icon={TrendingUp} title="O'sish tahlili">
        Har kuni barcha Reellar: ko&apos;rishlar bir kunda keskin oshsa yoki ko&apos;rishlar oshib,
        layklar deyarli o&apos;smasa — pullik reklamaga xos signal ro&apos;yxatga tushadi.
      </Layer>

      <Layer step={3} icon={Megaphone} title="Ishtirokchilar shikoyati">
        Boshqa ishtirokchilar lentasida «Reklama» belgisi bilan ko&apos;rgan videoning skrinshotini
        Mini App&apos;dagi &quot;Reklamani ko&apos;rdim&quot; orqali yuboradi. Bitta ishtirokchiga
        kelgan shikoyatlar bitta holatga yig&apos;iladi.
      </Layer>

      <Layer
        step={4}
        icon={Handshake}
        title="Yuzma-yuz tekshiruv"
        footer={
          <Link
            href="/winner"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            G&apos;olib bo&apos;limiga o&apos;tish
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        Sovg&apos;ani topshirishdan oldin g&apos;olib telefonida Instagram → Professional panel →
        &quot;Reklama vositalari&quot; bo&apos;limi ko&apos;riladi: tanlov davridagi reklamalar
        tarixi shu yerda turadi.
      </Layer>
    </Card>
  );
}
