import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import ListAllElements from "@/application/usecases/ListAllElements.js";
import type AuthTokenValidator from "@/application/protocols/AuthTokenValidator.js";
import type ElementRepository from "@/application/protocols/ElementRepository.js";
import ManageUserMolecules from "@/application/usecases/ManageUserMolecules.js";
import type { AppEnv } from "@/config/env.js";
import { createExpressApp } from "@/http/createExpressApp.js";
import { createRequireAuthMiddleware } from "@/http/middlewares/requireAuth.js";
import InMemoryUserMoleculeRepository from "@/infrastructure/repositories/InMemoryUserMoleculeRepository.js";
import { makeElement } from "../support/elementFixture.js";

const appEnv: AppEnv = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3333,
  mongoUri: null,
  dataSource: "memory",
  authRequired: false,
  authServiceUrl: null,
  authValidatePath: "/validate-token",
  authProfilePath: "/profile",
  authRevokeUserSessionsPath: null,
  adminBootstrapUserIds: [],
};

function makeListAllElements(repository: ElementRepository): ListAllElements {
  return new ListAllElements(repository);
}

function makeManageUserMolecules(): ManageUserMolecules {
  return new ManageUserMolecules(new InMemoryUserMoleculeRepository());
}

describe("Express endpoints", () => {
  it("normalizes CORS origins configured with trailing slash", async () => {
    const previousCorsOrigins = process.env.CORS_ORIGINS;
    try {
      process.env.CORS_ORIGINS = "https://frontend.example.com/";

      const app = createExpressApp({
        appEnv,
        listAllElements: makeListAllElements({
          getAllElements: vi.fn().mockResolvedValue([]),
        }),
        manageUserMolecules: makeManageUserMolecules(),
      });

      const response = await request(app)
        .options("/elements")
        .set("Origin", "https://frontend.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://frontend.example.com",
      );
    } finally {
      if (previousCorsOrigins === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = previousCorsOrigins;
      }
    }
  });

  it("GET /health returns runtime status", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
    });

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      env: "test",
      dataSource: "memory",
    });
  });

  it("GET /elements returns all mapped element fields", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi
          .fn()
          .mockResolvedValue([
            makeElement({ symbol: "H", name: "Hydrogen" }),
            makeElement({ symbol: "He", name: "Helium" }),
          ]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      symbol: "H",
      name: "Hydrogen",
      image: expect.objectContaining({
        title: expect.any(String),
      }),
      cpk_hex: expect.any(String),
    });
  });

  it("GET /elements returns sanitized error payload in production", async () => {
    const app = createExpressApp({
      appEnv: {
        ...appEnv,
        nodeEnv: "production",
      },
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockRejectedValue(new Error("repository failed")),
      }),
      manageUserMolecules: makeManageUserMolecules(),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        statusCode: 500,
        code: "LIST_ELEMENTS_FAILED",
        message: "Internal error while listing elements.",
      },
    });
  });

  it("GET /elements returns sanitized + detailed error payload in development", async () => {
    const app = createExpressApp({
      appEnv: {
        ...appEnv,
        nodeEnv: "development",
      },
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockRejectedValue(new Error("repository failed")),
      }),
      manageUserMolecules: makeManageUserMolecules(),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      statusCode: 500,
      code: "LIST_ELEMENTS_FAILED",
      message: "Internal error while listing elements.",
    });
    expect(response.body.development).toMatchObject({
      message: "repository failed",
      layer: "application",
      name: "Error",
      stack: expect.any(String),
    });
  });

  it("returns structured 404 for unknown route", async () => {
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
    });

    const response = await request(app).get("/unknown");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        statusCode: 404,
        code: "ROUTE_NOT_FOUND",
        message: "Not found",
      },
    });
  });
});

describe("Express auth integration", () => {
  it("keeps GET /elements public even when auth middleware exists", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app).get("/elements");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ symbol: "H" });
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it("does not validate token for GET /elements even when Authorization is present", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue({ userId: "user-1" }),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app)
      .get("/elements")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ symbol: "H" });
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it("still protects molecule routes when token is missing", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockResolvedValue(null),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app).get("/molecules");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized." });
  });

  it("still surfaces auth dependency for molecule routes when auth service is unavailable", async () => {
    const validator: AuthTokenValidator = {
      validate: vi.fn().mockRejectedValue(new Error("auth unavailable")),
    };
    const app = createExpressApp({
      appEnv,
      listAllElements: makeListAllElements({
        getAllElements: vi.fn().mockResolvedValue([makeElement({ symbol: "H" })]),
      }),
      manageUserMolecules: makeManageUserMolecules(),
      authMiddleware: createRequireAuthMiddleware(validator),
    });

    const response = await request(app)
      .get("/molecules")
      .set("Authorization", "Bearer any-token");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ message: "Authentication service unavailable." });
  });
});
