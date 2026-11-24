import { Suspense } from "react";
import type { Metadata } from "next";

import { WinnersView } from "@/components/winner/winners-view";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "G'oliblar",
};

export default function WinnerPage() {
  // `useSearchParams` (tab: `?tab=vouchers`) Suspense ichida bo'lishi kerak.
  return (
    <Suspense fallback={<Spinner />}>
      <WinnersView />
    </Suspense>
  );
}
