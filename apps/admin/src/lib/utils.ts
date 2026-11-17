import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind klasslarini birlashtirish (ziddiyatli klasslarda oxirgisi yutadi). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Login dan keyingi qaytish manzilini tekshirish: faqat ichki yo'llar
 * ruxsat etiladi (open redirect dan himoya).
 */
export function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  return value;
}
