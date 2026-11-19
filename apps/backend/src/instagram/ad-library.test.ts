import assert from "node:assert/strict";
import { test } from "node:test";

import { adLibrarySearchUrl, ApifyAdLibraryProvider } from "./ad-library";

/** Apify: ish darhol tugaydi, dataset — berilgan natijalar. */
function fakeApify(items: unknown[]) {
  const posts: unknown[] = [];
  const urls: string[] = [];
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    urls.push(url);
    if (init?.method === "POST") posts.push(JSON.parse(String(init.body)));
    const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    if (url.includes("/acts/")) return json({ data: { id: "r1", status: "SUCCEEDED", defaultDatasetId: "d1" } });
    if (url.includes("/datasets/d1/items")) return json(items);
    return Promise.resolve(new Response("?", { status: 404 }));
  };
  return { posts, urls, fetchFn: fetchFn as typeof fetch };
}

const adItem = (query: string, igUsername: string, id: string) => ({
  inputUrl: adLibrarySearchUrl(query),
  adArchiveID: id,
  isActive: true,
  startDateFormatted: "2026-11-28T07:00:00.000Z",
  publisherPlatform: ["INSTAGRAM"],
  ad_details: { advertiser: { ad_library_page_info: { page_info: { ig_username: igUsername } } } },
});

test("only ads whose advertiser is exactly the participant's account count", async () => {
  const { posts, urls, fetchFn } = fakeApify([
    adItem("ali_shop", "ali_shop", "1"),
    // Kalit so'z boshqa reklamada uchragan — boshqa reklama beruvchi.
    adItem("vali", "vali_store_uz", "2"),
    // Reklama topilmadi — aktor bo'sh yozuv qaytaradi.
    { inputUrl: adLibrarySearchUrl("sardor") },
  ]);
  const provider = new ApifyAdLibraryProvider("tok", fetchFn);
  const result = await provider.check(["Ali_Shop", "vali", "sardor"]);

  assert.deepEqual(result.get("ali_shop"), [
    {
      adId: "1",
      startedOn: "2026-11-28",
      platforms: ["INSTAGRAM"],
      url: "https://www.facebook.com/ads/library/?id=1",
    },
  ]);
  assert.deepEqual(result.get("vali"), []);
  assert.deepEqual(result.get("sardor"), []);

  assert.match(urls[0], /\/acts\/apify~facebook-ads-scraper\/runs\?maxItems=15$/);
  assert.deepEqual(posts[0], {
    startUrls: ["ali_shop", "vali", "sardor"].map((u) => ({ url: adLibrarySearchUrl(u) })),
    resultsLimit: 5,
    activeStatus: "active",
    isDetailsPerAd: true,
  });
});
