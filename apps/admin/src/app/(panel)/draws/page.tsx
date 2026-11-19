import { Suspense } from "react";
import type { Metadata } from "next";

import { DrawsView } from "@/components/draws/draws-view";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Random tanlov",
};

export default function DrawsPage() {
  // `useSearchParams` (tanlangan tanlov `?id=`) Suspense ichida bo'lishi kerak.
  return (
    <Suspense fallback={<Spinner />}>
      <DrawsView />
    </Suspense>
  );
}
