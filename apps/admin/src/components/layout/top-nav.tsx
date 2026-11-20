"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Loader2, LogOut, Menu, X } from "lucide-react";

import oliviaLogo from "@/assets/olivia-logo.png";

import { homePathForRole, navItemsForRole, ROLE_LABELS, type NavItem } from "@/lib/navigation";
import type { AdminUser } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopNavProps {
  admin: AdminUser;
  onLogout: () => void;
  loggingOut: boolean;
}

/**
 * Panelda to'g'ridan-to'g'ri ko'rinadigan bandlar soni; qolganlari — "Yana" ichida.
 * 1024–1279px da logotip va profil joy oladi — bitta kam.
 */
const LG_VISIBLE = 4;
const XL_VISIBLE = 5;

type MenuName = "more" | "profile" | "mobile";

/**
 * Tashkilot egalari bo'limiga (`/owner`) yashirin kirish: logotipni ketma-ket shuncha marta,
 * har bosish oldingisidan ko'pi bilan `SECRET_TAP_GAP_MS` ichida bosish kerak. Hech qanday
 * ko'rinadigan ishora yo'q; oddiy bosish avvalgidek bosh sahifaga olib boradi.
 */
const SECRET_TAP_COUNT = 7;
const SECRET_TAP_GAP_MS = 1200;

/** Suzuvchi panelning "muzli shisha" foni (binafsha-kulrang). */
const GLASS =
  "bg-[linear-gradient(90deg,rgba(104,92,132,0.9),rgba(118,104,142,0.9))] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 " +
  "shadow-[0_18px_40px_-18px_rgba(46,32,84,0.6),inset_0_1px_0_rgba(255,255,255,0.14)]";

/** Ochiladigan menyular foni — panelning o'zidan biroz to'qroq va zichroq. */
const GLASS_PANEL =
  "bg-[rgba(96,84,124,0.96)] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 " +
  "shadow-[0_24px_50px_-20px_rgba(30,20,60,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]";

/**
 * Tepadagi suzuvchi navigatsiya paneli: chapda logotip, o'rtada bo'limlar
 * (sig'maganlari "Yana" ichida), o'ngda profil va chiqish.
 * Telefonda — logotip, nom va menyu tugmasi; bo'limlar panel ostida ochiladi.
 */
export function TopNav({ admin, onLogout, loggingOut }: TopNavProps) {
  const pathname = usePathname();
  const items = navItemsForRole(admin.role);
  const activeIndex = items.findIndex((item) => isActive(pathname, item.href));

  // Menyu qaysi sahifada ochilgan bo'lsa, faqat o'sha sahifada ochiq turadi —
  // boshqa bo'limga o'tilganda o'zi yopiladi.
  const [menu, setMenu] = useState<{ name: MenuName; path: string } | null>(null);
  const open = menu?.path === pathname ? menu.name : null;
  const triggers = useRef<Partial<Record<MenuName, HTMLButtonElement | null>>>({});
  const moreId = useId();
  const profileId = useId();
  const mobileId = useId();

  const toggle = (name: MenuName) => setMenu(open === name ? null : { name, path: pathname });
  const close = () => setMenu(null);

  const router = useRouter();
  /** Logotip bosishlari: ketma-ket soni va oxirgisining vaqti (sahifalar almashganda ham saqlanadi). */
  const logoTaps = useRef({ count: 0, last: 0 });

  function handleLogoClick(event: React.MouseEvent<HTMLAnchorElement>) {
    close();
    // Yangi oynada ochish (Cmd/Ctrl/Shift bilan) — oddiy havola, sanalmaydi.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      logoTaps.current.count = 0;
      return;
    }
    const now = performance.now();
    const taps = logoTaps.current;
    taps.count = now - taps.last <= SECRET_TAP_GAP_MS ? taps.count + 1 : 1;
    taps.last = now;
    if (taps.count >= SECRET_TAP_COUNT) {
      taps.count = 0;
      event.preventDefault();
      router.push("/owner");
    }
  }

  // Tashqariga bosilganda yoki Escape — yopiladi.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Element && event.target.closest(`[data-menu="${open}"]`)) return;
      setMenu(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      setMenu(null);
      triggers.current[open]?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const visible = items.slice(0, XL_VISIBLE);
  // "Yana" ichidagilar: LG_VISIBLE..XL_VISIBLE oralig'idagilar faqat 1280px dan tor ekranda.
  const overflow = items.slice(LG_VISIBLE);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  /** Faol bo'lim "Yana" ichida: tor ekranda (lg) va keng ekranda (xl). */
  const activeInMoreLg = activeIndex >= LG_VISIBLE ? activeItem : null;
  const activeInMoreXl = activeIndex >= XL_VISIBLE ? activeItem : null;

  return (
    <header className="pointer-events-none sticky top-0 z-30 mx-auto max-w-[1400px] px-4 pt-3 sm:px-6 lg:pt-4">
      {/* Telefonda menyu ochilganda orqa fon */}
      <div
        aria-hidden
        className={cn(
          "fixed inset-0 bg-slate-900/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open === "mobile" ? "pointer-events-auto opacity-100" : "opacity-0",
        )}
      />

      <div className="pointer-events-auto relative flex h-16 items-center gap-2 p-2">
        {/* Fon alohida qatlamda — ichidagi menyular o'z "shisha" effektini saqlaydi. */}
        <div aria-hidden className={cn("absolute inset-0 rounded-full", GLASS)} />

        {/* Brend logotipi (apps/logos/Olivia.png dan kesilgan) — keng yozuv, shuning uchun oq "pill" ichida. */}
        <Link
          href={homePathForRole(admin.role)}
          onClick={handleLogoClick}
          aria-label="Olivia — bosh sahifa"
          title="Olivia · Reels tanlov"
          className="relative flex h-12 shrink-0 items-center rounded-full bg-white px-4 shadow-[0_4px_12px_-4px_rgba(30,20,60,0.45)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-white"
        >
          <Image src={oliviaLogo} alt="" priority className="h-[26px] w-auto" />
        </Link>

        {/* Telefon: o'rtada nom */}
        <span className="relative min-w-0 flex-1 truncate text-center text-[15px] font-semibold tracking-tight text-white lg:hidden">
          Reels tanlov
        </span>

        {/* Kompyuter: bo'limlar */}
        <nav aria-label="Asosiy menyu" className="relative hidden min-w-0 flex-1 items-center justify-center-safe gap-0.5 lg:flex">
          {visible.map((item, index) => (
            <BarLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={close}
              className={index >= LG_VISIBLE ? "hidden xl:flex" : undefined}
            />
          ))}

          {overflow.length > 0 && (
            <div data-menu="more" className={cn("relative", items.length <= XL_VISIBLE && "xl:hidden")}>
              <button
                ref={(element) => {
                  triggers.current.more = element;
                }}
                type="button"
                onClick={() => toggle("more")}
                aria-expanded={open === "more"}
                aria-controls={moreId}
                className={cn(
                  BAR_ITEM,
                  "gap-1",
                  activeInMoreXl || open === "more"
                    ? "text-white"
                    : activeInMoreLg
                      ? "text-white xl:text-white/70 xl:hover:bg-white/10 xl:hover:text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  open === "more" && "bg-white/10",
                )}
              >
                {activeInMoreXl ? (
                  activeInMoreXl.title
                ) : activeInMoreLg ? (
                  <>
                    <span className="xl:hidden">{activeInMoreLg.title}</span>
                    <span className="hidden xl:inline">Yana</span>
                  </>
                ) : (
                  "Yana"
                )}
                <ChevronDown
                  className={cn("size-4 transition-transform duration-200", open === "more" && "rotate-180")}
                  aria-hidden
                />
                {activeInMoreLg && <ActiveDot className={activeInMoreXl ? undefined : "xl:hidden"} />}
              </button>

              <Dropdown id={moreId} open={open === "more"} align="center" className="w-64">
                <ul className="space-y-0.5">
                  {overflow.map((item, index) => (
                    <li key={item.href} className={index < XL_VISIBLE - LG_VISIBLE ? "xl:hidden" : undefined}>
                      <MenuLink item={item} active={isActive(pathname, item.href)} onNavigate={close} />
                    </li>
                  ))}
                </ul>
              </Dropdown>
            </div>
          )}
        </nav>

        {/* Kompyuter: profil */}
        <div data-menu="profile" className="relative hidden shrink-0 lg:block">
          <button
            ref={(element) => {
              triggers.current.profile = element;
            }}
            type="button"
            onClick={() => toggle("profile")}
            aria-expanded={open === "profile"}
            aria-controls={profileId}
            aria-label={`Profil: ${admin.fullName}`}
            className="flex h-12 items-center gap-2 rounded-full bg-white pr-3 pl-1.5 xl:gap-2.5 xl:pr-4 text-[15px] font-medium text-slate-900 shadow-[0_4px_12px_-4px_rgba(30,20,60,0.45)] transition duration-200 hover:bg-violet-50 active:scale-[0.98] focus-visible:outline-white"
          >
            <Initials name={admin.fullName} />
            {/* 1024–1280px da joy tor — faqat bosh harflar. */}
            <span className="hidden max-w-[10rem] truncate xl:inline">{admin.fullName}</span>
            <ChevronDown
              className={cn("size-4 text-slate-400 transition-transform duration-200", open === "profile" && "rotate-180")}
              aria-hidden
            />
          </button>

          <Dropdown id={profileId} open={open === "profile"} align="end" className="w-72">
            <ProfileBlock admin={admin} onLogout={onLogout} loggingOut={loggingOut} />
          </Dropdown>
        </div>

        {/* Telefon: menyu tugmasi */}
        <button
          ref={(element) => {
            triggers.current.mobile = element;
          }}
          type="button"
          data-menu="mobile"
          onClick={() => toggle("mobile")}
          aria-expanded={open === "mobile"}
          aria-controls={mobileId}
          aria-label={open === "mobile" ? "Menyuni yopish" : "Menyuni ochish"}
          className="relative grid size-12 shrink-0 place-items-center rounded-full bg-white text-slate-900 shadow-[0_4px_12px_-4px_rgba(30,20,60,0.45)] transition active:scale-95 focus-visible:outline-white lg:hidden"
        >
          {open === "mobile" ? <X className="size-[22px]" aria-hidden /> : <Menu className="size-[22px]" aria-hidden />}
        </button>

        {/* Telefon: bo'limlar ro'yxati */}
        <div
          id={mobileId}
          data-menu="mobile"
          inert={open !== "mobile"}
          className={cn(
            "absolute inset-x-0 top-full pt-2 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden",
            open === "mobile" ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
          )}
        >
          <div className={cn("max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-[28px] p-2", GLASS_PANEL)}>
            <nav aria-label="Asosiy menyu">
              <ul className="grid gap-0.5 sm:grid-cols-2">
                {items.map((item) => (
                  <li key={item.href}>
                    <MenuLink item={item} active={isActive(pathname, item.href)} onNavigate={close} />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-2 border-t border-white/10 pt-2">
              <ProfileBlock admin={admin} onLogout={onLogout} loggingOut={loggingOut} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "Bosh administrator" → "BA". */
function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const BAR_ITEM =
  "relative flex items-center rounded-full px-3.5 py-2 text-[15px] whitespace-nowrap transition-colors duration-200 focus-visible:outline-white";

/** Faol bo'lim belgisi — matn ostidagi kichik nuqta. */
function ActiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute -bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white", className)}
    />
  );
}

function BarLink({
  item,
  active,
  onNavigate,
  className,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
  className?: string;
}) {
  if (!item.ready) {
    return (
      <span
        aria-disabled="true"
        title="Bu bo'lim keyingi bosqichlarda qo'shiladi"
        className={cn(BAR_ITEM, "cursor-not-allowed text-white/35", className)}
      >
        {item.title}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(BAR_ITEM, active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white", className)}
    >
      {item.title}
      {active && <ActiveDot />}
    </Link>
  );
}

/** Ochiladigan menyudagi band: ikonka + nom. */
function MenuLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  const classes = "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] transition-colors duration-200";
  if (!item.ready) {
    return (
      <span aria-disabled="true" className={cn(classes, "cursor-not-allowed text-white/35")}>
        <Icon className="size-5 shrink-0" strokeWidth={1.8} aria-hidden />
        <span className="truncate">{item.title}</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        classes,
        "focus-visible:outline-white",
        active ? "bg-white/15 font-medium text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className={cn("size-5 shrink-0", active ? "text-white" : "text-white/60")} strokeWidth={1.8} aria-hidden />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

function Initials({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[linear-gradient(160deg,#a78bfa,#6d28d9)] font-semibold text-white",
        large ? "size-11 text-sm" : "size-9 text-xs",
      )}
    >
      {initials(name)}
    </span>
  );
}

function ProfileBlock({ admin, onLogout, loggingOut }: TopNavProps) {
  return (
    <div className="flex items-center gap-3 px-1.5 py-1">
      <Initials name={admin.fullName} large />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[15px] font-semibold text-white">{admin.fullName}</span>
        <span className="block truncate text-[13px] text-white/60">{ROLE_LABELS[admin.role]}</span>
      </span>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-slate-900 transition hover:bg-violet-50 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-white"
      >
        {loggingOut ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
        Chiqish
      </button>
    </div>
  );
}

interface DropdownProps {
  id: string;
  open: boolean;
  /** Tugmaga nisbatan joylashuv: o'rtada yoki o'ng chetda. */
  align: "center" | "end";
  className?: string;
  children: React.ReactNode;
}

/** Panel ostida ochiladigan "shisha" menyu. Yopiq bo'lsa — fokus ham, bosish ham o'tmaydi (`inert`). */
function Dropdown({ id, open, align, className, children }: DropdownProps) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        "absolute top-full pt-3",
        align === "center" ? "left-1/2 -translate-x-1/2" : "right-0",
        open ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-[26px] p-2 transition duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          align === "center" ? "origin-top" : "origin-top-right",
          GLASS_PANEL,
          open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
