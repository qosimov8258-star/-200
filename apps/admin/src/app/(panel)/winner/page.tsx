import type { Metadata } from "next";

import { WinnerView } from "@/components/winner/winner-view";

export const metadata: Metadata = {
  title: "G'olib",
};

export default function WinnerPage() {
  return <WinnerView />;
}
