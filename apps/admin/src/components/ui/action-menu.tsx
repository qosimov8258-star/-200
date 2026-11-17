"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  /** Xavfli amal — qizil rangda. */
  danger?: boolean;
  disabled?: boolean;
}

interface ActionMenuProps {
  /** Tugmaning ekran o'quvchilar uchun nomi, masalan "Ali Valiyev uchun amallar". */
  label: string;
  items: ActionMenuItem[];
}

/** Menyu ochilganda pastda shuncha joy bo'lmasa, yuqoriga ochiladi. */
const MENU_SPACE_NEEDED = 160;

interface MenuPosition {
  top: number;
  right: number;
  upward: boolean;
}

/**
 * Qator amallari menyusi ("⋯"). `position: fixed` bilan chiziladi — jadvalning
 * gorizontal skroll konteyneri uni kesib qo'ymaydi. Skroll yoki o'lcham
 * o'zgarsa yopiladi.
 */
export function ActionMenu({ label, items }: ActionMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = position !== null;

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const upward = window.innerHeight - rect.bottom < MENU_SPACE_NEEDED;
    setPosition({
      top: upward ? rect.top - 4 : rect.bottom + 4,
      right: window.innerWidth - rect.right,
      upward,
    });
  }

  function closeMenu(returnFocus: boolean) {
    setPosition(null);
    if (returnFocus) buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;

    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setPosition(null);
      }
    }
    function handleViewportChange() {
      setPosition(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const enabled = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    } else if (event.key === "Tab") {
      closeMenu(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      enabled[(index + step + enabled.length) % enabled.length]?.focus();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeMenu(false) : openMenu())}
        className={cn(
          "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900",
          open && "bg-slate-100 text-slate-900",
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>

      {position && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className="fixed z-50 min-w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          style={{
            top: position.top,
            right: position.right,
            transform: position.upward ? "translateY(-100%)" : undefined,
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  // Fokus tugmaga qaytadi — amal oyna ochsa, oyna yopilganda ham shu tugmaga qaytadi.
                  closeMenu(true);
                  item.onSelect();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  "disabled:cursor-not-allowed disabled:text-slate-300",
                  item.danger
                    ? "text-red-700 hover:bg-red-50 focus:bg-red-50"
                    : "text-slate-700 hover:bg-slate-100 focus:bg-slate-100",
                  "focus:outline-none",
                )}
              >
                {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
