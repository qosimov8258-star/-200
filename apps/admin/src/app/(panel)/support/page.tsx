import { Suspense } from "react";
import type { Metadata } from "next";

import { SupportView } from "@/components/support/support-view";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Support",
};

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <Card className="flex justify-center py-16">
          <Spinner />
        </Card>
      }
    >
      <SupportView />
    </Suspense>
  );
}
