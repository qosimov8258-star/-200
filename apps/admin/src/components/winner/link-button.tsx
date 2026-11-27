import Link from "next/link";

import { cn } from "@/lib/utils";

type LinkButtonVariant = "primary" | "secondary";

// `components/ui/button.tsx` dagi ranglar va o'lcham bilan bir xil (u faqat `<button>` chizadi).
const VARIANT_CLASSES: Record<LinkButtonVariant, string> = {
  primary: "bg-brand-500 text-white shadow-[0_6px_14px_-6px_rgba(124,98,219,0.8)] hover:bg-brand-600",
  secondary: "border border-line bg-white text-ink hover:border-brand-200 hover:bg-brand-50/50",
};

/**
 * Tugma ko'rinishidagi havola — boshqa joyga o'tish uchun (masalan, "Barabanga o'tish"). Oddiy havola
 * bo'lib qoladi: yangi tabda ochish va klaviatura bilan ishlaydi.
 */
export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: LinkButtonVariant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-medium transition-colors",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
