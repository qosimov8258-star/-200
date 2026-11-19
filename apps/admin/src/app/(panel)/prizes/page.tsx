import type { Metadata } from "next";

import { PrizesView } from "@/components/prizes/prizes-view";

export const metadata: Metadata = {
  title: "Sovg'alar",
};

export default function PrizesPage() {
  return <PrizesView />;
}
