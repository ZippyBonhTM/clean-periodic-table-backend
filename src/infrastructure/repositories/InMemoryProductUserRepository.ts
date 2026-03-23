import type ProductUserRepository from "../../application/protocols/ProductUserRepository.js";
import type {
  ProductUserListInput,
  UpsertProductUserIdentityInput,
} from "../../application/protocols/ProductUserRepository.js";
import type { ProductUserRecord } from "../../domain/Admin.js";
import { clampPageSize, decodeCursor, encodeCursor, escapeRegExp } from "./adminCursor.js";

function cloneUser(user: ProductUserRecord): ProductUserRecord {
  return structuredClone(user);
}

function getSortDate(user: ProductUserRecord, sort: ProductUserListInput["sort"]): Date {
  return sort.startsWith("last-seen") ? user.lastSeenSortAt : user.createdAt;
}

function compareUsers(first: ProductUserRecord, second: ProductUserRecord, sort: ProductUserListInput["sort"]): number {
  const direction = sort.endsWith("-asc") ? 1 : -1;
  const dateDiff = getSortDate(first, sort).getTime() - getSortDate(second, sort).getTime();

  if (dateDiff !== 0) {
    return dateDiff * direction;
  }

  return first.id.localeCompare(second.id) * direction;
}

export default class InMemoryProductUserRepository implements ProductUserRepository {
  private readonly records = new Map<string, ProductUserRecord>();

  async upsertIdentity(input: UpsertProductUserIdentityInput): Promise<ProductUserRecord> {
    const now = new Date();
    const existing = this.records.get(input.identity.id);

    if (existing === undefined) {
      const touchedAt = input.touchLastSeenAt ?? null;
      const created: ProductUserRecord = {
        id: input.identity.id,
        name: input.identity.name,
        email: input.identity.email,
        role: input.forceAdmin ? "ADMIN" : input.defaultRole,
        accountVersion: input.accountVersion ?? "legacy",
        accountStatus: "active",
        restriction: null,
        createdAt: now,
        updatedAt: now,
        lastSeenAt: touchedAt,
        lastSeenSortAt: touchedAt ?? now,
        lastAuditAt: null,
      };

      this.records.set(created.id, created);
      return cloneUser(created);
    }

    const updated: ProductUserRecord = {
      ...existing,
      name: input.identity.name,
      email: input.identity.email,
      role: input.forceAdmin ? "ADMIN" : existing.role,
      accountVersion: existing.accountVersion ?? input.accountVersion ?? "legacy",
      updatedAt: now,
      lastSeenAt: input.touchLastSeenAt ?? existing.lastSeenAt,
      lastSeenSortAt: input.touchLastSeenAt ?? existing.lastSeenSortAt,
    };

    this.records.set(updated.id, updated);
    return cloneUser(updated);
  }

  async findById(userId: string): Promise<ProductUserRecord | null> {
    const record = this.records.get(userId);
    return record === undefined ? null : cloneUser(record);
  }

  async save(user: ProductUserRecord): Promise<ProductUserRecord> {
    const nextUser = cloneUser(user);
    this.records.set(nextUser.id, nextUser);
    return cloneUser(nextUser);
  }

  async countActiveAdmins(): Promise<number> {
    return [...this.records.values()].filter((user) => user.role === "ADMIN" && user.accountStatus === "active").length;
  }

  async list(input: ProductUserListInput) {
    const limit = clampPageSize(input.limit);
    const query = input.query?.trim() ?? "";
    const regex = query.length > 0 ? new RegExp(escapeRegExp(query), "i") : null;
    const cursor = decodeCursor(input.cursor);

    const matching = [...this.records.values()]
      .filter((user) => input.role === undefined || input.role === null || input.role === "all" ? true : user.role === input.role)
      .filter((user) => input.version === undefined || input.version === null || input.version === "all" ? true : user.accountVersion === input.version)
      .filter((user) => input.status === undefined || input.status === null || input.status === "all" ? true : user.accountStatus === input.status)
      .filter((user) => {
        if (regex === null) {
          return true;
        }

        return regex.test(user.id) || regex.test(user.name) || regex.test(user.email);
      })
      .sort((first, second) => compareUsers(first, second, input.sort));

    const visible = cursor === null
      ? matching
      : matching.filter((user) => {
          const sortTime = getSortDate(user, input.sort).toISOString();
          const direction = input.sort.endsWith("-asc") ? 1 : -1;

          if (sortTime === cursor.value) {
            return user.id.localeCompare(cursor.id) * direction > 0;
          }

          return sortTime.localeCompare(cursor.value) * direction > 0;
        });

    const pageItems = visible.slice(0, limit);
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = visible.length > limit && lastItem !== undefined
      ? encodeCursor({ value: getSortDate(lastItem, input.sort).toISOString(), id: lastItem.id })
      : null;

    return {
      items: pageItems.map((user) => cloneUser(user)),
      nextCursor,
      prevCursor: null,
    };
  }
}
