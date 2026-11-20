"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IosIcon, type IosTint } from "@/components/ui/ios-icon";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

/** Barcha ega so'rovlari shu kalit ostida — amaldan keyin hammasi birga yangilanadi. */
export const OWNER_QUERY_KEY = "owner";

const NOTICE_TIMEOUT_MS = 5000;

/** "Ali Valiyev"; ism kiritilmagan bo'lsa — "Ismsiz foydalanuvchi". */
export function ownerFullName(person: { firstName: string | null; lastName: string | null }): string {
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || "Ismsiz foydalanuvchi";
}

/** "+998901234567" -> "+998 90 123 45 67" (faqat ko'rsatish uchun); boshqa ko'rinish — o'zgarishsiz. */
export function formatOwnerPhone(phone: string | null): string {
  if (!phone) return "—";
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return match ? `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : phone;
}

/** Muvaffaqiyat xabari — bir necha soniyadan keyin o'zi yo'qoladi. */
export function useNotice(): [string | null, (message: string | null) => void] {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice];
}

export function NoticeBanner({ message }: { message: string | null }) {
  return (
    <div role="status" aria-live="polite">
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {message}
        </div>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <IosIcon icon={AlertTriangle} tint="orange" size={48} />
      <p className="text-sm text-slate-600">{errorMessage(error)}</p>
      <Button variant="secondary" onClick={onRetry}>
        Qayta urinish
      </Button>
    </div>
  );
}

export function EmptyState({ icon, tint = "gray", text }: { icon: LucideIcon; tint?: IosTint; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <IosIcon icon={icon} tint={tint} size={48} />
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}

/** Seyf eshigining "kodli g'ildiragi" — to'q panellardagi bezak. */
export function VaultDial({ className }: { className?: string }) {
  const ticks = Array.from({ length: 48 }, (_, index) => index);
  return (
    <svg viewBox="0 0 200 200" aria-hidden className={cn("pointer-events-none", className)} fill="none">
      <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="78" stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" />
      <circle cx="100" cy="100" r="46" stroke="currentColor" strokeWidth="6" />
      <circle cx="100" cy="100" r="14" fill="currentColor" />
      {ticks.map((tick) => {
        const angle = (tick / ticks.length) * Math.PI * 2;
        const long = tick % 4 === 0;
        const inner = long ? 82 : 86;
        return (
          <line
            key={tick}
            x1={100 + Math.cos(angle) * inner}
            y1={100 + Math.sin(angle) * inner}
            x2={100 + Math.cos(angle) * 92}
            y2={100 + Math.sin(angle) * 92}
            stroke="currentColor"
            strokeWidth={long ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      {[0, 1, 2].map((spoke) => {
        const angle = (spoke / 3) * Math.PI * 2 - Math.PI / 2;
        return (
          <line
            key={spoke}
            x1={100 + Math.cos(angle) * 14}
            y1={100 + Math.sin(angle) * 14}
            x2={100 + Math.cos(angle) * 46}
            y2={100 + Math.sin(angle) * 46}
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** Kichik "Maxfiy bo'lim" yorlig'i (to'q fonda). */
export function SecretLabel({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-white/80 uppercase ring-1 ring-white/15",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-[#f45d6f] shadow-[0_0_8px_rgba(244,93,111,0.9)]" />
      Maxfiy bo&apos;lim
    </span>
  );
}
