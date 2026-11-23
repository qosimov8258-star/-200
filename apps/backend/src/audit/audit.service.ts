import { Inject, Injectable, Optional } from "@nestjs/common";

import type { AdminRole } from "../admin/auth/admin-accounts";
import { StateStore } from "../persistence/state-store";

/** `apps/admin/src/lib/types.ts` → AuditEntity bilan bir xil. */
export type AuditEntity =
  | "participant"
  | "reel"
  | "support_ticket"
  | "target_case"
  | "telegram_message"
  | "winner"
  | "settings"
  | "prize"
  | "voucher_draw"
  | "story"
  | "auth";

export const AUDIT_ENTITIES: AuditEntity[] = [
  "participant",
  "reel",
  "support_ticket",
  "target_case",
  "telegram_message",
  "winner",
  "settings",
  "prize",
  "voucher_draw",
  "story",
  "auth",
];

/** Amalni bajargan xodim. */
export interface AuditActor {
  id: string;
  name: string;
  role: AdminRole;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: AuditActor;
  /** Masalan "participant.block", "support.reply". */
  action: string;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  before: string;
  after: string;
  reason: string;
}

export type AuditInput = Omit<AuditEntry, "id" | "at" | "actor"> & { actor: AuditActor };

export interface AuditQuery {
  search?: string;
  entity?: AuditEntity;
  actorRole?: AdminRole;
  page?: number;
  pageSize?: number;
}

const MAX_ENTRIES = 50_000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Audit log (TZ 2-bo'lim): barcha Admin va Support harakatlari — kim, nima, qachon, nega.
 * Faqat qo'shiladi (tahrirlash va o'chirish yo'q). `StateStore` orqali diskka saqlanadi.
 */
@Injectable()
export class AuditService {
  private entries: AuditEntry[] = [];
  private seq = 0;

  constructor(@Optional() @Inject(StateStore) store: StateStore | null = null) {
    const saved = store?.attach("audit", () => ({ seq: this.seq, entries: this.entries }));
    if (saved) {
      this.seq = saved.seq;
      this.entries = saved.entries;
    }
  }

  record(input: AuditInput): AuditEntry {
    this.seq += 1;
    const entry: AuditEntry = { id: `aud_${this.seq}`, at: new Date().toISOString(), ...input };
    this.entries.push(entry);
    // Juda eski yozuvlar (50 mingdan oshganda) — faylning cheksiz o'sishidan himoya.
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    return entry;
  }

  /** Eng yangisi yuqorida. */
  list(query: AuditQuery) {
    const term = (query.search ?? "").trim().toLowerCase();
    const rows = this.entries
      .filter(
        (e) =>
          (!query.entity || e.entity === query.entity) &&
          (!query.actorRole || e.actor.role === query.actorRole) &&
          (!term ||
            [e.actor.name, e.action, e.entityLabel, e.entityId, e.reason, e.before, e.after].some((v) =>
              v.toLowerCase().includes(term),
            )),
      )
      .reverse();
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(lastPage, Math.max(1, query.page ?? 1));
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  }
}
