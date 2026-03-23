import type AdminAuditRepository from "../../application/protocols/AdminAuditRepository.js";
import type {
  AppendAdminAuditInput,
  ListAdminAuditInput,
} from "../../application/protocols/AdminAuditRepository.js";
import type { AdminAuditRecord } from "../../domain/Admin.js";
import { clampPageSize, decodeCursor, encodeCursor, escapeRegExp } from "./adminCursor.js";

function cloneAuditEntry(entry: AdminAuditRecord): AdminAuditRecord {
  return structuredClone(entry);
}

export default class InMemoryAdminAuditRepository implements AdminAuditRepository {
  private readonly records = new Map<string, AdminAuditRecord>();

  private sequence = 0;

  async append(input: AppendAdminAuditInput): Promise<AdminAuditRecord> {
    this.sequence += 1;
    const record: AdminAuditRecord = {
      id: `audit-${String(this.sequence)}`,
      action: input.action,
      summary: input.summary,
      occurredAt: input.occurredAt ?? new Date(),
      actor: structuredClone(input.actor),
      target: input.target === null ? null : structuredClone(input.target),
      ipAddress: input.ipAddress,
    };

    this.records.set(record.id, record);
    return cloneAuditEntry(record);
  }

  async list(input: ListAdminAuditInput) {
    const limit = clampPageSize(input.limit);
    const query = input.query?.trim() ?? "";
    const regex = query.length > 0 ? new RegExp(escapeRegExp(query), "i") : null;
    const cursor = decodeCursor(input.cursor);

    const matching = [...this.records.values()]
      .filter((entry) => input.action === undefined || input.action === null || input.action === "all" ? true : entry.action === input.action)
      .filter((entry) => {
        if (regex === null) {
          return true;
        }

        return (
          regex.test(entry.summary) ||
          regex.test(entry.actor.id ?? "") ||
          regex.test(entry.actor.name ?? "") ||
          regex.test(entry.actor.email ?? "") ||
          regex.test(entry.target?.id ?? "") ||
          regex.test(entry.target?.name ?? "") ||
          regex.test(entry.target?.email ?? "")
        );
      })
      .sort((first, second) => {
        const timeDiff = second.occurredAt.getTime() - first.occurredAt.getTime();
        if (timeDiff !== 0) {
          return timeDiff;
        }

        return second.id.localeCompare(first.id);
      });

    const visible = cursor === null
      ? matching
      : matching.filter((entry) => {
          if (entry.occurredAt.toISOString() === cursor.value) {
            return entry.id.localeCompare(cursor.id) < 0;
          }

          return entry.occurredAt.toISOString().localeCompare(cursor.value) < 0;
        });

    const pageItems = visible.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = visible.length > limit && lastItem !== undefined
      ? encodeCursor({ value: lastItem.occurredAt.toISOString(), id: lastItem.id })
      : null;

    return {
      items: pageItems.map((entry) => cloneAuditEntry(entry)),
      nextCursor,
      prevCursor: null,
    };
  }
}
