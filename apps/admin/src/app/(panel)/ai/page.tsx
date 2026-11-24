import { Suspense } from "react";
import type { Metadata } from "next";

import { AiView } from "@/components/ai/ai-view";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "AI tekshiruvi",
};

export default function AiPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="flex justify-center py-12">
            <Spinner />
          </CardContent>
        </Card>
      }
    >
      <AiView />
    </Suspense>
  );
}
