import type AdminAuditRepository from "../protocols/AdminAuditRepository.js";
import type { ListAdminAuditInput } from "../protocols/AdminAuditRepository.js";
import type AuthIdentityResolver from "../protocols/AuthIdentityResolver.js";
import type ProductUserRepository from "../protocols/ProductUserRepository.js";
import type { ProductUserListInput } from "../protocols/ProductUserRepository.js";
import type UserSessionRevoker from "../protocols/UserSessionRevoker.js";
import type { RevokeUserSessionsInput } from "../protocols/UserSessionRevoker.js";
import {
  type AdminAuditAction,
  type AdminAuditRecord,
  type AdminCursorPage,
  type AdminUserAccountStatus,
  type AdminUserCapabilities,
  type AdminUserDetail,
  type AdminUserRole,
  type AdminUserSummary,
  type ProductUserIdentity,
  type ProductUserRecord,
} from "../../domain/Admin.js";
import { AppError } from "../../http/errors/AppError.js";

type MutationContext = {
  accessToken: string;
  ipAddress: string | null;
};

type ChangeUserRoleInput = MutationContext & {
  targetUserId: string;
  role: AdminUserRole;
  reason: string;
};

type ModerateUserInput = MutationContext & {
  targetUserId: string;
  status: AdminUserAccountStatus;
  reason: string;
  expiresAt: Date | null;
};

type RevokeSessionsInput = MutationContext & {
  targetUserId: string;
  reason: string;
  mode: "all" | "except-current";
};

type AdminUserRoleMutationResult = {
  user: AdminUserDetail;
  auditEntryId: string | null;
  message: string;
};

type AdminUserModerationMutationResult = {
  user: AdminUserDetail;
  auditEntryId: string | null;
  message: string;
};

type AdminUserSessionRevokeResult = {
  revokedSessionCount: number;
  auditEntryId: string | null;
  message: string;
};

function createForbiddenError(message = "Admin access denied."): AppError {
  return new AppError({
    statusCode: 403,
    code: "ADMIN_FORBIDDEN",
    message,
    publicMessage: message,
    layer: "application",
  });
}

function createUnavailableError(message: string): AppError {
  return new AppError({
    statusCode: 503,
    code: "ADMIN_DEPENDENCY_UNAVAILABLE",
    message,
    publicMessage: message,
    layer: "infrastructure",
  });
}

function createValidationError(message: string): AppError {
  return new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message,
    publicMessage: message,
    layer: "application",
  });
}

function assertNonEmptyValue(value: string, fieldName: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw createValidationError(`${fieldName} is required.`);
  }

  return trimmed;
}

function normalizeReason(value: string, fieldName: string): string {
  const normalized = assertNonEmptyValue(value, fieldName).replace(/\s+/g, " ");

  if (normalized.length < 8) {
    throw createValidationError(`${fieldName} must contain at least 8 characters.`);
  }

  return normalized;
}

function isRestrictionExpired(user: ProductUserRecord, now: Date): boolean {
  return (
    user.accountStatus === "restricted" &&
    user.restriction?.expiresAt instanceof Date &&
    user.restriction.expiresAt.getTime() <= now.getTime()
  );
}

function cloneRestriction(user: ProductUserRecord): ProductUserRecord["restriction"] {
  if (user.restriction === null) {
    return null;
  }

  return {
    reason: user.restriction.reason,
    expiresAt: user.restriction.expiresAt === null ? null : new Date(user.restriction.expiresAt),
  };
}

function toAdminUserSummary(user: ProductUserRecord): AdminUserSummary {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
    lastSeenAt: user.lastSeenAt === null ? null : new Date(user.lastSeenAt),
  };
}

function toAdminUserDetail(
  user: ProductUserRecord,
  capabilities: AdminUserCapabilities | null,
): AdminUserDetail {
  return {
    ...toAdminUserSummary(user),
    activeSessionCount: null,
    lastAuditAt: user.lastAuditAt === null ? null : new Date(user.lastAuditAt),
    restriction: cloneRestriction(user),
    capabilities,
  };
}

export default class ManageAdminUsers {
  constructor(
    private readonly productUserRepository: ProductUserRepository,
    private readonly adminAuditRepository: AdminAuditRepository,
    private readonly authIdentityResolver: AuthIdentityResolver,
    private readonly bootstrapAdminUserIds: Set<string>,
    private readonly userSessionRevoker: UserSessionRevoker | null = null,
  ) {}

  async getAdminSession(accessToken: string): Promise<{ user: ProductUserIdentity & { role: AdminUserRole } }> {
    const actor = await this.requireAdminActor(accessToken);

    return {
      user: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
    };
  }

  async listUsers(
    accessToken: string,
    input: ProductUserListInput,
  ): Promise<AdminCursorPage<AdminUserSummary>> {
    await this.requireAdminActor(accessToken);
    const page = await this.productUserRepository.list(input);

    return {
      items: page.items.map((user) => toAdminUserSummary(user)),
      nextCursor: page.nextCursor,
      prevCursor: page.prevCursor,
    };
  }

  async getUserDetail(accessToken: string, targetUserId: string): Promise<AdminUserDetail> {
    const actor = await this.requireAdminActor(accessToken);
    const targetUser = await this.requireTargetUser(targetUserId);
    const normalizedTarget = await this.normalizeUserStatus(targetUser);
    const capabilities = await this.buildCapabilities(actor, normalizedTarget);

    return toAdminUserDetail(normalizedTarget, capabilities);
  }

  async changeUserRole(input: ChangeUserRoleInput): Promise<AdminUserRoleMutationResult> {
    const actor = await this.requireAdminActor(input.accessToken);
    const targetUser = await this.requireTargetUser(input.targetUserId);
    const normalizedTarget = await this.normalizeUserStatus(targetUser);
    const reason = normalizeReason(input.reason, "reason");
    const capabilities = await this.buildCapabilities(actor, normalizedTarget);

    if (!capabilities.canChangeRole) {
      throw createForbiddenError("This user role cannot be changed by the current admin.");
    }

    if (normalizedTarget.role === input.role) {
      throw createValidationError("The user already has this role.");
    }

    const updatedUser = await this.productUserRepository.save({
      ...normalizedTarget,
      role: input.role,
      updatedAt: new Date(),
    });
    const auditEntry = await this.adminAuditRepository.append({
      action: "role_change",
      summary: `${actor.email} changed ${updatedUser.email} role to ${input.role}.`,
      actor: this.toActorSnapshot(actor),
      target: this.toTargetSnapshot(updatedUser),
      ipAddress: input.ipAddress,
    });
    const auditedUser = await this.productUserRepository.save({
      ...updatedUser,
      lastAuditAt: new Date(auditEntry.occurredAt),
      updatedAt: new Date(),
    });

    return {
      user: toAdminUserDetail(auditedUser, await this.buildCapabilities(actor, auditedUser)),
      auditEntryId: auditEntry.id,
      message: "User role updated.",
    };
  }

  async moderateUser(input: ModerateUserInput): Promise<AdminUserModerationMutationResult> {
    const actor = await this.requireAdminActor(input.accessToken);
    const targetUser = await this.requireTargetUser(input.targetUserId);
    const normalizedTarget = await this.normalizeUserStatus(targetUser);
    const reason = normalizeReason(input.reason, "reason");
    const capabilities = await this.buildCapabilities(actor, normalizedTarget);

    if (!capabilities.canModerate) {
      throw createForbiddenError("This user cannot be moderated by the current admin.");
    }

    if (input.status === "restricted" && input.expiresAt !== null && Number.isNaN(input.expiresAt.getTime())) {
      throw createValidationError("expiresAt must be a valid ISO date or null.");
    }

    const nextRestriction =
      input.status === "active"
        ? null
        : {
            reason,
            expiresAt: input.status === "restricted" ? input.expiresAt : null,
          };

    const updatedUser = await this.productUserRepository.save({
      ...normalizedTarget,
      accountStatus: input.status,
      restriction: nextRestriction,
      updatedAt: new Date(),
    });
    const auditEntry = await this.adminAuditRepository.append({
      action: "moderation",
      summary: `${actor.email} set ${updatedUser.email} status to ${input.status}.`,
      actor: this.toActorSnapshot(actor),
      target: this.toTargetSnapshot(updatedUser),
      ipAddress: input.ipAddress,
    });
    const auditedUser = await this.productUserRepository.save({
      ...updatedUser,
      lastAuditAt: new Date(auditEntry.occurredAt),
      updatedAt: new Date(),
    });

    return {
      user: toAdminUserDetail(auditedUser, await this.buildCapabilities(actor, auditedUser)),
      auditEntryId: auditEntry.id,
      message: "User moderation updated.",
    };
  }

  async revokeUserSessions(input: RevokeSessionsInput): Promise<AdminUserSessionRevokeResult> {
    const actor = await this.requireAdminActor(input.accessToken);
    const targetUser = await this.requireTargetUser(input.targetUserId);
    const normalizedTarget = await this.normalizeUserStatus(targetUser);
    const reason = normalizeReason(input.reason, "reason");
    const capabilities = await this.buildCapabilities(actor, normalizedTarget);

    if (!capabilities.canRevokeSessions) {
      throw createUnavailableError("User session revocation is not available yet.");
    }

    const revoker = this.userSessionRevoker;

    if (revoker === null) {
      throw createUnavailableError("User session revocation is not configured.");
    }

    const revokedSessionCount = await revoker.revoke({
      actorUserId: actor.id,
      targetUserId: normalizedTarget.id,
      reason,
      mode: input.mode,
      accessToken: input.accessToken,
    } satisfies RevokeUserSessionsInput);
    const auditEntry = await this.adminAuditRepository.append({
      action: "session_revoke",
      summary: `${actor.email} revoked sessions for ${normalizedTarget.email}.`,
      actor: this.toActorSnapshot(actor),
      target: this.toTargetSnapshot(normalizedTarget),
      ipAddress: input.ipAddress,
    });
    await this.productUserRepository.save({
      ...normalizedTarget,
      lastAuditAt: new Date(auditEntry.occurredAt),
      updatedAt: new Date(),
    });

    return {
      revokedSessionCount,
      auditEntryId: auditEntry.id,
      message: "User sessions revoked.",
    };
  }

  async listAudit(accessToken: string, input: ListAdminAuditInput): Promise<AdminCursorPage<AdminAuditRecord>> {
    await this.requireAdminActor(accessToken);
    return await this.adminAuditRepository.list(input);
  }

  private async resolveIdentity(accessToken: string): Promise<ProductUserIdentity> {
    const normalizedToken = assertNonEmptyValue(accessToken, "accessToken");
    const identity = await this.authIdentityResolver.resolve(normalizedToken);

    if (identity === null) {
      throw createUnavailableError("Could not resolve the current authenticated user profile.");
    }

    return identity;
  }

  private async syncActor(accessToken: string): Promise<ProductUserRecord> {
    const identity = await this.resolveIdentity(accessToken);

    return await this.productUserRepository.upsertIdentity({
      identity,
      defaultRole: "USER",
      forceAdmin: this.bootstrapAdminUserIds.has(identity.id),
      touchLastSeenAt: new Date(),
    });
  }

  private async requireAdminActor(accessToken: string): Promise<ProductUserRecord> {
    const actor = await this.normalizeUserStatus(await this.syncActor(accessToken));

    if (actor.accountStatus !== "active" || actor.role !== "ADMIN") {
      throw createForbiddenError();
    }

    return actor;
  }

  private async requireTargetUser(targetUserId: string): Promise<ProductUserRecord> {
    const normalizedUserId = assertNonEmptyValue(targetUserId, "userId");
    const targetUser = await this.productUserRepository.findById(normalizedUserId);

    if (targetUser === null) {
      throw new AppError({
        statusCode: 404,
        code: "ADMIN_USER_NOT_FOUND",
        message: `Product user ${normalizedUserId} was not found.`,
        publicMessage: "User not found.",
        layer: "application",
      });
    }

    return targetUser;
  }

  private async normalizeUserStatus(user: ProductUserRecord): Promise<ProductUserRecord> {
    const now = new Date();

    if (!isRestrictionExpired(user, now)) {
      return user;
    }

    return await this.productUserRepository.save({
      ...user,
      accountStatus: "active",
      restriction: null,
      updatedAt: now,
    });
  }

  private async buildCapabilities(
    actor: ProductUserRecord,
    target: ProductUserRecord,
  ): Promise<AdminUserCapabilities> {
    const activeAdminCount = await this.productUserRepository.countActiveAdmins();
    const isSelf = actor.id === target.id;
    const isBootstrapProtected = this.bootstrapAdminUserIds.has(target.id);
    const isLastAdminProtected =
      isBootstrapProtected ||
      (target.role === "ADMIN" && target.accountStatus === "active" && activeAdminCount <= 1);
    const canChangeRole = !isSelf && !isLastAdminProtected;
    const canModerate = !isSelf && !isLastAdminProtected;
    const canRevokeSessions =
      !isSelf && this.userSessionRevoker !== null && this.userSessionRevoker.isAvailable();

    return {
      canChangeRole,
      canModerate,
      canRevokeSessions,
      isSelf,
      isLastAdminProtected,
    };
  }

  private toActorSnapshot(actor: ProductUserRecord) {
    return {
      id: actor.id,
      name: actor.name,
      email: actor.email,
    };
  }

  private toTargetSnapshot(target: ProductUserRecord) {
    return {
      id: target.id,
      name: target.name,
      email: target.email,
    };
  }
}

export type {
  AdminUserModerationMutationResult,
  AdminUserRoleMutationResult,
  AdminUserSessionRevokeResult,
  ChangeUserRoleInput,
  ModerateUserInput,
  RevokeSessionsInput,
};
