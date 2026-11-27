import clsx from "clsx";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { useEffect } from "react";

import { t } from "../i18n";
import { haptic } from "../lib/telegram";

export interface MoreMenuItem {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Ikonka foni (Tailwind klasslari). */
  tone: string;
  active?: boolean;
  onSelect: () => void;
}

/**
 * Pastki menyuga sig'magan bo'limlar: "Ko'proq" tugmasi ustida ochiladigan shisha
 * panel. Tashqariga bosish yoki Escape — yopadi.
 */
export function MoreMenu({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: MoreMenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label={t.moreClose}
        onClick={onClose}
        className="fixed inset-0 z-30 animate-fade bg-ink/15 backdrop-blur-[3px]"
      />
      <div
        role="menu"
        aria-label={t.navMore}
        className="fixed right-7 z-40 w-[min(300px,calc(100%-56px))] origin-bottom-right animate-menu-pop rounded-[30px] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(255,255,255,0.7))] p-2 shadow-[0_18px_40px_rgba(30,31,34,0.18),0_1px_4px_rgba(30,31,34,0.06)] backdrop-blur-xl backdrop-saturate-150"
        style={{ bottom: "calc(var(--safe-bottom) + 12px + 66px + 12px)" }}
      >
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                haptic.select();
                item.onSelect();
              }}
              style={{ animationDelay: `${60 + i * 45}ms` }}
              className={clsx(
                "flex w-full animate-rise items-center gap-3 rounded-[22px] p-2.5 text-left transition active:scale-[0.98]",
                item.active ? "bg-ink/[0.06]" : "active:bg-ink/[0.04]",
              )}
            >
              <span
                className={clsx(
                  "grid size-11 shrink-0 place-items-center rounded-[15px] text-white shadow-[0_6px_14px_rgba(30,31,34,0.16)]",
                  item.tone,
                )}
              >
                <Icon className="size-[22px]" strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{item.label}</span>
                <span className="block truncate text-[12.5px] text-muted">{item.hint}</span>
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-muted" />
            </button>
          );
        })}
      </div>
    </>
  );
}
