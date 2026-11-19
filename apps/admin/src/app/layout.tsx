import type { Metadata } from "next";
import { Lexend } from "next/font/google";

import "./globals.css";

/** CareOps uslubidagi yumaloq geometrik shrift; o'zbek lotini uchun latin-ext. */
const lexend = Lexend({
  subsets: ["latin", "latin-ext"],
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Admin panel · Reels tanlov",
    template: "%s · Reels tanlov admin",
  },
  description: "Reels tanlov ilovasi — zavod xodimlari uchun admin panel",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" className={lexend.variable}>
      <body>{children}</body>
    </html>
  );
}
