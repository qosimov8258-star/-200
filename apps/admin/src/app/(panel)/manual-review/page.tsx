import { Suspense } from "react";
import type { Metadata } from "next";

import { ManualReviewView } from "@/components/manual-review/manual-review-view";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const metadata: Metadata = {
  title: "Qo'lda tekshiruv",
};

export default function ManualReviewPage() {
  return (
    <Suspense
      fallback={
        <Card className="overflow-hidden">
          <TableSkeleton rows={6} />
        </Card>
      }
    >
      <ManualReviewView />
    </Suspense>
  );
}
