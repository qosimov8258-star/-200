/**
 * Apify (apify/instagram-scraper) orqali Reel ko'rishlarini olish — SINOV skripti.
 *
 *   cd apps/backend
 *   npx tsx scripts/apify-reels-test.ts reels.txt
 *
 * Ikki bosqich:
 *   1) Reel linklari bo'yicha — egasini (va iloji bo'lsa ko'rishlarni) oladi;
 *   2) ko'rishlar chiqmagan Reel'lar uchun egasining profil Reels lentasini o'qib,
 *      shu Reel'ni shortcode bo'yicha topadi (Instagram ko'rishlarni lentada beradi).
 *
 * Token: `apps/backend/.env` dagi APIFY_API_TOKEN. Har bir natija Apify hisobidan
 * pul yechadi (bepul oylik limit bor) — oz sonli link bilan sinang.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { canonicalReelUrl, parseReelShortcode } from "../src/miniapp/reel-url";

try {
  process.loadEnvFile(".env");
} catch {
  // .env yo'q — o'zgaruvchi muhitdan olinadi.
}

const ACTOR = "apify~instagram-scraper";
const PROFILE_REELS_LIMIT = 30;

interface IgItem {
  shortCode?: string;
  url?: string;
  ownerUsername?: string;
  videoPlayCount?: number | null;
  videoViewCount?: number | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  timestamp?: string;
  error?: string;
  errorDescription?: string;
}

const token = process.env.APIFY_API_TOKEN;
if (!token) {
  console.error("APIFY_API_TOKEN topilmadi (apps/backend/.env).");
  process.exit(1);
}

/** Aktorni ishga tushirib, natijalarni kutib oladi (Apify run-sync API). */
async function runActor(input: Record<string, unknown>): Promise<IgItem[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=280`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Apify → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as IgItem[];
}

const plays = (i: IgItem | undefined) => i?.videoPlayCount ?? i?.videoViewCount ?? null;

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("Foydalanish: npx tsx scripts/apify-reels-test.ts reels.txt");
    process.exit(1);
  }
  const codes = [
    ...new Set(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((l) => parseReelShortcode(l.trim()))
        .filter((c): c is string => c !== null),
    ),
  ];
  if (codes.length === 0) {
    console.error("Yaroqli Reel linki yo'q.");
    process.exit(1);
  }

  const started = Date.now();
  console.log(`1-bosqich: ${codes.length} ta Reel linki…`);
  const direct = await runActor({
    directUrls: codes.map(canonicalReelUrl),
    resultsType: "details",
    resultsLimit: 1,
  });
  const byCode = new Map<string, IgItem>();
  for (const item of direct) if (item.shortCode) byCode.set(item.shortCode, item);

  // 2-bosqich: ko'rishlar chiqmaganlar uchun egasining Reels lentasi.
  const owners = [
    ...new Set(
      codes
        .filter((c) => plays(byCode.get(c)) === null)
        .map((c) => byCode.get(c)?.ownerUsername)
        .filter((u): u is string => Boolean(u)),
    ),
  ];
  const fromProfile = new Map<string, IgItem>();
  if (owners.length > 0) {
    console.log(`2-bosqich: ${owners.length} ta profil Reels lentasi…`);
    const feed = await runActor({
      directUrls: owners.map((u) => `https://www.instagram.com/${u}/`),
      resultsType: "reels",
      resultsLimit: PROFILE_REELS_LIMIT,
    });
    for (const item of feed) if (item.shortCode) fromProfile.set(item.shortCode, item);
  }

  const rows = codes.map((code) => {
    const d = byCode.get(code);
    const p = fromProfile.get(code);
    return {
      shortcode: code,
      egasi: d?.ownerUsername ?? p?.ownerUsername ?? "",
      "ko'rish (link)": plays(d) ?? "",
      "ko'rish (profil)": plays(p) ?? "",
      layk: d?.likesCount ?? p?.likesCount ?? "",
      izoh: d?.commentsCount ?? p?.commentsCount ?? "",
      xato: d?.error ?? d?.errorDescription ?? (d || p ? "" : "topilmadi"),
    };
  });
  console.table(rows);
  console.log(`${Math.round((Date.now() - started) / 1000)} soniyada.`);
  writeFileSync("apify-raw.json", JSON.stringify({ direct, profile: [...fromProfile.values()] }, null, 2));
  console.log("Xom javob: apps/backend/apify-raw.json");
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
