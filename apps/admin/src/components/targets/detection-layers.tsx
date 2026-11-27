"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Handshake, Library, Megaphone, TrendingUp } from "lucide-react";

import { getTargetCheckStatus } from "@/lib/api";
import { formatDate, formatDayTime, formatNumber } from "@/lib/format";
import type { TargetAdsCheckReport } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Reklama kutubxonasi tekshiruvi natijasining to'liq matni. */
function reportText(report: TargetAdsCheckReport): string {
  const who = report.reason === "admin" ? "qo'lda" : "avtomatik";
  if (report.error) return `${formatDayTime(report.at)} (${who}) — xato: ${report.error}`;
  return `${formatDayTime(report.at)} (${who}): ${formatNumber(report.checked)} ta akkaunt, ${formatNumber(report.found)} ta faol reklama`;
}

function Method({
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
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{step}-usul</p>
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-muted">{children}</p>
      {footer && <div className="mt-auto">{footer}</div>}
    </div>
  );
}

/**
 * Tizim reklamani qanday topadi: to'rt usul ("Batafsil" ichida). Instagram boshqa akkauntning
 * reklama tarixini bermaydi — shuning uchun avtomatik signallar va shikoyatlar g'olibni
 * yuzma-yuz tekshirish bilan yakunlanadi. "Hozir tekshirish" — sahifa tepasidagi qatorda.
 */
export function DetectionLayers() {
  // `AdsCheckBar` bilan bir xil so'rov (kesh umumiy) — qo'shimcha so'rov ketmaydi.
  const status = useQuery({ queryKey: ["target-check"], queryFn: getTargetCheckStatus });
  const lastCheck = status.data?.lastCheck ?? null;
  const nextCheckOn = status.data?.nextCheckOn ?? null;

  return (
    // 1 px oraliq + fon rangi — har qanday ustunlar sonida ingichka ajratgich chiziqlar.
    <div className="grid gap-px bg-line lg:grid-cols-2 xl:grid-cols-4">
      <Method
        step={1}
        icon={Library}
        title="Instagram reklama kutubxonasi"
        footer={
          <div className="space-y-1 text-xs text-muted">
            <p>Oxirgi tekshiruv: {lastCheck ? reportText(lastCheck) : "hali bo'lmagan"}</p>
            {nextCheckOn && <p>Keyingi avtomatik: {formatDate(nextCheckOn)}</p>}
          </div>
        }
      >
        Reytingning yetakchilari oyiga bir marta — har oylik bosqich oxirida tekshiriladi:
        akkauntda faol reklama bo&apos;lsa — holat ochiladi va dalil havolasi saqlanadi. Kerak
        bo&apos;lsa, istalgan vaqtda tepadagi «Hozir tekshirish» bilan tekshirish mumkin.
      </Method>

      <Method step={2} icon={TrendingUp} title="Ko'rishlar g'ayrioddiy o'sishi">
        Har kuni ko&apos;rishlar yig&apos;ilganda barcha videolar ko&apos;riladi: ko&apos;rishlar bir
        kunda keskin oshsa yoki ko&apos;rishlar oshib, layklar deyarli o&apos;smasa — pullik reklamaga
        xos signal ro&apos;yxatga tushadi.
      </Method>

      <Method step={3} icon={Megaphone} title="Ishtirokchilar shikoyati">
        Boshqa ishtirokchilar lentasida «Reklama» belgisi bilan ko&apos;rgan videoning skrinshotini
        ilovadagi «Reklamani ko&apos;rdim» orqali yuboradi. Bitta ishtirokchiga kelgan shikoyatlar
        bitta holatga yig&apos;iladi.
      </Method>

      <Method
        step={4}
        icon={Handshake}
        title="G'olib telefonini ko'rish"
        footer={
          <Link
            href="/winner"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            G&apos;oliblar bo&apos;limiga o&apos;tish
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        Sovg&apos;ani topshirishdan oldin g&apos;olib telefonida Instagram → Professional panel →
        «Reklama vositalari» bo&apos;limi ko&apos;riladi: tanlov davridagi reklamalar tarixi shu
        yerda turadi.
      </Method>
    </div>
  );
}
