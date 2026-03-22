import type ProductUserRepository from "../../../application/protocols/ProductUserRepository.js";
import type {
  ProductUserListInput,
  UpsertProductUserIdentityInput,
} from "../../../application/protocols/ProductUserRepository.js";
import type { ProductUserRecord } from "../../../domain/Admin.js";
import ProductUserModel from "../models/ProductUserModel.js";
import type { ProductUserDocument } from "../models/ProductUserModel.js";
import { clampPageSize, decodeCursor, encodeCursor, escapeRegExp } from "../../repositories/adminCursor.js";

type StoredProductUserDocument = ProductUserDocument;
type FilterQuery<TDocument> = Record<string, unknown> & Partial<TDocument>;

function mapDocument(document: StoredProductUserDocument): ProductUserRecord {
  return {
    id: document.id,
    name: document.name,
    email: document.email,
    role: document.role,
    accountStatus: document.accountStatus,
    restriction: document.restriction === null ? null : {
      reason: document.restriction.reason,
      expiresAt: document.restriction.expiresAt === null ? null : new Date(document.restriction.expiresAt),
    },
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
    lastSeenAt: document.lastSeenAt === null ? null : new Date(document.lastSeenAt),
    lastSeenSortAt: new Date(document.lastSeenSortAt),
    lastAuditAt: document.lastAuditAt === null ? null : new Date(document.lastAuditAt),
  };
}

function buildBaseQuery(input: ProductUserListInput): FilterQuery<StoredProductUserDocument> {
  const query: FilterQuery<StoredProductUserDocument> = {};
  const normalizedQuery = input.query?.trim() ?? "";

  if (input.role !== undefined && input.role !== null && input.role !== "all") {
    query.role = input.role;
  }

  if (input.status !== undefined && input.status !== null && input.status !== "all") {
    query.accountStatus = input.status;
  }

  if (normalizedQuery.length > 0) {
    const regex = new RegExp(escapeRegExp(normalizedQuery), "i");
    query.$or = [
      { id: regex },
      { name: regex },
      { email: regex },
    ];
  }

  return query;
}

export default class MongoProductUserRepository implements ProductUserRepository {
  async upsertIdentity(input: UpsertProductUserIdentityInput): Promise<ProductUserRecord> {
    const existing = (await ProductUserModel.findOne({ id: input.identity.id }).lean().exec()) as StoredProductUserDocument | null;
    const now = new Date();

    if (existing === null) {
      const touchedAt = input.touchLastSeenAt ?? null;
      const created = await ProductUserModel.create({
        id: input.identity.id,
        name: input.identity.name,
        email: input.identity.email,
        role: input.forceAdmin ? "ADMIN" : input.defaultRole,
        accountStatus: "active",
        restriction: null,
        lastSeenAt: touchedAt,
        lastSeenSortAt: touchedAt ?? now,
        lastAuditAt: null,
      });

      const reloaded = (await ProductUserModel.findById(created._id).lean().exec()) as StoredProductUserDocument | null;

      if (reloaded === null) {
        throw new Error(`Created product user ${input.identity.id} could not be reloaded.`);
      }

      return mapDocument(reloaded);
    }

    const updated = (await ProductUserModel.findOneAndUpdate(
      { id: input.identity.id },
      {
        $set: {
          name: input.identity.name,
          email: input.identity.email,
          role: input.forceAdmin ? "ADMIN" : existing.role,
          updatedAt: now,
          ...(input.touchLastSeenAt !== undefined && input.touchLastSeenAt !== null
            ? {
                lastSeenAt: input.touchLastSeenAt,
                lastSeenSortAt: input.touchLastSeenAt,
              }
            : {}),
        },
      },
      { new: true, projection: { __v: 0 } },
    ).lean().exec()) as StoredProductUserDocument | null;

    if (updated === null) {
      throw new Error(`Product user ${input.identity.id} could not be updated.`);
    }

    return mapDocument(updated);
  }

  async findById(userId: string): Promise<ProductUserRecord | null> {
    const document = (await ProductUserModel.findOne({ id: userId }, { __v: 0 }).lean().exec()) as StoredProductUserDocument | null;
    return document === null ? null : mapDocument(document);
  }

  async save(user: ProductUserRecord): Promise<ProductUserRecord> {
    const updated = (await ProductUserModel.findOneAndUpdate(
      { id: user.id },
      {
        $set: {
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          restriction: user.restriction,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastSeenAt: user.lastSeenAt,
          lastSeenSortAt: user.lastSeenSortAt,
          lastAuditAt: user.lastAuditAt,
        },
      },
      { new: true, upsert: true, projection: { __v: 0 } },
    ).lean().exec()) as StoredProductUserDocument | null;

    if (updated === null) {
      throw new Error(`Product user ${user.id} could not be persisted.`);
    }

    return mapDocument(updated);
  }

  async countActiveAdmins(): Promise<number> {
    return await ProductUserModel.countDocuments({ role: "ADMIN", accountStatus: "active" }).exec();
  }

  async list(input: ProductUserListInput) {
    const limit = clampPageSize(input.limit);
    const query = buildBaseQuery(input);
    const cursor = decodeCursor(input.cursor);
    const sortField = input.sort.startsWith("last-seen") ? "lastSeenSortAt" : "createdAt";
    const direction = input.sort.endsWith("-asc") ? 1 : -1;

    if (cursor !== null) {
      const cursorDate = new Date(cursor.value);

      if (!Number.isNaN(cursorDate.getTime())) {
        const cursorQuery: FilterQuery<StoredProductUserDocument> = {
          $or: [
            { [sortField]: { [direction === 1 ? "$gt" : "$lt"]: cursorDate } },
            { [sortField]: cursorDate, id: { [direction === 1 ? "$gt" : "$lt"]: cursor.id } },
          ],
        };

        if (Object.keys(query).length > 0) {
          Object.assign(query, { $and: [buildBaseQuery(input), cursorQuery] });
          delete query.$or;
          delete query.role;
          delete query.accountStatus;
        } else {
          Object.assign(query, cursorQuery);
        }
      }
    }

    const documents = (await ProductUserModel.find(query, { __v: 0 })
      .sort({ [sortField]: direction, id: direction })
      .limit(limit + 1)
      .lean()
      .exec()) as StoredProductUserDocument[];

    const hasNextPage = documents.length > limit;
    const pageItems = hasNextPage ? documents.slice(0, limit) : documents;
    const lastItem = pageItems[pageItems.length - 1];

    return {
      items: pageItems.map((document) => mapDocument(document)),
      nextCursor:
        hasNextPage && lastItem !== undefined
          ? encodeCursor({ value: new Date(lastItem[sortField as keyof StoredProductUserDocument] as Date).toISOString(), id: lastItem.id })
          : null,
      prevCursor: null,
    };
  }
}
