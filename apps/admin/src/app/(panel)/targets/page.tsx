import { Suspense } from "react";
import type { Metadata } from "next";

import { TargetsView } from "@/components/targets/targets-view";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const metadata: Metadata = {
  title: "Target yoqqanlar",
};

export default function TargetsPage() {
  return (
    <Suspense
      fallback={
        <Card className="overflow-hidden">
          <TableSkeleton rows={6} />
        </Card>
      }
    >
      <TargetsView />
    </Suspense>
  );
}
