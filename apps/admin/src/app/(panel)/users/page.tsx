import { Suspense } from "react";
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { UsersView } from "@/components/users/users-view";

export const metadata: Metadata = {
  title: "Foydalanuvchilar",
};

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <Card className="overflow-hidden">
          <TableSkeleton />
        </Card>
      }
    >
      <UsersView />
    </Suspense>
  );
}
