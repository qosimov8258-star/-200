import { Suspense } from "react";
import type { Metadata } from "next";

import { AuditView } from "@/components/audit/audit-view";
import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export const metadata: Metadata = {
  title: "Amallar tarixi",
};

export default function AuditLogPage() {
  return (
    <Suspense
      fallback={
        <Card className="overflow-hidden">
          <TableSkeleton rows={10} />
        </Card>
      }
    >
      <AuditView />
    </Suspense>
  );
}
