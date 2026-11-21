import assert from "node:assert/strict";
import { test } from "node:test";

import { maxChargeUsd } from "./apify-client";
import { ApifyReelStatsProvider } from "./apify.provider";

interface Call {
  method: string;
  url: string;
  body: unknown;
  auth: string | null;
}

/** Apify API'ni taqlid qiladi: ish → bir marta RUNNING → SUCCEEDED → dataset. */
function fakeApify(items: unknown[], finalStatus = "SUCCEEDED") {
  const calls: Call[] = [];
  let polls = 0;
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      method: init?.method ?? "GET",
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      auth: headers.get("authorization"),
    });
    const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    if (url.includes("/acts/")) return json({ data: { id: "run1", status: "READY", defaultDatasetId: "ds1" } });
    if (url.includes("/actor-runs/")) {
      polls += 1;
      const status = polls < 2 ? "RUNNING" : finalStatus;
      return json({ data: { id: "run1", status, defaultDatasetId: "ds1" } });
    }
    if (url.includes("/datasets/ds1/items")) return json(items);
    return Promise.resolve(new Response("not found", { status: 404 }));
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

test("maps Apify items to Reel stats and marks missing Reels as null", async () => {
  const { calls, fetchFn } = fakeApify([
    {
      shortCode: "Dfs87rlsMIn",
      type: "Video",
      productType: "clips",
      ownerUsername: "NeedleMacB",
      videoPlayCount: 156745,
      likesCount: 17800,
      commentsCount: 100,
      timestamp: "2026-11-14T00:47:39.000Z",
    },
    { shortCode: "Hidden0001", type: "Video", ownerUsername: "x", videoPlayCount: 10, likesCount: -1 },
    { url: "https://www.instagram.com/reel/Gone000001/", error: "not_found" },
  ]);
  const provider = new ApifyReelStatsProvider("secret-token", fetchFn);
  const result = await provider.fetch(["Dfs87rlsMIn", "Hidden0001", "Gone000001"]);

  assert.deepEqual(result.get("Dfs87rlsMIn"), {
    shortcode: "Dfs87rlsMIn",
    owner: "needlemacb",
    isVideo: true,
    views: 156745,
    likes: 17800,
    comments: 100,
    postedAt: new Date("2026-11-14T00:47:39.000Z"),
  });
  assert.equal(result.get("Hidden0001")?.likes, null);
  assert.equal(result.get("Gone000001"), null);

  const start = calls[0];
  assert.equal(start.method, "POST");
  // 3 × $0.0027 = $0.0081 — Apify faqat `maxItems` bilan kelgan ishni rad etadi (2026-11-21).
  assert.match(start.url, /\/acts\/apify~instagram-scraper\/runs\?maxItems=3&maxTotalChargeUsd=0\.0081$/);
  assert.equal(start.auth, "Bearer secret-token");
  assert.deepEqual(start.body, {
    directUrls: [
      "https://www.instagram.com/reel/Dfs87rlsMIn/",
      "https://www.instagram.com/reel/Hidden0001/",
      "https://www.instagram.com/reel/Gone000001/",
    ],
    resultsType: "details",
    resultsLimit: 1,
  });
  assert.equal(calls.filter((c) => c.url.includes("/actor-runs/")).length, 2);
});

test("a failed Apify run is an error, not an empty result", async () => {
  const { fetchFn } = fakeApify([], "FAILED");
  const provider = new ApifyReelStatsProvider("t", fetchFn);
  await assert.rejects(provider.fetch(["AAAAA1"]), /FAILED/);
});

test("large batches are split into several runs", async () => {
  const { calls, fetchFn } = fakeApify([]);
  const provider = new ApifyReelStatsProvider("t", fetchFn);
  const codes = Array.from({ length: 150 }, (_, i) => `CODE${String(i).padStart(4, "0")}`);
  const result = await provider.fetch(codes);
  assert.equal(result.size, 150);
  assert.equal(calls.filter((c) => c.method === "POST").length, 2);
});

test("maxChargeUsd: natijalar × narx, kamida bitta natija narxi (Apify minimumi)", () => {
  assert.equal(maxChargeUsd({ maxItems: 1, pricePerItemUsd: 0.0027 }), 0.0027);
  assert.equal(maxChargeUsd({ maxItems: 3, pricePerItemUsd: 0.0027 }), 0.0081);
  assert.equal(maxChargeUsd({ maxItems: 100, pricePerItemUsd: 0.0027 }), 0.27);
  assert.equal(maxChargeUsd({ maxItems: 0, pricePerItemUsd: 0.0027 }), 0.0027);
  assert.equal(maxChargeUsd({ maxItems: 15, pricePerItemUsd: 0.0058 }), 0.087);
});
