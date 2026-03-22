export type AdminUserRole = "USER" | "ADMIN";

export type AdminUserAccountStatus = "active" | "restricted" | "suspended";

export type ProductUserIdentity = {
  id: string;
  name: string;
  email: string;
};

export type ProductUserRestriction = {
  reason: string | null;
  expiresAt: Date | null;
};

export type ProductUserRecord = ProductUserIdentity & {
  role: AdminUserRole;
  accountStatus: AdminUserAccountStatus;
  restriction: ProductUserRestriction | null;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date | null;
  lastSeenSortAt: Date;
  lastAuditAt: Date | null;
};

export type AdminUserCapabilities = {
  canChangeRole: boolean;
  canModerate: boolean;
  canRevokeSessions: boolean;
  isSelf: boolean;
  isLastAdminProtected: boolean;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  accountStatus: AdminUserAccountStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date | null;
};

export type AdminUserDetail = AdminUserSummary & {
  activeSessionCount: number | null;
  lastAuditAt: Date | null;
  restriction: ProductUserRestriction | null;
  capabilities: AdminUserCapabilities | null;
};

export type AdminAuditAction =
  | "role_change"
  | "moderation"
  | "session_revoke"
  | "access_check";

export type AdminAuditActor = {
  id: string | null;
  name: string | null;
  email: string | null;
};

export type AdminAuditTarget = {
  id: string | null;
  name: string | null;
  email: string | null;
};

export type AdminAuditRecord = {
  id: string;
  action: AdminAuditAction;
  summary: string;
  occurredAt: Date;
  actor: AdminAuditActor;
  target: AdminAuditTarget | null;
  ipAddress: string | null;
};

export type AdminCursorPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  prevCursor: string | null;
};

export type AdminUsersSort =
  | "created-desc"
  | "created-asc"
  | "last-seen-desc"
  | "last-seen-asc";
