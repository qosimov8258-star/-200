import { Suspense } from "react";
import type { Metadata } from "next";

import { StoriesView } from "@/components/stories/stories-view";
import { StoriesSkeleton } from "@/components/stories/story-card";

export const metadata: Metadata = {
  title: "Istoriyalar",
};

export default function StoriesPage() {
  return (
    <Suspense fallback={<StoriesSkeleton />}>
      <StoriesView />
    </Suspense>
  );
}
