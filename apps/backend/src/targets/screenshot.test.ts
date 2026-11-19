import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_SCREENSHOT_BYTES, parseScreenshot } from "./screenshot";

const dataUrl = (mime: string, bytes: Buffer) => `data:${mime};base64,${bytes.toString("base64")}`;
const jpegBytes = (size: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);

test("only real images of an allowed type and size are accepted", () => {
  const ok = parseScreenshot(dataUrl("image/jpeg", jpegBytes(5_000)));
  assert.equal(ok?.mime, "image/jpeg");
  assert.equal(ok?.data.length, 5_004);

  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2_000)]);
  assert.equal(parseScreenshot(dataUrl("image/png", png))?.mime, "image/png");

  // Turi rasmga mos emas (HTML "rasm" deb yuborilgan).
  assert.equal(parseScreenshot(dataUrl("image/jpeg", Buffer.from("<html>".repeat(400)))), null);
  // Ruxsat etilmagan tur.
  assert.equal(parseScreenshot(dataUrl("image/svg+xml", jpegBytes(5_000))), null);
  // Juda kichik va juda katta.
  assert.equal(parseScreenshot(dataUrl("image/jpeg", jpegBytes(10))), null);
  assert.equal(parseScreenshot(dataUrl("image/jpeg", jpegBytes(MAX_SCREENSHOT_BYTES))), null);
  assert.equal(parseScreenshot("rasm emas"), null);
});
