import request from "supertest";
import { describe, expect, it } from "vitest";

import type AuthIdentityResolver from "@/application/protocols/AuthIdentityResolver.js";
import type AuthTokenValidator from "@/application/protocols/AuthTokenValidator.js";
import ListAllElements from "@/application/usecases/ListAllElements.js";
import ManageAdminUsers from "@/application/usecases/ManageAdminUsers.js";
import ManageUserMolecules from "@/application/usecases/ManageUserMolecules.js";
import type { ProductUserIdentity } from "@/domain/Admin.js";
import type { AppEnv } from "@/config/env.js";
import { createExpressApp } from "@/http/createExpressApp.js";
import { createRequireAuthMiddleware } from "@/http/middlewares/requireAuth.js";
import InMemoryAdminAuditRepository from "@/infrastructure/repositories/InMemoryAdminAuditRepository.js";
import InMemoryElementRepository from "@/infrastructure/repositories/InMemoryElementRepository.js";
import InMemoryProductUserRepository from "@/infrastructure/repositories/InMemoryProductUserRepository.js";
import InMemoryUserMoleculeRepository from "@/infrastructure/repositories/InMemoryUserMoleculeRepository.js";

const appEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
  authRequired: true,
  authServiceUrl: "http://auth.internal",
  authInternalServiceToken: null,
  authValidatePath: "/validate-token",
  authProfilePath: "/profile",
  authRevokeUserSessionsPath: null,
  adminBootstrapUserIds: ["admin-1"],
};

type AdminTestContext = {
  app: ReturnType<typeof createExpressApp>;
  productUsers: InMemoryProductUserRepository;
  audits: InMemoryAdminAuditRepository;
};

function makeIdentityResolver(): AuthIdentityResolver {
  const byToken = new Map<string, ProductUserIdentity>([
    [
      "admin-token",
      {
        id: "admin-1",
        name: "Admin One",
        email: "admin@example.com",
      },
    ],
    [
      "user-token",
      {
        id: "user-1",
        name: "User One",
        email: "user@example.com",
      },
    ],
    [
      "user-two-token",
      {
        id: "user-2",
        name: "User Two",
        email: "user-two@example.com",
      },
    ],
  ]);

  return {
    async resolve(accessToken: string) {
      return byToken.get(accessToken) ?? null;
    },
  };
}

function makeAuthMiddleware() {
  const validator: AuthTokenValidator = {
    async validate(accessToken: string) {
      if (accessToken.trim().length === 0) {
        return null;
      }

      return {
        userId: accessToken,
      };
    },
  };

  return createRequireAuthMiddleware(validator);
}

function createAdminTestContext(): AdminTestContext {
  const productUsers = new InMemoryProductUserRepository();
  const audits = new InMemoryAdminAuditRepository();
  const manageAdminUsers = new ManageAdminUsers(
    productUsers,
    audits,
    makeIdentityResolver(),
    new Set(["admin-1"]),
    null,
  );
  const app = createExpressApp({
    appEnv,
    listAllElements: new ListAllElements(new InMemoryElementRepository()),
    manageAdminUsers,
    manageUserMolecules: new ManageUserMolecules(new InMemoryUserMoleculeRepository()),
    authMiddleware: makeAuthMiddleware(),
  });

  return {
    app,
    productUsers,
    audits,
  };
}

describe("admin routes", () => {
  it("bootstraps an admin session from product backend authority", async () => {
    const { app } = createAdminTestContext();

    const response = await request(app)
      .get("/api/v1/admin/session")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      user: {
        id: "admin-1",
        name: "Admin One",
        email: "admin@example.com",
        role: "ADMIN",
      },
    });
  });

  it("denies non-admin users even when they are authenticated", async () => {
    const { app } = createAdminTestContext();

    const response = await request(app)
      .get("/api/v1/admin/session")
      .set("Authorization", "Bearer user-token");

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      code: "ADMIN_FORBIDDEN",
      message: "Admin access denied.",
    });
  });

  it("lists known product users and exposes detail capabilities", async () => {
    const { app, productUsers } = createAdminTestContext();

    await productUsers.upsertIdentity({
      identity: {
        id: "user-1",
        name: "User One",
        email: "user@example.com",
      },
      defaultRole: "USER",
      forceAdmin: false,
      touchLastSeenAt: new Date("2026-03-22T19:00:00.000Z"),
    });

    const listResponse = await request(app)
      .get("/api/v1/admin/users?sort=created-desc")
      .set("Authorization", "Bearer admin-token");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(2);
    expect(listResponse.body.items[0]).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
    });

    const detailResponse = await request(app)
      .get("/api/v1/admin/users/user-1")
      .set("Authorization", "Bearer admin-token");

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toMatchObject({
      id: "user-1",
      email: "user@example.com",
      role: "USER",
      capabilities: {
        canChangeRole: true,
        canModerate: true,
        canRevokeSessions: false,
        isSelf: false,
      },
    });
  });

  it("changes user role and records an audit entry", async () => {
    const { app, productUsers } = createAdminTestContext();

    await productUsers.upsertIdentity({
      identity: {
        id: "user-1",
        name: "User One",
        email: "user@example.com",
      },
      defaultRole: "USER",
      forceAdmin: false,
      touchLastSeenAt: new Date("2026-03-22T19:00:00.000Z"),
    });

    const mutationResponse = await request(app)
      .post("/api/v1/admin/users/user-1/role")
      .set("Authorization", "Bearer admin-token")
      .send({
        role: "ADMIN",
        reason: "Promoting for content operations",
      });

    expect(mutationResponse.status).toBe(200);
    expect(mutationResponse.body).toMatchObject({
      user: {
        id: "user-1",
        role: "ADMIN",
      },
      auditEntryId: expect.any(String),
      message: "User role updated.",
    });

    const auditResponse = await request(app)
      .get("/api/v1/admin/audit")
      .set("Authorization", "Bearer admin-token");

    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.items[0]).toMatchObject({
      action: "role_change",
      actor: {
        email: "admin@example.com",
      },
      target: {
        email: "user@example.com",
      },
    });
  });

  it("returns 503 for session revocation until the auth service exposes that operation", async () => {
    const { app, productUsers } = createAdminTestContext();

    await productUsers.upsertIdentity({
      identity: {
        id: "user-2",
        name: "User Two",
        email: "user-two@example.com",
      },
      defaultRole: "USER",
      forceAdmin: false,
      touchLastSeenAt: new Date("2026-03-22T19:10:00.000Z"),
    });

    const response = await request(app)
      .post("/api/v1/admin/users/user-2/sessions/revoke")
      .set("Authorization", "Bearer admin-token")
      .send({
        reason: "Security rotation after staff review",
        mode: "all",
      });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({
      code: "ADMIN_DEPENDENCY_UNAVAILABLE",
    });
  });
});
