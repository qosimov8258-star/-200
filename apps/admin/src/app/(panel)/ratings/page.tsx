import { Suspense } from "react";
import type { Metadata } from "next";

import { RatingsView } from "@/components/ratings/ratings-view";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const metadata: Metadata = {
  title: "Reyting",
};

export default function RatingsPage() {
  return (
    <Suspense
      fallback={
        <Card className="overflow-hidden">
          <TableSkeleton rows={10} />
        </Card>
      }
    >
      <RatingsView />
    </Suspense>
  );
}
