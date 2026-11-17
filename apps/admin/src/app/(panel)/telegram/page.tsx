import { Suspense } from "react";
import type { Metadata } from "next";

import { TelegramView } from "@/components/telegram/telegram-view";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const metadata: Metadata = {
  title: "Telegram",
};

export default function TelegramPage() {
  return (
    <Suspense
      fallback={
        <Card className="overflow-hidden">
          <TableSkeleton rows={8} />
        </Card>
      }
    >
      <TelegramView />
    </Suspense>
  );
}
