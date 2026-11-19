import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HttpException } from "@nestjs/common";

import { parseSupportMessage } from "../miniapp/validation";
import { ParticipantsService } from "../participants/participants.service";
import { StateStore } from "../persistence/state-store";
import { RulesService } from "../rules/rules.service";
import { SupportService } from "./support.service";

test("thread: shows the participant's messages and operator replies in order, only their own", () => {
  const support = new SupportService();
  support.addParticipantMessage(1, "Ismimni o'zgartirmoqchiman", null);
  support.addParticipantMessage(2, "Boshqa ishtirokchi", null);
  support.addOperatorReply(1, "Pasport nusxasini yuboring");

  const thread = support.thread(1);
  assert.deepEqual(
    thread.map((m) => [m.from, m.text]),
    [
      ["PARTICIPANT", "Ismimni o'zgartirmoqchiman"],
      ["OPERATOR", "Pasport nusxasini yuboring"],
    ],
  );
  assert.equal(support.thread(3).length, 0);
});

test("recentParticipantMessages counts only the participant's own messages inside the window", () => {
  const support = new SupportService();
  for (let i = 0; i < 3; i++) support.addParticipantMessage(7, `xabar ${i}`, null);
  support.addOperatorReply(7, "javob");

  assert.equal(support.recentParticipantMessages(7, 60_000), 3);
  const later = new Date(Date.now() + 2 * 60_000);
  assert.equal(support.recentParticipantMessages(7, 60_000, later), 0);
});

test("parseSupportMessage: trims text, rejects empty, too long and unknown fields", () => {
  assert.equal(parseSupportMessage({ text: "  Salom  " }), "Salom");
  const status = (body: unknown) => {
    try {
      parseSupportMessage(body);
      return 0;
    } catch (e) {
      return e instanceof HttpException ? e.getStatus() : -1;
    }
  };
  assert.equal(status({ text: "   " }), 422);
  assert.equal(status({ text: "a".repeat(1001) }), 422);
  assert.equal(status({ text: "salom", extra: 1 }), 400);
});

// --- Admin panel ----------------------------------------------------------------

function setup(store: StateStore | null = null) {
  const participants = new ParticipantsService(new RulesService());
  const support = new SupportService(store);
  const people = (telegramId: number) => participants.get(telegramId);
  const person = (id: number, firstName: string, lastName: string) => {
    participants.setPhone(id, id, `+99890${String(id).padStart(7, "0")}`);
    participants.register(id, firstName, lastName, 25);
  };
  return { participants, support, people, person };
}

const httpStatus = async (fn: () => unknown) => {
  try {
    await fn();
    return 0;
  } catch (e) {
    return e instanceof HttpException ? e.getStatus() : -1;
  }
};

test("adminList: subject from the first message, awaitingReply, status counts and search", () => {
  const { support, people, person } = setup();
  person(1, "Ali", "Valiyev");
  person(2, "Oʻtkir", "Hamidov");
  const long = "Videomni yuborgan edim, lekin ilovada hali ham tekshirilmoqda deb turibdi, nima qilsam bo'ladi?";
  const t1 = support.addParticipantMessage(1, long, null);
  support.addOperatorReply(1, "Tekshiryapmiz");
  const t2 = support.addParticipantMessage(2, "", "photo-file-id", 12_345);

  const { rows, statusCounts } = support.adminList({}, people);
  assert.equal(rows.length, 2);
  const first = rows.find((r) => r.id === String(t1.id))!;
  assert.ok(first.subject.length <= 60);
  assert.ok(first.subject.endsWith("…"));
  assert.ok(long.startsWith(first.subject.slice(0, -1)));
  assert.equal(first.status, "IN_PROGRESS");
  assert.equal(first.awaitingReply, false);
  assert.deepEqual(first.lastMessage.author, "STAFF");
  assert.equal(first.messageCount, 2);

  const photo = rows.find((r) => r.id === String(t2.id))!;
  assert.equal(photo.subject, "Rasm");
  assert.equal(photo.lastMessage.text, "Rasm");
  assert.equal(photo.awaitingReply, true);
  assert.equal(photo.participant.firstName, "Oʻtkir");

  assert.deepEqual(statusCounts, { ALL: 2, OPEN: 2, NEW: 1, IN_PROGRESS: 1, CLOSED: 0 });
  assert.deepEqual(support.adminList({ status: "NEW" }, people).rows.map((r) => r.id), [String(t2.id)]);
  assert.equal(support.adminList({ search: "o'tkir" }, people).rows[0]?.id, String(t2.id));
  assert.equal(support.adminList({ search: "valiyev ali" }, people).rows[0]?.id, String(t1.id));
  assert.equal(support.adminList({ search: `#${t1.id}` }, people).rows[0]?.id, String(t1.id));
  assert.equal(support.adminList({ search: "ilovada hali" }, people).rows.length, 1, "mavzu bo'yicha");
  assert.equal(support.adminList({ search: "0000002" }, people).rows[0]?.id, String(t2.id), "telefon bo'yicha");
  assert.equal(support.adminList({ search: "valiyev" }, people).statusCounts.ALL, 1);
});

test("replyAsStaff: delivers first, then stores the reply with the staff name and moves to IN_PROGRESS", async () => {
  const { support, people, person } = setup();
  person(1, "Ali", "Valiyev");
  const ticket = support.addParticipantMessage(1, "Savol", null);
  const delivered: number[] = [];

  const { before } = await support.replyAsStaff(String(ticket.id), "Javob", "Dilnoza Karimova", async (t) => {
    delivered.push(t.telegramId);
  });
  assert.equal(before, "NEW");
  assert.deepEqual(delivered, [1]);
  support.addOperatorReply(1, "Guruhdan javob");

  const detail = support.adminDetail(ticket.id, people);
  assert.equal(detail.status, "IN_PROGRESS");
  assert.deepEqual(
    detail.messages.map((m) => [m.author, m.authorName, m.text]),
    [
      ["PARTICIPANT", "Ali Valiyev", "Savol"],
      ["STAFF", "Dilnoza Karimova", "Javob"],
      ["STAFF", "Operator", "Guruhdan javob"],
    ],
  );
  assert.equal(support.adminList({}, people).rows[0]?.awaitingReply, false);
});

test("replyAsStaff: nothing is stored when delivery fails; closed ticket is 409; unknown is 404", async () => {
  const { support, people } = setup();
  const ticket = support.addParticipantMessage(1, "Savol", null);

  const failing = () => Promise.reject(new HttpException({ message: "Ishtirokchi botni bloklagan" }, 409));
  assert.equal(await httpStatus(() => support.replyAsStaff(ticket.id, "Javob", "Admin", failing)), 409);
  const detail = support.adminDetail(ticket.id, people);
  assert.equal(detail.messages.length, 1, "yetkazilmagan javob saqlanmaydi");
  assert.equal(detail.status, "NEW");
  assert.equal(detail.participant.firstName, "", "ishtirokchi topilmasa ham ishlaydi");

  support.setStatus(ticket.id, "CLOSED");
  let called = false;
  const deliver = async () => {
    called = true;
  };
  assert.equal(await httpStatus(() => support.replyAsStaff(ticket.id, "Javob", "Admin", deliver)), 409);
  assert.equal(called, false, "yopilgan murojaatga yuborilmaydi");
  assert.equal(await httpStatus(() => support.replyAsStaff("999", "Javob", "Admin", deliver)), 404);
  assert.equal(await httpStatus(() => support.adminDetail("abc", people)), 404);
});

test("setStatus: changes status and updatedAt; cannot reopen while another ticket is open", async () => {
  const { support, people } = setup();
  const old = support.addParticipantMessage(1, "Birinchi", null);
  const before = old.updatedAt.getTime();
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(support.setStatus(old.id, "CLOSED").before, "NEW");
  assert.equal(support.adminDetail(old.id, people).status, "CLOSED");
  assert.ok(old.updatedAt.getTime() > before, "holat o'zgarishi faollik hisoblanadi");
  assert.equal(support.setStatus(old.id, "CLOSED").before, "CLOSED", "o'zgarishsiz");

  // Yopilgandan keyin yozsa — yangi murojaat.
  const fresh = support.addParticipantMessage(1, "Yana savol", null);
  assert.notEqual(fresh.id, old.id);
  assert.equal(await httpStatus(() => support.setStatus(old.id, "IN_PROGRESS")), 409);

  support.setStatus(fresh.id, "CLOSED");
  assert.equal(support.setStatus(old.id, "IN_PROGRESS").ticket.status, "IN_PROGRESS");
  assert.equal(await httpStatus(() => support.setStatus("404", "NEW")), 404);
});

test("attachments: id and url per photo message; unknown attachment is 404", async () => {
  const { support, people } = setup();
  const ticket = support.addParticipantMessage(1, "Mana skrinshot", "file-abc", 2048);
  support.addParticipantMessage(1, "Matn", null);

  const [photo, text] = support.adminDetail(ticket.id, people).messages;
  assert.deepEqual(photo?.attachments, [
    {
      id: "m1",
      fileName: `rasm-${ticket.id}-1.jpg`,
      sizeBytes: 2048,
      url: `/api/v1/admin/support/tickets/${ticket.id}/attachments/m1`,
    },
  ]);
  assert.deepEqual(text?.attachments, []);
  assert.equal(support.attachmentFileId(String(ticket.id), "m1"), "file-abc");
  assert.equal(await httpStatus(() => support.attachmentFileId(ticket.id, "m2")), 404, "matnli xabarda fayl yo'q");
  assert.equal(await httpStatus(() => support.attachmentFileId(ticket.id, "../m1")), 404);
});

test("old saved data without `by`/`photoSize` still loads and shows in the admin panel", () => {
  const dir = mkdtempSync(join(tmpdir(), "support-"));
  const old = new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 });
  const at = (iso: string) => new Date(iso);
  // Yangi maydonlar qo'shilishidan oldingi ko'rinish.
  old.attach("support", () => ({
    seq: 3,
    tickets: [
      {
        id: 2,
        telegramId: 9,
        status: "IN_PROGRESS",
        messages: [
          { from: "PARTICIPANT", text: "Eski savol", photoFileId: "old-photo", createdAt: at("2026-11-20T08:00:00Z") },
          { from: "OPERATOR", text: "Eski javob", photoFileId: null, createdAt: at("2026-11-20T09:00:00Z") },
        ],
        updatedAt: at("2026-11-20T09:00:00Z"),
      },
    ],
    groupMessageOwner: [[555, 9]],
  }));
  old.flush();

  const { support, people, person } = setup(new StateStore({ dir, saveEveryMs: 60_000, keepBackups: 1 }));
  person(9, "Eski", "Ishtirokchi");
  const detail = support.adminDetail("2", people);
  assert.equal(detail.subject, "Eski savol");
  assert.equal(detail.createdAt, "2026-11-20T08:00:00.000Z");
  assert.equal(detail.messages[1]?.authorName, "Operator");
  assert.equal(detail.messages[0]?.attachments[0]?.sizeBytes, 0);
  assert.equal(support.ownerOfGroupMessage(555), 9);
  assert.equal(support.adminList({ status: "OPEN" }, people).rows[0]?.awaitingReply, false);

  // Raqamlash saqlangandan davom etadi.
  support.setStatus(2, "CLOSED");
  assert.equal(support.addParticipantMessage(9, "Yangi", null).id, 3);
});
