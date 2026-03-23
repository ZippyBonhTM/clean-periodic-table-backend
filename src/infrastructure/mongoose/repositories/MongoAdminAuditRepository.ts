import type AdminAuditRepository from "../../../application/protocols/AdminAuditRepository.js";
import type {
  AppendAdminAuditInput,
  ListAdminAuditInput,
} from "../../../application/protocols/AdminAuditRepository.js";
import type { AdminAuditRecord } from "../../../domain/Admin.js";
import AdminAuditModel from "../models/AdminAuditModel.js";
import type { AdminAuditDocument } from "../models/AdminAuditModel.js";
import { clampPageSize, decodeCursor, encodeCursor, escapeRegExp } from "../../repositories/adminCursor.js";

type FilterQuery<TDocument> = Record<string, unknown> & Partial<TDocument>;

function mapDocument(document: AdminAuditDocument & { _id: { toString(): string } }): AdminAuditRecord {
  return {
    id: document._id.toString(),
    action: document.action,
    summary: document.summary,
    occurredAt: new Date(document.occurredAt),
    actor: structuredClone(document.actor),
    target: document.target === null ? null : structuredClone(document.target),
    ipAddress: document.ipAddress,
  };
}

export default class MongoAdminAuditRepository implements AdminAuditRepository {
  async append(input: AppendAdminAuditInput): Promise<AdminAuditRecord> {
    const created = await AdminAuditModel.create({
      action: input.action,
      summary: input.summary,
      occurredAt: input.occurredAt ?? new Date(),
      actor: input.actor,
      target: input.target,
      ipAddress: input.ipAddress,
    });

    const reloaded = (await AdminAuditModel.findById(created._id).lean().exec()) as (AdminAuditDocument & { _id: { toString(): string } }) | null;

    if (reloaded === null) {
      throw new Error("Created admin audit entry could not be reloaded.");
    }

    return mapDocument(reloaded);
  }

  async list(input: ListAdminAuditInput) {
    const limit = clampPageSize(input.limit);
    const query: FilterQuery<AdminAuditDocument> = {};
    const normalizedQuery = input.query?.trim() ?? "";
    const cursor = decodeCursor(input.cursor);

    if (input.action !== undefined && input.action !== null && input.action !== "all") {
      query.action = input.action;
    }

    if (normalizedQuery.length > 0) {
      const regex = new RegExp(escapeRegExp(normalizedQuery), "i");
      query.$or = [
        { summary: regex },
        { "actor.id": regex },
        { "actor.name": regex },
        { "actor.email": regex },
        { "target.id": regex },
        { "target.name": regex },
        { "target.email": regex },
      ];
    }

    if (cursor !== null) {
      const cursorDate = new Date(cursor.value);

      if (!Number.isNaN(cursorDate.getTime())) {
        const cursorQuery: FilterQuery<AdminAuditDocument> = {
          $or: [
            { occurredAt: { $lt: cursorDate } },
            { occurredAt: cursorDate, _id: { $lt: cursor.id } },
          ],
        };

        if (Object.keys(query).length > 0) {
          Object.assign(query, { $and: [{ ...query }, cursorQuery] });
          delete query.$or;
          delete query.action;
        } else {
          Object.assign(query, cursorQuery);
        }
      }
    }

    const documents = (await AdminAuditModel.find(query)
      .sort({ occurredAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec()) as Array<AdminAuditDocument & { _id: { toString(): string } }>;

    const hasNextPage = documents.length > limit;
    const pageItems = hasNextPage ? documents.slice(0, limit) : documents;
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((document) => mapDocument(document)),
      nextCursor:
        hasNextPage && lastItem !== undefined
          ? encodeCursor({ value: new Date(lastItem.occurredAt).toISOString(), id: lastItem._id.toString() })
          : null,
      prevCursor: null,
    };
  }
}
