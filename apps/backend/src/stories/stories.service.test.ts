import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiException } from "../common/api-exception";
import { ParticipantsService } from "../participants/participants.service";
import { RulesService } from "../rules/rules.service";
import { MAX_ACTIVE_STORIES, STORY_TTL_MS, StoriesService } from "./stories.service";
import { looksLikeVideo, MAX_STORY_BYTES, storyMimeOf } from "./story-file";

/** MP4 boshiga o'xshash (ISO BMFF `ftyp` atomi) fayl. */
const mp4 = (size = 4_000): Buffer => {
  const data = Buffer.alloc(size);
  data.writeUInt32BE(24, 0);
  data.write("ftypisom", 4, "latin1");
  return data;
};
/** WebM (EBML) boshiga o'xshash fayl. */
const webm = (size = 4_000): Buffer => {
  const data = Buffer.alloc(size);
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).copy(data);
  return data;
};

function setup() {
  let now = new Date("2026-11-23T10:00:00Z");
  const participants = new ParticipantsService(new RulesService());
  for (const id of [1, 2, 3]) {
    participants.setPhone(id, id, `+99890000000${id}`);
    participants.register(id, `Ism${id}`, `Familiya${id}`, 25);
    participants.acceptRules(id, 1);
  }
  participants.setPhone(9, 9, "+998900000009"); // profili to'ldirilmagan
  const stories = new StoriesService(participants, null, { clock: () => now });
  const later = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { participants, stories, later };
}

const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof ApiException ? (e.getResponse() as { code: string }).code : "OTHER";
  }
  return "NONE";
};

test("file checks: only MP4/MOV/WebM by type and leading bytes", () => {
  assert.equal(storyMimeOf("video/mp4"), "video/mp4");
  assert.equal(storyMimeOf("Video/QuickTime; codecs=avc1"), "video/quicktime");
  assert.equal(storyMimeOf("video/webm"), "video/webm");
  assert.equal(storyMimeOf("image/png"), null);
  assert.equal(storyMimeOf(undefined), null);
  assert.equal(looksLikeVideo(mp4(), "video/mp4"), true);
  assert.equal(looksLikeVideo(mp4(), "video/quicktime"), true, "MOV ham ISO BMFF");
  assert.equal(looksLikeVideo(webm(), "video/webm"), true);
  assert.equal(looksLikeVideo(webm(), "video/mp4"), false);
  assert.equal(looksLikeVideo(Buffer.alloc(4_000), "video/mp4"), false);
});

test("a registered participant posts a story; everyone sees it, mine first", () => {
  const { stories, later } = setup();
  stories.add(2, "video/mp4", mp4());
  later(60_000);
  stories.add(1, "video/webm", webm());
  later(60_000);
  stories.add(3, "video/mp4", mp4());
  later(60_000);
  stories.add(1, "video/mp4", mp4());

  const forMe = stories.groups(1);
  assert.deepEqual(
    forMe.map((g) => [g.fullName, g.isMe, g.stories.length]),
    [
      ["Ism1 Familiya1", true, 2],
      ["Ism3 Familiya3", false, 1],
      ["Ism2 Familiya2", false, 1],
    ],
  );
  // Eskidan yangiga; 24 soat yashaydi.
  const mine = forMe[0].stories;
  assert.ok(mine[0].createdAt < mine[1].createdAt);
  assert.equal(new Date(mine[0].expiresAt).getTime() - new Date(mine[0].createdAt).getTime(), STORY_TTL_MS);
  // Mehmon — hech kim "men" emas; kalit Telegram ID emas va barqaror.
  const guest = stories.groups(null);
  assert.ok(guest.every((g) => !g.isMe));
  assert.ok(guest.every((g) => !/^\d+$/.test(g.authorKey)));
  assert.equal(stories.groups(2).find((g) => g.fullName === "Ism1 Familiya1")?.authorKey, forMe[0].authorKey);
});

test("only active registered participants can post; bad files and the limit are refused", () => {
  const { participants, stories } = setup();
  assert.equal(code(() => stories.add(9, "video/mp4", mp4())), "UNAUTHORIZED");
  assert.equal(code(() => stories.add(404, "video/mp4", mp4())), "UNAUTHORIZED");
  assert.equal(code(() => stories.add(1, "image/png", mp4())), "STORY_INVALID_FILE");
  assert.equal(code(() => stories.add(1, "video/mp4", {})), "STORY_INVALID_FILE");
  assert.equal(code(() => stories.add(1, "video/mp4", Buffer.alloc(4_000))), "STORY_INVALID_FILE");
  assert.equal(code(() => stories.add(1, "video/mp4", mp4(500))), "STORY_INVALID_FILE");
  assert.equal(code(() => stories.add(1, "video/mp4", mp4(MAX_STORY_BYTES + 1))), "STORY_TOO_LARGE");

  for (let i = 0; i < MAX_ACTIVE_STORIES; i++) stories.add(1, "video/mp4", mp4());
  assert.equal(code(() => stories.add(1, "video/mp4", mp4())), "STORY_LIMIT");

  participants.get(2)!.status = "BLOCKED";
  assert.equal(code(() => stories.add(2, "video/mp4", mp4())), "UNAUTHORIZED");
});

test("stories expire after 24 hours: hidden, video gone, files cleaned, limit freed", () => {
  const { stories, later } = setup();
  for (let i = 0; i < MAX_ACTIVE_STORIES; i++) stories.add(1, "video/mp4", mp4());
  const id = stories.groups(1)[0].stories[0].id;
  assert.ok(stories.video(id));

  later(STORY_TTL_MS - 1_000);
  assert.equal(stories.groups(null).length, 1);
  later(1_000);
  assert.deepEqual(stories.groups(null), []);
  assert.equal(stories.video(id), null);
  assert.equal(stories.cleanup(), MAX_ACTIVE_STORIES);
  assert.equal(code(() => stories.add(1, "video/mp4", mp4())), "NONE");
});

test("own story can be deleted; someone else's cannot; the video is served until then", () => {
  const { stories } = setup();
  stories.add(1, "video/mp4", mp4(5_000));
  const id = stories.groups(1)[0].stories[0].id;
  const video = stories.video(id);
  assert.ok(video && "data" in video && video.data.length === 5_000 && video.mime === "video/mp4");

  assert.equal(code(() => stories.removeOwn(2, id)), "NOT_FOUND");
  stories.removeOwn(1, id);
  assert.equal(stories.video(id), null);
  assert.equal(code(() => stories.removeOwn(1, id)), "NOT_FOUND");
});

test("blocked participants' stories are hidden from everyone but stay in the admin list", () => {
  const { participants, stories, later } = setup();
  stories.add(1, "video/mp4", mp4());
  later(1_000);
  stories.add(2, "video/mp4", mp4());
  participants.get(2)!.status = "BLOCKED";
  assert.deepEqual(stories.groups(null).map((g) => g.fullName), ["Ism1 Familiya1"]);
  assert.deepEqual(
    stories.adminList().map((s) => [s.participant.id, s.participant.fullName, s.participant.phone, s.mime]),
    [
      ["2", "Ism2 Familiya2", "+998900000002", "video/mp4"],
      ["1", "Ism1 Familiya1", "+998900000001", "video/mp4"],
    ],
  );
});

test("admin removes any active story", () => {
  const { stories } = setup();
  stories.add(3, "video/mp4", mp4());
  const id = stories.adminList()[0].id;
  assert.deepEqual(stories.adminRemove(id)?.fullName, "Ism3 Familiya3");
  assert.equal(stories.adminRemove(id), null);
  assert.deepEqual(stories.adminList(), []);
  assert.deepEqual(stories.groups(null), []);
});
