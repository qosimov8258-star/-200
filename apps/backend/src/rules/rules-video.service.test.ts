import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_RULES_VIDEO_BYTES, RulesVideoService } from "./rules-video.service";

/** MP4 boshiga o'xshash (ISO BMFF `ftyp` atomi) fayl. */
const mp4 = (size = 4_000): Buffer => {
  const data = Buffer.alloc(size);
  data.writeUInt32BE(24, 0);
  data.write("ftypisom", 4, "latin1");
  return data;
};

test("only MP4/MOV/WebM up to 100 MB pass the check", () => {
  const svc = new RulesVideoService();
  assert.equal(svc.check("image/png", mp4()), "INVALID");
  assert.equal(svc.check("video/mp4", {}), "INVALID");
  assert.equal(svc.check("video/mp4", Buffer.alloc(4_000)), "INVALID");
  assert.equal(svc.check("video/mp4", mp4(500)), "INVALID");
  assert.equal(svc.check("video/mp4", mp4(MAX_RULES_VIDEO_BYTES + 1)), "TOO_LARGE");
  const ok = svc.check("video/quicktime; codecs=avc1", mp4());
  assert.ok(typeof ok === "object" && ok.mime === "video/quicktime");
});

test("upload, replace and delete: only the current id is served", () => {
  const svc = new RulesVideoService();
  assert.equal(svc.get(), null);
  const first = svc.set({ mime: "video/mp4", data: mp4(5_000) }, "Bosh Admin", new Date("2026-11-24T10:00:00Z"));
  assert.deepEqual(svc.get(), first);
  assert.deepEqual([first.sizeBytes, first.updatedBy, first.updatedAt], [5_000, "Bosh Admin", "2026-11-24T10:00:00.000Z"]);
  const served = svc.file(first.id);
  assert.ok(served && "data" in served && served.data.length === 5_000);

  const second = svc.set({ mime: "video/mp4", data: mp4(6_000) }, "Admin");
  assert.notEqual(second.id, first.id);
  assert.equal(svc.file(first.id), null, "eski id endi berilmaydi");
  assert.ok(svc.file(second.id));

  assert.deepEqual(svc.remove(), second);
  assert.equal(svc.get(), null);
  assert.equal(svc.file(second.id), null);
  assert.equal(svc.remove(), null);
});
