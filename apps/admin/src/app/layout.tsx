import type { Metadata } from "next";

import "./globals.css";

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
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
