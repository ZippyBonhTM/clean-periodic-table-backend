import { Router, type Request, type RequestHandler } from "express";

import type ManageAdminUsers from "../../application/usecases/ManageAdminUsers.js";
import type {
  AdminUserModerationMutationResult,
  AdminUserRoleMutationResult,
  AdminUserSessionRevokeResult,
} from "../../application/usecases/ManageAdminUsers.js";
import { AppError } from "../errors/AppError.js";

type CreateAdminRoutesInput = {
  manageAdminUsers: ManageAdminUsers;
  authMiddleware?: RequestHandler;
};

type AdminSessionResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "USER" | "ADMIN";
  };
};

function requireAuthenticationMiddleware(authMiddleware?: RequestHandler): RequestHandler[] {
  if (authMiddleware !== undefined) {
    return [authMiddleware];
  }

  return [(_request, response) => {
    response.status(503).json({ message: "Admin operations require authentication." });
  }];
}

function getAuthenticatedAccessToken(request: Request): string {
  const accessToken = request.auth?.accessToken;

  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    throw new AppError({
      statusCode: 500,
      code: "AUTH_CONTEXT_MISSING",
      message: "Authenticated access token was not attached to the request.",
      publicMessage: "Authentication context missing.",
      layer: "http",
    });
  }

  return accessToken;
}

function getUserIdParam(request: Request): string {
  const value = request.params.userId;

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ADMIN_INPUT",
      message: "userId route param is required.",
      publicMessage: "userId route param is required.",
      layer: "http",
    });
  }

  return value.trim();
}

function parseLimit(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 20;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ADMIN_INPUT",
      message: "limit must be an integer.",
      publicMessage: "limit must be an integer.",
      layer: "http",
    });
  }

  return parsed;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRole(value: unknown): "USER" | "ADMIN" | "all" | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  if (value === "USER" || value === "ADMIN" || value === "all") {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "role must be USER, ADMIN, or all.",
    publicMessage: "role must be USER, ADMIN, or all.",
    layer: "http",
  });
}

function parseAccountStatus(value: unknown): "active" | "restricted" | "suspended" | "all" | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  if (value === "active" || value === "restricted" || value === "suspended" || value === "all") {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "status must be active, restricted, suspended, or all.",
    publicMessage: "status must be active, restricted, suspended, or all.",
    layer: "http",
  });
}

function parseAccountVersion(value: unknown): "legacy" | "product-v1" | "all" | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  if (value === "legacy" || value === "product-v1" || value === "all") {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "version must be legacy, product-v1, or all.",
    publicMessage: "version must be legacy, product-v1, or all.",
    layer: "http",
  });
}

function parseUsersSort(
  value: unknown,
): "created-desc" | "created-asc" | "last-seen-desc" | "last-seen-asc" {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "created-desc";
  }

  if (
    value === "created-desc" ||
    value === "created-asc" ||
    value === "last-seen-desc" ||
    value === "last-seen-asc"
  ) {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "sort must be created-desc, created-asc, last-seen-desc, or last-seen-asc.",
    publicMessage: "sort is invalid.",
    layer: "http",
  });
}

function parseAuditAction(
  value: unknown,
): "role_change" | "moderation" | "session_revoke" | "access_check" | "all" | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  if (
    value === "role_change" ||
    value === "moderation" ||
    value === "session_revoke" ||
    value === "access_check" ||
    value === "all"
  ) {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "action filter is invalid.",
    publicMessage: "action filter is invalid.",
    layer: "http",
  });
}

function parseIpAddress(request: Request): string | null {
  const forwarded = request.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    return first.length > 0 ? first : null;
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0]?.trim() ?? "";
    return first.length > 0 ? first : null;
  }

  const remoteAddress = request.socket.remoteAddress?.trim() ?? "";
  return remoteAddress.length > 0 ? remoteAddress : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseBodyString(body: Record<string, unknown>, key: string): string {
  const value = body[key];

  if (typeof value !== "string") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ADMIN_INPUT",
      message: `${key} must be a string.`,
      publicMessage: `${key} must be a string.`,
      layer: "http",
    });
  }

  return value;
}

function parseBodyRole(body: Record<string, unknown>): "USER" | "ADMIN" {
  const value = parseBodyString(body, "role");

  if (value === "USER" || value === "ADMIN") {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "role must be USER or ADMIN.",
    publicMessage: "role must be USER or ADMIN.",
    layer: "http",
  });
}

function parseBodyStatus(body: Record<string, unknown>): "active" | "restricted" | "suspended" {
  const value = parseBodyString(body, "status");

  if (value === "active" || value === "restricted" || value === "suspended") {
    return value;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "status must be active, restricted, or suspended.",
    publicMessage: "status must be active, restricted, or suspended.",
    layer: "http",
  });
}

function parseMode(body: Record<string, unknown>): "all" | "except-current" {
  const rawValue = body.mode;

  if (rawValue === undefined || rawValue === null) {
    return "except-current";
  }

  if (rawValue === "all" || rawValue === "except-current") {
    return rawValue;
  }

  throw new AppError({
    statusCode: 400,
    code: "INVALID_ADMIN_INPUT",
    message: "mode must be all or except-current.",
    publicMessage: "mode must be all or except-current.",
    layer: "http",
  });
}

function parseExpiresAt(body: Record<string, unknown>): Date | null {
  const rawValue = body.expiresAt;

  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  if (typeof rawValue !== "string") {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ADMIN_INPUT",
      message: "expiresAt must be an ISO string or null.",
      publicMessage: "expiresAt must be an ISO string or null.",
      layer: "http",
    });
  }

  const parsed = new Date(rawValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError({
      statusCode: 400,
      code: "INVALID_ADMIN_INPUT",
      message: "expiresAt must be a valid ISO date.",
      publicMessage: "expiresAt must be a valid ISO date.",
      layer: "http",
    });
  }

  return parsed;
}

function toUserSummary(user: Awaited<ReturnType<ManageAdminUsers["listUsers"]>>["items"][number]) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}

function toUserDetail(user: Awaited<ReturnType<ManageAdminUsers["getUserDetail"]>>) {
  return {
    ...toUserSummary(user),
    activeSessionCount: user.activeSessionCount,
    lastAuditAt: user.lastAuditAt?.toISOString() ?? null,
    restriction:
      user.restriction === null
        ? null
        : {
            reason: user.restriction.reason,
            expiresAt: user.restriction.expiresAt?.toISOString() ?? null,
          },
  };
}

function toAuditEntry(entry: Awaited<ReturnType<ManageAdminUsers["listAudit"]>>["items"][number]) {
  return {
    ...entry,
    occurredAt: entry.occurredAt.toISOString(),
  };
}

function toRoleMutationResponse(result: AdminUserRoleMutationResult) {
  return {
    user: toUserDetail(result.user),
    auditEntryId: result.auditEntryId,
    message: result.message,
  };
}

function toModerationMutationResponse(result: AdminUserModerationMutationResult) {
  return {
    user: toUserDetail(result.user),
    auditEntryId: result.auditEntryId,
    message: result.message,
  };
}

function toSessionRevokeResponse(result: AdminUserSessionRevokeResult) {
  return {
    revokedSessionCount: result.revokedSessionCount,
    auditEntryId: result.auditEntryId,
    message: result.message,
  };
}

function createAdminRoutes({ manageAdminUsers, authMiddleware }: CreateAdminRoutesInput): Router {
  const router = Router();
  const authHandlers = requireAuthenticationMiddleware(authMiddleware);

  router.get("/api/v1/admin/session", ...authHandlers, async (request, response, next) => {
    try {
      const session = await manageAdminUsers.getAdminSession(getAuthenticatedAccessToken(request));
      response.status(200).json(session satisfies AdminSessionResponse);
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get("/api/v1/admin/users", ...authHandlers, async (request, response, next) => {
    try {
      const result = await manageAdminUsers.listUsers(getAuthenticatedAccessToken(request), {
        cursor: parseOptionalString(request.query.cursor),
        limit: parseLimit(request.query.limit),
        query: parseOptionalString(request.query.q),
        role: parseRole(request.query.role),
        version: parseAccountVersion(request.query.version),
        status: parseAccountStatus(request.query.status),
        sort: parseUsersSort(request.query.sort),
      });

      response.status(200).json({
        items: result.items.map((user) => toUserSummary(user)),
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get("/api/v1/admin/users/:userId", ...authHandlers, async (request, response, next) => {
    try {
      const result = await manageAdminUsers.getUserDetail(
        getAuthenticatedAccessToken(request),
        getUserIdParam(request),
      );

      response.status(200).json(toUserDetail(result));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post("/api/v1/admin/users/:userId/role", ...authHandlers, async (request, response, next) => {
    try {
      if (!isRecord(request.body)) {
        throw new AppError({
          statusCode: 400,
          code: "INVALID_ADMIN_INPUT",
          message: "Request body must be an object.",
          publicMessage: "Request body must be an object.",
          layer: "http",
        });
      }

      const result = await manageAdminUsers.changeUserRole({
        accessToken: getAuthenticatedAccessToken(request),
        targetUserId: getUserIdParam(request),
        role: parseBodyRole(request.body),
        reason: parseBodyString(request.body, "reason"),
        ipAddress: parseIpAddress(request),
      });

      response.status(200).json(toRoleMutationResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post("/api/v1/admin/users/:userId/moderation", ...authHandlers, async (request, response, next) => {
    try {
      if (!isRecord(request.body)) {
        throw new AppError({
          statusCode: 400,
          code: "INVALID_ADMIN_INPUT",
          message: "Request body must be an object.",
          publicMessage: "Request body must be an object.",
          layer: "http",
        });
      }

      const result = await manageAdminUsers.moderateUser({
        accessToken: getAuthenticatedAccessToken(request),
        targetUserId: getUserIdParam(request),
        status: parseBodyStatus(request.body),
        reason: parseBodyString(request.body, "reason"),
        expiresAt: parseExpiresAt(request.body),
        ipAddress: parseIpAddress(request),
      });

      response.status(200).json(toModerationMutationResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post("/api/v1/admin/users/:userId/sessions/revoke", ...authHandlers, async (request, response, next) => {
    try {
      if (!isRecord(request.body)) {
        throw new AppError({
          statusCode: 400,
          code: "INVALID_ADMIN_INPUT",
          message: "Request body must be an object.",
          publicMessage: "Request body must be an object.",
          layer: "http",
        });
      }

      const result = await manageAdminUsers.revokeUserSessions({
        accessToken: getAuthenticatedAccessToken(request),
        targetUserId: getUserIdParam(request),
        reason: parseBodyString(request.body, "reason"),
        mode: parseMode(request.body),
        ipAddress: parseIpAddress(request),
      });

      response.status(200).json(toSessionRevokeResponse(result));
    } catch (error: unknown) {
      next(error);
    }
  });

  router.get("/api/v1/admin/audit", ...authHandlers, async (request, response, next) => {
    try {
      const result = await manageAdminUsers.listAudit(getAuthenticatedAccessToken(request), {
        cursor: parseOptionalString(request.query.cursor),
        limit: parseLimit(request.query.limit),
        query: parseOptionalString(request.query.q),
        action: parseAuditAction(request.query.action),
      });

      response.status(200).json({
        items: result.items.map((entry) => toAuditEntry(entry)),
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}

export { createAdminRoutes };
export type { CreateAdminRoutesInput };
