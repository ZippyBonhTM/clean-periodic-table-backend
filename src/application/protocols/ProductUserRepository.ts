import type {
  AdminCursorPage,
  AdminUserAccountStatus,
  AdminUserRole,
  AdminUsersSort,
  ProductUserIdentity,
  ProductUserRecord,
} from "../../domain/Admin.js";

export type ProductUserListInput = {
  cursor?: string | null;
  limit: number;
  query?: string | null;
  role?: AdminUserRole | "all" | null;
  status?: AdminUserAccountStatus | "all" | null;
  sort: AdminUsersSort;
};

export type UpsertProductUserIdentityInput = {
  identity: ProductUserIdentity;
  defaultRole: AdminUserRole;
  forceAdmin: boolean;
  touchLastSeenAt?: Date | null;
};

export default interface ProductUserRepository {
  upsertIdentity(input: UpsertProductUserIdentityInput): Promise<ProductUserRecord>;
  findById(userId: string): Promise<ProductUserRecord | null>;
  save(user: ProductUserRecord): Promise<ProductUserRecord>;
  countActiveAdmins(): Promise<number>;
  list(input: ProductUserListInput): Promise<AdminCursorPage<ProductUserRecord>>;
}
