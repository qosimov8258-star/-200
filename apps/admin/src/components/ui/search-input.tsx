"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

const DEBOUNCE_MS = 300;

interface SearchInputProps {
  /** URL dagi joriy qidiruv qiymati. */
  value: string;
  /** Yozish to'xtagach (300 ms) chaqiriladi, qiymat `trim` qilingan. */
  onDebouncedChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}

/**
 * Qidiruv maydoni: har harfda emas, yozish to'xtagach qidiradi. URL dagi qiymat
 * tashqaridan o'zgarsa (tozalash tugmasi, "orqaga") maydon unga moslashadi.
 */
export function SearchInput({
  value,
  onDebouncedChange,
  placeholder,
  label,
  className,
}: SearchInputProps) {
  const [input, setInput] = useState(value);
  /** Shu maydon oxirgi marta yuborgan qiymat. */
  const [sentValue, setSentValue] = useState(value);
  /** Tashqi qiymatning oxirgi ko'rilgani. */
  const [seenValue, setSeenValue] = useState(value);

  // O'zimiz yuborgan qiymat qaytib kelsa tegmaymiz: foydalanuvchi shu payt yozishda davom etayotgan bo'lishi mumkin.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== sentValue) {
      setInput(value);
    }
  }

  // Ota komponent har renderda yangi funksiya beradi — taymer qayta boshlanmasligi uchun ref.
  const callbackRef = useRef(onDebouncedChange);
  useEffect(() => {
    callbackRef.current = onDebouncedChange;
  });

  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed === value) return;
    const timer = setTimeout(() => {
      setSentValue(trimmed);
      callbackRef.current(trimmed);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, value]);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <Input
        type="search"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="pl-9"
      />
    </div>
  );
}
