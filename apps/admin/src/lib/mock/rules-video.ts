/**
 * MOCK backend: qoida videosi (Mini App'dagi "Qoidalar" bo'limida eng tepada). Haqiqiy backendda:
 *   GET / PUT / DELETE /api/v1/admin/rules/video
 *   GET /api/v1/miniapp/rules/video/:id
 * (`apps/backend/src/admin/admin-rules.controller.ts`, `apps/backend/src/rules/rules-video.service.ts`)
 *
 * Fayl faqat shu sahifa xotirasida (`URL.createObjectURL`) — sahifa yangilansa video yo'qoladi.
 * Audit yozuvlari esa boshqa mock amallar kabi `localStorage` da qoladi.
 */
import { ApiError } from "../api-error";
import { rulesVideoMimeOf } from "../rules-video";
import { RULES_VIDEO_LIMITS, type AdminUser, type RulesVideo, type RulesVideoMime } from "../types";
import { recordAudit } from "./audit";

/** Bundan kichik fayl video bo'lishi mumkin emas (backenddagi bilan bir xil). */
const MIN_BYTES = 1_000;

/** MP4 va MOV (ISO BMFF) fayl boshidagi birinchi "atom" nomlari. */
const BMFF_ATOMS = new Set(["ftyp", "moov", "mdat", "wide", "free", "skip"]);
/** WebM (Matroska / EBML) sarlavhasi. */
const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

/** Brauzer video ochib bo'lmaydigan manzil — `<video>` xuddi 404 dagidek xato beradi. */
const MISSING_VIDEO_URL = "data:video/mp4;base64,";

let current: RulesVideo | null = null;
/** Video id -> `blob:` manzil. Almashtirilgan / o'chirilgan videoning manzili bekor qilinadi. */
const objectUrls = new Map<string, string>();

/** Fayl boshidagi baytlar e'lon qilingan turga mos keladimi (backenddagi kabi). */
async function looksLikeVideo(file: Blob, mime: RulesVideoMime): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (mime === "video/webm") return EBML_MAGIC.every((byte, index) => head[index] === byte);
  return BMFF_ATOMS.has(String.fromCharCode(...head.subarray(4, 8)));
}

function describe(video: RulesVideo): string {
  return `${video.mime}, ${video.sizeBytes} bayt`;
}

function newId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function forget(video: RulesVideo | null): void {
  if (!video) return;
  const url = objectUrls.get(video.id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(video.id);
}

export function getRulesVideo(): RulesVideo | null {
  return current;
}

/** Hajmni nginx kabi so'rov boshida tekshiradi (fayl to'liq yuborilmasdan). */
export function checkRulesVideoSize(file: File): void {
  if (file.size > RULES_VIDEO_LIMITS.maxBytes) {
    throw new ApiError(413, "Video 100 MB dan katta bo'lmasin.", "RULES_VIDEO_TOO_LARGE");
  }
}

export async function uploadRulesVideo(file: File, actor: AdminUser): Promise<RulesVideo> {
  checkRulesVideoSize(file);
  const mime = rulesVideoMimeOf(file);
  if (!mime || file.size < MIN_BYTES || !(await looksLikeVideo(file, mime))) {
    throw new ApiError(422, "Faqat video yuklash mumkin: MP4, MOV yoki WebM.", "RULES_VIDEO_INVALID");
  }

  const previous = current;
  const video: RulesVideo = {
    id: newId(),
    mime,
    sizeBytes: file.size,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.fullName,
  };
  objectUrls.set(video.id, URL.createObjectURL(file));
  current = video;
  forget(previous);

  recordAudit({
    actorId: actor.id,
    actorName: actor.fullName,
    action: "settings.rules_video",
    entity: "settings",
    entityId: "rules-video",
    before: previous ? describe(previous) : "",
    after: describe(video),
    reason: "",
  });
  return video;
}

export function deleteRulesVideo(actor: AdminUser): void {
  const removed = current;
  if (!removed) return;
  current = null;
  forget(removed);

  recordAudit({
    actorId: actor.id,
    actorName: actor.fullName,
    action: "settings.rules_video_delete",
    entity: "settings",
    entityId: "rules-video",
    before: describe(removed),
    after: "",
    reason: "",
  });
}

/** `<video src>` uchun manzil: joriy video — `blob:` manzil, eskisi — ochilmaydigan manzil (404 kabi). */
export function rulesVideoUrl(id: string): string {
  return objectUrls.get(id) ?? MISSING_VIDEO_URL;
}
