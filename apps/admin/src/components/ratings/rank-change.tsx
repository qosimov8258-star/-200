import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RankChangeProps {
  rank: number;
  previousRank: number | null;
}

/**
 * O'rin o'zgarishi (o'rin yonida, kichik): strelka + son + ekran o'quvchilar uchun matn (faqat
 * rang bilan emas). Oldingi kuni reytingda bo'lmagan video — "Yangi".
 */
export function RankChange({ rank, previousRank }: RankChangeProps) {
  if (previousRank === null) {
    return (
      <Badge tone="brand" className="px-1.5 py-0 text-[11px]" title="Oldingi kuni reytingda yo'q edi">
        Yangi
      </Badge>
    );
  }

  const diff = previousRank - rank;
  if (diff === 0) {
    return (
      <span className="inline-flex text-slate-300" title={`Oldingi kun ham ${previousRank}-o'rin`}>
        <Minus className="size-3.5" aria-hidden />
        <span className="sr-only">o&apos;rni o&apos;zgarmadi</span>
      </span>
    );
  }

  const up = diff > 0;
  const Arrow = up ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-green-700" : "text-red-700",
      )}
      title={`Oldingi kun: ${previousRank}-o'rin`}
    >
      <Arrow className="size-3" aria-hidden />
      <span className="sr-only">{up ? "ko'tarildi:" : "tushdi:"}</span>
      {Math.abs(diff)}
    </span>
  );
}
