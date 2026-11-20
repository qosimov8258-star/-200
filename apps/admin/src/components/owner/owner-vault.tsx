"use client";

import { useState } from "react";
import { Crosshair, Loader2, LockKeyhole, LogOut, ShieldAlert, Users } from "lucide-react";

import { IosIcon } from "@/components/ui/ios-icon";
import type { OwnerUser } from "@/lib/owner-types";
import { cn } from "@/lib/utils";

import { SecretLabel, VaultDial } from "./owner-common";
import { OwnerParticipants } from "./owner-participants";
import { OwnerRisk } from "./owner-risk";
import { OwnerTargets } from "./owner-targets";

type Tab = "participants" | "targets" | "risk";

const TABS: Array<{ value: Tab; label: string; icon: typeof Users }> = [
  { value: "participants", label: "Ishtirokchilar", icon: Users },
  { value: "targets", label: "Target", icon: Crosshair },
  { value: "risk", label: "Xavfli hisoblar", icon: ShieldAlert },
];

interface OwnerVaultProps {
  owner: OwnerUser;
  onLogout: () => void;
  loggingOut: boolean;
}

/** Ega kirgandan keyingi ko'rinish: to'q "seyf" sarlavhasi va uchta bo'lim. */
export function OwnerVault({ owner, onLogout, loggingOut }: OwnerVaultProps) {
  const [tab, setTab] = useState<Tab>("participants");

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 pt-4 pb-10 sm:px-6 lg:pt-6">
      <header className="relative overflow-hidden rounded-panel bg-ink px-5 py-5 text-white shadow-[0_24px_50px_-28px_rgba(39,38,39,0.9)] sm:px-7 sm:py-6">
        <VaultDial className="absolute -top-24 -right-10 size-72 text-white/[0.06] sm:right-24" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.025)_0_2px,transparent_2px_9px)]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <IosIcon icon={LockKeyhole} tint="indigo" size={48} />
            <div className="min-w-0">
              <SecretLabel />
              <h1 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">Tashkilot egalari</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-full bg-white/[0.07] py-1.5 pr-1.5 pl-4 ring-1 ring-white/10 sm:self-auto">
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{owner.fullName}</span>
              <span className="block truncate text-xs text-white/50">@{owner.login}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-ink transition hover:bg-brand-50 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-white"
            >
              {loggingOut ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
              Chiqish
            </button>
          </div>
        </div>
      </header>

      <OwnerTabs value={tab} onChange={setTab} />

      <main id={`owner-panel-${tab}`} role="tabpanel" aria-labelledby={`owner-tab-${tab}`} className="mt-5">
        {tab === "participants" && <OwnerParticipants />}
        {tab === "targets" && <OwnerTargets />}
        {tab === "risk" && <OwnerRisk />}
      </main>
    </div>
  );
}

/**
 * Bo'lim tablari — `Segmented` uslubida (kulrang yo'lak, oq tanlangan pill), lekin telefonda
 * uchtasi ham sig'ishi uchun ikonka matn ustida. Strelkalar bilan almashtirish mumkin.
 */
function OwnerTabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((item) => item.value === value);
    const next = TABS[(index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length];
    onChange(next.value);
    document.getElementById(`owner-tab-${next.value}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Bo'limlar"
      onKeyDown={handleKeyDown}
      className="mt-5 grid grid-cols-3 gap-1 rounded-[20px] bg-slate-200/70 p-1 sm:inline-grid sm:rounded-full"
    >
      {TABS.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            id={`owner-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`owner-panel-${item.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-200",
              "sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-4 sm:text-sm",
              active
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1),0_4px_12px_-4px_rgba(15,23,42,0.18)]"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
